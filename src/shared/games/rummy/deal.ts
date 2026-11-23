// The Rummy deal's timing, shared by the TV, the phones and the bots: the TV slides one card at
// a time from the deck to each player, round the table starting with the first player, and each
// phone shows its card the moment it lands on that player's board. Everything counts from when
// the deal event arrives, which reaches every screen at about the same time.
//
// A Rummy deal is big (10 or 12 cards each, up to 8 players), so the cards go faster when there
// are more of them: the whole deal takes about 3 to 5 seconds.

/** Wait before the first card leaves the deck, so the TV has drawn the new round. */
export const DEAL_LEAD = 150;
/** How long one card takes to slide from the deck to a player. */
export const DEAL_FLY = 380;
/** After the last card lands: the top card of the deck is turned up onto the discard pile. */
export const TURN_UP_GAP = 120;
export const TURN_UP_FLY = 480;

const TARGET = 4000;
const MIN_STEP = 45;
const MAX_STEP = 150;

/** Time between one card leaving the deck and the next. */
export const dealStep = (cards: number) => Math.min(MAX_STEP, Math.max(MIN_STEP, Math.round(TARGET / Math.max(1, cards))));

/** The seat each card goes to, in the order they're dealt: one at a time, starting with `first`. */
export function dealOrder(seats: number, first: number, each: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < each; k++) for (let j = 0; j < seats; j++) out.push((first + j) % seats);
  return out;
}

/** When card `i` leaves the deck, in ms from the deal event. */
export const leavesAt = (i: number, step: number) => DEAL_LEAD + i * step;
/** When card `i` lands on its player. */
export const landsAt = (i: number, step: number) => leavesAt(i, step) + DEAL_FLY;

/** When the turned-up card leaves the deck for the discard pile. */
export const turnUpAt = (seats: number, each: number) => landsAt(seats * each - 1, dealStep(seats * each)) + TURN_UP_GAP;
/** How long the whole deal takes, turn-up included. Bots wait this long before their first move. */
export const dealDuration = (seats: number, each: number) => turnUpAt(seats, each) + TURN_UP_FLY;

/** When each of this seat's cards lands, first card first. */
export function seatLandings(seats: number, first: number, each: number, seat: number): number[] {
  const step = dealStep(seats * each);
  return dealOrder(seats, first, each).flatMap((s, i) => (s === seat ? [landsAt(i, step)] : []));
}
