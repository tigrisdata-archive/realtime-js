import {
  toConnectedEvent,
  toMessageEvent,
  toErrorEvent,
  createMessageEvent,
  toRealTimeMessage,
  createHeartbeatEvent,
  createDisconnectEvent,
  Encoding,
  createAttachEvent,
  createSubscribeEvent,
  createDetachEvent,
  createUnsubscribeEvent,
} from "./messages";
import { EventEmitter } from "node:events";
import * as proto from "../proto/server/v1/realtime";
import Logger from "./logger";

type MessageEventListener = (MessageEvent: proto.MessageEvent) => void;

export type Newable<T> = { new (...args: any[]): T };

interface TransportConfig {
  heartbeatTimeout: number;
  WebSocket: Newable<WebSocket>;
  url: string;
  logger: Logger;
  autoconnect: boolean;
}

interface Session {
  sessionId: string;
  socketId: string;
}

type ConnectionState =
  | "failed"
  | "connecting"
  | "connected"
  | "error"
  | "uninitialized"
  | "closing"
  | "closed";

export type ConnectError = proto.ErrorEvent;

export declare interface Transport {
  on(event: "error", listener: (error: ConnectError) => void): this;
  on(event: ConnectionEvent, listener: () => void): this;
}

export type ConnectionEventFn = () => void;
export type ConnectionErrorFn = (error: ConnectError) => void;

export type ConnectionEvent =
  | "failed"
  | "connecting"
  | "connected"
  | "closing"
  | "closed";

export type Connection = Pick<Transport, "on" | "off" | "once">;

export class Transport extends EventEmitter {
  private channelListeners: Map<string, MessageEventListener[]>;
  private ws: WebSocket;
  private session?: Session;
  private _connectionState: ConnectionState = "uninitialized";
  private heartbeatId: number | NodeJS.Timeout = 0;
  private config: TransportConfig;
  private encoding: Encoding;

  private maxRetries = 10;
  private connectionRetries = 0;
  private logger: Logger;
  private reconnectId: number | NodeJS.Timeout = 0;

  constructor(config: TransportConfig) {
    super();

    this.config = config;
    this.logger = config.logger;
    this.channelListeners = new Map();
    this.encoding = Encoding.msgpack;

    if (config.autoconnect) {
      this.establishConnection();
    }
  }

  setConnectionState(newState: ConnectionState, error?: ConnectError) {
    this.logger.debug(
      `state changed from ${this._connectionState} to ${newState}`
    );
    this._connectionState = newState;

    if (newState === "error") {
      this.emit("error", error);
    } else {
      this.emit(newState as ConnectionEvent);
    }
  }

  establishConnection() {
    let params = `user-agent=FIX_ME&protocol=1&msg-encoding=${this.encoding}`;
    if (this.session?.sessionId) {
      params += `&sessionId=${this.session.sessionId}&`;
    }

    this.logger.info("connecting to ", this.config.url);
    this.ws = new this.config.WebSocket(`${this.config.url}?${params}`);
    this.ws.binaryType = "arraybuffer";
    this.setConnectionState("connecting");

    // this.ws.onopen = () => this.restartHeartbeat();
    // @ts-ignore
    this.ws.onerror = (err) => this.onError(err.message);
    this.ws.onclose = (_event) => this.onClose();
    this.ws.onmessage = (msg: MessageEvent<Uint8Array>) =>
      this.onMessage(msg.data);
  }

  onClose() {
    this.clearHearbeat();
    if (this._connectionState === "closing") {
      this.setConnectionState("closed");
      return;
    }

    this.connectionRetries += 1;

    if (this.connectionRetries <= this.maxRetries) {
      this.logger.info("reconnecting to server");
      this.reconnectId = setTimeout(
        () => this.establishConnection(),
        // Exponential backoff taken from https://bpaulino.com/entries/retrying-api-calls-with-exponential-backoff
        // (2 ** 1) * 100 = 200 ms
        // (2 ** 2) * 100 = 400 ms
        // (2 ** 3) * 100 = 800 ms
        2 ** this.connectionRetries * 100
      );
    } else {
      this.emit("failed");
      this._connectionState = "failed";
    }
  }

  onError(err: string) {
    this.logger.error(err);
    this._connectionState = "error";
    this.emit("error", { code: null, message: err });
  }

  onMessage(data: Uint8Array) {
    const msg = toRealTimeMessage(this.encoding, data);

    this.logger.debug("message recieved", msg.eventType);

    switch (msg.eventType) {
      case proto.EventType.ack:
        return;
      case proto.EventType.connected:
        this.session = toConnectedEvent(this.encoding, msg.event);
        this.setConnectionState("connected");
        this.connectionRetries = 0;
        this.restartHeartbeat();
        return;
      case proto.EventType.heartbeat:
        return;
      case proto.EventType.message:
        let channelMsg = toMessageEvent(this.encoding, msg.event);
        this.handleChannelMessage(channelMsg);
        return;
      case proto.EventType.error:
        let error = toErrorEvent(this.encoding, msg.event);
        this.emit("error", error);
        this.logger.error("recieved ", error);
        return;
      default:
        throw new Error(`unknown message type ${msg.eventType}`);
    }
  }

  clearHearbeat() {
    clearTimeout(this.heartbeatId);
  }
  restartHeartbeat() {
    this.clearHearbeat();
    this.heartbeatId = setTimeout(
      () => this.sendHeartbeat(),
      this.config.heartbeatTimeout
    );
  }

  send(msg: string | Uint8Array) {
    this.restartHeartbeat();
    this.ws.send(msg);
  }

  sendHeartbeat() {
    this.logger.debug("sending heartbeat");
    this.restartHeartbeat();
    this.ws.send(createHeartbeatEvent(this.encoding));
  }

  sendDisconnect() {
    this.logger.debug("sending disconnect");
    this.ws.send(createDisconnectEvent(this.encoding));
  }

  connectionState(): ConnectionState {
    return this._connectionState;
  }

  handleChannelMessage(msg: proto.MessageEvent) {
    const listeners = this.channelListeners.get(msg.channel);

    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => listener(msg));
  }

  listen(channelName: string, listener: MessageEventListener) {
    if (!this.channelListeners.has(channelName)) {
      this.channelListeners.set(channelName, []);
    }

    const channelListeners = this.channelListeners.get(channelName);

    if (!channelListeners) {
      return;
    }

    channelListeners.push(listener);
  }

  attach(channelName: string) {
    this.logger.debug("sending attach from ", channelName);
    this.ws.send(createAttachEvent(this.encoding, channelName));
  }

  detach(channelName: string) {
    this.logger.debug("sending detach");
    this.ws.send(createDetachEvent(this.encoding, channelName));
  }

  subscribe(channelName: string, name: string, position: string) {
    this.logger.debug("sending subscribe", channelName);
    this.ws.send(
      createSubscribeEvent(this.encoding, channelName, name, position)
    );
  }

  unsubscribe(channelName: string) {
    this.logger.debug("sending unsubscribe", channelName);
    this.ws.send(createUnsubscribeEvent(this.encoding, channelName));
  }

  async publish(channel: string, name: string, message: string) {
    this.logger.debug("publish msg", channel, name, message);
    const msg = createMessageEvent(this.encoding, channel, name, message);
    this.send(msg);
  }

  // Returns the connection session socket id
  socketId(): string | undefined {
    return this.session?.sessionId;
  }

  close() {
    this.logger.info("transport closing");
    this.sendDisconnect();
    this.setConnectionState("closing");
    this.clearHearbeat();
    clearTimeout(this.reconnectId);
    this.ws.close();
  }
}
