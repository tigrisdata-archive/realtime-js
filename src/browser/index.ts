import platform from "../runtime/platform";
import configure from "./platform";
import { RealTime } from "../runtime/index";

configure(platform);

export function hello(where: string) {
  console.log("HELLO from browser", where);

  let rt = new RealTime({ platform });
}
