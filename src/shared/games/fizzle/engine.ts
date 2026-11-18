// Fizzle!: an original "hot potato" card game.
//
// The deck hides lit firecrackers (one fewer than the number of players). Draw one and
// it sits in front of you with a two-turn fuse: you get one more turn to Toss it to
// someone else or douse it with Water (which shuffles it back into the deck). If its
// fuse runs out at the start of your turn, it goes BOOM and you're out. On your turn,
// play any action cards you like, then draw (unless you Nap or Fish). Last one standing wins.

import { fail, shuffle, type Member, type Rng } from "../../common";

export type FizzleKind = "cracker" | "water" | "toss" | "peek" | "shuffle" | "nap" | "fish";
export interface FCard {
  id: number;
  kind: FizzleKind;
}
export interface Lit {
  id: number;
  fuse: number;
}

export interface FizzlePlayer {
  id: string;
  name: string;
  hue: number;
  avatar?: string;
  bot?: boolean;
  connected: boolean;
  hand: FCard[];
  lit: Lit[];
  out: boolean;
  /** Joined mid-game: sits out until the next game. */
  waiting: boolean;
  /** What this player saw with Peek (top first), until the deck changes. */
  peek: FCard[] | null;
}

export interface FizzleState {
  phase: "playing" | "over";
  players: FizzlePlayer[];
  turn: number;
  deck: FCard[]; // top of the deck = last element
  discard: FCard[];
  winner: string | null;
  hostId: string | null;
  nextId: number;
}

export type FizzleEvent =
  | { type: "deal"; first: string; crackers: number }
  | { type: "play"; pid: string; card: FCard; target?: string }
  | { type: "draw"; pid: string; from: "top" | "bottom" }
  | { type: "lit"; pid: string; fuse: number }
  | { type: "douse"; pid: string }
  | { type: "toss"; pid: string; target: string }
  | { type: "peek"; pid: string }
  | { type: "shuffle"; pid: string }
  | { type: "nap"; pid: string }
  | { type: "boom"; pid: string }
  | { type: "turn"; pid: string }
  | { type: "won"; pid: string };

export type FizzleAction = { t: "play"; cardId: number; target?: string } | { t: "draw" } | { t: "restart" } | { t: "skip" };

export const FUSE = 2;
export const CARD_INFO: Record<FizzleKind, { name: string; emoji: string; text: string }> = {
  cracker: { name: "Firecracker", emoji: "🧨", text: "Lit! Toss it or douse it before the fuse runs out." },
  water: { name: "Water", emoji: "💧", text: "Douse your lit firecracker. It goes back into the deck." },
  toss: { name: "Toss", emoji: "🤾", text: "Throw your lit firecracker to another player (fresh fuse)." },
  peek: { name: "Peek", emoji: "👀", text: "Secretly look at the top 3 cards of the deck." },
  shuffle: { name: "Shuffle", emoji: "🔀", text: "Shuffle the deck." },
  nap: { name: "Nap", emoji: "💤", text: "End your turn without drawing." },
  fish: { name: "Fish", emoji: "🎣", text: "Draw from the bottom of the deck instead of the top." },
};

// ---------- setup ----------

function actionDeck(players: number, nextId: () => number): FCard[] {
  const scale = players <= 5 ? 1 : 1.5;
  const counts: [FizzleKind, number][] = [
    ["water", 4],
    ["toss", 6],
    ["peek", 5],
    ["shuffle", 4],
    ["nap", 6],
    ["fish", 4],
  ];
  const cards: FCard[] = [];
  for (const [kind, n] of counts) for (let k = 0; k < Math.round(n * scale); k++) cards.push({ id: nextId(), kind });
  return cards;
}

export function newFizzle(members: Member[], hostId: string | null, rng: Rng): { state: FizzleState; events: FizzleEvent[] } {
  const s: FizzleState = {
    phase: "playing",
    players: members.map((m) => ({
      id: m.id,
      name: m.name,
      hue: m.hue,
      avatar: m.avatar,
      bot: m.bot,
      connected: m.connected,
      hand: [],
      lit: [],
      out: false,
      waiting: false,
      peek: null,
    })),
    turn: 0,
    deck: [],
    discard: [],
    winner: null,
    hostId,
    nextId: 1,
  };
  return { state: s, events: deal(s, rng) };
}

function deal(s: FizzleState, rng: Rng): FizzleEvent[] {
  const id = () => s.nextId++;
  for (const p of s.players) {
    p.hand = [];
    p.lit = [];
    p.out = false;
    p.waiting = false;
    p.peek = null;
  }
  const deck = shuffle(actionDeck(s.players.length, id), rng);
  for (const p of s.players) {
    p.hand.push({ id: id(), kind: "water" });
    p.hand.push(...deck.splice(0, 4));
  }
  const crackers = s.players.length - 1;
  for (let k = 0; k < crackers; k++) deck.push({ id: id(), kind: "cracker" });
  s.deck = shuffle(deck, rng);
  s.discard = [];
  s.winner = null;
  s.phase = "playing";
  s.turn = Math.floor(rng() * s.players.length);
  return [{ type: "deal", first: s.players[s.turn]!.id, crackers }];
}

// ---------- helpers ----------

const alive = (s: FizzleState) => s.players.filter((p) => !p.out && !p.waiting);
const find = (s: FizzleState, pid: string) => s.players.find((p) => p.id === pid) ?? fail("You're not in this game.");
export const currentPlayer = (s: FizzleState) => s.players[s.turn]!;

function requireTurn(s: FizzleState, pid: string): FizzlePlayer {
  if (s.phase !== "playing") fail("The game is over.");
  const p = find(s, pid);
  if (p.out || p.waiting) fail("You're out of this game. Cheer from the sidelines!");
  if (currentPlayer(s).id !== pid) fail("Hang on, it's not your turn.");
  return p;
}

/** Someone changed the deck in a way that makes old peeks wrong. */
const forgetPeeks = (s: FizzleState) => s.players.forEach((p) => (p.peek = null));

function insertRandom(s: FizzleState, card: FCard, rng: Rng) {
  const at = Math.floor(rng() * (s.deck.length + 1));
  s.deck.splice(at, 0, card);
}

/** Pass the turn to the next player still in, burning down fuses as their turn starts. */
function nextTurn(s: FizzleState, events: FizzleEvent[]) {
  for (let guard = 0; guard < s.players.length * 3 && s.phase === "playing"; guard++) {
    s.turn = (s.turn + 1) % s.players.length;
    const p = currentPlayer(s);
    if (p.out || p.waiting) continue;
    if (startTurn(s, p, events)) return;
  }
}

/** Fuses tick down when your turn starts. Returns false if this player just went boom. */
function startTurn(s: FizzleState, p: FizzlePlayer, events: FizzleEvent[]): boolean {
  for (const l of p.lit) l.fuse--;
  if (p.lit.some((l) => l.fuse <= 0)) {
    boom(s, p, events);
    return s.phase !== "playing";
  }
  events.push({ type: "turn", pid: p.id });
  return true;
}

function boom(s: FizzleState, p: FizzlePlayer, events: FizzleEvent[]) {
  p.out = true;
  s.discard.push(...p.hand);
  p.hand = [];
  // The firecracker that went off is spent; any others they held go back into play.
  const spent = p.lit.find((l) => l.fuse <= 0)!;
  const others = p.lit.filter((l) => l !== spent);
  p.lit = [];
  for (const o of others) s.deck.unshift({ id: o.id, kind: "cracker" });
  events.push({ type: "boom", pid: p.id });
  const left = alive(s);
  if (left.length <= 1) {
    s.phase = "over";
    s.winner = left[0]?.id ?? null;
    if (s.winner) events.push({ type: "won", pid: s.winner });
  }
}

function drawCard(s: FizzleState, p: FizzlePlayer, from: "top" | "bottom", events: FizzleEvent[]) {
  const card = from === "top" ? s.deck.pop() : s.deck.shift();
  events.push({ type: "draw", pid: p.id, from });
  if (from === "top") for (const x of s.players) x.peek = x.peek?.length ? x.peek.slice(1) : null;
  else for (const x of s.players) if (x.peek && x.peek.length > s.deck.length) x.peek = null; // drew into what they'd seen
  if (card) {
    if (card.kind === "cracker") {
      p.lit.push({ id: card.id, fuse: FUSE });
      events.push({ type: "lit", pid: p.id, fuse: FUSE });
    } else p.hand.push(card);
  }
  nextTurn(s, events);
}

// ---------- actions ----------

export function play(s: FizzleState, pid: string, cardId: number, target: string | undefined, rng: Rng): FizzleEvent[] {
  const p = requireTurn(s, pid);
  const card = p.hand.find((c) => c.id === Number(cardId)) ?? fail("That card isn't in your hand.");
  const events: FizzleEvent[] = [];
  const litFirst = () => [...p.lit].sort((a, b) => a.fuse - b.fuse)[0];
  switch (card.kind) {
    case "water": {
      const lit = litFirst() ?? fail("Nothing to douse: you don't have a lit firecracker.");
      p.lit = p.lit.filter((l) => l !== lit);
      insertRandom(s, { id: lit.id, kind: "cracker" }, rng);
      forgetPeeks(s);
      events.push({ type: "play", pid, card }, { type: "douse", pid });
      break;
    }
    case "toss": {
      const lit = litFirst() ?? fail("Nothing to toss: you don't have a lit firecracker.");
      const to = s.players.find((x) => x.id === target && !x.out && !x.waiting && x.id !== pid) ?? fail("Pick someone still in the game to toss it to.");
      p.lit = p.lit.filter((l) => l !== lit);
      to.lit.push({ id: lit.id, fuse: FUSE });
      events.push({ type: "play", pid, card, target: to.id }, { type: "toss", pid, target: to.id });
      break;
    }
    case "peek":
      p.peek = s.deck.slice(-3).reverse();
      events.push({ type: "play", pid, card }, { type: "peek", pid });
      break;
    case "shuffle":
      shuffle(s.deck, rng);
      forgetPeeks(s);
      events.push({ type: "play", pid, card }, { type: "shuffle", pid });
      break;
    case "nap":
      events.push({ type: "play", pid, card }, { type: "nap", pid });
      break;
    case "fish":
      events.push({ type: "play", pid, card });
      break;
    default:
      fail("You can't play that.");
  }
  p.hand = p.hand.filter((c) => c !== card);
  s.discard.push(card);
  if (card.kind === "nap") nextTurn(s, events);
  if (card.kind === "fish") drawCard(s, p, "bottom", events);
  return events;
}

export function draw(s: FizzleState, pid: string, _rng: Rng): FizzleEvent[] {
  const p = requireTurn(s, pid);
  const events: FizzleEvent[] = [];
  drawCard(s, p, "top", events);
  return events;
}

export function restart(s: FizzleState, isHost: boolean, rng: Rng): FizzleEvent[] {
  if (!isHost) fail("Only the host can start a new game.");
  if (s.players.length < 2) fail("You need at least 2 players.");
  return deal(s, rng);
}

/** Host (or anyone, if that player's phone is gone) moves past the current player. They still draw. */
export function skipTurn(s: FizzleState, by: string, isHost: boolean, _rng: Rng): FizzleEvent[] {
  if (s.phase !== "playing") fail("The game is over.");
  const p = currentPlayer(s);
  if (p.id === by) fail("It's your turn!");
  if (!isHost && p.connected) fail("Only the host can skip someone who's still connected.");
  const events: FizzleEvent[] = [];
  drawCard(s, p, "top", events);
  return events;
}

export function addPlayer(s: FizzleState, m: Member): FizzleEvent[] {
  if (s.players.some((p) => p.id === m.id)) return [];
  s.players.push({ id: m.id, name: m.name, hue: m.hue, avatar: m.avatar, bot: m.bot, connected: m.connected, hand: [], lit: [], out: false, waiting: true, peek: null });
  return [];
}

export function removePlayer(s: FizzleState, pid: string, rng: Rng): FizzleEvent[] {
  const i = s.players.findIndex((p) => p.id === pid);
  if (i < 0) return [];
  const [p] = s.players.splice(i, 1);
  const events: FizzleEvent[] = [];
  s.discard.push(...p!.hand);
  for (const l of p!.lit) insertRandom(s, { id: l.id, kind: "cracker" }, rng);
  // Keep one fewer firecracker than players still in, so someone can win.
  const crackersNeeded = Math.max(0, alive(s).length - 1);
  const inPlay = () => s.deck.filter((c) => c.kind === "cracker").length + s.players.reduce((a, x) => a + x.lit.length, 0);
  while (inPlay() > crackersNeeded) {
    const k = s.deck.findIndex((c) => c.kind === "cracker");
    if (k < 0) break;
    s.deck.splice(k, 1);
  }
  if (s.phase !== "playing" || !s.players.length) return events;
  const left = alive(s);
  if (left.length <= 1) {
    s.phase = "over";
    s.winner = left[0]?.id ?? null;
    if (s.winner) events.push({ type: "won", pid: s.winner });
    return events;
  }
  if (i < s.turn) s.turn--;
  else if (i === s.turn) {
    s.turn = (s.turn - 1 + s.players.length) % s.players.length;
    nextTurn(s, events);
  }
  return events;
}

// ---------- views ----------

export function publicView(s: FizzleState) {
  return {
    phase: s.phase,
    turnId: s.phase === "playing" ? currentPlayer(s).id : null,
    deckCount: s.deck.length,
    crackersInDeck: s.deck.filter((c) => c.kind === "cracker").length,
    discardTop: s.discard[s.discard.length - 1] ?? null,
    winner: s.winner,
    hostId: s.hostId,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      hue: p.hue,
      avatar: p.avatar ?? null,
      bot: !!p.bot,
      connected: p.connected,
      count: p.hand.length,
      lit: p.lit.map((l) => l.fuse),
      out: p.out,
      waiting: p.waiting,
    })),
  };
}
export type FizzlePublic = ReturnType<typeof publicView>;

export function privateView(s: FizzleState, pid: string) {
  const p = s.players.find((x) => x.id === pid);
  if (!p) return null;
  const mine = s.phase === "playing" && currentPlayer(s).id === pid && !p.out;
  return { pid, hand: p.hand, lit: p.lit.map((l) => l.fuse), peek: p.peek, myTurn: mine, out: p.out, waiting: p.waiting };
}
export type FizzlePrivate = NonNullable<ReturnType<typeof privateView>>;
