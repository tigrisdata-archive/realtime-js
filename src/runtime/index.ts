import platform from "./platform";

export class Realtime {
  constructor() {
    console.log("constructor", platform.runtime, platform.WebSocket);
  }
}
