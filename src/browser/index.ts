import platform from "../runtime/platform";
import configure from "./platform";
import { RealTime as RT, RealTimeConfig } from "../runtime/index";
export { Channel } from "../runtime/index";

configure(platform);

export class RealTime extends RT {
  constructor(options: RealTimeConfig) {
    super({ ...options, platform });
  }
}
