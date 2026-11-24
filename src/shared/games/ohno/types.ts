// OhNo! types, shared by the rules engine (server) and the OhNo! views (browser).

export const COLORS = ["red", "yellow", "green", "blue"] as const;
export type Color = (typeof COLORS)[number];
export type CardColor = Color | "wild";
export type ActionValue = "skip" | "reverse" | "draw2";
export type WildValue = "wild" | "wild4";
export type NumberValue = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export type CardValue = NumberValue | ActionValue | WildValue;

export interface Card {
  id: number;
  color: CardColor;
  value: CardValue;
}

export interface Settings {
  /** Allow stacking +2 on +2 (and +4 on +4) to pass the penalty along. */
  stacking: boolean;
  /** When drawing (manually or automatically), keep drawing until a playable card shows up. */
  drawUntilPlayable: boolean;
  /** 0 = single round; otherwise first to this many points wins. */
  targetScore: number;
  /** Cards drawn when caught without calling OhNo!. */
  catchPenalty: number;
  /** Classic 7-0 rule: playing a 7 swaps hands with the next player; playing a 0 rotates everyone's hands. */
  sevenZero: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  stacking: false,
  drawUntilPlayable: false,
  targetScore: 0,
  catchPenalty: 2,
  sevenZero: false,
};

export type Phase = "lobby" | "playing" | "roundOver";

export interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  connected: boolean;
  score: number;
  calledOhNo: boolean;
  lastPlayed: Card | null;
  /** index into the avatar palette, stable for the lifetime of the room */
  hue: number;
  /** Computer player, run by the room itself. */
  bot?: boolean;
  /** Picture the player chose (one of AVATARS). */
  avatar?: string;
}

export interface GameState {
  code: string;
  phase: Phase;
  settings: Settings;
  hostId: string | null;
  players: PlayerState[];
  drawPile: Card[];
  discard: Card[];
  color: Color | null;
  turn: number;
  direction: 1 | -1;
  /** Accumulated draw penalty waiting on the current player (only non-zero while stacking). */
  pendingDraw: number;
  pendingType: "draw2" | "wild4" | null;
  /** The card the current player just drew and may play (or pass). */
  drawnCardId: number | null;
  /** Player who went down to one card without calling OhNo! and can be caught. */
  vulnerable: string | null;
  round: number;
  roundWinner: string | null;
  roundPoints: number;
  gameWinner: string | null;
  seq: number;
}

/** Things that happened, so the clients can animate them in order. */
export type GameEvent =
  | { type: "deal"; round: number; first: string }
  | { type: "play"; pid: string; card: Card; color: Color }
  | { type: "draw"; pid: string; count: number; reason: "auto" | "manual" | "penalty" | "caught" | "join" }
  | { type: "skip"; pid: string }
  | { type: "reverse"; direction: 1 | -1 }
  | { type: "swap"; pid: string; withPid: string }
  | { type: "rotate"; direction: 1 | -1 }
  | { type: "pass"; pid: string }
  | { type: "ohno"; pid: string }
  | { type: "caught"; pid: string; by: string; count: number }
  | { type: "roundOver"; winner: string; points: number; gameOver: boolean }
  | { type: "reshuffle" }
  | { type: "joined"; pid: string }
  | { type: "left"; pid: string; kicked: boolean };

export interface PublicPlayer {
  id: string;
  name: string;
  count: number;
  connected: boolean;
  score: number;
  calledOhNo: boolean;
  lastPlayed: Card | null;
  hue: number;
  bot: boolean;
  avatar: string | null;
}

export interface PublicState {
  code: string;
  phase: Phase;
  settings: Settings;
  hostId: string | null;
  players: PublicPlayer[];
  discard: Card[]; // last few, top is last
  color: Color | null;
  turnId: string | null;
  direction: 1 | -1;
  pendingDraw: number;
  drawPileCount: number;
  vulnerable: string | null;
  round: number;
  roundWinner: string | null;
  roundPoints: number;
  gameWinner: string | null;
  /** Hands revealed at the end of a round. */
  reveal: Record<string, Card[]> | null;
  seq: number;
}

export interface PrivateState {
  pid: string;
  hand: Card[];
  playable: number[];
  canDraw: boolean;
  canPass: boolean;
  canTake: boolean;
  drawnCardId: number | null;
}

/** What a phone can ask OhNo! to do. */
export type OhNoAction =
  | { t: "play"; cardId: number; color?: Color }
  | { t: "draw" }
  | { t: "pass" }
  | { t: "take" }
  | { t: "ohno" }
  | { t: "catch"; target: string }
  | { t: "skip" }
  | { t: "nextRound" };

export const HAND_SIZE = 7;
