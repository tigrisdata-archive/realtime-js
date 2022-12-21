import { Platform } from "../runtime/platform";

export default function configure(platform: Platform): Platform {
  platform.WebSocket = globalThis.WebSocket;
  platform.runtime = "browser";

  return platform;
}
