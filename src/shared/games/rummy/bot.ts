// A sensible Contract Rummy player: collect toward the contract, lay down as soon as it
// can, add cards to groups once down, and discard whatever helps least.

import type { Rng } from "../../common";
import { canAdd, findContract, isJoker, points, type Contract, type PCard } from "./cards";
import { contractOf, isFinalContract, type RummyAction, type RummyState } from "./engine";

/** How useful a card is for this contract, given the rest of the hand (higher = keep). */
export function usefulness(card: PCard, hand: PCard[], contract: Contract): number {
  if (isJoker(card)) return 100;
  const others = hand.filter((c) => c.id !== card.id && !isJoker(c));
  let score = 0;
  if (contract.sets) score += others.filter((c) => c.rank === card.rank).length * 10 * contract.sets;
  if (contract.runs) {
    for (const c of others) {
      if (c.suit !== card.suit) continue;
      const gap = Math.min(Math.abs(c.rank - card.rank), Math.abs((c.rank === 1 ? 14 : c.rank) - (card.rank === 1 ? 14 : card.rank)));
      if (gap >= 1 && gap <= 3) score += (4 - gap) * 3 * contract.runs;
    }
  }
  return score - points(card) / 10; // when in doubt, dump high cards
}

/**
 * Does this card complete something right now? A third of a rank (sets), or a third
 * card in a four-card window of one suit (runs). Bots only take discards that do.
 */
export function completes(card: PCard, hand: PCard[], contract: Contract): boolean {
  if (isJoker(card)) return true;
  const nat = hand.filter((c) => !isJoker(c) && c.id !== card.id);
  if (contract.sets && nat.filter((c) => c.rank === card.rank).length >= 2) return true;
  if (contract.runs) {
    for (const aceHigh of [false, true]) {
      const v = (c: PCard) => (c.rank === 1 && aceHigh ? 14 : c.rank);
      const mine = v(card);
      const suited = new Set(nat.filter((c) => c.suit === card.suit).map(v));
      if (suited.has(mine)) continue;
      for (let start = mine - 3; start <= mine; start++) {
        let have = 0;
        for (let x = start; x < start + 4; x++) if (x !== mine && suited.has(x)) have++;
        if (have >= 2) return true;
      }
    }
  }
  return false;
}

/** Moves for the bot whose turn it is. */
export function botTurn(s: RummyState, pid: string): RummyAction[] {
  const me = s.players.find((p) => p.id === pid)!;
  const contract = contractOf(s);
  const final = isFinalContract(contract);
  if (s.stage === "draw") {
    const top = s.discard[s.discard.length - 1];
    const wantTop = top && !me.down && completes(top, me.hand, contract);
    const fitsTable = top && me.down && !final && s.melds.some((m) => canAdd(m, [top]));
    return [{ t: "draw", from: wantTop || fitsTable ? "discard" : "stock" }];
  }

  const moves: RummyAction[] = [];
  let hand = [...me.hand];
  if (!me.down) {
    // Final round: only if the whole hand works. Otherwise lay down the contract,
    // keeping at least one card back to discard.
    const all = findContract(hand, contract, true);
    if (all) return [{ t: "layDown", cardIds: hand.map((c) => c.id) }];
    if (!final) {
      const melds = findContract(hand, contract, false);
      if (melds) {
        const ids = melds.flatMap((m) => m.cards.map((c) => c.id));
        if (ids.length < hand.length) {
          moves.push({ t: "layDown", cardIds: ids });
          hand = hand.filter((c) => !ids.includes(c.id));
          // Next: add any leftovers onto our own fresh melds or the table (simulated loosely).
          // Plan on copies: never touch the real table while thinking.
          const tableMelds = s.melds.map((m) => ({ ...m, cards: [...m.cards] }));
          for (const card of [...hand]) {
            if (hand.length <= 1) break;
            const target = tableMelds.find((m) => canAdd(m, [card]));
            if (target) {
              moves.push({ t: "hit", cardIds: [card.id], meldId: target.id });
              target.cards = canAdd(target, [card])!.cards;
              hand = hand.filter((c) => c.id !== card.id);
            }
          }
        }
      }
    }
  } else if (!final) {
    // Already down: shed cards onto any group that takes them. Going out by hitting is fine.
    const melds = s.melds.map((m) => ({ ...m, cards: [...m.cards] }));
    for (const card of [...hand]) {
      const target = melds.find((m) => canAdd(m, [card]));
      if (target) {
        moves.push({ t: "hit", cardIds: [card.id], meldId: target.id });
        target.cards = canAdd(target, [card])!.cards;
        hand = hand.filter((c) => c.id !== card.id);
      }
    }
    if (!hand.length) return moves;
  }
  if (!hand.length) return moves;
  // Discard the least useful card (never a joker if there's a choice, and not the card we just picked up).
  const choices = hand.length > 1 ? hand.filter((c) => c.id !== s.tookFromDiscard) : hand;
  const worst = [...choices].sort((a, b) => usefulness(a, hand, contract) - usefulness(b, hand, contract))[0]!;
  moves.push({ t: "discard", cardId: worst.id });
  return moves;
}

/** Would this bot like to call "May I?" on the current top discard? */
export function botWantsMayI(s: RummyState, pid: string, rng: Rng): boolean {
  const me = s.players.find((p) => p.id === pid);
  const top = s.discard[s.discard.length - 1];
  if (!me || !top || me.down || me.buys >= 3 || s.lastDiscardBy === pid || s.mayI.includes(pid)) return false;
  return completes(top, me.hand, contractOf(s)) && rng() < 0.6;
}
