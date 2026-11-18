import { describe, expect, it } from "vitest";
import { botTurn } from "../src/shared/bot";
import * as engine from "../src/shared/engine";
import type { ClientMessage, GameState } from "../src/shared/types";

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function apply(s: GameState, pid: string, m: ClientMessage, rng: () => number) {
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

describe("bots", () => {
  it("host can add bots; they get names, a bot flag, and are never made host", () => {
    const s = engine.newGame("X");
    engine.joinPlayer(s, "human", "Sean");
    expect(() => engine.addBot(s, "nobody")).toThrow(/host/);
    engine.addBot(s, "human");
    engine.addBot(s, "human");
    const view = engine.publicView(s);
    expect(view.players.filter((p) => p.bot).map((p) => p.name)).toEqual(["Robo Rita", "Bitsy"]);
    engine.setConnected(s, s.players[1]!.id, false); // bots never drop
    expect(s.players).toHaveLength(3);
    engine.removePlayer(s, "human", false);
    expect(s.hostId).toBeNull();
  });

  it("one human + bots can start a game", () => {
    const s = engine.newGame("X");
    engine.joinPlayer(s, "human", "Sean");
    engine.addBot(s, "human");
    engine.startGame(s, "human", seeded(3));
    expect(s.phase).toBe("playing");
  });

  it("bots play hundreds of full games without an illegal move", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seeded(seed);
      const s = engine.newGame("SIM");
      engine.joinPlayer(s, "host", "Host");
      for (let i = 0; i < 1 + (seed % 5); i++) engine.addBot(s, "host", rng);
      engine.updateSettings(s, "host", { stacking: seed % 2 === 0, drawUntilPlayable: seed % 3 === 0 });
      engine.removePlayer(s, "host", false); // bots only from here on
      s.hostId = "host";
      if (s.players.length < 2) continue;
      engine.startGame(s, "host", rng);
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
