// A sensible Euchre partner: counts trump strength to bid, leads aces and trump,
// doesn't trump a partner who's already winning, and throws junk when it can't win.

import type { Rng } from "../../common";
import { effSuit, isLeft, isRight, legalCards, partnerOf, power, SUITS, teamOf, trickWinner, type ECard, type EuchreAction, type EuchreState, type Suit } from "./engine";

/** Rough worth of a hand if `trump` were trump (about 7+ is a good call). */
export function handStrength(hand: ECard[], trump: Suit): number {
  let v = 0;
  let trumps = 0;
  const suits = new Set<Suit>();
  for (const c of hand) {
    if (isRight(c, trump)) v += 3.2;
    else if (isLeft(c, trump)) v += 2.7;
    else if (c.suit === trump) v += ({ 1: 2.1, 13: 1.8, 12: 1.6, 10: 1.4, 9: 1.3 } as Record<number, number>)[c.rank] ?? 1;
    else if (c.rank === 1) v += 1.1;
    else if (c.rank === 13) v += 0.3;
    if (effSuit(c, trump) === trump) trumps++;
    else suits.add(c.suit);
  }
  // Short in side suits means you can trump in sooner.
  if (trumps >= 2) v += (3 - Math.min(3, suits.size)) * 0.5;
  return v;
}

/** The dealer's best 5 out of 6 once they pick up: drop the weakest side card. */
export function dealerDiscard(hand: ECard[], trump: Suit): ECard {
  const side = hand.filter((c) => effSuit(c, trump) !== trump);
  const pool = side.length ? side : hand;
  const count = (s: Suit) => side.filter((c) => c.suit === s).length;
  // Prefer emptying a suit (singletons that aren't aces), then the lowest card.
  return [...pool].sort((a, b) => {
    const va = (a.rank === 1 ? 20 : 0) + count(a.suit) * 3 + power(a, trump, a.suit);
    const vb = (b.rank === 1 ? 20 : 0) + count(b.suit) * 3 + power(b, trump, b.suit);
    return va - vb;
  })[0]!;
}

function bidRound1(s: EuchreState, seat: number): EuchreAction {
  const up = s.upcard!;
  const me = s.players[seat]!;
  let hand = me.hand;
  if (seat === s.dealer) hand = [...hand, up].filter((c) => c !== dealerDiscard([...hand, up], up.suit));
  let v = handStrength(hand, up.suit);
  // The upcard goes to the dealer: good if that's my partner, bad if it's an opponent.
  if (seat !== s.dealer) v += (teamOf(s.dealer) === teamOf(seat) ? 1 : -1) * (power(up, up.suit, up.suit) >= 99 ? 1.6 : 0.8);
  if (v >= 7.6) return { t: "order", alone: v >= 11.5 && hand.some((c) => isRight(c, up.suit)) };
  return { t: "pass" };
}

function bidRound2(s: EuchreState, seat: number): EuchreAction {
  const me = s.players[seat]!;
  let best: Suit = SUITS.find((x) => x !== s.turnedDown)!;
  let bestV = -1;
  for (const suit of SUITS) {
    if (suit === s.turnedDown) continue;
    const v = handStrength(me.hand, suit);
    if (v > bestV) [best, bestV] = [suit, v];
  }
  const mustCall = seat === s.dealer && s.settings.stick;
  if (bestV >= 7.2 || mustCall) return { t: "call", suit: best, alone: bestV >= 11.5 && me.hand.some((c) => isRight(c, best)) };
  return { t: "pass" };
}

function cheapest(cards: ECard[], trump: Suit): ECard {
  // Lowest side card first; trump only if that's all there is.
  return [...cards].sort((a, b) => {
    const ta = effSuit(a, trump) === trump ? 100 : 0;
    const tb = effSuit(b, trump) === trump ? 100 : 0;
    return ta + power(a, trump, a.suit) - (tb + power(b, trump, b.suit));
  })[0]!;
}

function choosePlay(s: EuchreState, seat: number, rng: Rng): ECard {
  const trump = s.trump!;
  const hand = s.players[seat]!.hand;
  const legal = legalCards(hand, s.trick, trump);
  if (legal.length === 1) return legal[0]!;

  if (!s.trick.length) {
    const trumps = legal.filter((c) => effSuit(c, trump) === trump).sort((a, b) => power(b, trump, null) - power(a, trump, null));
    const makers = s.maker !== null && teamOf(s.maker) === teamOf(seat);
    // We called it: pull trump with the top one.
    if (makers && trumps.length >= 2 && power(trumps[0]!, trump, null) >= 99) return trumps[0]!;
    const aces = legal.filter((c) => c.rank === 1 && c.suit !== trump);
    if (aces.length) return aces[Math.floor(rng() * aces.length)]!;
    if (makers && trumps.length >= 3) return trumps[0]!;
    return cheapest(legal, trump);
  }

  const led = effSuit(s.trick[0]!.card, trump);
  const winnerSeat = trickWinner(s.trick, trump);
  const winning = s.trick.find((t) => t.seat === winnerSeat)!.card;
  const best = power(winning, trump, led);
  const partnerWinning = winnerSeat === partnerOf(seat);
  const last = s.trick.length === (s.alone ? 2 : 3);
  // Partner has it (and it's safe enough): don't waste anything.
  if (partnerWinning && (last || best >= 14 || best >= 55)) return cheapest(legal, trump);
  const beaters = legal.filter((c) => power(c, trump, led) > best).sort((a, b) => power(a, trump, led) - power(b, trump, led));
  if (beaters.length) return beaters[0]!;
  return cheapest(legal, trump);
}

export function botMove(s: EuchreState, pid: string, rng: Rng): EuchreAction | null {
  const seat = s.players.findIndex((p) => p.id === pid);
  if (seat < 0 || s.turn !== seat || s.trickDone) return null;
  switch (s.phase) {
    case "bid1":
      return bidRound1(s, seat);
    case "bid2":
      return bidRound2(s, seat);
    case "discard":
      return { t: "discard", cardId: dealerDiscard(s.players[seat]!.hand, s.trump!).id };
    case "play":
      return { t: "play", cardId: choosePlay(s, seat, rng).id };
    default:
      return null;
  }
}
