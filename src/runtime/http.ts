import { RealTimeConfigInternal } from ".";
import Logger from "./logger";
import * as proto from "../proto/server/v1/realtime";
import axios, { Axios } from "axios";

interface Channel {
  channel: string;
}

interface Subscriptions {
  devices: string[];
}

interface Message {
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

  async channelMessages(name: string): Promise<Channel> {
    // let resp = await this.axios.get(`/channels/${name}/messages`, {
    //   params: { start: 0 },
    // });
    let resp = await this.axios.get(`/channels/${name}/messages?start=0`);

    return resp.data as Channel;
  }

  async channelSubscriptions(name: string): Promise<Subscriptions> {
    let resp = await this.axios.get(`/channels/${name}/subscriptions`);

    return resp.data as Subscriptions;
  }

  async channelPublish(name: string, messages: Message[]): Promise<any> {
    const req = {
      messages: messages,
    };
    let resp = await this.axios.post(`/channels/${name}/messages`, {
      data: req,
    });

    return resp.data;
  }
}
