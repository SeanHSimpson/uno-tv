// Contract Rummy: the traditional seven-contract rummy game.
//
// Each round has a contract (e.g. "1 set of 3 + 1 run of 4"). On your turn: draw from
// the deck or take the top discard, optionally lay down your contract (once per round),
// once you're down add cards to any group on the table, then discard one card. Empty
// your hand to win the round; everyone else scores the cards they're still holding.
// Lowest total after all rounds wins. "May I?": when you don't want to wait for your
// turn, ask for the top discard; you get it plus a penalty card from the deck.

import { fail, shuffle, type Member, type Rng } from "../../common";
import { canAdd, contractLabel, CONTRACTS, findContract, makeDeck, points, type Contract, type MeldShape, type PCard } from "./cards";

export interface RummySettings extends Record<string, unknown> {
  /** 7 = classic (all contracts), 4 = short game. */
  rounds: number;
  mayI: boolean;
}
export const RUMMY_DEFAULTS: RummySettings = { rounds: 7, mayI: true };
const SHORT_CONTRACTS = [0, 1, 2, 6]; // 2 sets, set+run, 2 runs, 3 runs
const MAX_BUYS = 3;

export interface Meld extends MeldShape {
  id: number;
  owner: string;
}

export interface RummyPlayer {
  id: string;
  name: string;
  hue: number;
  avatar?: string;
  bot?: boolean;
  connected: boolean;
  hand: PCard[];
  down: boolean;
  score: number;
  roundScores: number[];
  buys: number;
}

export interface RummyState {
  phase: "playing" | "roundOver" | "gameOver";
  /** Contract indexes for this game (into CONTRACTS). */
  plan: number[];
  round: number; // 1-based
  players: RummyPlayer[];
  dealer: number;
  turn: number;
  stage: "draw" | "play";
  stock: PCard[];
  discard: PCard[];
  melds: Meld[];
  /** Players asking "May I?" for the current top discard, in the order they asked. */
  mayI: string[];
  lastDiscardBy: string | null;
  /** The card the current player took from the discard pile this turn (can't throw it straight back). */
  tookFromDiscard: number | null;
  settings: RummySettings;
  roundWinner: string | null;
  hostId: string | null;
  nextMeldId: number;
}

export type RummyEvent =
  | { type: "deal"; round: number; contract: string; first: string }
  | { type: "draw"; pid: string; from: "stock" | "discard"; card?: PCard }
  | { type: "mayI"; pid: string }
  | { type: "bought"; pid: string; card: PCard }
  | { type: "down"; pid: string; melds: number[] }
  | { type: "hit"; pid: string; meldId: number; cards: PCard[] }
  | { type: "discard"; pid: string; card: PCard }
  | { type: "reshuffle" }
  | { type: "out"; pid: string; round: number; points: Record<string, number> }
  | { type: "gameOver"; winner: string };

export type RummyAction =
  | { t: "draw"; from: "stock" | "discard" }
  | { t: "layDown"; cardIds: number[] }
  | { t: "hit"; cardIds: number[]; meldId: number }
  | { t: "discard"; cardId: number }
  | { t: "mayI" }
  | { t: "skip" }
  | { t: "nextRound" };

/** 10 cards for the first four contracts, 12 for the bigger ones (3 runs needs at least 12). */
export const handSize = (contractIndex: number) => (contractIndex >= 4 ? 12 : 10);
export const contractOf = (s: RummyState): Contract => CONTRACTS[s.plan[s.round - 1]!]!;
export const isFinalContract = (c: Contract) => c.runs === 3; // must go out all at once

const sortHand = (h: PCard[]) => h.sort((a, b) => (a.rank || 99) - (b.rank || 99) || (a.suit ?? "").localeCompare(b.suit ?? "") || a.id - b.id);

// ---------- setup ----------

export function newRummy(members: Member[], settings: RummySettings, hostId: string | null, rng: Rng): { state: RummyState; events: RummyEvent[] } {
  const s: RummyState = {
    phase: "playing",
    plan: settings.rounds === 4 ? SHORT_CONTRACTS : CONTRACTS.map((_, i) => i),
    round: 0,
    players: members.map((m) => ({
      id: m.id,
      name: m.name,
      hue: m.hue,
      avatar: m.avatar,
      bot: m.bot,
      connected: m.connected,
      hand: [],
      down: false,
      score: 0,
      roundScores: [],
      buys: 0,
    })),
    dealer: Math.floor(rng() * members.length),
    turn: 0,
    stage: "draw",
    stock: [],
    discard: [],
    melds: [],
    mayI: [],
    lastDiscardBy: null,
    tookFromDiscard: null,
    settings: { ...RUMMY_DEFAULTS, ...settings },
    roundWinner: null,
    hostId,
    nextMeldId: 1,
  };
  return { state: s, events: deal(s, rng) };
}

function deal(s: RummyState, rng: Rng): RummyEvent[] {
  s.round++;
  s.phase = "playing";
  s.stock = makeDeck(s.players.length <= 4 ? 2 : 3, rng);
  s.discard = [];
  s.melds = [];
  s.mayI = [];
  s.lastDiscardBy = null;
  s.roundWinner = null;
  const n = handSize(s.plan[s.round - 1]!);
  for (const p of s.players) {
    p.hand = sortHand(s.stock.splice(0, n));
    p.down = false;
    p.buys = 0;
  }
  s.discard.push(s.stock.pop()!);
  s.dealer = (s.dealer + 1) % s.players.length;
  s.turn = (s.dealer + 1) % s.players.length;
  s.stage = "draw";
  return [{ type: "deal", round: s.round, contract: contractLabel(contractOf(s)), first: s.players[s.turn]!.id }];
}

// ---------- helpers ----------

const find = (s: RummyState, pid: string) => s.players.find((p) => p.id === pid) ?? fail("You're not in this game.");
const current = (s: RummyState) => s.players[s.turn]!;
const takeFromHand = (p: RummyPlayer, ids: number[]): PCard[] => {
  const unique = [...new Set(ids.map(Number))];
  const cards = unique.map((id) => p.hand.find((c) => c.id === id) ?? fail("That card isn't in your hand."));
  return cards;
};
const removeFromHand = (p: RummyPlayer, cards: PCard[]) => {
  const ids = new Set(cards.map((c) => c.id));
  p.hand = p.hand.filter((c) => !ids.has(c.id));
};

function requireTurn(s: RummyState, pid: string, stage: "draw" | "play"): RummyPlayer {
  if (s.phase !== "playing") fail("The round is over.");
  const p = find(s, pid);
  if (current(s).id !== pid) fail("Hang on, it's not your turn.");
  if (s.stage !== stage) fail(stage === "draw" ? "You've already drawn this turn." : "Draw a card first (from the deck or the discard pile).");
  return p;
}

function drawFromStock(s: RummyState, rng: Rng, events: RummyEvent[]): PCard | undefined {
  if (!s.stock.length && s.discard.length > 1) {
    const top = s.discard.pop()!;
    s.stock = shuffle(s.discard, rng);
    s.discard = [top];
    events.push({ type: "reshuffle" });
  }
  return s.stock.pop();
}

// ---------- actions ----------

export function draw(s: RummyState, pid: string, from: "stock" | "discard", rng: Rng): RummyEvent[] {
  const p = requireTurn(s, pid, "draw");
  const events: RummyEvent[] = [];
  if (from === "discard") {
    const card = s.discard.pop() ?? fail("The discard pile is empty.");
    p.hand.push(card);
    s.tookFromDiscard = card.id;
    events.push({ type: "draw", pid, from, card });
  } else {
    // Passing on the discard: if anyone asked "May I?", the first in seat order gets it (+1 penalty card).
    if (s.mayI.length && s.discard.length) {
      const n = s.players.length;
      for (let k = 1; k < n; k++) {
        const buyer = s.players[(s.turn + k) % n]!;
        if (!s.mayI.includes(buyer.id)) continue;
        const card = s.discard.pop()!;
        buyer.hand.push(card);
        const extra = drawFromStock(s, rng, events);
        if (extra) buyer.hand.push(extra);
        buyer.buys++;
        sortHand(buyer.hand);
        events.push({ type: "bought", pid: buyer.id, card });
        break;
      }
    }
    const card = drawFromStock(s, rng, events);
    if (card) p.hand.push(card);
    s.tookFromDiscard = null;
    events.push({ type: "draw", pid, from: "stock" });
  }
  s.mayI = [];
  sortHand(p.hand);
  s.stage = "play";
  return events;
}

export function mayI(s: RummyState, pid: string): RummyEvent[] {
  if (!s.settings.mayI) fail("\"May I?\" is turned off for this game.");
  if (s.phase !== "playing") fail("The round is over.");
  const p = find(s, pid);
  if (current(s).id === pid) fail("It's your turn, so just take it from the discard pile.");
  if (s.stage !== "draw") fail("Too late: they've already drawn.");
  if (!s.discard.length) fail("There's nothing on the discard pile.");
  if (s.lastDiscardBy === pid) fail("You can't buy back your own discard.");
  if (p.buys >= MAX_BUYS) fail(`You've used all ${MAX_BUYS} "May I?"s this round.`);
  if (s.mayI.includes(pid)) return [];
  s.mayI.push(pid);
  return [{ type: "mayI", pid }];
}

/** Lay down your contract. You pick the cards; we work out the sets and runs. */
export function layDown(s: RummyState, pid: string, cardIds: number[]): RummyEvent[] {
  const p = requireTurn(s, pid, "play");
  if (p.down) fail("You're already down this round. Add cards to groups instead.");
  const cards = takeFromHand(p, cardIds);
  const contract = contractOf(s);
  const final = isFinalContract(contract);
  if (final && cards.length !== p.hand.length) fail("Last round: lay down your whole hand at once (3 runs, no discard).");
  const melds = findContract(cards, contract, true);
  if (!melds) fail(`Those cards don't make ${contractLabel(contract)}.`);
  removeFromHand(p, cards);
  p.down = true;
  const ids: number[] = [];
  for (const m of melds!) {
    const meld: Meld = { ...m, id: s.nextMeldId++, owner: pid };
    s.melds.push(meld);
    ids.push(meld.id);
  }
  const events: RummyEvent[] = [{ type: "down", pid, melds: ids }];
  return events.concat(checkOut(s, p));
}

/** Add cards to any group on the table (only once you're down yourself). */
export function hit(s: RummyState, pid: string, cardIds: number[], meldId: number): RummyEvent[] {
  const p = requireTurn(s, pid, "play");
  if (!p.down) fail("Lay down your own contract before adding to groups.");
  if (isFinalContract(contractOf(s))) fail("Last round: there's no adding to groups.");
  const meld = s.melds.find((m) => m.id === Number(meldId)) ?? fail("That group isn't on the table.");
  const cards = takeFromHand(p, cardIds);
  const grown = canAdd(meld, cards);
  if (!grown) fail(`Those don't fit on that ${meld.kind}.`);
  removeFromHand(p, cards);
  meld.cards = grown!.cards;
  const events: RummyEvent[] = [{ type: "hit", pid, meldId: meld.id, cards }];
  return events.concat(checkOut(s, p));
}

export function discard(s: RummyState, pid: string, cardId: number): RummyEvent[] {
  const p = requireTurn(s, pid, "play");
  const [card] = takeFromHand(p, [cardId]);
  if (card!.id === s.tookFromDiscard && p.hand.length > 1) fail("You just picked that one up. Discard a different card.");
  removeFromHand(p, [card!]);
  s.discard.push(card!);
  s.lastDiscardBy = pid;
  s.mayI = [];
  const events: RummyEvent[] = [{ type: "discard", pid, card: card! }];
  const out = checkOut(s, p);
  if (out.length) return events.concat(out);
  s.turn = (s.turn + 1) % s.players.length;
  s.stage = "draw";
  return events;
}

function checkOut(s: RummyState, p: RummyPlayer): RummyEvent[] {
  if (p.hand.length) return [];
  const pts: Record<string, number> = {};
  for (const x of s.players) {
    const n = x.hand.reduce((a, c) => a + points(c), 0);
    pts[x.id] = n;
    x.score += n;
    x.roundScores.push(n);
  }
  s.roundWinner = p.id;
  const events: RummyEvent[] = [{ type: "out", pid: p.id, round: s.round, points: pts }];
  if (s.round >= s.plan.length) {
    s.phase = "gameOver";
    const winner = [...s.players].sort((a, b) => a.score - b.score)[0]!;
    events.push({ type: "gameOver", winner: winner.id });
  } else s.phase = "roundOver";
  return events;
}

export function nextRound(s: RummyState, isHost: boolean, rng: Rng): RummyEvent[] {
  if (!isHost) fail("Only the host can deal the next round.");
  if (s.phase === "gameOver") {
    // Play again from round 1.
    for (const p of s.players) {
      p.score = 0;
      p.roundScores = [];
    }
    s.round = 0;
    return deal(s, rng);
  }
  if (s.phase !== "roundOver") fail("The round isn't over yet.");
  return deal(s, rng);
}

export function addPlayer(s: RummyState, m: Member): RummyEvent[] {
  if (s.players.some((p) => p.id === m.id)) return [];
  // New players sit out the current round and join at the next deal, with the highest score so far.
  const worst = Math.max(0, ...s.players.map((p) => p.score));
  s.players.push({ id: m.id, name: m.name, hue: m.hue, avatar: m.avatar, bot: m.bot, connected: m.connected, hand: [], down: false, score: worst, roundScores: [], buys: 0 });
  return [];
}

export function removePlayer(s: RummyState, pid: string): RummyEvent[] {
  const i = s.players.findIndex((p) => p.id === pid);
  if (i < 0) return [];
  const [p] = s.players.splice(i, 1);
  s.stock.unshift(...p!.hand);
  s.mayI = s.mayI.filter((x) => x !== pid);
  if (!s.players.length) return [];
  if (i < s.turn) s.turn--;
  else if (i === s.turn) {
    s.turn = s.turn % s.players.length;
    s.stage = "draw";
  }
  if (s.dealer >= s.players.length) s.dealer = 0;
  return [];
}

/** Skip someone whose phone has gone (anyone may do this; the host can always). */
export function skipTurn(s: RummyState, by: string, isHost: boolean): RummyEvent[] {
  if (s.phase !== "playing") fail("The round is over.");
  const p = current(s);
  if (p.id === by) fail("It's your turn. Draw a card!");
  if (!isHost && p.connected) fail("Only the host can skip someone who's still connected.");
  s.turn = (s.turn + 1) % s.players.length;
  s.stage = "draw";
  s.mayI = [];
  return [];
}

// ---------- views ----------

export function publicView(s: RummyState) {
  const contract = contractOf(s);
  return {
    phase: s.phase,
    round: s.round,
    rounds: s.plan.length,
    contract,
    contractText: contractLabel(contract),
    plan: s.plan.map((i) => contractLabel(CONTRACTS[i]!)),
    finalRound: isFinalContract(contract),
    turnId: s.phase === "playing" ? current(s).id : null,
    stage: s.stage,
    stockCount: s.stock.length,
    discardTop: s.discard[s.discard.length - 1] ?? null,
    discardCount: s.discard.length,
    melds: s.melds,
    mayI: s.mayI,
    settings: s.settings,
    roundWinner: s.roundWinner,
    hostId: s.hostId,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      hue: p.hue,
      avatar: p.avatar ?? null,
      bot: !!p.bot,
      connected: p.connected,
      count: p.hand.length,
      down: p.down,
      score: p.score,
      roundScores: p.roundScores,
      buys: p.buys,
    })),
    reveal: s.phase !== "playing" ? Object.fromEntries(s.players.map((p) => [p.id, p.hand])) : null,
  };
}
export type RummyPublic = ReturnType<typeof publicView>;

export function privateView(s: RummyState, pid: string) {
  const p = s.players.find((x) => x.id === pid);
  if (!p) return null;
  const mine = s.phase === "playing" && current(s).id === pid;
  return {
    pid,
    hand: p.hand,
    down: p.down,
    myTurn: mine,
    canDraw: mine && s.stage === "draw",
    canPlay: mine && s.stage === "play",
    /** The card you took from the discard pile this turn (you can't throw it straight back). */
    tookFromDiscard: mine ? s.tookFromDiscard : null,
    canMayI:
      s.settings.mayI && s.phase === "playing" && !mine && s.stage === "draw" && s.discard.length > 0 && s.lastDiscardBy !== pid && p.buys < MAX_BUYS && !s.mayI.includes(pid),
    buysLeft: MAX_BUYS - p.buys,
  };
}
export type RummyPrivate = NonNullable<ReturnType<typeof privateView>>;
