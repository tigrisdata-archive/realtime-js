import * as proto from "../proto/server/v1/realtime";
// import { encode, decode } from "@ably/msgpack-js";

export enum Encoding {
  msgpack,
  json,
}

export function toConnectedEvent(
  encoding: Encoding,
  event: Uint8Array
): proto.ConnectedEvent {
  return proto.ConnectedEvent.fromJSON(decode(encoding, event));
}

export function toMessageEvent(
  encoding: Encoding,
  event: Uint8Array
): proto.MessageEvent {
  return proto.MessageEvent.fromJSON(decode(encoding, event));
}

export function createMessageEvent(
  encoding: Encoding,
  channel: string,
  name: string,
  message: string
) {
  const msg = proto.MessageEvent.fromJSON({
    channel,
    name,
    data: message,
  });

  return createRTMessage(
    encoding,
    proto.EventType.message,
    encode(encoding, msg)
  );
}

export function createHeartbeatEvent(encoding: Encoding) {
  return createRTMessage(encoding, proto.EventType.heartbeat, "");
}

export function createDisconnectEvent(encoding: Encoding) {
  return createRTMessage(encoding, proto.EventType.disconnect, "");
}

export function createRTMessage(
  encoding: Encoding,
  eventType: proto.EventType,
  event: string | Uint8Array
) {
  const rt = proto.RealTimeMessage.fromJSON({
    eventType,
    event,
  });

  return encode(encoding, rt);
}

export function toRealTimeMessage(data: string) {
  return proto.RealTimeMessage.fromJSON(JSON.stringify(data));
}

function decode(encoding: Encoding, data: Uint8Array): any {
  if (encoding === Encoding.json) {
    return JSON.parse(String(data));
  } else {
    throw new Error("only json encoding supported");
  }
}

function encode(encoding: Encoding, msg: any): string | Uint8Array {
  if (encoding === Encoding.json) {
    return JSON.stringify(msg);
  } else {
    throw new Error("only json encoding supported");
  }
}
