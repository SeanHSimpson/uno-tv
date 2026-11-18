// Hush: a cooperative, no-talking game.
//
// Cards 1–100. On level N everyone holds N cards. The whole table must play every
// card in rising order, without talking and without taking turns: anyone may play
// their lowest card at any moment. If you play while someone holds a lower card,
// the team loses a heart and those lower cards are discarded. Stars: if everyone
// agrees, each player discards their lowest card. Clear the goal level to win.

import { fail, shuffle, type Member, type Rng } from "../../common";

export interface HushSettings extends Record<string, unknown> {
  /** 0 = automatic, based on player count. */
  goal: number;
}
export const HUSH_DEFAULTS: HushSettings = { goal: 0 };

export type HushPhase = "ready" | "playing" | "won" | "lost";

export interface HushPlayer {
  id: string;
  name: string;
  hue: number;
  avatar?: string;
  bot?: boolean;
  connected: boolean;
  hand: number[]; // always sorted ascending
  ready: boolean;
  star: boolean;
}

export interface HushState {
  phase: HushPhase;
  level: number;
  goal: number;
  hearts: number;
  stars: number;
  players: HushPlayer[];
  /** Cards played this level, in order. */
  pile: number[];
  /** Cards thrown away this level (mistakes and stars), shown face up. */
  discarded: number[];
  last: { pid: string; card: number } | null;
  hostId: string | null;
  /** Counts up on every change so bot timing can restart from "now". */
  tick: number;
}

export type HushEvent =
  | { type: "deal"; level: number }
  | { type: "ready"; pid: string }
  | { type: "go"; level: number }
  | { type: "play"; pid: string; card: number }
  | { type: "mistake"; pid: string; card: number; lost: { pid: string; cards: number[] }[]; hearts: number }
  | { type: "starVote"; pid: string; on: boolean }
  | { type: "star"; discards: { pid: string; card: number }[] }
  | { type: "levelDone"; level: number; reward: "heart" | "star" | null }
  | { type: "won" }
  | { type: "lost" };

export type HushAction = { t: "ready" } | { t: "play" } | { t: "star" } | { t: "restart" };

export const MAX_HEARTS = 5;
export const MAX_STARS = 3;
const STAR_LEVELS = [3, 6, 9];
const HEART_LEVELS = [4, 8];

export function autoGoal(players: number) {
  return players <= 2 ? 10 : players === 3 ? 9 : 8;
}

const toPlayer = (m: Member): HushPlayer => ({
  id: m.id,
  name: m.name,
  hue: m.hue,
  avatar: m.avatar,
  bot: m.bot,
  connected: m.connected,
  hand: [],
  ready: false,
  star: false,
});

export function newHush(members: Member[], settings: HushSettings, hostId: string | null, rng: Rng): { state: HushState; events: HushEvent[] } {
  const players = members.map(toPlayer);
  const state: HushState = {
    phase: "ready",
    level: 0,
    goal: settings.goal || autoGoal(players.length),
    hearts: Math.min(MAX_HEARTS, Math.max(2, players.length)),
    stars: 1,
    players,
    pile: [],
    discarded: [],
    last: null,
    hostId,
    tick: 0,
  };
  return { state, events: deal(state, 1, rng) };
}

function deal(s: HushState, level: number, rng: Rng): HushEvent[] {
  const deck = shuffle(Array.from({ length: 100 }, (_, i) => i + 1), rng);
  s.level = level;
  s.phase = "ready";
  s.pile = [];
  s.discarded = [];
  s.last = null;
  for (const p of s.players) {
    p.hand = deck.splice(0, level).sort((a, b) => a - b);
    p.ready = false;
    p.star = false;
  }
  s.tick++;
  return [{ type: "deal", level }];
}

const find = (s: HushState, pid: string) => s.players.find((p) => p.id === pid) ?? fail("You're not in this game.");
const allEmpty = (s: HushState) => s.players.every((p) => p.hand.length === 0);

export function ready(s: HushState, pid: string): HushEvent[] {
  if (s.phase !== "ready") return [];
  const p = find(s, pid);
  if (p.ready) return [];
  p.ready = true;
  s.tick++;
  const events: HushEvent[] = [{ type: "ready", pid }];
  // Players whose phones dropped count as ready, so the table never waits forever.
  if (s.players.every((x) => x.ready || !x.connected)) {
    s.phase = "playing";
    events.push({ type: "go", level: s.level });
  }
  return events;
}

/** Play your lowest card (the only sensible card to play in Hush). */
export function playLowest(s: HushState, pid: string, rng: Rng): HushEvent[] {
  if (s.phase !== "playing") fail(s.phase === "ready" ? "Wait for everyone to be ready." : "This game is over.");
  const p = find(s, pid);
  const card = p.hand.shift();
  if (card === undefined) fail("You're out of cards this level. Sit tight!");
  s.tick++;
  const events: HushEvent[] = [{ type: "play", pid, card: card! }];
  s.pile.push(card!);
  s.last = { pid, card: card! };

  // Did anyone still hold something lower? That's a mistake.
  const lost: { pid: string; cards: number[] }[] = [];
  for (const other of s.players) {
    const lower = other.hand.filter((c) => c < card!);
    if (lower.length) {
      other.hand = other.hand.filter((c) => c > card!);
      lost.push({ pid: other.id, cards: lower });
      s.discarded.push(...lower);
    }
  }
  if (lost.length) {
    s.hearts--;
    events.push({ type: "mistake", pid, card: card!, lost, hearts: s.hearts });
    if (s.hearts <= 0) {
      s.phase = "lost";
      events.push({ type: "lost" });
      return events;
    }
  }
  return events.concat(checkLevelDone(s, rng));
}

/** Vote (or un-vote) to use a star. When everyone holding cards agrees, it happens. */
export function voteStar(s: HushState, pid: string): HushEvent[] {
  if (s.phase !== "playing") fail("Stars can only be used during a level.");
  if (s.stars <= 0) fail("No stars left.");
  const p = find(s, pid);
  p.star = !p.star;
  s.tick++;
  const events: HushEvent[] = [{ type: "starVote", pid, on: p.star }];
  const voters = s.players.filter((x) => x.hand.length > 0 && x.connected);
  if (p.star && voters.length && voters.every((x) => x.star)) {
    s.stars--;
    const discards: { pid: string; card: number }[] = [];
    for (const x of s.players) {
      const c = x.hand.shift();
      if (c !== undefined) {
        discards.push({ pid: x.id, card: c });
        s.discarded.push(c);
      }
      x.star = false;
    }
    events.push({ type: "star", discards });
  }
  return events;
}

function checkLevelDone(s: HushState, rng: Rng): HushEvent[] {
  if (!allEmpty(s)) return [];
  const level = s.level;
  let reward: "heart" | "star" | null = null;
  if (STAR_LEVELS.includes(level) && s.stars < MAX_STARS) {
    s.stars++;
    reward = "star";
  } else if (HEART_LEVELS.includes(level) && s.hearts < MAX_HEARTS) {
    s.hearts++;
    reward = "heart";
  }
  const events: HushEvent[] = [{ type: "levelDone", level, reward }];
  if (level >= s.goal) {
    s.phase = "won";
    s.tick++;
    events.push({ type: "won" });
    return events;
  }
  return events.concat(deal(s, level + 1, rng));
}

export function restart(s: HushState, isHost: boolean, rng: Rng): HushEvent[] {
  if (!isHost) fail("Only the host can do that.");
  s.hearts = Math.min(MAX_HEARTS, Math.max(2, s.players.length));
  s.stars = 1;
  return deal(s, 1, rng);
}

export function addPlayer(s: HushState, m: Member, rng: Rng): HushEvent[] {
  if (s.players.some((p) => p.id === m.id)) return [];
  const p = toPlayer(m);
  s.players.push(p);
  // Joining before the level starts? Deal them in now from the unused numbers.
  if (s.phase === "ready") {
    const used = new Set([...s.players.flatMap((x) => x.hand)]);
    const free = shuffle(Array.from({ length: 100 }, (_, i) => i + 1).filter((n) => !used.has(n)), rng);
    p.hand = free.slice(0, s.level).sort((a, b) => a - b);
  }
  s.tick++;
  return [];
}

export function removePlayer(s: HushState, pid: string, rng: Rng): HushEvent[] {
  const i = s.players.findIndex((p) => p.id === pid);
  if (i < 0) return [];
  const [p] = s.players.splice(i, 1);
  s.discarded.push(...p!.hand);
  s.tick++;
  if (s.players.length < 2 || s.phase !== "playing") return s.phase === "ready" ? maybeStart(s) : [];
  return checkLevelDone(s, rng);
}

function maybeStart(s: HushState): HushEvent[] {
  if (s.players.length >= 2 && s.players.every((x) => x.ready || !x.connected)) {
    s.phase = "playing";
    return [{ type: "go", level: s.level }];
  }
  return [];
}

// ---------- views ----------

export function publicView(s: HushState) {
  return {
    phase: s.phase,
    level: s.level,
    goal: s.goal,
    hearts: s.hearts,
    stars: s.stars,
    pile: s.pile.slice(-8),
    played: s.pile.length,
    discarded: s.discarded.slice(-12),
    last: s.last,
    hostId: s.hostId,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      hue: p.hue,
      avatar: p.avatar ?? null,
      bot: !!p.bot,
      connected: p.connected,
      count: p.hand.length,
      ready: p.ready,
      star: p.star,
    })),
    // When it's over, show everyone what they were holding.
    reveal: s.phase === "lost" ? Object.fromEntries(s.players.map((p) => [p.id, p.hand])) : null,
  };
}
export type HushPublic = ReturnType<typeof publicView>;

export function privateView(s: HushState, pid: string) {
  const p = s.players.find((x) => x.id === pid);
  if (!p) return null;
  return { pid, hand: p.hand, canPlay: s.phase === "playing" && p.hand.length > 0 };
}
export type HushPrivate = NonNullable<ReturnType<typeof privateView>>;

// ---------- bots ----------

/**
 * A bot plays its lowest card after a pause that grows with the gap between the
 * last card on the pile and that card, like quietly counting up in your head.
 */
export function botDelay(s: HushState, p: HushPlayer, rng: Rng): number {
  const lowest = p.hand[0]!;
  const lastCard = s.last?.card ?? Math.max(0, ...s.discarded.filter((c) => c < lowest));
  const gap = Math.max(1, lowest - lastCard);
  return 700 + gap * 170 * (0.85 + rng() * 0.3);
}
