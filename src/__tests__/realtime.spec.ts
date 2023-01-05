import { RealTime, Channel } from "../node/index";
import { WsTestServer } from "./mock.server";
import * as proto from "../proto/server/v1/realtime";
import { Encoding } from "../runtime";
// TODO:
// 5. Http endpoints
// 6. browser support
// 7. presence

describe("realtime message send and receive with mock server", () => {
  let server: WsTestServer;

  beforeEach(async () => {
    server = new WsTestServer(8084);
    server.start();
  });

  afterEach(async () => {
    await server.close();
  });

  it("should send attach to server", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      await new Promise<void>(async (done) => {
        let ch = realtime.getChannel("test-one");

        ch.attach();

        await sleep(100);
        let lastMsg = server.history().pop() as proto.RealTimeMessage;
        expect(lastMsg.event_type).toEqual(proto.EventType.attach);

        done();
      });
    } finally {
      realtime.close();
    }
  });

  it("should send attach and subscribe msg on subscribe", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      await new Promise<void>(async (done) => {
        let ch = realtime.getChannel("test-one");

        ch.subscribe("name", (_msg) => {});

        await sleep(100);

        const hist = server.history();
        const sub = hist.pop() as proto.RealTimeMessage;
        const attach = hist.pop() as proto.RealTimeMessage;

        expect(attach.event_type).toEqual(proto.EventType.attach);
        expect(sub.event_type).toEqual(proto.EventType.subscribe);

        done();
      });
    } finally {
      realtime.close();
    }
  });

  it("should only send attach and subscribe msg once", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      await new Promise<void>(async (done) => {
        let ch = realtime.getChannel("test-one");

        ch.attach();
        ch.subscribe("name", (_msg) => {});
        ch.attach();
        ch.subscribe("name", (_msg) => {});
        ch.attach();
        ch.subscribe("name2", (_msg) => {});

        await sleep(100);

        let totalAttach = 0;
        let totalSubs = 0;
        server.history().forEach((msg) => {
          if (msg.event_type === proto.EventType.attach) {
            totalAttach += 1;
          }
          if (msg.event_type === proto.EventType.subscribe) {
            totalSubs += 1;
          }
        });

        expect(totalAttach).toEqual(1);
        expect(totalSubs).toEqual(1);

        done();
      });
    } finally {
      realtime.close();
    }
  });

  it("should send detach", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      await new Promise<void>(async (done) => {
        let ch = realtime.getChannel("test-one");

        ch.attach();
        ch.detach();
        await sleep(100);
        const hist = server.history();
        const detach = hist.pop() as proto.RealTimeMessage;
        const attach = hist.pop() as proto.RealTimeMessage;

        expect(attach.event_type).toEqual(proto.EventType.attach);
        expect(detach.event_type).toEqual(proto.EventType.detach);

        done();
      });
    } finally {
      realtime.close();
    }
  });

  it("should send unsubscribe", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      await new Promise<void>(async (done) => {
        let ch = realtime.getChannel("test-one");

        let cb = (_data) => {};
        ch.subscribe("test", cb);
        ch.unsubscribe("test", cb);

        await sleep(100);

        const unsub = server.history().pop() as proto.RealTimeMessage;
        const sub = server.history().pop() as proto.RealTimeMessage;
        const attach = server.history().pop() as proto.RealTimeMessage;

        expect(attach.event_type).toEqual(proto.EventType.attach);
        expect(sub.event_type).toEqual(proto.EventType.subscribe);
        expect(unsub.event_type).toEqual(proto.EventType.unsubscribe);

        ch.subscribe("test", cb);
        ch.unsubscribeAll();

        await sleep(100);

        const unsub1 = server.history().pop() as proto.RealTimeMessage;
        const sub1 = server.history().pop() as proto.RealTimeMessage;
        expect(sub1.event_type).toEqual(proto.EventType.subscribe);
        expect(unsub1.event_type).toEqual(proto.EventType.unsubscribe);
        done();
      });
    } finally {
      realtime.close();
    }
  });

  it("should do attach, detach and attach again", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      await new Promise<void>(async (done) => {
        let ch = realtime.getChannel("test-one");

        let cb = (_data) => {};
        ch.subscribe("test", cb);
        ch.unsubscribe("test", cb);

        await sleep(100);

        const unsub = server.history().pop() as proto.RealTimeMessage;
        const sub = server.history().pop() as proto.RealTimeMessage;
        const attach = server.history().pop() as proto.RealTimeMessage;

        expect(attach.event_type).toEqual(proto.EventType.attach);
        expect(sub.event_type).toEqual(proto.EventType.subscribe);
        expect(unsub.event_type).toEqual(proto.EventType.unsubscribe);

        ch.subscribe("test", (msg) => {
          expect(msg).toEqual("sent message!");
          done();
        });

        ch.publish("test", "sent message!");
      });
    } finally {
      realtime.close();
    }
  });

  it("can send and receive", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "p1",
      encoding: Encoding.msgpack,
    });
    try {
      await realtime.once("connected");
      const channel1 = realtime.getChannel(`test-one-${Date.now()}`);
      // const channel1 = realtime.getChannel(`test`);
      channel1.attach();
      await new Promise<void>(async (done) => {
        channel1.subscribe("greeting", (message) => {
          expect(message.text).toEqual("hello world");
          expect(message.value).toEqual(1);
          expect(
            (server.history().pop() as proto.RealTimeMessage).event_type
          ).toEqual(proto.EventType.message);
          done();
        });
        await channel1.publish("greeting", { text: "hello world", value: 1 });
      });
      await sleep(1000);
    } finally {
      realtime.close();
    }
  });

  it("can listen to specific messages only", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    await realtime.once("connected");
    try {
      await new Promise<void>(async (done, reject) => {
        const channel1 = realtime.getChannel("test-one");

        channel1.subscribe("ch1", (message) => {
          expect(message).toEqual("hello world");
          done();
        });

        channel1.subscribe("ch2", (_message) => {
          reject("ch2 should not see message");
        });

        await waitForDelivery(channel1, "ch1", "hello world");
      });
    } finally {
      realtime.close();
    }
  });

  it("can subscribe and unsubscribe individual listener", async () => {
    let messageCount = 0;
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    await realtime.once("connected");
    const channel1 = realtime.getChannel("test-one");

    let cb = (_) => (messageCount += 1);

    channel1.subscribe("ch1", cb);
    await waitForDelivery(channel1, "ch1", "msg1");

    channel1.unsubscribe("ch1", cb);
    await waitForDelivery(channel1, "ch1", "msg2");

    try {
      expect(messageCount).toEqual(1);
    } finally {
      realtime.close();
    }
  });

  it("can unsubscribe all listeners", async () => {
    let messageCount = 0;
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      const channel1 = realtime.getChannel("test-one");

      channel1.subscribe("ch1", (_) => (messageCount += 1));
      channel1.subscribe("ch2", (_) => (messageCount += 1));
      channel1.subscribe("ch1", (_) => (messageCount += 1));
      channel1.subscribe("ch2", (_) => (messageCount += 1));

      await waitForDelivery(channel1, "ch1", "msg1");
      await waitForDelivery(channel1, "ch2", "msgForCh2");

      channel1.unsubscribeAll();

      await waitForDelivery(channel1, "ch1", "msg2");
      await waitForDelivery(channel1, "ch2", "msgForCh2Again");

      expect(messageCount).toEqual(4);
    } finally {
      realtime.close();
    }
  });

  it("can unsubscribe all listeners from a msg", async () => {
    let messageCount = 0;
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      const channel1 = realtime.getChannel("test-one");

      channel1.subscribe("ch1", (_) => (messageCount += 1));
      channel1.subscribe("ch1", (_) => (messageCount += 1));
      channel1.subscribe("ch1", (_) => (messageCount += 1));
      channel1.subscribe("ch1", (_) => (messageCount += 1));

      await waitForDelivery(channel1, "ch1", "msg1");

      channel1.unsubscribeAllFrom("ch1");

      await waitForDelivery(channel1, "ch1", "msg2");

      expect(messageCount).toEqual(4);
    } finally {
      realtime.close();
    }
  });

  it("sends heartbeat if no other message sent", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      await sleep(1500);
      let msg = server.history().pop() as proto.RealTimeMessage;

      expect(msg.event_type).toEqual(proto.EventType.heartbeat);
    } finally {
      realtime.close();
    }
  });

  it("sends disconnect on close", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      realtime.close();
      await sleep(100);
      let msg = server.history().pop() as proto.RealTimeMessage;

      expect(msg.event_type).toEqual(proto.EventType.disconnect);
    } finally {
      realtime.close();
    }
  });

  it("retries on failures", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      realtime.on("error", (err) =>
        expect(err.message).toEqual("test error message")
      );
      server.rejectConnectionsWith("test error message");
      await sleep(1000);
      expect(server.connectionAttempts).toEqual(3);
    } finally {
      realtime.close();
    }
  });

  it("emits events for all connection states", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
      autoconnect: false,
    });

    let eventCount = 0;
    realtime.on("connecting", () => (eventCount += 1));
    realtime.on("connected", () => (eventCount += 1));
    realtime.on("closing", () => (eventCount += 1));
    realtime.on("closed", () => (eventCount += 1));

    let closed = realtime.once("closed");

    await realtime.connect();
    realtime.close();
    await closed;
    expect(eventCount).toEqual(4);
  });

  it("queues up messages if not connectioned", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
      autoconnect: false,
    });

    try {
      let ch = realtime.getChannel("testoffline");

      let msgReceived = 0;
      let done = new Promise<void>((resolve) => {
        ch.subscribe("main", (msg) => {
          msgReceived += 1;

          if (msg === "msg3") {
            resolve();
          }
        });
      });

      ch.publish("main", "msg1");
      ch.publish("main", "msg2");
      ch.publish("main", "msg3");

      expect(server.history().length).toEqual(0);

      await realtime.connect();
      await done;

      expect(msgReceived).toEqual(3);
    } finally {
      realtime.close();
    }
  });

  it("sends subscribe on reconnect", async () => {
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });

    await realtime.once("connected");

    try {
      const ch1 = realtime.getChannel("one");

      ch1.subscribe("main", (msg) => {
        expect(msg).toEqual("msg1");
      });

      await waitForDelivery(ch1, "main", "msg1");
      server.closeConnection(realtime.socketId() as string);
      await realtime.once("connected");
      await sleep(100);
      let msg = server.history().pop();
      expect(msg?.event_type).toEqual(proto.EventType.subscribe);
    } finally {
      realtime.close();
    }
  });

  it("recovers from disconnect", async () => {
    const messages: string[] = [];
    const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    const rt2 = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });
    try {
      await realtime.once("connected");
      await rt2.once("connected");

      const ch1 = realtime.getChannel("one");
      const otherCh1 = rt2.getChannel("one");

      let done = new Promise<void>((resolve) => {
        ch1.subscribe("main", (msg) => {
          messages.push(msg);

          if (msg === "msg5") {
            resolve();
          }
        });
      });

      otherCh1.attach();

      await waitForDelivery(otherCh1, "main", "msg1");
      server.closeConnection(realtime.socketId() as string);
      otherCh1.publish("main", "msg2");
      otherCh1.publish("main", "msg3");
      otherCh1.publish("main", "msg4");
      otherCh1.publish("main", "msg5");

      await done;
      expect(messages).toEqual(["msg1", "msg2", "msg3", "msg4", "msg5"]);
    } finally {
      realtime.close();
      rt2.close();
    }
  });
});

async function waitForDelivery(
  channel: Channel,
  msgType: string,
  message: string
) {
  await new Promise<void>(async (resolve) => {
    channel.subscribe(msgType, () => {
      resolve();
      channel.unsubscribe(msgType, resolve);
    });
    await channel.publish(msgType, message);
  });
}

const sleep = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};
