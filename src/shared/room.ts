// The room: who's here, who hosts, which game, and the running game's state.
// Pure logic (no I/O) so it's unit-testable; the Durable Object wraps it.

import { cleanAvatar, cleanName, fail, GameError, MAX_PLAYERS, publicMember, type EmoteId, type Member, type PublicMember, type Rng } from "./common";
import { GAMES, isGameId } from "./games";
import type { ActionCtx, GameId } from "./games/types";

export type TurnTimerOption = 0 | 30 | 60;

export interface RoomState {
  version: 2;
  code: string;
  hostId: string | null;
  members: Member[];
  gameId: GameId;
  settings: Partial<Record<GameId, Record<string, unknown>>>;
  audio: { tvMusic: boolean; tvSounds: boolean };
  /** Optional per-turn countdown in seconds (0 = off). */
  turnTimer?: TurnTimerOption;
  turnKey?: string | null;
  turnDeadline?: number | null;
  winAwarded?: boolean;
  phase: "lobby" | "game";
  /** State of the running game module (null in the lobby). */
  game: unknown;
  /** A short message for everyone, e.g. why a game ended. */
  notice: string | null;
  seq: number;
}

export type RoomEvent =
  | { type: "joined"; pid: string }
  | { type: "left"; pid: string; kicked: boolean }
  | { type: "started"; gameId: GameId }
  | { type: "ended"; reason: string | null };

export interface Result {
  room: RoomEvent[];
  game: unknown[];
}
const none = (): Result => ({ room: [], game: [] });

export function newRoom(code: string): RoomState {
  return {
    version: 2,
    code,
    hostId: null,
    members: [],
    gameId: "ohno",
    settings: {},
    audio: { tvMusic: true, tvSounds: true },
    turnTimer: 0,
    turnKey: null,
    turnDeadline: null,
    winAwarded: false,
    phase: "lobby",
    game: null,
    notice: null,
    seq: 0,
  };
}

const mod = (r: RoomState) => GAMES[r.gameId];
const ctx = (r: RoomState, pid: string | null, rng: Rng): ActionCtx => ({ isHost: !!pid && pid === r.hostId, hostId: r.hostId, rng });
const requireHost = (r: RoomState, pid: string) => {
  if (r.hostId !== pid) fail("Only the host can do that.");
};
const member = (r: RoomState, pid: string) => r.members.find((m) => m.id === pid) ?? fail("You're not in this room.");

export function settingsFor(r: RoomState, id: GameId = r.gameId): Record<string, unknown> {
  return { ...GAMES[id].defaultSettings, ...(r.settings[id] ?? {}) };
}

function freeHue(r: RoomState) {
  const used = new Set(r.members.map((m) => m.hue));
  let hue = 0;
  while (used.has(hue) && hue < MAX_PLAYERS) hue++;
  return hue;
}

/** The host role only ever goes to a person, never a bot. */
function pickHost(r: RoomState) {
  r.hostId = r.members.find((m) => m.connected && !m.bot)?.id ?? r.members.find((m) => !m.bot)?.id ?? null;
}

function syncGame(r: RoomState) {
  if (r.phase === "game" && r.game) mod(r).sync(r.game, r.members, r.hostId);
}

/** After anything touches the game: award session wins when over, or return to lobby on abort. */
function settle(r: RoomState, res: Result): Result {
  if (r.phase === "game" && r.game) {
    const st = mod(r).status(r.game);
    if (st === "abort") {
      r.phase = "lobby";
      r.game = null;
      r.winAwarded = false;
      r.turnKey = null;
      r.turnDeadline = null;
      r.notice = "Not enough players left to keep going, so we're back in the lobby.";
      res.room.push({ type: "ended", reason: r.notice });
    } else if (st === "over") {
      if (!r.winAwarded) {
        r.winAwarded = true;
        for (const wid of mod(r).winners?.(r.game) ?? []) {
          const m = r.members.find((x) => x.id === wid);
          if (m) m.wins = (m.wins ?? 0) + 1;
        }
      }
    } else {
      r.winAwarded = false;
    }
  }
  return res;
}

// ---------- membership ----------

export function join(r: RoomState, pid: string, rawName: unknown, rawAvatar: unknown, rng: Rng): Result {
  const res = none();
  const existing = r.members.find((m) => m.id === pid);
  if (existing) {
    existing.connected = true;
    if (rawName) existing.name = cleanName(rawName);
    existing.avatar = cleanAvatar(rawAvatar) ?? existing.avatar;
    if (!r.hostId) pickHost(r);
    syncGame(r);
    return res;
  }
  if (r.members.length >= MAX_PLAYERS) fail(`This table is full (${MAX_PLAYERS} players max).`);
  const m: Member = { id: pid, name: cleanName(rawName), hue: freeHue(r), avatar: cleanAvatar(rawAvatar), connected: true };
  r.members.push(m);
  if (!r.hostId) r.hostId = pid;
  res.room.push({ type: "joined", pid });
  if (r.phase === "game" && r.game) res.game.push(...mod(r).join(r.game, m, ctx(r, pid, rng)));
  syncGame(r);
  return settle(r, res);
}

const BOT_NAMES = ["Robo Rita", "Bitsy", "Sir Beeps", "Clanky", "Pixel", "Gizmo", "Dot Matrix", "Sprocket", "Widget"];

export function addBot(r: RoomState, by: string, rng: Rng): Result {
  requireHost(r, by);
  if (r.members.length >= MAX_PLAYERS) fail(`This table is full (${MAX_PLAYERS} players max).`);
  const used = new Set(r.members.map((m) => m.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${r.members.length + 1}`;
  const pid = `bot-${Math.floor(rng() * 1e9).toString(36)}-${r.members.length}`;
  const res = join(r, pid, name, undefined, rng);
  member(r, pid).bot = true;
  syncGame(r);
  return res;
}

export function setConnected(r: RoomState, pid: string, connected: boolean, rng: Rng): Result {
  const m = r.members.find((x) => x.id === pid);
  if (!m || m.bot || m.connected === connected) return none();
  // Empty seats in the lobby just disappear; during a game we hold their seat for when they come back.
  if (!connected && r.phase === "lobby") return remove(r, pid, false, rng);
  m.connected = connected; // the host keeps the role while briefly away
  syncGame(r);
  return none();
}

export function remove(r: RoomState, pid: string, kicked: boolean, rng: Rng): Result {
  const i = r.members.findIndex((m) => m.id === pid);
  if (i < 0) return none();
  r.members.splice(i, 1);
  const res = none();
  res.room.push({ type: "left", pid, kicked });
  if (r.hostId === pid) pickHost(r);
  if (r.phase === "game" && r.game) res.game.push(...mod(r).leave(r.game, pid, ctx(r, null, rng)));
  syncGame(r);
  return settle(r, res);
}

export function kick(r: RoomState, by: string, pid: string, rng: Rng): Result {
  requireHost(r, by);
  if (pid === by) fail("You can't remove yourself.");
  member(r, pid);
  return remove(r, pid, true, rng);
}

/** A player leaves the room voluntarily. */
export function leave(r: RoomState, pid: string, rng: Rng): Result {
  return remove(r, pid, false, rng);
}

/** Hand the host crown to another human player in the room. */
export function transferHost(r: RoomState, by: string, toPid: string): Result {
  requireHost(r, by);
  const target = member(r, toPid);
  if (target.bot) fail("Bots can't be the host.");
  if (!target.connected) fail(`${target.name} is offline right now.`);
  r.hostId = target.id;
  syncGame(r);
  return none();
}

export function setTurnTimer(r: RoomState, by: string, seconds: unknown): Result {
  requireHost(r, by);
  const n = Number(seconds);
  if (n !== 0 && n !== 30 && n !== 60) fail("Pick Off, 30s, or 60s.");
  r.turnTimer = n as TurnTimerOption;
  r.turnKey = null;
  r.turnDeadline = null;
  return none();
}

export function setAvatar(r: RoomState, pid: string, raw: unknown): Result {
  const avatar = cleanAvatar(raw);
  if (!avatar) fail("Pick one of the pictures.");
  member(r, pid).avatar = avatar;
  syncGame(r);
  return none();
}

// ---------- host controls ----------

export function selectGame(r: RoomState, by: string, gameId: unknown): Result {
  requireHost(r, by);
  if (!isGameId(gameId)) fail("That game isn't available.");
  if (r.phase !== "lobby") fail("Finish this game first.");
  r.gameId = gameId as GameId;
  r.notice = null;
  return none();
}

export function updateSettings(r: RoomState, by: string, gameId: unknown, patch: unknown): Result {
  requireHost(r, by);
  if (!isGameId(gameId)) fail("That game isn't available.");
  const defs = GAMES[gameId as GameId].settings;
  const next = { ...settingsFor(r, gameId as GameId) };
  for (const [key, value] of Object.entries((patch ?? {}) as Record<string, unknown>)) {
    const def = defs.find((d) => d.key === key);
    // Only accept known settings with one of their listed values.
    if (def && def.options.some((o) => o.value === value)) next[key] = value;
  }
  r.settings[gameId as GameId] = next;
  return none();
}

export function setAudio(r: RoomState, by: string, patch: unknown): Result {
  requireHost(r, by);
  const p = (patch ?? {}) as Record<string, unknown>;
  if (typeof p.tvMusic === "boolean") r.audio.tvMusic = p.tvMusic;
  if (typeof p.tvSounds === "boolean") r.audio.tvSounds = p.tvSounds;
  return none();
}

export function start(r: RoomState, by: string, rng: Rng): Result {
  requireHost(r, by);
  if (r.phase !== "lobby") fail("A game is already going.");
  const m = mod(r);
  const players = r.members.filter((x) => x.connected || x.bot);
  if (players.length < m.meta.minPlayers) fail(`${m.meta.name} needs at least ${m.meta.minPlayers} players (you can add a bot).`);
  if (players.length > m.meta.maxPlayers) fail(`${m.meta.name} is for up to ${m.meta.maxPlayers} players.`);
  const { state, events } = m.start(players, settingsFor(r), ctx(r, by, rng));
  r.game = state;
  r.phase = "game";
  r.winAwarded = false;
  r.turnKey = null;
  r.turnDeadline = null;
  r.notice = null;
  return settle(r, { room: [{ type: "started", gameId: r.gameId }], game: events });
}

export function endGame(r: RoomState, by: string): Result {
  requireHost(r, by);
  if (r.phase !== "game") return none();
  r.phase = "lobby";
  r.game = null;
  r.winAwarded = false;
  r.turnKey = null;
  r.turnDeadline = null;
  // Anyone whose phone left during the game gives up their seat now.
  const gone = r.members.filter((m) => !m.connected && !m.bot).map((m) => m.id);
  const res: Result = { room: [{ type: "ended", reason: null }], game: [] };
  for (const pid of gone) {
    r.members = r.members.filter((m) => m.id !== pid);
    res.room.push({ type: "left", pid, kicked: false });
  }
  if (!r.members.some((m) => m.id === r.hostId)) pickHost(r);
  return res;
}

// ---------- playing ----------

export function gameAction(r: RoomState, pid: string, action: unknown, rng: Rng): Result {
  if (r.phase !== "game" || !r.game) fail("There's no game going right now.");
  member(r, pid);
  return settle(r, { room: [], game: mod(r).action(r.game, pid, action, ctx(r, pid, rng)) });
}

/** The TV may send a few actions (like "next round") on the host's behalf. */
export function tvAction(r: RoomState, action: unknown, rng: Rng): Result {
  const t = (action as { t?: unknown } | null)?.t;
  if (r.phase !== "game" || !r.hostId || typeof t !== "string" || !mod(r).tvActions?.includes(t)) return none();
  return gameAction(r, r.hostId, action, rng);
}

export function nextBot(r: RoomState, rng: Rng) {
  if (r.phase !== "game" || !r.game) return null;
  return mod(r).nextBot(r.game, ctx(r, null, rng));
}

/** Update turnDeadline whenever the active human turn changes (for the optional turn timer). */
export function syncTurnTimer(r: RoomState, now: number) {
  const sec = r.turnTimer ?? 0;
  if (!sec || r.phase !== "game" || !r.game) {
    r.turnKey = null;
    r.turnDeadline = null;
    return;
  }
  const turn = mod(r).activeTurn?.(r.game) ?? null;
  const m = turn ? r.members.find((x) => x.id === turn.pid) : undefined;
  if (!turn || !m || m.bot) {
    r.turnKey = null;
    r.turnDeadline = null;
    return;
  }
  if (turn.key !== r.turnKey || !r.turnDeadline) {
    r.turnKey = turn.key;
    r.turnDeadline = now + sec * 1000;
  }
}

export function activeTurn(r: RoomState) {
  if (r.phase !== "game" || !r.game) return null;
  return mod(r).activeTurn?.(r.game) ?? null;
}

export function runTimeout(r: RoomState, pid: string, rng: Rng): Result {
  if (r.phase !== "game" || !r.game) return none();
  const m = mod(r);
  if (!m.timeout) return none();
  const ev = m.timeout(r.game, pid, ctx(r, pid, rng));
  r.turnKey = null;
  r.turnDeadline = null;
  return settle(r, { room: [], game: ev });
}

export function runBot(r: RoomState, pid: string, rng: Rng): Result {
  const res = none();
  if (r.phase !== "game" || !r.game) return res;
  const m = mod(r);
  for (const a of m.botActions(r.game, pid, ctx(r, pid, rng))) {
    try {
      res.game.push(...m.action(r.game, pid, a, ctx(r, pid, rng)));
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      // Never let a confused bot stall the table.
      try {
        res.game.push(...(m.botRescue?.(r.game, pid, ctx(r, pid, rng)) ?? []));
      } catch (again) {
        if (!(again instanceof GameError)) throw again;
      }
      break;
    }
  }
  return settle(r, res);
}

// ---------- views ----------

export interface RoomPublic {
  code: string;
  hostId: string | null;
  members: PublicMember[];
  gameId: GameId;
  settings: Record<string, unknown>;
  audio: { tvMusic: boolean; tvSounds: boolean };
  turnTimer: TurnTimerOption;
  turnDeadline: number | null;
  phase: "lobby" | "game";
  notice: string | null;
  seq: number;
}

export function roomView(r: RoomState): RoomPublic {
  return {
    code: r.code,
    hostId: r.hostId,
    members: r.members.map(publicMember),
    gameId: r.gameId,
    settings: settingsFor(r),
    audio: r.audio,
    turnTimer: r.turnTimer ?? 0,
    turnDeadline: r.turnDeadline ?? null,
    phase: r.phase,
    notice: r.notice,
    seq: r.seq,
  };
}

export function gameView(r: RoomState, pid: string | null) {
  if (r.phase !== "game" || !r.game) return null;
  const m = mod(r);
  return { id: r.gameId, pub: m.publicView(r.game), me: pid ? m.privateView(r.game, pid) : null };
}

// ---------- wire protocol ----------

export type ClientMessage =
  | { t: "selectGame"; gameId: GameId }
  | { t: "settings"; gameId: GameId; settings: Record<string, unknown> }
  | { t: "audio"; audio: { tvMusic?: boolean; tvSounds?: boolean } }
  | { t: "turnTimer"; seconds: number }
  | { t: "start" }
  | { t: "endGame" }
  | { t: "addBot" }
  | { t: "kick"; pid: string }
  | { t: "leave" }
  | { t: "transferHost"; pid: string }
  | { t: "avatar"; avatar: string }
  | { t: "emote"; emote: EmoteId }
  | { t: "skipTrack" }
  | { t: "game"; action: unknown };

export type ServerMessage =
  | {
      t: "state";
      room: RoomPublic;
      game: { id: GameId; pub: unknown; me: unknown } | null;
      events: Result;
    }
  | { t: "emote"; pid: string; emote: EmoteId }
  | { t: "skipTrack" }
  | { t: "error"; message: string }
  | { t: "fatal"; message: string };

/** Apply a message from a player's phone. */
export function handle(r: RoomState, pid: string, m: ClientMessage, rng: Rng): Result {
  switch (m?.t) {
    case "selectGame":
      return selectGame(r, pid, m.gameId);
    case "settings":
      return updateSettings(r, pid, m.gameId, m.settings);
    case "audio":
      return setAudio(r, pid, m.audio);
    case "turnTimer":
      return setTurnTimer(r, pid, m.seconds);
    case "start":
      return start(r, pid, rng);
    case "endGame":
      return endGame(r, pid);
    case "addBot":
      return addBot(r, pid, rng);
    case "kick":
      return kick(r, pid, String(m.pid), rng);
    case "leave":
      return leave(r, pid, rng);
    case "transferHost":
      return transferHost(r, pid, String(m.pid));
    case "avatar":
      return setAvatar(r, pid, m.avatar);
    case "game":
      return gameAction(r, pid, m.action, rng);
    default:
      return none();
  }
}
