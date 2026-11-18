import { describe, expect, it } from "vitest";
import {
  callOhNo,
  catchPlayer,
  createDeck,
  draw,
  GameError,
  isPlayable,
  joinPlayer,
  newGame,
  pass,
  play,
  privateView,
  publicView,
  removePlayer,
  setConnected,
  skipCurrent,
  startGame,
  take,
  updateSettings,
} from "../src/shared/games/ohno/engine";
import type { Card, GameState } from "../src/shared/games/ohno/types";

/** Small deterministic PRNG so tests are repeatable. */
function seeded(seed = 42) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 1000;
const c = (color: Card["color"], value: Card["value"]): Card => ({ id: nextId++, color, value });

/** Build a game in progress with hand-picked cards. */
function table(hands: Card[][], topCard: Card, opts: Partial<GameState> = {}): GameState {
  const s = newGame("TEST");
  hands.forEach((_, i) => joinPlayer(s, `p${i}`, `P${i}`));
  s.phase = "playing";
  s.players.forEach((p, i) => (p.hand = hands[i]!));
  s.discard = [topCard];
  s.color = topCard.color === "wild" ? "red" : topCard.color;
  s.drawPile = Array.from({ length: 30 }, () => c("green", "5"));
  s.turn = 0;
  Object.assign(s, opts);
  return s;
}

describe("deck", () => {
  it("has the standard 108 cards with unique ids", () => {
    const deck = createDeck(seeded());
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((d) => d.id)).size).toBe(108);
    expect(deck.filter((d) => d.value === "wild4")).toHaveLength(4);
    expect(deck.filter((d) => d.color === "red" && d.value === "0")).toHaveLength(1);
  });
});

describe("lobby", () => {
  it("first joiner is host; start needs 2 players; deals 7 each and picks a first player", () => {
    const s = newGame("ABCD");
    joinPlayer(s, "a", "Ann");
    expect(s.hostId).toBe("a");
    expect(() => startGame(s, "a")).toThrow(GameError);
    joinPlayer(s, "b", "Bob");
    expect(() => startGame(s, "b")).toThrow(/host/);
    const ev = startGame(s, "a", seeded(7));
    expect(ev[0]).toMatchObject({ type: "deal", round: 1 });
    expect(s.phase).toBe("playing");
    expect(s.discard[0]!.color).not.toBe("wild");
    const total = s.players.reduce((n, p) => n + p.hand.length, 0) + s.drawPile.length + s.discard.length;
    expect(total).toBe(108);
  });

  it("random first player varies with the seed", () => {
    const firsts = new Set<string>();
    for (let seed = 1; seed < 30; seed++) {
      const s = newGame("X");
      ["a", "b", "c", "d"].forEach((id) => joinPlayer(s, id, id));
      const ev = startGame(s, "a", seeded(seed));
      firsts.add((ev[0] as { first: string }).first);
    }
    expect(firsts.size).toBeGreaterThan(2);
  });

  it("disconnecting in the lobby removes the seat and moves host", () => {
    const s = newGame("X");
    joinPlayer(s, "a", "Ann");
    joinPlayer(s, "b", "Bob");
    setConnected(s, "a", false);
    expect(s.players.map((p) => p.id)).toEqual(["b"]);
    expect(s.hostId).toBe("b");
  });

  it("sanitizes names and validates settings", () => {
    const s = newGame("X");
    joinPlayer(s, "a", "  <b>Grandma Jo the Great</b> ");
    expect(s.players[0]!.name).toBe("bGrandma Jo th");
    updateSettings(s, "a", { targetScore: 500, stacking: true, catchPenalty: 99 });
    expect(s.settings).toMatchObject({ targetScore: 500, stacking: true, catchPenalty: 2 });
  });
});

describe("playing cards", () => {
  it("rejects out-of-turn and non-matching plays", () => {
    const s = table([[c("blue", "3"), c("red", "1")], [c("red", "2")]], c("red", "7"));
    expect(() => play(s, "p1", s.players[1]!.hand[0]!.id)).toThrow(/not your turn/);
    expect(() => play(s, "p0", s.players[0]!.hand[0]!.id)).toThrow(/match/);
  });

  it("matches by symbol and moves the turn", () => {
    const s = table([[c("blue", "7"), c("red", "1"), c("red", "4")], [c("blue", "2")]], c("red", "7"));
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(s.color).toBe("blue");
    expect(s.players[1]!.id).toBe(publicView(s).turnId);
    expect(s.players[0]!.lastPlayed?.value).toBe("7");
  });

  it("wilds require a color", () => {
    const s = table([[c("wild", "wild"), c("red", "1"), c("red", "3")], [c("green", "2")]], c("red", "7"));
    expect(() => play(s, "p0", s.players[0]!.hand[0]!.id)).toThrow(/color/);
    play(s, "p0", s.players[0]!.hand[0]!.id, "green");
    expect(s.color).toBe("green");
  });

  it("skip jumps a player; reverse flips direction", () => {
    const hands = [[c("red", "skip"), c("red", "reverse"), c("red", "1")], [c("red", "2")], [c("red", "3")]];
    const s = table(hands, c("red", "9"));
    play(s, "p0", hands[0]![0]!.id);
    expect(publicView(s).turnId).toBe("p2");
    const s2 = table([[c("red", "reverse"), c("red", "1")], [c("red", "2")], [c("red", "3")]], c("red", "9"));
    play(s2, "p0", s2.players[0]!.hand[0]!.id);
    expect(s2.direction).toBe(-1);
    expect(publicView(s2).turnId).toBe("p2");
  });

  it("reverse acts as skip with two players", () => {
    const s = table([[c("red", "reverse"), c("red", "1")], [c("red", "2")]], c("red", "9"));
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(publicView(s).turnId).toBe("p0");
  });

  it("+2 makes the next player draw and lose their turn (no stacking)", () => {
    const s = table([[c("red", "draw2"), c("red", "1")], [c("red", "2")], [c("red", "3")]], c("red", "9"));
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(s.players[1]!.hand).toHaveLength(3);
    expect(publicView(s).turnId).toBe("p2");
  });

  it("+4 makes the next player draw 4 and lose their turn", () => {
    const s = table([[c("wild", "wild4"), c("red", "1")], [c("red", "2")], [c("yellow", "3")]], c("red", "9"));
    play(s, "p0", s.players[0]!.hand[0]!.id, "yellow");
    expect(s.players[1]!.hand).toHaveLength(5);
    expect(publicView(s).turnId).toBe("p2");
  });
});

describe("stacking", () => {
  it("lets the next player stack and passes the combined penalty on", () => {
    const s = table(
      [[c("red", "draw2"), c("blue", "1")], [c("blue", "draw2"), c("blue", "1")], [c("green", "3")]],
      c("red", "9"),
    );
    updateSettings(s, "p0", { stacking: true });
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(publicView(s).turnId).toBe("p1");
    expect(s.pendingDraw).toBe(2);
    expect(privateView(s, "p1")!.canTake).toBe(true);
    expect(isPlayable(s, s.players[1]!.hand[1]!)).toBe(false);
    play(s, "p1", s.players[1]!.hand[0]!.id);
    // p2 can't stack -> auto-draws 4 and is skipped
    expect(s.players[2]!.hand).toHaveLength(5);
    expect(s.pendingDraw).toBe(0);
    expect(publicView(s).turnId).toBe("p0");
  });

  it("taking the stack draws and skips", () => {
    const s = table([[c("red", "draw2"), c("red", "1")], [c("blue", "draw2")], [c("red", "3")]], c("red", "9"));
    updateSettings(s, "p0", { stacking: true });
    play(s, "p0", s.players[0]!.hand[0]!.id);
    take(s, "p1");
    expect(s.players[1]!.hand).toHaveLength(3);
    expect(publicView(s).turnId).toBe("p2");
  });
});

describe("auto draw", () => {
  it("draws automatically when you have nothing playable, and passes if the draw doesn't help", () => {
    const s = table([[c("red", "1"), c("red", "2")], [c("blue", "3")], [c("red", "4")]], c("red", "9"));
    s.drawPile = [c("yellow", "8")];
    s.drawPile.push(...Array.from({ length: 5 }, () => c("yellow", "6")));
    play(s, "p0", s.players[0]!.hand[0]!.id); // red 1 -> p1 has blue 3 only, draws yellow 6 (no match) -> pass
    expect(s.players[1]!.hand).toHaveLength(2);
    expect(publicView(s).turnId).toBe("p2");
  });

  it("lets you play or keep an auto-drawn playable card", () => {
    const s = table([[c("red", "1"), c("red", "2")], [c("blue", "3")], [c("red", "4")]], c("red", "9"));
    const good = c("red", "6");
    s.drawPile = [good];
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(publicView(s).turnId).toBe("p1");
    const me = privateView(s, "p1")!;
    expect(me.drawnCardId).toBe(good.id);
    expect(me.playable).toEqual([good.id]);
    expect(me.canPass).toBe(true);
    pass(s, "p1");
    expect(publicView(s).turnId).toBe("p2");
  });

  it("draw-until-playable keeps drawing", () => {
    const s = table([[c("red", "1"), c("red", "2")], [c("blue", "3")], [c("red", "4")]], c("red", "9"));
    updateSettings(s, "p0", { drawUntilPlayable: true });
    s.drawPile = [c("red", "6"), c("blue", "4"), c("blue", "8")]; // pops from the end
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(s.players[1]!.hand).toHaveLength(4);
    expect(privateView(s, "p1")!.canPass).toBe(true);
  });

  it("manual draw is allowed even with a playable card", () => {
    const s = table([[c("red", "1")], [c("red", "3")]], c("red", "9"));
    s.drawPile = [c("green", "2")];
    draw(s, "p0");
    expect(s.players[0]!.hand).toHaveLength(2);
    expect(publicView(s).turnId).toBe("p1");
  });

  it("reshuffles the discard pile when the deck runs out", () => {
    const s = table([[c("red", "1"), c("red", "2")], [c("blue", "3")]], c("red", "9"));
    s.drawPile = [];
    s.discard = [c("yellow", "5"), c("green", "5"), c("red", "9")];
    const ev = draw(s, "p0");
    expect(ev.some((e) => e.type === "reshuffle")).toBe(true);
    expect(s.discard).toHaveLength(1);
  });
});

describe("OhNo! calls", () => {
  it("forgetting to call lets others catch you until the next card is played", () => {
    const s = table([[c("red", "1"), c("red", "2")], [c("blue", "3"), c("red", "5")], [c("red", "7")]], c("red", "9"));
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(s.vulnerable).toBe("p0");
    expect(() => catchPlayer(s, "p0", "p0")).toThrow();
    catchPlayer(s, "p2", "p0");
    expect(s.players[0]!.hand).toHaveLength(3);
    expect(s.vulnerable).toBeNull();
  });

  it("calling before playing keeps you safe", () => {
    const s = table([[c("red", "1"), c("red", "2")], [c("red", "3")]], c("red", "9"));
    expect(() => callOhNo(s, "p1")).not.toThrow(); // 1 card is fine any time
    callOhNo(s, "p0");
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(s.vulnerable).toBeNull();
    expect(() => catchPlayer(s, "p1", "p0")).toThrow(/safe/);
  });

  it("calling late (after playing) still saves you if nobody caught you yet", () => {
    const s = table([[c("red", "1"), c("red", "2")], [c("red", "3"), c("red", "4")]], c("red", "9"));
    play(s, "p0", s.players[0]!.hand[0]!.id);
    callOhNo(s, "p0");
    expect(s.vulnerable).toBeNull();
  });

  it("the window closes once another card is played", () => {
    const s = table([[c("red", "1"), c("red", "2")], [c("red", "3"), c("red", "4"), c("red", "5")]], c("red", "9"));
    play(s, "p0", s.players[0]!.hand[0]!.id);
    play(s, "p1", s.players[1]!.hand[0]!.id);
    expect(s.vulnerable).toBeNull();
  });

  it("can't call with a big hand", () => {
    const s = table([[c("red", "1"), c("red", "2"), c("red", "3")], [c("red", "3")]], c("red", "9"));
    expect(() => callOhNo(s, "p0")).toThrow(GameError);
  });
});

describe("scoring", () => {
  it("winner scores everyone else's cards; single-round game ends", () => {
    const s = table([[c("red", "1")], [c("wild", "wild"), c("blue", "skip"), c("green", "7")]], c("red", "9"));
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(s.phase).toBe("roundOver");
    expect(s.players[0]!.score).toBe(77);
    expect(s.gameWinner).toBe("p0");
    expect(publicView(s).reveal!["p1"]).toHaveLength(3);
  });

  it("first to the target score wins across rounds", () => {
    const s = table([[c("red", "1")], [c("green", "7")]], c("red", "9"));
    updateSettings(s, "p0", { targetScore: 100 });
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(s.phase).toBe("roundOver");
    expect(s.gameWinner).toBeNull();
  });

  it("going out on a +2 still makes the next player draw (for points)", () => {
    const s = table([[c("red", "draw2")], [c("green", "7")]], c("red", "9"));
    s.drawPile = [c("blue", "5"), c("blue", "5")];
    play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(s.players[0]!.score).toBe(17);
  });
});

describe("host controls & departures", () => {
  it("removing the current player hands the turn to the next one", () => {
    const s = table([[c("red", "1")], [c("red", "2")], [c("red", "3")]], c("red", "9"));
    s.turn = 1; // p1's turn
    removePlayer(s, "p1", true);
    expect(publicView(s).turnId).toBe("p2");
    removePlayer(s, "p2", false);
    expect(s.phase).toBe("lobby"); // only one left
  });

  it("anyone can skip a disconnected current player; only the host can skip a connected one", () => {
    const s = table([[c("red", "1")], [c("red", "2"), c("red", "5")], [c("red", "3"), c("red", "4")]], c("red", "9"));
    s.turn = 1;
    expect(() => skipCurrent(s, "p2")).toThrow(/host/);
    setConnected(s, "p1", false);
    skipCurrent(s, "p2");
    expect(publicView(s).turnId).toBe("p2");
    expect(() => skipCurrent(s, "p2")).toThrow(/your turn/);
  });

  it("returns a removed player's cards to the deck", () => {
    const s = table([[c("red", "1")], [c("red", "2")], [c("red", "3"), c("red", "4")]], c("red", "9"));
    const before = s.drawPile.length;
    removePlayer(s, "p2", true);
    expect(s.drawPile.length).toBe(before + 2);
  });

  it("a mid-round join is dealt in", () => {
    const s = table([[c("red", "1")], [c("red", "2")]], c("red", "9"));
    joinPlayer(s, "late", "Late");
    expect(s.players.at(-1)!.hand).toHaveLength(7);
  });

  it("reconnecting keeps your hand", () => {
    const s = table([[c("red", "1"), c("red", "5")], [c("red", "2")]], c("red", "9"));
    setConnected(s, "p0", false);
    expect(s.players[0]!.connected).toBe(false);
    joinPlayer(s, "p0", "P0");
    expect(s.players[0]!.hand).toHaveLength(2);
  });
});

describe("full games", () => {
  it("plays random games to completion without breaking invariants", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      const s = newGame("SIM");
      const n = 2 + (seed % 5);
      for (let i = 0; i < n; i++) joinPlayer(s, `p${i}`, `P${i}`);
      updateSettings(s, "p0", { stacking: seed % 2 === 0, drawUntilPlayable: seed % 3 === 0 });
      startGame(s, "p0", rng);
      let moves = 0;
      while (s.phase === "playing" && moves++ < 3000) {
        const pid = publicView(s).turnId!;
        const me = privateView(s, pid)!;
        if (me.hand.length === 2 && rng() < 0.7) callOhNo(s, pid);
        if (me.playable.length && rng() < 0.9) {
          const card = me.hand.find((h) => h.id === me.playable[0])!;
          play(s, pid, card.id, card.color === "wild" ? "blue" : undefined, rng);
        } else if (me.canTake) take(s, pid, rng);
        else if (me.canPass) pass(s, pid, rng);
        else draw(s, pid, rng);
        if (s.vulnerable && rng() < 0.5) {
          const other = s.players.find((p) => p.id !== s.vulnerable)!;
          catchPlayer(s, other.id, s.vulnerable, rng);
        }
        const total = s.players.reduce((a, p) => a + p.hand.length, 0) + s.drawPile.length + s.discard.length;
        expect(total).toBe(108);
      }
      expect(s.phase).toBe("roundOver");
    }
  });
});
