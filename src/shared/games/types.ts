// The contract every game implements so the room can host it.
// A module is pure TypeScript (no I/O): the room handles sockets, storage, timing and members.

import type { Member, Rng } from "../common";

export type GameId = "ohno" | "hush" | "rummy";

/** A host-adjustable option, declared as data so the lobby can render and validate it. */
export interface SettingDef {
  key: string;
  label: string;
  options: { value: string | number | boolean; label: string }[];
}

export interface GameMeta {
  id: GameId;
  name: string;
  /** One line for the game picker. */
  tagline: string;
  /** A sentence or two shown when the game is selected. */
  howTo: string;
  emoji: string;
  minPlayers: number;
  maxPlayers: number;
  /** Which background music suits it: "game" (lively) or "calm". */
  music: "game" | "calm";
  coop?: boolean;
}

export interface ActionCtx {
  isHost: boolean;
  hostId: string | null;
  rng: Rng;
}

export type GameStatus = "playing" | "over" | "abort";

export interface GameModule<S = any, Settings = any, Action = any, Event = any> {
  meta: GameMeta;
  settings: SettingDef[];
  defaultSettings: Settings;

  /** Deal / set up a new game for these people. */
  start(members: Member[], settings: Settings, ctx: ActionCtx): { state: S; events: Event[] };
  /** A player (or bot) did something. Throw GameError with a friendly message to refuse. */
  action(state: S, pid: string, action: Action, ctx: ActionCtx): Event[];
  /** Someone joined mid-game (they may sit out until the next round). */
  join(state: S, member: Member, ctx: ActionCtx): Event[];
  /** Someone left or was removed mid-game. */
  leave(state: S, pid: string, ctx: ActionCtx): Event[];
  /** Copy names, pictures, online status and the host from the room into the game's copy of the players. */
  sync(state: S, members: Member[], hostId: string | null): void;

  publicView(state: S): unknown;
  privateView(state: S, pid: string): unknown;

  /** Is a bot due to act? Returns who, and after how long, or null. */
  nextBot(state: S, ctx: ActionCtx): { pid: string; delay: number } | null;
  /** The bot's moves (applied in order through `action`). */
  botActions(state: S, pid: string, ctx: ActionCtx): Action[];
  /** If a bot's move was refused, something safe to do instead so the table never stalls. */
  botRescue?(state: S, pid: string, ctx: ActionCtx): Event[];

  /** "over" = finished (results showing), "abort" = can't continue (e.g. too few players). */
  status(state: S): GameStatus;
  /** Actions the TV itself may send on the host's behalf (e.g. "next round" via the remote). */
  tvActions?: string[];
}
