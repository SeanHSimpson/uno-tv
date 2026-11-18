import { describe, expect, it } from "vitest";
import { joinPlayer, newGame, play, publicView } from "../src/shared/engine";
import type { Card, GameState } from "../src/shared/types";

let id = 5000;
const c = (color: Card["color"], value: Card["value"]): Card => ({ id: id++, color, value });

/** n players, everyone holds a wild (always playable, so nobody auto-draws) plus filler. */
function game(n: number, direction: 1 | -1, turn = 0): GameState {
  const s = newGame("T");
  for (let i = 0; i < n; i++) joinPlayer(s, `p${i}`, `P${i}`);
  s.phase = "playing";
  s.players.forEach((p) => (p.hand = [c("wild", "wild"), c("blue", "9"), c("blue", "8")]));
  s.discard = [c("red", "5")];
  s.color = "red";
  s.drawPile = Array.from({ length: 40 }, () => c("green", "3"));
  s.direction = direction;
  s.turn = turn;
  return s;
}
const at = (s: GameState, i: number) => s.players[((i % s.players.length) + s.players.length) % s.players.length]!.id;

describe.each([3, 4, 5])("%i players", (n) => {
  describe.each([1, -1] as const)("direction %i", (dir) => {
    const t = 1; // player p1 plays
    const next = (k: number) => at(game(n, dir), t + dir * k);

    it("number card: next player", () => {
      const s = game(n, dir, t);
      play(s, "p1", (s.players[1]!.hand[0] = c("red", "7")).id);
      expect(publicView(s).turnId).toBe(next(1));
    });

    it("skip: jumps exactly one player", () => {
      const s = game(n, dir, t);
      const ev = play(s, "p1", (s.players[1]!.hand[0] = c("red", "skip")).id);
      expect(ev.find((e) => e.type === "skip")).toMatchObject({ pid: next(1) });
      expect(publicView(s).turnId).toBe(next(2));
      expect(s.direction).toBe(dir); // direction unchanged
    });

    it("reverse: flips direction, previous player goes next", () => {
      const s = game(n, dir, t);
      play(s, "p1", (s.players[1]!.hand[0] = c("red", "reverse")).id);
      expect(s.direction).toBe(-dir);
      expect(publicView(s).turnId).toBe(next(-1));
    });

    it("+2: next player draws 2 and is skipped", () => {
      const s = game(n, dir, t);
      const victim = s.players.find((p) => p.id === next(1))!;
      play(s, "p1", (s.players[1]!.hand[0] = c("red", "draw2")).id);
      expect(victim.hand).toHaveLength(5);
      expect(publicView(s).turnId).toBe(next(2));
    });

    it("wild: sets color, next player", () => {
      const s = game(n, dir, t);
      play(s, "p1", s.players[1]!.hand[0]!.id, "green");
      expect(s.color).toBe("green");
      expect(publicView(s).turnId).toBe(next(1));
    });

    it("wild +4: sets color, next draws 4 and is skipped", () => {
      const s = game(n, dir, t);
      const victim = s.players.find((p) => p.id === next(1))!;
      play(s, "p1", (s.players[1]!.hand[0] = c("wild", "wild4")).id, "yellow");
      expect(s.color).toBe("yellow");
      expect(victim.hand).toHaveLength(7);
      expect(publicView(s).turnId).toBe(next(2));
    });
  });
});

describe("2 players", () => {
  it("skip and reverse both give the same player another turn", () => {
    for (const v of ["skip", "reverse"] as const) {
      const s = game(2, 1, 0);
      play(s, "p0", (s.players[0]!.hand[1] = c("red", v)).id);
      expect(publicView(s).turnId).toBe("p0");
    }
  });
});
