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

import { WebSocketServer, WebSocket } from "ws";
import * as proto from "../proto/server/v1/realtime";
import {
  encode as encodeMsgPack,
  decode as decodeMsgPack,
} from "@msgpack/msgpack";

let socketId = 0;
let sessionId = 0;
let seq = 0;

function getSocketId() {
  socketId += 1;
  return socketId.toString();
}

function getSessionId() {
  sessionId += 1;
  return sessionId.toString();
}

function getSeq() {
  seq += 1;
  return seq.toString();
}

export class WsTestServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket>;

  private _history: proto.RealTimeMessage[];
  private channelStream: Map<string, proto.MessageEvent[]>;

  private _rejectConnectionsWith: string;
  public connectionAttempts = 0;

  constructor(port) {
    this.wss = new WebSocketServer({
      port,
    });
    this.clients = new Map();
    this._history = [];
    this.channelStream = new Map();
    this._rejectConnectionsWith = "";
  }

  start() {
    this.wss.on("connection", (ws) => {
      console.log("server: connected to client");
      this.connectionAttempts += 1;
      if (this._rejectConnectionsWith !== "") {
        let err = {
          code: 1,
          message: this._rejectConnectionsWith,
        } as proto.ErrorEvent;

        let msg: proto.RealTimeMessage = {
          event_type: proto.EventType.error,
          event: encodeMsgPack(err),
        };

        console.log("server: Sending error", msg);
        ws.send(encodeMsgPack(msg));
        ws.close();
        return;
      }

      let socketId = getSocketId();
      this.clients.set(socketId, ws);
      let connected = {
        socket_id: socketId,
        session_id: getSessionId(),
      } as proto.ConnectedEvent;

      ws.on("message", (data: Uint8Array) => {
        let msg = decodeMsgPack(data) as proto.RealTimeMessage;
        console.log("server: received: ", msg);

        this._history.push(msg);

        if (msg.event_type === proto.EventType.attach) {
          let attachEvent = decodeMsgPack(msg.event) as proto.AttachEvent;

          if (!this.channelStream.has(attachEvent.channel)) {
            this.channelStream.set(attachEvent.channel, []);
          }
        }

        if (msg.event_type === proto.EventType.detach) {
          let detach = decodeMsgPack(msg.event) as proto.DetachEvent;
          // The server should only remove the channel stream if there are no more devices
          // that are attached to the stream. This is a test server so this is fine
          this.channelStream.delete(detach.channel);
        }

        if (msg.event_type === proto.EventType.subscribe) {
          let sub = decodeMsgPack(msg.event) as proto.SubscribeEvent;

          let channelStream = this.channelStream.get(
            sub.channel
          ) as proto.MessageEvent[];

          channelStream.forEach((msg) => {
            if (msg.id > sub.position) {
              let raw = encodeMsgPack(msg);
              let rt = {
                event: raw,
                event_type: proto.EventType.message,
              } as proto.RealTimeMessage;

              ws.send(encodeMsgPack(rt));
            }
          });
        }

        if (msg.event_type === proto.EventType.message) {
          const channelMsg = decodeMsgPack(msg.event) as proto.MessageEvent;
          channelMsg.id = getSeq();

          const channelStream = this.channelStream.get(
            channelMsg.channel
          ) as proto.MessageEvent[];

          channelStream.push(channelMsg);

          let publishMsg: proto.RealTimeMessage = {
            event_type: proto.EventType.message,
            event: encodeMsgPack(channelMsg),
          };

          this.clients.forEach((client) =>
            client.send(encodeMsgPack(publishMsg))
          );
        }

        if (msg.event_type === proto.EventType.heartbeat) {
          ws.send(data);
        }
      });

      let msg: proto.RealTimeMessage = {
        event_type: proto.EventType.connected,
        event: encodeMsgPack(connected),
      };

      console.log("server: Sending connect", msg);
      ws.send(encodeMsgPack(msg));
    });
  }

  rejectConnectionsWith(error: string) {
    this._rejectConnectionsWith = error;
  }

  closeConnection(sessionId: string) {
    let ws = this.clients.get(sessionId);

    if (!ws) {
      return;
    }

    ws.close();
  }

  history() {
    return this._history;
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        console.log("server: closing");
        if (err) {
          console.log("server: error", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
