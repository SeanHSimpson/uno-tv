import { getServerByName, routePartykitRequest, Server, type Connection, type ConnectionContext } from "partyserver";
import { cleanEmote, GameError } from "../shared/common";
import * as R from "../shared/room";

type ConnState = { role: "tv" } | { role: "player"; pid: string };

const ROOM_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"; // consonants only: no accidental words, no 0/O 1/I mixups
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // rooms are cleaned up after 6 idle hours
const ALARM_REFRESH_MS = 15 * 60 * 1000; // no need to hit setAlarm on every single card play
const STORAGE_KEY = "room";
const DISCONNECT_GRACE_MS = 8_000;

/**
 * One Durable Object per room. It owns the room (members, host, chosen game and that
 * game's state) and every WebSocket in it (TVs and phones). Games plug in as modules
 * (src/shared/games); this class only deals with sockets, storage and timing.
 */
export class Room extends Server<Env> {
  static options = { hibernate: true };

  room: R.RoomState | null = null;

  async onStart() {
    const saved = await this.ctx.storage.get<R.RoomState>(STORAGE_KEY);
    this.room = saved?.version === 2 ? saved : null;
    // Heartbeats from phones/TVs are answered by the runtime itself, so they never wake a hibernating room.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** RPC from the Worker when a TV creates a room. Returns false if the code is taken. */
  async create(): Promise<boolean> {
    if (this.room) return false;
    await this.ctx.storage.delete("game"); // leftovers from the single-game version
    this.room = R.newRoom(this.name);
    await this.save();
    return true;
  }

  async exists(): Promise<boolean> {
    return this.room !== null;
  }

  getConnectionTags(_c: Connection, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    return [url.searchParams.get("role") === "tv" ? "tv" : "player"];
  }

  async onConnect(conn: Connection<ConnState>, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    if (!this.room) {
      this.send(conn, { t: "fatal", message: "That room doesn't exist. Check the code on the TV." });
      conn.close(4404, "no such room");
      return;
    }
    if (url.searchParams.get("role") === "tv") {
      conn.setState({ role: "tv" });
      this.sync({ room: [], game: [] }, conn);
      this.scheduleBots(); // in case the room just woke up mid-game
      this.scheduleTurnTimer();
      return;
    }
    const pid = (url.searchParams.get("pid") ?? "").slice(0, 64);
    if (!/^[\w-]{8,64}$/.test(pid)) {
      this.send(conn, { t: "fatal", message: "Bad player id." });
      conn.close(4400, "bad pid");
      return;
    }
    conn.setState({ role: "player", pid });
    this.lastActive.set(pid, Date.now());
    try {
      await this.commit(R.join(this.room, pid, url.searchParams.get("name"), url.searchParams.get("avatar"), Math.random));
    } catch (err) {
      this.send(conn, { t: "fatal", message: err instanceof GameError ? err.message : "Couldn't join that room." });
      conn.close(4403, "rejected");
    }
  }

  private tvConnections() {
    const out: Connection<ConnState>[] = [];
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.role === "tv") out.push(c);
    }
    return out;
  }

  async onMessage(conn: Connection<ConnState>, raw: string | ArrayBuffer | ArrayBufferView) {
    const r = this.room;
    const st = conn.state;
    if (!r || !st || raw === "ping") return;
    let msg: R.ClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer));
    } catch {
      return;
    }
    try {
      let res: R.Result;
      if (st.role === "tv") {
        // TVs are mostly display-only: they may start the chosen game, or send a few
        // game actions (like "next round") on the host's behalf.
        if (msg?.t === "start" && r.hostId) res = R.start(r, r.hostId, Math.random);
        else if (msg?.t === "game") res = R.tvAction(r, msg.action, Math.random);
        else return;
      } else {
        this.lastActive.set(st.pid, Date.now());
        if (msg?.t === "hello") {
          // Returning from background on a still-open socket: restore online state if it had flipped.
          if (R.markActive(r, st.pid)) await this.commit({ room: [], game: [] });
          else this.sync({ room: [], game: [] }, conn);
          return;
        }
        if (msg?.t === "emote") {
          const emote = cleanEmote(msg.emote);
          if (!emote) return;
          const now = Date.now();
          if (now - (this.lastEmote.get(st.pid) ?? 0) < 1200) return;
          this.lastEmote.set(st.pid, now);
          if (R.markActive(r, st.pid)) await this.commit({ room: [], game: [] });
          for (const tv of this.tvConnections()) this.send(tv, { t: "emote", pid: st.pid, emote });
          return;
        }
        if (msg?.t === "skipTrack") {
          if (r.hostId !== st.pid) return this.send(conn, { t: "error", message: "Only the host can do that." });
          for (const tv of this.tvConnections()) this.send(tv, { t: "skipTrack" });
          return;
        }
        res = R.handle(r, st.pid, msg, Math.random);
        if (msg?.t === "kick") this.disconnectKicked(String(msg.pid));
        if (msg?.t === "leave") {
          await this.commit(res);
          conn.close(4002, "left");
          return;
        }
      }
      await this.commit(res);
    } catch (err) {
      if (err instanceof GameError) this.send(conn, { t: "error", message: err.message });
      else {
        console.error("room error", err);
        this.send(conn, { t: "error", message: "Something went wrong. Try again." });
      }
    }
  }

  private disconnectKicked(pid: string) {
    if (this.room?.members.some((m) => m.id === pid)) return; // kick was refused
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.role === "player" && c.state.pid === pid) {
        this.send(c, { t: "fatal", message: "The host removed you from the table." });
        c.close(4001, "kicked");
      }
    }
  }

  async onClose(conn: Connection<ConnState>) {
    const st = conn.state;
    if (!this.room || st?.role !== "player") return;
    // Phones blip offline all the time (screen lock, Wi-Fi to mobile data). Give them a few
    // seconds to come back before the TV greys out their seat. The pending timer keeps the
    // room awake just long enough to check.
    const pid = st.pid;
    const closedAt = Date.now();
    await new Promise((r) => setTimeout(r, DISCONNECT_GRACE_MS));
    if (!this.room || (this.lastActive.get(pid) ?? 0) > closedAt || this.isOnline(pid, conn.id)) return;
    await this.commit(R.setConnected(this.room, pid, false, Math.random));
  }

  /** Is this player connected on any other socket (another tab, or a reconnect)? */
  private isOnline(pid: string, exceptId?: string) {
    for (const c of this.getConnections<ConnState>()) {
      if (c.id !== exceptId && c.state?.role === "player" && c.state.pid === pid) {
        if (c.readyState === WebSocket.OPEN || c.readyState === 1) return true;
      }
    }
    return false;
  }

  async onAlarm() {
    // Idle cleanup: if nobody's here, forget the room.
    const anyone = [...this.getConnections()].length > 0;
    if (anyone) {
      this.lastAlarmAt = Date.now();
      await this.ctx.storage.setAlarm(this.lastAlarmAt + ROOM_TTL_MS);
      return;
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
  }

  private lastAlarmAt = 0;

  private async save() {
    const now = Date.now();
    if (now - this.lastAlarmAt >= ALARM_REFRESH_MS) {
      this.lastAlarmAt = now;
      await Promise.all([this.ctx.storage.put(STORAGE_KEY, this.room), this.ctx.storage.setAlarm(now + ROOM_TTL_MS)]);
    } else {
      await this.ctx.storage.put(STORAGE_KEY, this.room);
    }
  }

  private async commit(res: R.Result) {
    if (!this.room) return;
    R.syncTurnTimer(this.room, Date.now());
    this.room.seq++;
    await this.save();
    this.sync(res);
    this.scheduleBots();
    this.scheduleTurnTimer();
  }

  // ---------------- bots & turn timer ----------------
  // Bots live inside the room: after every change we ask the game whether a bot should
  // act, and if so do it after a human-feeling pause. (A pending timer keeps the room awake.)

  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmote = new Map<string, number>();
  private lastActive = new Map<string, number>();

  private scheduleTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    const r = this.room;
    if (!r || !r.turnDeadline) return;
    const turn = R.activeTurn(r);
    if (!turn) return;
    const wait = Math.max(50, r.turnDeadline - Date.now());
    const expectedKey = r.turnKey;
    const pid = turn.pid;
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      if (!this.room || this.room.turnKey !== expectedKey) return;
      try {
        const res = R.runTimeout(this.room, pid, Math.random);
        this.commit(res).catch((err) => console.error("timeout commit error", err));
      } catch (err) {
        console.error("timeout error", err);
      }
    }, wait);
  }

  private scheduleBots() {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
    if (!this.room) return;
    const due = R.nextBot(this.room, Math.random);
    if (!due) return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      if (!this.room) return;
      try {
        const res = R.runBot(this.room, due.pid, Math.random);
        this.commit(res).catch((err) => console.error("bot commit error", err));
      } catch (err) {
        console.error("bot error", err);
      }
    }, due.delay);
  }

  /** Send everyone the room, the game's public state, and their own private state. */
  private sync(events: R.Result, only?: Connection<ConnState>) {
    const r = this.room;
    if (!r) return;
    const room = R.roomView(r);
    const pubGame = R.gameView(r, null);
    const targets = only ? [only] : this.getConnections<ConnState>();
    for (const c of targets) {
      const st = c.state;
      const game = st?.role === "player" ? R.gameView(r, st.pid) : pubGame;
      this.send(c, { t: "state", room, game, events });
    }
  }

  private send(c: Connection, msg: R.ServerMessage) {
    try {
      c.send(JSON.stringify(msg));
    } catch {
      /* socket already gone */
    }
  }
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
