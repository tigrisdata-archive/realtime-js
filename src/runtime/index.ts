import { Platform } from "./platform";
import { EventEmitter } from "eventemitter3";
import {
  Transport,
  ConnectionEvent,
  ConnectionEventFn,
  ConnectionErrorFn,
} from "./transport";
import Logger, { LogLevel } from "./logger";
import { Channel, ChannelManager } from "./channel";
import { Encoding } from "./messages";

export { Channel } from "./channel";
export { Encoding } from "./messages";

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
  encoding?: Encoding;
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
        encoding: Encoding.msgpack,
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
      encoding: this._config.encoding,
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
