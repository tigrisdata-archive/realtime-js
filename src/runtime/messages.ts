import * as proto from "../proto/server/v1/realtime";
import {
  encode as encodeMsgPack,
  decode as decodeMsgPack,
} from "@msgpack/msgpack";

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
  let m = decodeMsg(encoding, event) as proto.MessageEvent;

  return {
    ...m,
    data: decodeMsg(encoding, m.data),
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
  message: string
) {
  const encoder = new TextEncoder();
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
  return createRTMessage(encoding, proto.EventType.heartbeat, new Uint8Array());
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
) {
  const rt = {
    event_type,
    event,
  } as proto.RealTimeMessage;

  return encodeMsg(encoding, rt);
}

export function toRealTimeMessage(
  encoding: Encoding,
  data: string | Uint8Array
): proto.RealTimeMessage {
  if (typeof data === "string") {
    console.log("ss", JSON.parse(data));
    return JSON.parse(data);
  } else {
  }
  return proto.RealTimeMessage.fromJSON(
    decodeMsg(encoding, data as Uint8Array)
  );
}

function decodeMsg(encoding: Encoding, data: Uint8Array): any {
  switch (encoding) {
    case Encoding.json:
      return JSON.parse(String(data));
    case Encoding.msgpack:
      return decodeMsgPack(data);
    default:
      throw new Error("only json and msgpack encoding supported");
  }
}

function encodeMsg(encoding: Encoding, msg: any): string | Uint8Array {
  switch (encoding) {
    case Encoding.json:
      return JSON.stringify(msg);
    case Encoding.msgpack:
      return encodeMsgPack(msg);
    default:
      throw new Error("only json and msgpack encoding supported");
  }
}
