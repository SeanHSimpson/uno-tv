// A friendly computer player. Pure function: given the table, return the moves to send.
// It plays sensibly but not ruthlessly. It sometimes forgets to call OhNo! (so humans
// get to catch it) and occasionally catches people who forget.

import { isPlayable, type Rng } from "./engine";
import { COLORS, type Card, type Color, type GameState, type OhNoAction } from "./types";

export function botTurn(s: GameState, pid: string, rng: Rng = Math.random): OhNoAction[] {
  const me = s.players.find((p) => p.id === pid);
  if (!me || s.phase !== "playing" || s.players[s.turn]?.id !== pid) return [];
  const moves: OhNoAction[] = [];

  // Catch someone who forgot to call OhNo!
  if (s.vulnerable && s.vulnerable !== pid && rng() < 0.5) moves.push({ t: "catch", target: s.vulnerable });

  const playable = me.hand.filter((c) => isPlayable(s, c));

  if (s.pendingDraw > 0) {
    // Stacking is on and we can pass the pile along: do it. Otherwise take the cards.
    if (playable.length) moves.push(...playCard(me.hand, best(s, playable, me.hand), rng));
    else moves.push({ t: "take" });
    return moves;
  }

  if (s.drawnCardId !== null) {
    const drawn = playable.find((c) => c.id === s.drawnCardId);
    moves.push(...(drawn ? playCard(me.hand, drawn, rng) : [{ t: "pass" } as OhNoAction]));
    return moves;
  }

  if (!playable.length) {
    moves.push({ t: "draw" });
    return moves;
  }
  moves.push(...playCard(me.hand, best(s, playable, me.hand), rng));
  return moves;
}

function playCard(hand: Card[], card: Card, rng: Rng): OhNoAction[] {
  const moves: OhNoAction[] = [];
  // Usually remembers to call OhNo! on the second-to-last card. Usually.
  if (hand.length === 2 && rng() < 0.8) moves.push({ t: "ohno" });
  moves.push({ t: "play", cardId: card.id, color: card.color === "wild" ? pickColor(hand, card, rng) : undefined });
  return moves;
}

/** Pick the card to play: dump points, save wilds, and hit hard when the next player is close to winning. */
function best(s: GameState, playable: Card[], hand: Card[]): Card {
  const n = s.players.length;
  const next = s.players[(((s.turn + s.direction) % n) + n) % n]!;
  const danger = next.hand.length <= 2;
  const endgame = hand.length <= 2;
  const score = (c: Card) => {
    let v = 0;
    if (c.value === "wild4") v = endgame || danger ? 30 : 1;
    else if (c.value === "wild") v = endgame ? 25 : 2;
    else if (c.value === "draw2") v = danger ? 28 : 12;
    else if (c.value === "skip" || c.value === "reverse") v = danger ? 26 : 11;
    else v = 10 + Number(c.value) / 10; // prefer shedding high numbers
    if (c.color === s.color) v += 1; // keep the color we probably hold
    return v;
  };
  return [...playable].sort((a, b) => score(b) - score(a))[0]!;
}

/** The colour we hold the most of (ignoring the wild being played). */
function pickColor(hand: Card[], playing: Card, rng: Rng): Color {
  const counts = new Map<Color, number>();
  for (const c of hand) if (c.id !== playing.id && c.color !== "wild") counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : COLORS[Math.floor(rng() * COLORS.length)]!;
}
