// The deal's timing, shared by the TV and the phones so they stay in step: the TV flies one
// card at a time round the table from the dealer's left, and each phone shows its card the
// moment that card lands on its seat on the TV. Both start the clock when the deal event
// arrives, which reaches every screen at about the same time.

export const CARDS_EACH = 5;
/** Wait before the first card leaves the deck, so the TV has drawn the new hand. */
export const DEAL_LEAD = 120;
/** Time between one card leaving the deck and the next. */
export const DEAL_STEP = 160;
/** How long one card takes to slide from the deck to a seat. */
export const DEAL_FLY = 420;

/** When card `i` of the deal (0 = the first card dealt) leaves the deck, in ms from the deal event. */
export const leavesAt = (i: number) => DEAL_LEAD + i * DEAL_STEP;
/** When card `i` lands on its seat. */
export const landsAt = (i: number) => leavesAt(i) + DEAL_FLY;

/** How long the whole deal takes on the TV: when the last card lands. Bots wait this long before bidding. */
export const dealDuration = (seats = 4) => landsAt(seats * CARDS_EACH - 1);

/** The seat each card goes to, in the order they're dealt: one at a time, starting left of the dealer. */
export function dealOrder(seats: number, dealer: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < CARDS_EACH; k++) for (let j = 1; j <= seats; j++) out.push((dealer + j) % seats);
  return out;
}

/** When each of this seat's cards lands, first card first. */
export function seatLandings(seats: number, dealer: number, seat: number): number[] {
  return dealOrder(seats, dealer).flatMap((s, i) => (s === seat ? [landsAt(i)] : []));
}
