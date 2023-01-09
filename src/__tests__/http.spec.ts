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

import axios from "axios";
import { reduceEachLeadingCommentRange } from "typescript";
import { RealTime } from "../node/index";
import { Encoding } from "../runtime";

const sleep = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

describe("http endpoints", () => {
  let PROJECT: string = "";
  beforeEach(async () => {
    PROJECT = "test-project-1-" + Date.now();
    try {
      const resp = await axios.post(
        `http://127.0.0.1:8081/v1/projects/${PROJECT}/create`
      );
      console.log("SS", resp.status);
      console.log("SS", resp.data);
    } catch (e) {
      //@ts-ignore
      console.log("SETUP failed", e);
      throw e;
    }
    await sleep(3000);
  });

  afterEach(async () => {
    const _resp = await axios.post(
      `http://127.0.0.1:8081/v1/projects/${PROJECT}/delete`
    );
  });

  it("should get list of channels", async () => {
    const realtime = new RealTime({
      url: "http://127.0.0.1:8083",
      project: "p1",
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
      encoding: Encoding.json,
    });

    const rt2 = new RealTime({
      url: "http://127.0.0.1:8083",
      project: PROJECT,
      encoding: Encoding.msgpack,
    });

    await realtime.once("connected");

    const ch = realtime.getChannel("test-ch-1");
    const ch2 = rt2.getChannel("test-ch-1");

    ch2.attach();

    await new Promise<void>((done) => {
      ch.subscribe("first", (_msg) => {
        ch2.publish("third", "third-msg");
        done();
      });
      ch.publish("first", "hello");
      ch.publish("second", "second-msg");
    });

    try {
      const channel = await realtime.http().channel("test-ch-1");
      expect(channel).toEqual({ channel: "test-ch-1" });
      const channelMessages = await realtime
        .http()
        .channelMessages("test-ch-1");
      expect(channelMessages[0].data).toEqual("hello");
      expect(channelMessages.length).toEqual(3);
      expect(channelMessages[1].data).toEqual("second-msg");
      expect(channelMessages[2].data).toEqual("third-msg");
      let devices = await realtime.http().channelSubscriptions("test-ch");
      expect(devices.devices).toHaveLength(2);
    } finally {
      realtime.close();
      rt2.close();

      await realtime.once("closed");
      await rt2.once("closed");
    }
  });

  it("publish message", async () => {
    const realtime = new RealTime({
      url: "http://127.0.0.1:8083",
      project: PROJECT,
    });

    await realtime.once("connected");
    let chan = "test-ch-1-" + Date.now();

    const ch = realtime.getChannel(chan);
    let msgWait1 = new Promise<void>((done) => {
      ch.subscribe("first", (msg) => {
        console.log("sss111", msg);
        expect(msg).toEqual("from http");
        done();
      });
    });

    let msgWait2 = new Promise<void>((done) => {
      ch.subscribe("second", (msg) => {
        console.log("sss", msg);
        expect(msg).toEqual({ val: "another from http" });
        done();
      });
    });

    await sleep(400);

    try {
      await realtime.http().channelPublish(chan, [
        { name: "first", data: "from http" },
        { name: "second", data: { val: "another from http" } },
      ]);

      let mg = await realtime.http().channelMessages(chan);

      expect(mg.length).toEqual(2);

      await Promise.all([msgWait1, msgWait2]);
    } finally {
      realtime.close();
    }
  });
});
