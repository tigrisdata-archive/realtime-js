import platform, { Platform } from "./platform";
import { EventEmitter } from "node:events";
import {
  Transport,
  ConnectionEvent,
  ConnectError,
  ConnectionEventFn,
  ConnectionErrorFn,
} from "./transport";
import { MessageEvent } from "../proto/server/v1/realtime";
import Logger, { LogLevel } from "./logger";

type SubscribeCallback = (string) => void;

export interface RealTimeConfigInternal {
  /*
   * An id used to identify this client when using the presence feature.
   * If the client id is not set, an error will be thrown when using any presence features
   */
  clientId?: string;
  platform: Platform;
  url: string;
  project: string;
  loglevel?: LogLevel;
  autoconnect?: boolean;
}

export type RealTimeConfig = Omit<RealTimeConfigInternal, "platform">;

export class RealTime {
  private _config: RealTimeConfig;
  private channelManager: ChannelManager;
  private transport: Transport;
  private logger: Logger;
  constructor(config: RealTimeConfigInternal) {
    this._config = Object.assign(
      {
        autoconnect: true,
        loglevel: LogLevel.error,
      },
      config
    );

    this.logger = new Logger(config.loglevel);
    this.transport = new Transport({
      WebSocket: config.platform.WebSocket,
      heartbeatTimeout: 1000,
      url: `${config.url}/v1/projects/${config.project}/realtime`,
      logger: this.logger,
      autoconnect: this._config.autoconnect,
    });

    this.channelManager = new ChannelManager(this.transport, this.logger);

    this._config = config;
  }

  connect() {
    if (!this._config.autoconnect) {
      this.transport.establishConnection();
    }

    return this.once("connected");
  }

  getChannel(name: string): Channel {
    return this.channelManager.getOrCreate(name);
  }

  on(event: "error", listener: ConnectionErrorFn): this;
  on(event: ConnectionEvent, listener: ConnectionEventFn): this;
  on(
    event: ConnectionEvent | "error",
    listener: ConnectionEventFn | ConnectionErrorFn
  ): this {
    if (event === "error") {
      this.transport.on("error", listener as ConnectionErrorFn);
    } else {
      this.transport.on(event, listener as ConnectionEventFn);
    }
    return this;
  }

  off(event: ConnectionEvent, listener: () => void) {
    this.transport.off(event, listener);
    return this;
  }

  once(event: ConnectionEvent): Promise<void> {
    return new Promise((resolve) => {
      this.transport.once(event, () => resolve());
    });
  }

  close() {
    this.channelManager.close();
    this.transport.close();
  }

  socketId() {
    return this.transport.socketId();
  }
}

class Presence extends EventEmitter {
  constructor() {
    super();
  }
}

export class Channel extends EventEmitter {
  private name: string;
  private hasAttached: boolean;
  private hasSubscribed: boolean;
  private transport: Transport;
  private position = "0";
  private logger: Logger;

  constructor(name: string, transport: Transport, logger: Logger) {
    super();
    this.hasAttached = false;
    this.name = name;
    this.transport = transport;
    this.logger = logger;
  }

  subscribe(msgName: string, cb: SubscribeCallback) {
    if (!this.hasAttached) {
      this.attach();
    }

    this.on(msgName, cb);

    if (!this.hasSubscribed) {
      this.transport.subscribe(this.name, msgName, this.position);
      this.hasSubscribed = true;
    }
  }

  unsubscribe(msgName: string, cb: SubscribeCallback) {
    this.off(msgName, cb);

    this.maybeSendUnsubscribe();
  }

  unsubscribeAll(msgName: string) {
    this.removeAllListeners(msgName);
    this.maybeSendUnsubscribe();
  }

  private maybeSendUnsubscribe() {
    console.log(this.eventNames().length);
    if (this.eventNames().length === 0) {
      this.hasSubscribed = false;
      this.transport.unsubscribe(this.name);
    }
  }

  attach() {
    if (this.hasAttached) {
      return;
    }
    this.transport.attach(this.name);
    this.transport.listen(this.name, (msg: MessageEvent) => this.notify(msg));
    this.hasAttached = true;
  }

  detach() {
    if (this.hasAttached) {
      this.hasAttached = false;
      this.transport.detach(this.name);
    }
  }

  async publish(msgName: string, data: string) {
    await this.transport.publish(this.name, msgName, data);
  }

  notify(msg: MessageEvent) {
    this.logger.debug("emitting message", msg);
    this.emit(msg.name, msg.data);
  }
}

class ChannelManager {
  channels: Map<string, Channel>;
  transport: Transport;
  logger: Logger;

  constructor(transport: Transport, logger: Logger) {
    this.channels = new Map<string, Channel>();
    this.transport = transport;
    this.logger = logger;
  }

  getOrCreate(name): Channel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new Channel(name, this.transport, this.logger));
    }

    return this.channels.get(name) as Channel;
  }

  close() {
    this.channels.forEach((channel) => channel.detach());
    this.channels.clear();
  }
}
