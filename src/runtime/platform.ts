export interface Platform {
  runtime: "node" | "browser" | "unknown";
  WebSocket: any;
}

export default {
  runtime: "unknown",
  WebSocket: globalThis.WebSocket,
} as Platform;
