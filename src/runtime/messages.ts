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

import * as proto from "../proto/server/v1/realtime";
import {
  encode as encodeMsgPack,
  decode as decodeMsgPack,
} from "@msgpack/msgpack";
import { jsonFromBase64 } from "./utils";

export enum Encoding {
  msgpack,
  json,
}

export function toConnectedEvent(
  encoding: Encoding,
  event: Uint8Array
): proto.ConnectedEvent {
  return decodeMsg(encoding, event);
}

export function toMessageEvent(
  encoding: Encoding,
  event: Uint8Array
): proto.MessageEvent {
  let msgEvent = decodeMsg(encoding, event) as proto.MessageEvent;

  let data = msgEvent.data;

  if (encoding === Encoding.json) {
    // []bytes are encoded as base64 strings for json
    data = jsonFromBase64(msgEvent.data as unknown as string);
  } else {
    data = decodeMsg(Encoding.msgpack, msgEvent.data);
  }

  return {
    ...msgEvent,
    data,
  };
}

export function toErrorEvent(
  encoding: Encoding,
  event: Uint8Array
): proto.ErrorEvent {
  return decodeMsg(encoding, event);
}

export function createMessageEvent(
  encoding: Encoding,
  channel: string,
  name: string,
  message: any
) {
  //@ts-ignore
  const msg: proto.MessageEvent = {
    channel,
    name,
    data: encodeMsg(encoding, message) as Uint8Array,
  };

  return createRTMessage(
    encoding,
    proto.EventType.message,
    encodeMsg(encoding, msg)
  );
}

export function createHeartbeatEvent(encoding: Encoding) {
  // @ts-ignore
  return createRTMessage(
    encoding,
    proto.EventType.heartbeat,
    encodeMsg(encoding, {})
  );
}

export function createDisconnectEvent(encoding: Encoding) {
  const disconnect: proto.DisconnectEvent = {
    channel: "",
  };

  return createRTMessage(
    encoding,
    proto.EventType.disconnect,
    encodeMsg(encoding, disconnect)
  );
}

export function createAttachEvent(encoding: Encoding, channel: string) {
  const attach: proto.AttachEvent = {
    channel,
  };

  return createRTMessage(
    encoding,
    proto.EventType.attach,
    encodeMsg(encoding, attach)
  );
}

export function createDetachEvent(encoding: Encoding, channel: string) {
  const detach: proto.DetachEvent = {
    channel,
  };

  return createRTMessage(
    encoding,
    proto.EventType.detach,
    encodeMsg(encoding, detach)
  );
}

export function createUnsubscribeEvent(encoding: Encoding, channel: string) {
  const unsubscribe: proto.UnsubscribeEvent = {
    channel,
  };

  return createRTMessage(
    encoding,
    proto.EventType.unsubscribe,
    encodeMsg(encoding, unsubscribe)
  );
}

export function createSubscribeEvent(
  encoding: Encoding,
  channel: string,
  name: string,
  position: string
) {
  const subscribe: proto.SubscribeEvent = {
    channel,
    name,
    position,
  };

  return createRTMessage(
    encoding,
    proto.EventType.subscribe,
    encodeMsg(encoding, subscribe)
  );
}

export function createRTMessage(
  encoding: Encoding,
  event_type: proto.EventType,
  event: string | Uint8Array
): Uint8Array | string {
  const rt = {
    event_type,
    event,
  } as proto.RealTimeMessage;

  return encodeMsg(encoding, rt, encoding === Encoding.json);
}

export function toRealTimeMessage(
  encoding: Encoding,
  data: string | ArrayLike<number>
): proto.RealTimeMessage {
  return decodeMsg(encoding, data) as proto.RealTimeMessage;
}

function decodeMsg(encoding: Encoding, data: string | ArrayLike<number>): any {
  switch (encoding) {
    case Encoding.json:
      if (typeof data === "string") {
        return JSON.parse(data as string);
      }
      return data;
    case Encoding.msgpack:
      return decodeMsgPack(data as ArrayLike<number>);
    default:
      throw new Error("only json and msgpack encoding supported");
  }
}

function encodeMsg(
  encoding: Encoding,
  msg: any,
  stringify: boolean = false
): Uint8Array | string | any {
  switch (encoding) {
    case Encoding.json:
      if (stringify) {
        return JSON.stringify(msg) as string;
      }
      return msg;
    case Encoding.msgpack:
      return encodeMsgPack(msg);
    default:
      throw new Error("only json and msgpack encoding supported");
  }
}
