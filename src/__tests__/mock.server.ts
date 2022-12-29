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
      console.log("connection");
      this.connectionAttempts += 1;
      if (this._rejectConnectionsWith !== "") {
        let err = {
          code: 1,
          message: this._rejectConnectionsWith,
        } as proto.ErrorEvent;

        let msg: proto.RealTimeMessage = {
          eventType: proto.EventType.error,
          event: encodeMsgPack(err),
        };

        console.log("Sending error", msg);
        ws.send(encodeMsgPack(msg));
        ws.close();
        return;
      }

      let socketId = getSocketId();
      this.clients.set(socketId, ws);
      let connected = {
        socketId,
        sessionId: getSessionId(),
      } as proto.ConnectedEvent;

      ws.on("message", (data: Uint8Array) => {
        // let msg = JSON.parse(data) as proto.RealTimeMessage;
        let msg = decodeMsgPack(data) as proto.RealTimeMessage;
        console.log("server received: ", msg);

        this._history.push(msg);

        if (msg.eventType === proto.EventType.attach) {
          let attachEvent = decodeMsgPack(msg.event) as proto.AttachEvent;

          if (!this.channelStream.has(attachEvent.channel)) {
            this.channelStream.set(attachEvent.channel, []);
          }
        }

        if (msg.eventType === proto.EventType.detach) {
          let detach = decodeMsgPack(msg.event) as proto.DetachEvent;
          // The server should only remove the channel stream if there are no more devices
          // that are attached to the stream. This is a test server so this is fine
          this.channelStream.delete(detach.channel);
        }

        if (msg.eventType === proto.EventType.message) {
          const channelMsg = decodeMsgPack(msg.event) as proto.MessageEvent;
          channelMsg.id = getSeq();
          const channelStream = this.channelStream.get(
            channelMsg.channel
          ) as proto.MessageEvent[];

          channelStream.push(channelMsg);

          this.clients.forEach((client) => client.send(data));
        }

        if (msg.eventType === proto.EventType.heartbeat) {
          ws.send(data);
        }
      });

      let msg: proto.RealTimeMessage = {
        eventType: proto.EventType.connected,
        event: encodeMsgPack(connected),
      };

      console.log("Sending connect", msg);
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
        console.log("closing server");
        if (err) {
          console.log("ERR", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
