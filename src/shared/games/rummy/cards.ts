// Playing cards and the rules for sets and runs (shared by the engine, bots and phones).

import { shuffle, type Rng } from "../../common";

export type Suit = "S" | "H" | "D" | "C";
export const SUITS: Suit[] = ["S", "H", "D", "C"];

/** rank 1 = ace … 13 = king; rank 0 = joker (suit null). */
export interface PCard {
  id: number;
  suit: Suit | null;
  rank: number;
}

export type MeldKind = "set" | "run";
export interface MeldShape {
  kind: MeldKind;
  /** In display order (runs low to high, with jokers in their spots). */
  cards: PCard[];
}

export const isJoker = (c: PCard) => c.rank === 0;
export const RANK_NAMES = ["Joker", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUIT_NAMES: Record<Suit, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
export const cardName = (c: PCard) => (isJoker(c) ? "Joker" : `${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit!]}`);

export function makeDeck(decks: number, rng: Rng): PCard[] {
  const cards: PCard[] = [];
  let id = 0;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) cards.push({ id: id++, suit, rank });
    cards.push({ id: id++, suit: null, rank: 0 }, { id: id++, suit: null, rank: 0 });
  }
  return shuffle(cards, rng);
}

/** Penalty points for a card left in your hand. */
export function points(c: PCard): number {
  if (isJoker(c)) return 50;
  if (c.rank === 1) return 15;
  if (c.rank >= 10) return 10;
  return 5;
}

/** A set: 3+ cards of one rank (any suits). Jokers may not outnumber real cards. */
export function asSet(cards: PCard[]): MeldShape | null {
  if (cards.length < 3) return null;
  const nat = cards.filter((c) => !isJoker(c));
  const jok = cards.filter(isJoker);
  if (nat.length < 2 || jok.length > nat.length) return null;
  if (nat.some((c) => c.rank !== nat[0]!.rank)) return null;
  return { kind: "set", cards: [...nat, ...jok] };
}

/**
 * A run: 4+ cards in a row of one suit. Aces can be low (A-2-3-4) or high (J-Q-K-A)
 * but don't wrap around. Jokers fill gaps or extend the ends.
 */
export function asRun(cards: PCard[]): MeldShape | null {
  if (cards.length < 4) return null;
  const nat = cards.filter((c) => !isJoker(c));
  const jok = cards.filter(isJoker);
  if (nat.length < 2 || jok.length > nat.length) return null;
  if (nat.some((c) => c.suit !== nat[0]!.suit)) return null;
  const len = cards.length;
  for (const aceHigh of [false, true]) {
    const val = (c: PCard) => (c.rank === 1 && aceHigh ? 14 : c.rank);
    const vals = nat.map(val);
    if (new Set(vals).size !== vals.length) continue;
    const lo = aceHigh ? 2 : 1;
    const hi = aceHigh ? 14 : 13;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    // Prefer jokers above the real cards; slide down only if we'd run past the top.
    for (let start = min; start >= lo; start--) {
      const end = start + len - 1;
      if (end > hi || end < max) continue;
      const byVal = new Map(nat.map((c) => [val(c), c]));
      const spare = [...jok];
      const ordered: PCard[] = [];
      for (let v = start; v <= end; v++) ordered.push(byVal.get(v) ?? spare.shift()!);
      return { kind: "run", cards: ordered };
    }
  }
  return null;
}

export const asKind = (kind: MeldKind, cards: PCard[]) => (kind === "set" ? asSet(cards) : asRun(cards));

/** Can these cards be added to a group already on the table? Returns the new group, or null. */
export function canAdd(meld: MeldShape, add: PCard[]): MeldShape | null {
  return add.length ? asKind(meld.kind, [...meld.cards, ...add]) : null;
}

// ---------- contracts ----------

export interface Contract {
  sets: number;
  runs: number;
}
export const CONTRACTS: Contract[] = [
  { sets: 2, runs: 0 },
  { sets: 1, runs: 1 },
  { sets: 0, runs: 2 },
  { sets: 3, runs: 0 },
  { sets: 2, runs: 1 },
  { sets: 1, runs: 2 },
  { sets: 0, runs: 3 },
];

export function contractLabel(c: Contract): string {
  const part = (n: number, word: string, size: number) => (n ? `${n === 1 ? "1" : n} ${word}${n === 1 ? "" : "s"} of ${size}` : "");
  return [part(c.sets, "set", 3), part(c.runs, "run", 4)].filter(Boolean).join(" + ");
}

/**
 * Split cards into the melds a contract asks for.
 * - useAll: every card must end up in one of the melds (extra cards make melds longer).
 * Returns null if it can't be done. Used to lay down (phones just pick cards) and by bots.
 *
 * Candidates describe which values they need; the actual card copies are chosen during
 * the search, so duplicates (we play with two or three decks) can form parallel groups.
 */
export function findContract(cards: PCard[], need: Contract, useAll: boolean): MeldShape[] | null {
  const jokers = cards.filter(isJoker);
  const nat = cards.filter((c) => !isJoker(c));

  type Cand =
    | { kind: "set"; rank: number; naturals: number; jokers: number }
    | { kind: "run"; suit: Suit; values: number[]; aceHigh: boolean; jokers: number };

  const sets: Cand[] = [];
  const rankCount = new Map<number, number>();
  for (const c of nat) rankCount.set(c.rank, (rankCount.get(c.rank) ?? 0) + 1);
  for (const [rank, n] of rankCount) {
    if (n >= 3) sets.push({ kind: "set", rank, naturals: 3, jokers: 0 });
    if (n >= 2) sets.push({ kind: "set", rank, naturals: 2, jokers: 1 });
  }
  const runs: Cand[] = [];
  for (const suit of SUITS) {
    for (const aceHigh of [false, true]) {
      const present = new Set(nat.filter((c) => c.suit === suit).map((c) => (c.rank === 1 && aceHigh ? 14 : c.rank)));
      for (let start = aceHigh ? 11 : 1; start <= (aceHigh ? 11 : 10); start++) {
        const values: number[] = [];
        for (let v = start; v < start + 4; v++) if (present.has(v)) values.push(v);
        const missing = 4 - values.length;
        if (values.length >= 2 && missing <= values.length) runs.push({ kind: "run", suit, values, aceHigh, jokers: missing });
      }
    }
  }

  /** Pick real, unused cards for a candidate (null if not enough copies are left). */
  const allocate = (cand: Cand, used: Set<number>): PCard[] | null => {
    const out: PCard[] = [];
    const take = (ok: (c: PCard) => boolean) => {
      const c = nat.find((x) => !used.has(x.id) && !out.includes(x) && ok(x));
      if (c) out.push(c);
      return !!c;
    };
    if (cand.kind === "set") {
      // Runs are picked first; prefer suits not in any chosen run so leftover cards can still extend them.
      const runSuits = new Set(chosen.filter((c) => c.kind === "run").map((c) => c.cards[0]?.suit));
      for (let k = 0; k < cand.naturals; k++) {
        if (!take((c) => c.rank === cand.rank && !runSuits.has(c.suit)) && !take((c) => c.rank === cand.rank)) return null;
      }
    } else {
      for (const v of cand.values) if (!take((c) => c.suit === cand.suit && (v === 14 ? c.rank === 1 : c.rank === v))) return null;
    }
    return out;
  };

  // Pick runs before sets: runs need exact suits, while sets take any suit of that rank.
  const want: MeldKind[] = [...Array(need.runs).fill("run"), ...Array(need.sets).fill("set")];
  const chosen: { kind: MeldKind; cards: PCard[]; jokers: number }[] = [];
  let result: MeldShape[] | null = null;

  const pick = (i: number, used: Set<number>, usedJokers: number, minIdx: number) => {
    if (result) return;
    if (i === want.length) {
      result = build(used);
      return;
    }
    const pool = want[i] === "set" ? sets : runs;
    // Same kind as the previous pick: don't revisit earlier candidates (but the same one again is
    // fine: with duplicate cards it makes a parallel group).
    const from = i > 0 && want[i - 1] === want[i] ? minIdx : 0;
    for (let k = from; k < pool.length; k++) {
      const cand = pool[k]!;
      if (usedJokers + cand.jokers > jokers.length) continue;
      const got = allocate(cand, used);
      if (!got) continue;
      chosen.push({ kind: cand.kind, cards: got, jokers: cand.jokers });
      const next = new Set(used);
      got.forEach((c) => next.add(c.id));
      pick(i + 1, next, usedJokers + cand.jokers, k);
      chosen.pop();
      if (result) return;
    }
  };

  const build = (used: Set<number>): MeldShape[] | null => {
    const spare = [...jokers];
    const base: MeldShape[] = [];
    for (const c of chosen) {
      const m = asKind(c.kind, [...c.cards, ...spare.splice(0, c.jokers)]);
      if (!m) return null;
      base.push(m);
    }
    if (!useAll) return base;
    const leftovers = [...nat.filter((c) => !used.has(c.id)), ...spare];
    // Every leftover card has to fit onto one of the melds. Try a couple of orders.
    const byValue = (a: PCard, b: PCard) => (a.rank || 99) - (b.rank || 99);
    for (const order of [[...leftovers].sort(byValue), [...leftovers].sort(byValue).reverse()]) {
      const melds = base.map((m) => ({ ...m, cards: [...m.cards] }));
      let left = order;
      let progress = true;
      while (left.length && progress) {
        progress = false;
        for (const card of [...left]) {
          for (let m = 0; m < melds.length; m++) {
            const grown = canAdd(melds[m]!, [card]);
            if (grown) {
              melds[m] = grown;
              left = left.filter((x) => x !== card);
              progress = true;
              break;
            }
          }
        }
      }
      if (!left.length) return melds;
    }
    return null;
  };

  pick(0, new Set(), 0, 0);
  return result;
}

/**
 * The biggest piece of a contract these cards make, using every card (for laying down in
 * parts). Returns the melds and how much of the contract they cover, or null.
 */
export function partOfContract(cards: PCard[], need: Contract): { melds: MeldShape[]; used: Contract } | null {
  let best: { melds: MeldShape[]; used: Contract } | null = null;
  for (let s = need.sets; s >= 0; s--) {
    for (let r = need.runs; r >= 0; r--) {
      if (s + r === 0) continue;
      if (best && s + r <= best.used.sets + best.used.runs) continue;
      const melds = findContract(cards, { sets: s, runs: r }, true);
      if (melds) best = { melds, used: { sets: s, runs: r } };
    }
  }
  return best;
}

export const contractLeft = (c: Contract, laid: Contract): Contract => ({ sets: c.sets - laid.sets, runs: c.runs - laid.runs });
