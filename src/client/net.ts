import PartySocket from "partysocket";
import type { ClientMessage, ServerMessage } from "../shared/room";

/** Everything a screen needs after each change in the room. */
export type Snapshot = Extract<ServerMessage, { t: "state" }>;

export interface RoomHandlers {
  onState(s: Snapshot): void;
  onError(message: string): void;
  onFatal(message: string): void;
  onStatus(connected: boolean): void;
}

const PING_EVERY = 15_000; // keeps phone carriers / home routers from dropping an idle socket
const DEAD_AFTER = 40_000; // no message (not even a pong) for this long = the socket is silently dead
const BANNER_DELAY = 2_500; // don't flash "Reconnecting…" for blips that heal on their own

export function connectRoom(code: string, query: Record<string, string>, h: RoomHandlers) {
  const ws = new PartySocket({
    host: location.host,
    party: "room",
    room: code,
    query,
    // Retry fast: a family game shouldn't wait 10s+ for a backoff after a phone wakes up.
    minReconnectionDelay: 250,
    maxReconnectionDelay: 3_000,
    reconnectionDelayGrowFactor: 1.5,
    connectionTimeout: 6_000,
  });
  let dead = false;
  let lastHeard = Date.now();
  let bannerTimer = 0;

  ws.addEventListener("open", () => {
    lastHeard = Date.now();
    clearTimeout(bannerTimer);
    bannerTimer = 0;
    h.onStatus(true);
  });
  ws.addEventListener("close", () => {
    if (dead || bannerTimer) return;
    bannerTimer = window.setTimeout(() => {
      bannerTimer = 0;
      if (!dead && ws.readyState !== WebSocket.OPEN) h.onStatus(false);
    }, BANNER_DELAY);
  });

  // Heartbeat: the server answers "ping" with "pong" without waking the Durable Object.
  const heartbeat = window.setInterval(() => {
    if (dead) return;
    if (ws.readyState === WebSocket.OPEN) {
      if (Date.now() - lastHeard > DEAD_AFTER) ws.reconnect();
      else ws.send("ping");
    }
  }, PING_EVERY);

  // Phones suspend pages when the screen locks; when they come back, check right away.
  const revive = () => {
    if (dead || document.visibilityState !== "visible") return;
    if (ws.readyState !== WebSocket.OPEN) {
      ws.reconnect();
      return;
    }
    // The socket may look open but have died while asleep: ping, and reconnect if nothing answers.
    const sent = Date.now();
    ws.send("ping");
    setTimeout(() => {
      if (!dead && lastHeard < sent) ws.reconnect();
    }, 3_000);
  };
  document.addEventListener("visibilitychange", revive);
  window.addEventListener("online", revive);
  window.addEventListener("pageshow", revive);

  ws.addEventListener("message", (e) => {
    lastHeard = Date.now();
    if (e.data === "pong") return;
    let msg: ServerMessage;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.t === "state") h.onState(msg);
    else if (msg.t === "error") h.onError(msg.message);
    else if (msg.t === "fatal") {
      shutdown();
      h.onFatal(msg.message);
    }
  });

  function shutdown() {
    dead = true;
    clearInterval(heartbeat);
    clearTimeout(bannerTimer);
    document.removeEventListener("visibilitychange", revive);
    window.removeEventListener("online", revive);
    window.removeEventListener("pageshow", revive);
    ws.close();
  }

  return {
    send(m: ClientMessage) {
      // PartySocket queues messages while reconnecting and sends them once it's back.
      ws.send(JSON.stringify(m));
    },
    close: shutdown,
  };
}

export async function createRoom(): Promise<string> {
  const res = await fetch("/api/rooms", { method: "POST" });
  const body = (await res.json()) as { code?: string; error?: string };
  if (!res.ok || !body.code) throw new Error(body.error ?? "Couldn't create a room.");
  return body.code;
}

export async function roomExists(code: string): Promise<boolean> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
  if (!res.ok) return false;
  return ((await res.json()) as { exists: boolean }).exists;
}

export function playerId(): string {
  const KEY = "ohno.pid";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function savedName(): string {
  try {
    return localStorage.getItem("ohno.name") ?? "";
  } catch {
    return "";
  }
}

export function savedAvatar(): string | null {
  try {
    return localStorage.getItem("ohno.avatar");
  } catch {
    return null;
  }
}

export function saveAvatar(a: string) {
  try {
    localStorage.setItem("ohno.avatar", a);
  } catch {
    /* private mode */
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem("ohno.name", name);
  } catch {
    /* private mode */
  }
}
