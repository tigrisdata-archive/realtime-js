import axios from "axios";
import { RealTime } from "../node/index";

describe("http endpoints", () => {
  let PROJECT: string = "";
  beforeEach(async () => {
    PROJECT = "test-project-1-" + Date.now();
    const resp = await axios.post(
      `http://127.0.0.1:8081/v1/projects/${PROJECT}/create`
    );

    // console.log("SS", resp.status);
    // console.log("SS", resp.data);
  });

  afterEach(async () => {
    const _resp = await axios.post(
      `http://127.0.0.1:8081/v1/projects/${PROJECT}/delete`
    );
  });

  it("should get list of channels", async () => {
    const realtime = new RealTime({
      url: "http://127.0.0.1:8083",
      project: PROJECT,
    });

    await realtime.once("connected");

    const ch = realtime.getChannel("test-ch");
    const ch2 = realtime.getChannel("test-ch-2");
    const ch3 = realtime.getChannel("test-ch-3");

    ch2.attach();
    ch3.attach();

    await new Promise<void>((done) => {
      ch.subscribe("first", (_msg) => {
        done();
      });
      ch.publish("first", "hello");
    });

    try {
      const channels = await realtime.http().channels();

      expect(channels).toContainEqual({ channel: "test-ch" });
      expect(channels).toContainEqual({ channel: "test-ch-2" });
      expect(channels).toContainEqual({ channel: "test-ch-3" });
    } finally {
      realtime.close();
    }
  });

  it("get channel info and messages", async () => {
    const realtime = new RealTime({
      url: "http://127.0.0.1:8083",
      project: PROJECT,
    });

    await realtime.once("connected");

    const ch = realtime.getChannel("test-ch");

    await new Promise<void>((done) => {
      ch.subscribe("first", (_msg) => {
        done();
      });
      ch.publish("first", "hello");
      ch.publish("second", "second-msg");
      ch.publish("third", "third-msg");
    });

    try {
      const channel = await realtime.http().channel("test-ch");

      expect(channel).toEqual({ channel: "test-ch" });

      //  NOT WORKING
      const channelMessages = await realtime.http().channelMessages("test-ch");
      expect(channelMessages).toContainEqual({
        name: "first",
        message: "hello1",
      });

      let devices = await realtime.http().channelSubscriptions("test-ch");
      expect(devices.devices).toHaveLength(1);
    } finally {
      realtime.close();
    }
  });

  // NOT WORKING
  it("publish message", async () => {
    const realtime = new RealTime({
      url: "http://127.0.0.1:8083",
      project: PROJECT,
    });

    await realtime.once("connected");
    let chan = "test-ch-" + Date.now();

    const ch = realtime.getChannel(chan);
    let msgWait1 = new Promise<void>((done) => {
      ch.subscribe("first", (msg) => {
        expect(msg).toEqual("from http");
        done();
      });
    });

    let msgWait2 = new Promise<void>((done) => {
      ch.subscribe("second", (msg) => {
        expect(msg).toEqual({ val: "another from http" });
        done();
      });
    });

    try {
      realtime.http().channelPublish(chan, [
        { name: "first", data: "from http" },
        { name: "second", data: { val: "another from http" } },
      ]);

      await Promise.all([msgWait1, msgWait2]);
    } finally {
      realtime.close();
    }
  });
});
