import { describe, expect, it } from "vitest";
import { botTurn } from "../src/shared/games/ohno/bot";
import * as engine from "../src/shared/games/ohno/engine";
import type { GameState, OhNoAction } from "../src/shared/games/ohno/types";

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function apply(s: GameState, pid: string, m: OhNoAction, rng: () => number) {
  switch (m.t) {
    case "play":
      return engine.play(s, pid, m.cardId, m.color, rng);
    case "draw":
      return engine.draw(s, pid, rng);
    case "pass":
      return engine.pass(s, pid, rng);
    case "take":
      return engine.take(s, pid, rng);
    case "ohno":
      return engine.callOhNo(s, pid);
    case "catch":
      return engine.catchPlayer(s, pid, m.target, rng);
    default:
      throw new Error(`unexpected bot move ${m.t}`);
  }
}

describe("OhNo! bots", () => {
  it("play hundreds of full games without an illegal move", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seeded(seed);
      const s = engine.newGame("SIM");
      const n = 2 + (seed % 5);
      for (let i = 0; i < n; i++) engine.joinPlayer(s, `bot${i}`, `Bot ${i}`, rng);
      for (const p of s.players) p.bot = true;
      engine.updateSettings(s, "bot0", { stacking: seed % 2 === 0, drawUntilPlayable: seed % 3 === 0 });
      engine.startGame(s, "bot0", rng);
      let turns = 0;
      while (s.phase === "playing" && turns++ < 2000) {
        const pid = s.players[s.turn]!.id;
        const moves = botTurn(s, pid, rng);
        expect(moves.length, `seed ${seed} turn ${turns}`).toBeGreaterThan(0);
        for (const m of moves) apply(s, pid, m, rng); // throws on any illegal move
      }
      expect(s.phase, `seed ${seed}`).toBe("roundOver");
    }
  });
});
