import { getServerByName, routePartykitRequest, Server, type Connection, type ConnectionContext } from "partyserver";
import { botTurn } from "../shared/bot";
import * as engine from "../shared/engine";
import { DEFAULT_SETTINGS, type ClientMessage, type GameEvent, type GameState, type ServerMessage } from "../shared/types";

type ConnState = { role: "tv" } | { role: "player"; pid: string };

const ROOM_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"; // consonants only: no accidental words, no 0/O 1/I mixups
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // rooms are cleaned up after 6 idle hours
const STORAGE_KEY = "game";
const DISCONNECT_GRACE_MS = 8_000;

/**
 * One Durable Object per room. It owns the authoritative game state and every
 * WebSocket in the room (TVs and phones). Hibernation keeps idle rooms free.
 */
export class Room extends Server<Env> {
  static options = { hibernate: true };

  game: GameState | null = null;

  async onStart() {
    this.game = (await this.ctx.storage.get<GameState>(STORAGE_KEY)) ?? null;
    // Rooms saved by an older version may be missing newer settings.
    if (this.game) this.game.settings = { ...DEFAULT_SETTINGS, ...this.game.settings };
    // Heartbeats from phones/TVs are answered by the runtime itself, so they never wake a hibernating room.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** RPC from the Worker when a TV creates a room. Returns false if the code is taken. */
  async create(): Promise<boolean> {
    if (this.game) return false;
    this.game = engine.newGame(this.name);
    await this.save();
    return true;
  }

  async exists(): Promise<boolean> {
    return this.game !== null;
  }

  getConnectionTags(_c: Connection, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    return [url.searchParams.get("role") === "tv" ? "tv" : "player"];
  }

  async onConnect(conn: Connection<ConnState>, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    if (!this.game) {
      this.send(conn, { t: "fatal", message: "That room doesn't exist. Check the code on the TV." });
      conn.close(4404, "no such room");
      return;
    }
    if (url.searchParams.get("role") === "tv") {
      conn.setState({ role: "tv" });
      this.sync([], conn);
      this.scheduleBots(); // in case the room just woke up mid-game
      return;
    }
    const pid = (url.searchParams.get("pid") ?? "").slice(0, 64);
    if (!/^[\w-]{8,64}$/.test(pid)) {
      this.send(conn, { t: "fatal", message: "Bad player id." });
      conn.close(4400, "bad pid");
      return;
    }
    conn.setState({ role: "player", pid });
    try {
      const events = engine.joinPlayer(this.game, pid, url.searchParams.get("name"));
      await this.commit(events);
    } catch (err) {
      this.send(conn, { t: "fatal", message: errorMessage(err) });
      conn.close(4403, "rejected");
    }
  }

  async onMessage(conn: Connection<ConnState>, raw: string | ArrayBuffer | ArrayBufferView) {
    const g = this.game;
    const st = conn.state;
    if (!g || !st || raw === "ping") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer));
    } catch {
      return;
    }
    // TVs are display-only, except they may start the game when the host taps Start there.
    const pid = st.role === "player" ? st.pid : g.hostId;
    if (!pid || (st.role === "tv" && msg.t !== "start" && msg.t !== "nextRound")) return;

    try {
      const events = this.apply(g, pid, msg);
      await this.commit(events);
    } catch (err) {
      if (err instanceof engine.GameError) this.send(conn, { t: "error", message: err.message });
      else {
        console.error("room error", err);
        this.send(conn, { t: "error", message: "Something went wrong. Try again." });
      }
    }
  }

  private apply(g: GameState, pid: string, m: ClientMessage): GameEvent[] {
    switch (m.t) {
      case "play":
        return engine.play(g, pid, Number(m.cardId), m.color);
      case "draw":
        return engine.draw(g, pid);
      case "pass":
        return engine.pass(g, pid);
      case "take":
        return engine.take(g, pid);
      case "ohno":
        return engine.callOhNo(g, pid);
      case "catch":
        return engine.catchPlayer(g, pid, String(m.target));
      case "start":
        return engine.startGame(g, pid);
      case "nextRound":
        return engine.nextRound(g, pid);
      case "lobby":
        return engine.backToLobby(g, pid);
      case "settings":
        engine.updateSettings(g, pid, m.settings ?? {});
        return [];
      case "kick": {
        const events = engine.kick(g, pid, String(m.pid));
        for (const c of this.getConnections<ConnState>("player")) {
          if (c.state?.role === "player" && c.state.pid === m.pid) {
            this.send(c, { t: "fatal", message: "The host removed you from the table." });
            c.close(4001, "kicked");
          }
        }
        return events;
      }
      case "skip":
        return engine.skipCurrent(g, pid);
      case "addBot":
        return engine.addBot(g, pid);
      case "rename": {
        const p = g.players.find((x) => x.id === pid);
        if (p) p.name = engine.cleanName(m.name);
        return [];
      }
      default:
        return [];
    }
  }

  async onClose(conn: Connection<ConnState>) {
    const g = this.game;
    const st = conn.state;
    if (!g || st?.role !== "player") return;
    // Phones blip offline all the time (screen lock, Wi-Fi to mobile data). Give them a few
    // seconds to come back before the TV greys out their seat. The pending timer keeps the
    // room awake just long enough to check.
    const pid = st.pid;
    await new Promise((r) => setTimeout(r, DISCONNECT_GRACE_MS));
    if (!this.game || this.isOnline(pid, conn.id)) return;
    await this.commit(engine.setConnected(this.game, pid, false));
  }

  /** Is this player connected on any other socket (another tab, or a reconnect)? */
  private isOnline(pid: string, exceptId?: string) {
    for (const c of this.getConnections<ConnState>("player")) {
      if (c.id !== exceptId && c.state?.role === "player" && c.state.pid === pid && c.readyState === WebSocket.OPEN) return true;
    }
    return false;
  }

  async onAlarm() {
    // Idle cleanup: if nobody's here, forget the room.
    const anyone = [...this.getConnections()].length > 0;
    if (anyone) {
      await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return;
    }
    this.game = null;
    await this.ctx.storage.deleteAll();
  }

  private async save() {
    await this.ctx.storage.put(STORAGE_KEY, this.game);
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  private async commit(events: GameEvent[]) {
    if (!this.game) return;
    this.game.seq++;
    await this.save();
    this.sync(events);
    this.scheduleBots();
  }

  // ---------------- bots ----------------
  // Bots live inside the room: after every change we check whether a bot should act,
  // and if so do it after a human-feeling pause. (A pending timer keeps the room awake.)

  private botTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleBots() {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
    const g = this.game;
    if (!g || g.phase !== "playing") return;
    const current = g.players[g.turn];
    const someoneToCatch = g.vulnerable && g.players.some((p) => p.bot && p.id !== g.vulnerable);
    let delay: number;
    if (current?.bot) delay = 1100 + Math.random() * 1000;
    else if (someoneToCatch && Math.random() < 0.55) delay = 2500 + Math.random() * 2500; // give humans a head start
    else return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.runBots().catch((err) => console.error("bot error", err));
    }, delay);
  }

  private async runBots() {
    const g = this.game;
    if (!g || g.phase !== "playing") return;
    const current = g.players[g.turn];
    const events: GameEvent[] = [];
    if (current?.bot) {
      for (const msg of botTurn(g, current.id)) {
        try {
          events.push(...this.apply(g, current.id, msg));
        } catch (err) {
          // Shouldn't happen, but never let a confused bot stall the table.
          console.error("bot move rejected", msg, err);
          try {
            events.push(...(g.drawnCardId !== null || g.pendingDraw ? engine.pass(g, current.id) : engine.draw(g, current.id)));
          } catch {
            events.push(...engine.skipCurrent(g, g.hostId ?? current.id));
          }
          break;
        }
      }
    } else if (g.vulnerable) {
      const catcher = g.players.find((p) => p.bot && p.id !== g.vulnerable);
      if (catcher) events.push(...engine.catchPlayer(g, catcher.id, g.vulnerable));
    }
    await this.commit(events);
  }

  /** Send everyone the public state plus their own private hand. */
  private sync(events: GameEvent[], only?: Connection<ConnState>) {
    const g = this.game;
    if (!g) return;
    const pub = engine.publicView(g);
    const targets = only ? [only] : this.getConnections<ConnState>();
    for (const c of targets) {
      const st = c.state;
      const me = st?.role === "player" ? engine.privateView(g, st.pid) : null;
      this.send(c, { t: "state", state: pub, me, events });
    }
  }

  private send(c: Connection, msg: ServerMessage) {
    try {
      c.send(JSON.stringify(msg));
    } catch {
      /* socket already gone */
    }
  }
}

function errorMessage(err: unknown) {
  return err instanceof engine.GameError ? err.message : "Couldn't join that room.";
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join("");
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = newCode();
        const stub = await getServerByName(env.Room, code);
        if (await stub.create()) return json({ code });
      }
      return json({ error: "Couldn't find a free room code, try again." }, 503);
    }

    const check = url.pathname.match(/^\/api\/rooms\/([A-Z]{4})$/);
    if (check && request.method === "GET") {
      const stub = await getServerByName(env.Room, check[1]!);
      return json({ exists: await stub.exists() });
    }

    // WebSockets: /parties/room/<CODE>
    const routed = await routePartykitRequest(request, env);
    if (routed) return routed;

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
