import PartySocket from "partysocket";
import type { ClientMessage, GameEvent, PrivateState, PublicState, ServerMessage } from "../shared/types";

export interface Snapshot {
  state: PublicState;
  me: PrivateState | null;
  events: GameEvent[];
}

export interface RoomHandlers {
  onState(s: Snapshot): void;
  onError(message: string): void;
  onFatal(message: string): void;
  onStatus(connected: boolean): void;
}

export function connectRoom(code: string, query: Record<string, string>, h: RoomHandlers) {
  const ws = new PartySocket({ host: location.host, party: "room", room: code, query });
  let dead = false;
  ws.addEventListener("open", () => h.onStatus(true));
  ws.addEventListener("close", () => !dead && h.onStatus(false));
  ws.addEventListener("message", (e) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.t === "state") h.onState(msg);
    else if (msg.t === "error") h.onError(msg.message);
    else if (msg.t === "fatal") {
      dead = true;
      ws.close();
      h.onFatal(msg.message);
    }
  });
  return {
    send(m: ClientMessage) {
      ws.send(JSON.stringify(m));
    },
    close() {
      dead = true;
      ws.close();
    },
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

export function saveName(name: string) {
  try {
    localStorage.setItem("ohno.name", name);
  } catch {
    /* private mode */
  }
}
