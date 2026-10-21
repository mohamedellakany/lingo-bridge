import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger";

/**
 * Lightweight real-time hub. Listeners open a WebSocket and subscribe to a
 * session code; when a new translation is added, it's pushed to every
 * subscriber of that code instantly — replacing the client-side polling loop.
 *
 * Protocol (JSON messages):
 *   client → server: { "type": "subscribe", "code": "ALICE" }
 *   server → client: { "type": "session", "session": { ...full session } }
 *   server → client: { "type": "translation", "code": "ALICE", "translation": {...} }
 *   server → client: { "type": "ended", "code": "ALICE" }
 */

type Client = WebSocket & { code?: string; isAlive?: boolean };

let wss: WebSocketServer | null = null;
const subscribers = new Map<string, Set<Client>>();

function subscribe(client: Client, code: string): void {
  const key = code.toUpperCase();
  // Remove from any previous subscription first.
  if (client.code) unsubscribe(client);
  client.code = key;
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(client);
}

function unsubscribe(client: Client): void {
  if (!client.code) return;
  const set = subscribers.get(client.code);
  if (set) {
    set.delete(client);
    if (set.size === 0) subscribers.delete(client.code);
  }
  client.code = undefined;
}

function send(client: WebSocket, payload: unknown): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
}

/** Broadcast a JSON payload to everyone subscribed to a session code. */
export function broadcast(code: string, payload: unknown): void {
  const set = subscribers.get(code.toUpperCase());
  if (!set) return;
  for (const client of set) send(client, payload);
}

export function initRealtime(server: Server): void {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: Client) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (raw) => {
      let msg: { type?: string; code?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === "subscribe" && typeof msg.code === "string") {
        subscribe(socket, msg.code);
      } else if (msg.type === "unsubscribe") {
        unsubscribe(socket);
      }
    });

    socket.on("close", () => unsubscribe(socket));
    socket.on("error", () => unsubscribe(socket));
  });

  // Heartbeat: drop dead connections so the subscriber map stays clean.
  const interval = setInterval(() => {
    if (!wss) return;
    for (const client of wss.clients as Set<Client>) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30_000);

  wss.on("close", () => clearInterval(interval));

  logger.info("Realtime WebSocket server listening on /ws");
}
