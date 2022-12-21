import { WebSocket } from "ws";
import { Platform } from "../runtime/platform";

export default function configure(platform: Platform): Platform {
  platform.WebSocket = WebSocket;
  platform.runtime = "node";

  return platform;
}
