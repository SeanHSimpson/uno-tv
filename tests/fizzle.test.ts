import { describe, expect, it } from "vitest";
import type { Member } from "../src/shared/common";
import * as F from "../src/shared/games/fizzle/engine";
import * as R from "../src/shared/room";

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const members = (n: number): Member[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, hue: i, connected: true }));
let nid = 5000;
const card = (kind: F.FizzleKind): F.FCard => ({ id: nid++, kind });

/** p0 to play, with chosen hands and deck (deck top = last). */
function table(n: number, hands: F.FizzleKind[][], deck: F.FizzleKind[]) {
  const { state } = F.newFizzle(members(n), "p0", seeded(1));
  state.players.forEach((p, i) => (p.hand = (hands[i] ?? []).map(card)));
  state.deck = deck.map(card);
  state.turn = 0;
  return state;
}

describe("Fizzle!", () => {
  it("deals 1 Water + 4 cards each and hides one fewer firecracker than players", () => {
    const { state, events } = F.newFizzle(members(4), "p0", seeded(3));
    expect(state.players.every((p) => p.hand.length === 5 && p.hand.some((c) => c.kind === "water"))).toBe(true);
    expect(state.deck.filter((c) => c.kind === "cracker")).toHaveLength(3);
    expect(events[0]).toMatchObject({ type: "deal", crackers: 3 });
  });

  it("drawing a firecracker lights it; you get one turn to deal with it, then boom", () => {
    const s = table(3, [[], [], []], ["shuffle", "nap", "cracker"]);
    F.draw(s, "p0", Math.random);
    expect(s.players[0]!.lit).toEqual([{ id: expect.any(Number), fuse: 2 }]);
    F.draw(s, "p1", Math.random);
    F.draw(s, "p2", Math.random);
    // p0's turn starts: fuse 1 now (still alive, last chance).
    expect(s.players[0]!.lit[0]!.fuse).toBe(1);
    expect(s.players[0]!.out).toBe(false);
    F.draw(s, "p0", Math.random); // didn't deal with it
    F.draw(s, "p1", Math.random);
    const ev = F.draw(s, "p2", Math.random);
    expect(ev.some((e) => e.type === "boom" && e.pid === "p0")).toBe(true);
    expect(s.players[0]!.out).toBe(true);
    expect(F.currentPlayer(s).id).toBe("p1"); // boom passes the turn on
  });

  it("Water douses it back into the deck", () => {
    const s = table(2, [["water"], []], ["nap", "cracker"]);
    F.draw(s, "p0", Math.random);
    F.draw(s, "p1", Math.random);
    const water = s.players[0]!.hand.find((c) => c.kind === "water")!;
    F.play(s, "p0", water.id, undefined, Math.random);
    expect(s.players[0]!.lit).toEqual([]);
    expect(s.deck.filter((c) => c.kind === "cracker")).toHaveLength(1);
  });

  it("Toss throws it to someone else with a fresh fuse", () => {
    const s = table(3, [["toss"], [], []], ["nap", "nap", "nap", "cracker"]);
    F.draw(s, "p0", Math.random);
    F.draw(s, "p1", Math.random);
    F.draw(s, "p2", Math.random);
    const toss = s.players[0]!.hand.find((c) => c.kind === "toss")!;
    expect(() => F.play(s, "p0", toss.id, "p0", Math.random)).toThrow(/someone/);
    F.play(s, "p0", toss.id, "p2", Math.random);
    expect(s.players[0]!.lit).toEqual([]);
    expect(s.players[2]!.lit[0]!.fuse).toBe(2);
  });

  it("Water and Toss need a lit firecracker", () => {
    const s = table(2, [["water", "toss"], []], ["nap"]);
    expect(() => F.play(s, "p0", s.players[0]!.hand[0]!.id, undefined, Math.random)).toThrow(/douse/);
    expect(() => F.play(s, "p0", s.players[0]!.hand[1]!.id, "p1", Math.random)).toThrow(/toss/);
  });

  it("Peek shows the top 3; Shuffle clears what people peeked; Nap skips the draw; Fish draws from the bottom", () => {
    const s = table(2, [["peek", "shuffle", "nap", "fish"], []], ["water", "toss", "nap", "cracker"]);
    F.play(s, "p0", s.players[0]!.hand[0]!.id, undefined, Math.random);
    expect(s.players[0]!.peek!.map((c) => c.kind)).toEqual(["cracker", "nap", "toss"]);
    F.play(s, "p0", s.players[0]!.hand[0]!.id, undefined, Math.random); // shuffle
    expect(s.players[0]!.peek).toBeNull();
    F.play(s, "p0", s.players[0]!.hand[0]!.id, undefined, Math.random); // nap
    expect(F.currentPlayer(s).id).toBe("p1");
    expect(s.players[0]!.hand.map((c) => c.kind)).toEqual(["fish"]);
  });

  it("Fish takes the bottom card", () => {
    const s = table(2, [["fish"], []], ["water", "cracker"]);
    F.play(s, "p0", s.players[0]!.hand[0]!.id, undefined, Math.random);
    expect(s.players[0]!.hand.map((c) => c.kind)).toEqual(["water"]);
    expect(s.players[0]!.lit).toEqual([]);
  });

  it("last one standing wins", () => {
    const s = table(2, [[], []], ["nap", "cracker"]);
    F.draw(s, "p0", Math.random);
    F.draw(s, "p1", Math.random);
    F.draw(s, "p0", Math.random);
    const ev = F.draw(s, "p1", Math.random);
    expect(ev.at(-1)).toEqual({ type: "won", pid: "p1" });
    expect(s.phase).toBe("over");
  });

  it("people who join mid-game wait for the next one; leaving keeps one fewer firecracker than players", () => {
    const { state } = F.newFizzle(members(4), "p0", seeded(5));
    F.addPlayer(state, { id: "late", name: "Late", hue: 9, connected: true });
    expect(state.players.at(-1)!.waiting).toBe(true);
    F.removePlayer(state, "p3", Math.random);
    expect(state.deck.filter((c) => c.kind === "cracker").length).toBe(2);
  });
});

describe("Fizzle! bots", () => {
  it("bots play many games to a winner without an illegal move", () => {
    const winners = new Set<string>();
    for (let seed = 1; seed <= 120; seed++) {
      const rng = seeded(seed);
      const r = R.newRoom("X");
      R.join(r, "host-player-1", "H", undefined, rng);
      R.selectGame(r, "host-player-1", "fizzle");
      for (let i = 0; i < 2 + (seed % 6); i++) R.addBot(r, "host-player-1", rng);
      r.members = r.members.filter((m) => m.bot);
      R.start(r, "host-player-1", rng);
      let steps = 0;
      while (steps++ < 5000) {
        const due = R.nextBot(r, rng);
        if (!due) break;
        R.runBot(r, due.pid, rng);
      }
      const g = r.game as F.FizzleState;
      expect(g.phase, `seed ${seed}`).toBe("over");
      expect(g.players.filter((p) => !p.out)).toHaveLength(1);
      winners.add(g.winner!);
    }
    expect(winners.size).toBeGreaterThan(3);
  });
});
