// How a game's screens plug into the TV and phone shells.

import type { RoomPublic } from "../../shared/room";

export interface GameSnap<Pub = any, Me = any> {
  room: RoomPublic;
  pub: Pub;
  me: Me | null;
  /** What just happened in the game, for animation and sound. */
  events: any[];
  /** True for the first snapshot after the view mounts (don't animate old events). */
  first: boolean;
}

export interface TvCtx {
  /** The view's own area of the screen. */
  el: HTMLElement;
  /** Put a short status line in the TV header (e.g. "Round 2 · clockwise"). */
  setStatus(html: string): void;
  /** Send a game action as the host (only actions the game allows the TV to send). */
  send(action: unknown): void;
}

export interface PhoneCtx {
  el: HTMLElement;
  pid: string;
  send(action: unknown): void;
  /** Bottom sheets live in the shell; views can add their own and open them. */
  openSheet(sheet: HTMLElement): void;
  closeSheets(): void;
}

export interface GameView {
  update(s: GameSnap): void;
  destroy(): void;
  /** Extra buttons for the host menu (use data-gact='{"t":...}' to send a game action). */
  hostMenu?(s: GameSnap): string;
  /** The TV's Enter key / remote OK button. */
  onEnter?(): void;
  /** The server refused an action (e.g. undo a half-finished swipe). */
  onError?(): void;
}

export interface GameScreens {
  tv(ctx: TvCtx): GameView;
  phone(ctx: PhoneCtx): GameView;
}
