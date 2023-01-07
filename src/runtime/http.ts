import { RealTimeConfigInternal } from ".";
import Logger from "./logger";
import * as proto from "../proto/server/v1/realtime";
import axios, { Axios } from "axios";
import { rejects } from "assert";

interface Channel {
  channel: string;
}

interface Subscriptions {
  devices: string[];
}

interface Message {
  id?: string;
  name: string;
  data: any;
}

export class Http {
  private _config: RealTimeConfigInternal;
  private logger: Logger;
  private axios: Axios;
  constructor(config: RealTimeConfigInternal, logger: Logger) {
    this._config = config;
    this.logger = logger;
    console.log(
      "URL",
      `${this._config.url}/v1/projects/${this._config.project}/realtime`
    );
    this.axios = axios.create({
      baseURL: `${this._config.url}/v1/projects/${this._config.project}/realtime`,
    });
  }

  async channels(): Promise<Channel[]> {
    let resp = await this.axios.get("/channels");

    return resp.data?.channels as Channel[];
  }

  async channel(name: string): Promise<Channel> {
    let resp = await this.axios.get(`/channels/${name}`);
    return resp.data as Channel;
  }

  async channelMessages(name: string, start: string = "0"): Promise<Message[]> {
    return new Promise(async (resolve, reject) => {
      const messages: Message[] = [];
      const resp = await this.axios.get(`/channels/${name}/messages`, {
        params: { start },
        responseType: "stream",
      });

      resp.data.on("data", (data: Uint8Array) => {
        const jsonStr = new TextDecoder().decode(data);
        const resp = JSON.parse(jsonStr);
        messages.push(resp.result.message);
      });

      resp.data.on("error", (err) => {
        rejects(err);
      });
      resp.data.on("end", () => resolve(messages));
    });
  }

  async channelSubscriptions(name: string): Promise<Subscriptions> {
    let resp = await this.axios.get(`/channels/${name}/subscriptions`);

    return resp.data as Subscriptions;
  }

  async channelPublish(name: string, messages: Message[]): Promise<any> {
    const req = {
      messages: messages,
    };
    let resp = await this.axios.post(`/channels/${name}/messages`, req);

    return resp.data;
  }
}
