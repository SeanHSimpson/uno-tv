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
  const len = cards.length;
  if (len < 4) return null;
  const nat: PCard[] = [];
  const jok: PCard[] = [];
  let suit: Suit | null = null;
  for (let i = 0; i < len; i++) {
    const c = cards[i]!;
    if (isJoker(c)) jok.push(c);
    else {
      if (suit === null) suit = c.suit;
      else if (c.suit !== suit) return null;
      nat.push(c);
    }
  }
  if (nat.length < 2 || jok.length > nat.length) return null;
  let hasAce = false;
  for (let i = 0; i < nat.length; i++) if (nat[i]!.rank === 1) hasAce = true;
  const modes = hasAce ? [false, true] : [false];
  for (const aceHigh of modes) {
    let min = 99;
    let max = 0;
    let dup = false;
    let mask = 0;
    for (let i = 0; i < nat.length; i++) {
      const r = nat[i]!.rank;
      const v = r === 1 && aceHigh ? 14 : r;
      const bit = 1 << v;
      if (mask & bit) {
        dup = true;
        break;
      }
      mask |= bit;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (dup) continue;
    const lo = aceHigh ? 2 : 1;
    const hi = aceHigh ? 14 : 13;
    if (max - min + 1 > len) continue;
    // Prefer jokers above the real cards; slide down only if we'd run past the top.
    const start = Math.min(min, hi - len + 1);
    if (start < lo || start + len - 1 < max) continue;
    const end = start + len - 1;
    const ordered: PCard[] = [];
    let jIdx = 0;
    for (let v = start; v <= end; v++) {
      let found: PCard | undefined;
      for (let i = 0; i < nat.length; i++) {
        const c = nat[i]!;
        if ((c.rank === 1 && aceHigh ? 14 : c.rank) === v) {
          found = c;
          break;
        }
      }
      ordered.push(found ?? jok[jIdx++]!);
    }
    return { kind: "run", cards: ordered };
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
  const totalMelds = need.sets + need.runs;
  if (totalMelds <= 0) return null;
  if (cards.length < need.sets * 3 + need.runs * 4) return null;

  const jokers = cards.filter(isJoker);
  const nat = cards.filter((c) => !isJoker(c));
  const maxJokers = jokers.length;
  if (useAll && maxJokers > nat.length) return null;
  if (nat.length < totalMelds * 2) return null;

  type Cand =
    | { kind: "set"; rank: number; naturals: number; jokers: number }
    | { kind: "run"; suit: Suit; values: number[]; aceHigh: boolean; jokers: number };

  const sets: Cand[] = [];
  if (need.sets > 0) {
    const rankCount = new Map<number, number>();
    for (const c of nat) rankCount.set(c.rank, (rankCount.get(c.rank) ?? 0) + 1);
    for (const [rank, n] of rankCount) {
      if (n >= 3) sets.push({ kind: "set", rank, naturals: 3, jokers: 0 });
      if (n >= 2 && maxJokers >= 1) sets.push({ kind: "set", rank, naturals: 2, jokers: 1 });
    }
    if (!sets.length) return null;
    sets.sort((a, b) => a.jokers - b.jokers);
  }

  const runs: Cand[] = [];
  if (need.runs > 0) {
    const seenRun = new Set<string>();
    for (const suit of SUITS) {
      const suited = nat.filter((c) => c.suit === suit);
      if (suited.length < 2) continue;
      const hasAce = suited.some((c) => c.rank === 1);
      for (const aceHigh of hasAce ? [false, true] : [false]) {
        const present = new Set(suited.map((c) => (c.rank === 1 && aceHigh ? 14 : c.rank)));
        for (let start = aceHigh ? 11 : 1; start <= (aceHigh ? 11 : 10); start++) {
          const values: number[] = [];
          for (let v = start; v < start + 4; v++) if (present.has(v)) values.push(v);
          const missing = 4 - values.length;
          if (values.length >= 2 && missing <= values.length && missing <= maxJokers) {
            // Multiple 4-card windows can contain the exact same subset of natural cards (e.g. 4♠ 6♠
            // with 2 jokers); deduplicating keeps the search tree tiny on joker-heavy hands.
            const key = `${suit}:${values.join(",")}`;
            if (!seenRun.has(key)) {
              seenRun.add(key);
              runs.push({ kind: "run", suit, values, aceHigh, jokers: missing });
            }
          }
        }
      }
    }
    if (!runs.length) return null;
    runs.sort((a, b) => a.jokers - b.jokers);
  }

  const used = new Uint8Array(nat.length);

  /** Pick real, unused card indices for a candidate (null if not enough copies are left). */
  const allocate = (cand: Cand): number[] | null => {
    const idxs: number[] = [];
    const take = (ok: (c: PCard) => boolean) => {
      for (let idx = 0; idx < nat.length; idx++) {
        if (used[idx]) continue;
        if (idxs.includes(idx)) continue;
        if (ok(nat[idx]!)) {
          idxs.push(idx);
          return true;
        }
      }
      return false;
    };
    if (cand.kind === "set") {
      // Runs are picked first; prefer suits not in any chosen run so leftover cards can still extend them.
      const runSuits = new Set<Suit>();
      for (const ch of chosen) if (ch.kind === "run" && ch.cards[0]?.suit) runSuits.add(ch.cards[0].suit);
      for (let k = 0; k < cand.naturals; k++) {
        if (!take((c) => c.rank === cand.rank && !runSuits.has(c.suit!)) && !take((c) => c.rank === cand.rank)) return null;
      }
    } else {
      for (const v of cand.values) {
        const targetRank = v === 14 ? 1 : v;
        if (!take((c) => c.suit === cand.suit && c.rank === targetRank)) return null;
      }
    }
    return idxs;
  };

  // Pick runs before sets: runs need exact suits, while sets take any suit of that rank.
  const want: MeldKind[] = [...Array(need.runs).fill("run"), ...Array(need.sets).fill("set")];
  const chosen: { kind: MeldKind; cards: PCard[]; jokers: number }[] = [];
  let result: MeldShape[] | null = null;
  let nodes = 0;
  const MAX_NODES = 5000;

  const pick = (i: number, usedJokers: number, minIdx: number) => {
    if (result || ++nodes > MAX_NODES) return;
    if (i === want.length) {
      result = build();
      return;
    }
    const pool = want[i] === "set" ? sets : runs;
    // Same kind as the previous pick: don't revisit earlier candidates (but the same one again is
    // fine: with duplicate cards it makes a parallel group).
    const from = i > 0 && want[i - 1] === want[i] ? minIdx : 0;
    for (let k = from; k < pool.length; k++) {
      const cand = pool[k]!;
      if (usedJokers + cand.jokers > maxJokers) continue;
      const idxs = allocate(cand);
      if (!idxs) continue;
      for (const idx of idxs) used[idx] = 1;
      chosen.push({ kind: cand.kind, cards: idxs.map((idx) => nat[idx]!), jokers: cand.jokers });
      pick(i + 1, usedJokers + cand.jokers, k);
      chosen.pop();
      for (const idx of idxs) used[idx] = 0;
      if (result || nodes > MAX_NODES) return;
    }
  };

  const build = (): MeldShape[] | null => {
    const spare = [...jokers];
    const base: MeldShape[] = [];
    for (const c of chosen) {
      const m = asKind(c.kind, [...c.cards, ...spare.splice(0, c.jokers)]);
      if (!m) return null;
      base.push(m);
    }
    if (!useAll) return base;
    const leftovers: PCard[] = [];
    for (let idx = 0; idx < nat.length; idx++) if (!used[idx]) leftovers.push(nat[idx]!);
    for (const j of spare) leftovers.push(j);
    if (!leftovers.length) return base;
    // Every leftover card has to fit onto one of the melds. Try a couple of orders.
    const byValue = (a: PCard, b: PCard) => (a.rank || 99) - (b.rank || 99);
    const asc = [...leftovers].sort(byValue);
    const desc = [...asc].reverse();
    for (const order of [asc, desc]) {
      const melds = base.map((m) => ({ ...m, cards: [...m.cards] }));
      let left = order;
      let progress = true;
      while (left.length && progress) {
        progress = false;
        const nextLeft: PCard[] = [];
        for (const card of left) {
          let placed = false;
          for (let m = 0; m < melds.length; m++) {
            const grown = canAdd(melds[m]!, [card]);
            if (grown) {
              melds[m] = grown;
              placed = true;
              progress = true;
              break;
            }
          }
          if (!placed) nextLeft.push(card);
        }
        left = nextLeft;
      }
      if (!left.length) return melds;
    }
    return null;
  };

  pick(0, 0, 0);
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
