/**
 * Copyright 2023 Tigris Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from "eventemitter3";
import { Transport } from "./transport";
import { MessageEvent } from "../proto/server/v1/realtime";
import Logger from "./logger";

type SubscribeCallback = (string) => void;

export class Channel extends EventEmitter {
  private name: string;
  private hasAttached: boolean = false;
  private hasSubscribed: boolean = false;
  private transport: Transport;
  private position = "0";
  private logger: Logger;

  constructor(name: string, transport: Transport, logger: Logger) {
    super();
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
      this.transport.listen(this.name, (msg: MessageEvent) => this.notify(msg));
      this.transport.subscribe(this.name, msgName, this.position);
      this.hasSubscribed = true;
    }
  }

  unsubscribe(msgName: string, cb: SubscribeCallback) {
    this.off(msgName, cb);

    this.maybeSendUnsubscribe();
  }

  unsubscribeAll() {
    this.eventNames().forEach((event) => this.removeAllListeners(event));
    this.maybeSendUnsubscribe();
  }

  unsubscribeAllFrom(msgName: string) {
    this.removeAllListeners(msgName);
    this.maybeSendUnsubscribe();
  }

  private maybeSendUnsubscribe() {
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
    this.hasAttached = true;
  }

  detach() {
    if (this.hasAttached) {
      this.hasAttached = false;
      this.transport.detach(this.name);
    }
  }

  async publish(msgName: string, data: any) {
    await this.transport.publish(this.name, msgName, data);
  }

  notify(msg: MessageEvent) {
    this.logger.debug("emitting message", msg);
    this.position = msg.id;
    this.emit(msg.name, msg.data);
  }
}

export class ChannelManager {
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
