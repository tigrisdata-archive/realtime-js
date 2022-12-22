import {
  toConnectedEvent,
  toMessageEvent,
  createMessageEvent,
  toRealTimeMessage,
  createHeartbeatEvent,
  createDisconnectEvent,
  Encoding,
} from "./messages";
import { EventEmitter } from "node:events";
import * as proto from "../proto/server/v1/realtime";
import { ErrorEvent } from "ws";

type MessageEventListener = (MessageEvent: proto.MessageEvent) => void;

export type Newable<T> = { new (...args: any[]): T };

interface TransportConfig {
  heartbeatTimeout: number;
  WebSocket: Newable<WebSocket>;
}

interface Session {
  sessionId: string;
  socketId: string;
}

type ConnectionState =
  | "failed"
  | "connecting"
  | "connected"
  | "uninitialized"
  | "closing"
  | "closed";

export class Transport extends EventEmitter {
  private channelListeners: Map<string, MessageEventListener[]>;
  private ws: WebSocket;
  private session?: Session;
  private _isConnected: Promise<void>;
  private _connectionState: ConnectionState = "uninitialized";
  private heartbeatId: number | NodeJS.Timeout;
  private config: TransportConfig;
  private connectionResolved: (value: void | PromiseLike<void>) => void;
  private encoding: Encoding;

  constructor(config: TransportConfig) {
    super();

    this.config = config;
    this.channelListeners = new Map();
    this.heartbeatId = 0;
    this.encoding = Encoding.json;

    // Default initialisation to keep typescript happy
    this.connectionResolved = () => {};
    this._isConnected = new Promise<void>((resolve) => {
      this.connectionResolved = resolve;
    });

    this.establishConnection();
  }

  establishConnection() {
    let params = "user-agent=FIX_ME&protocol=1";
    if (this.session?.sessionId) {
      params += `&sessionId=${this.session.sessionId}&`;
    }

    this.ws = new this.config.WebSocket(`ws://127.0.0.1:9000?${params}`);
    this._connectionState = "connecting";

    this.ws.onopen = () => this.restartHeartbeat();
    // @ts-ignore
    this.ws.onerror = (err) => this.onError(err.message);
    this.ws.onclose = (_event) => this.onClose();
    this.ws.onmessage = (msg: MessageEvent<string>) => this.onMessage(msg.data);
  }

  onClose() {
    clearTimeout(this.heartbeatId);
    if (this._connectionState === "closing") {
      this._connectionState = "closed";
      return;
    }

    this.establishConnection();
  }

  onError(err: string) {
    console.error(err);
  }

  onMessage(data: string) {
    const msg = toRealTimeMessage(data);

    switch (msg.eventType) {
      case proto.EventType.connected:
        this.session = toConnectedEvent(this.encoding, msg.event);
        this.connectionResolved();

        this._connectionState = "connected";

        console.log("connected with", this.session);
        return;

      case proto.EventType.heartbeat:
        console.log("heartbeat received");
        return;

      case proto.EventType.message:
        let channelMsg = toMessageEvent(this.encoding, msg.event);
        this.handleChannelMessage(channelMsg);
        return;
      default:
        throw new Error(`unknown message type ${msg.eventType}`);
    }
  }

  restartHeartbeat() {
    clearTimeout(this.heartbeatId);
    this.heartbeatId = setTimeout(
      () => this.sendHeartbeat(),
      this.config.heartbeatTimeout
    );
  }

  send(msg: Uint8Array | string) {
    this.ws.send(msg);
  }

  sendHeartbeat() {
    this.restartHeartbeat();
    this.ws.send(createHeartbeatEvent(this.encoding));
  }

  sendDisconnect() {
    this.restartHeartbeat();
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

  isConnected(): Promise<void> {
    return this._isConnected;
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

  async publish(channel: string, name: string, message: string) {
    const msg = createMessageEvent(this.encoding, channel, name, message);
    this.send(msg);
  }

  // Returns the connection session socket id
  socketId(): string | undefined {
    return this.session?.sessionId;
  }

  close() {
    this.sendDisconnect();
    this._connectionState = "closing";
    clearTimeout(this.heartbeatId);
    this.ws.close();
  }
}
