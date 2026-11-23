import { describe, expect, it } from "vitest";
import type { Member } from "../src/shared/common";
import { asRun, asSet, canAdd, findContract, makeDeck, points, type PCard, type Suit } from "../src/shared/games/rummy/cards";
import * as E from "../src/shared/games/rummy/engine";
import * as R from "../src/shared/room";

let nextId = 9000;
const c = (rank: number, suit: Suit | null = "H"): PCard => ({ id: nextId++, rank, suit: rank === 0 ? null : suit });
const J = () => c(0);
const ranks = (cards: PCard[] | undefined) => cards?.map((x) => (x.rank === 0 ? "J" : `${x.rank}${x.suit}`)).join(" ");

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

describe("cards & melds", () => {
  it("deck sizes and points", () => {
    expect(makeDeck(2, Math.random)).toHaveLength(108);
    expect(makeDeck(3, Math.random)).toHaveLength(162);
    expect([c(5), c(10), c(13), c(1), J()].map(points)).toEqual([5, 10, 10, 15, 50]);
  });

  it("sets: 3+ of a rank, jokers can't outnumber real cards", () => {
    expect(asSet([c(7, "H"), c(7, "S"), c(7, "D")])).not.toBeNull();
    expect(asSet([c(7, "H"), c(7, "S"), J()])).not.toBeNull();
    expect(asSet([c(7, "H"), J(), J()])).toBeNull();
    expect(asSet([c(7, "H"), c(8, "S"), c(7, "D")])).toBeNull();
    expect(asSet([c(7), c(7)])).toBeNull();
  });

  it("runs: 4+ in a row, one suit, jokers fill gaps, ace high or low, no wrap", () => {
    expect(ranks(asRun([c(5), c(3), c(4), c(6)])?.cards)).toBe("3H 4H 5H 6H");
    expect(ranks(asRun([c(3), c(6), J(), c(4)])?.cards)).toBe("3H 4H J 6H");
    expect(asRun([c(1), c(2), c(3), c(4)])).not.toBeNull();
    expect(ranks(asRun([c(11), c(12), c(13), c(1)])?.cards)).toBe("11H 12H 13H 1H");
    expect(asRun([c(12), c(13), c(1), c(2)])).toBeNull(); // no wrapping
    expect(asRun([c(3), c(4, "S"), c(5), c(6)])).toBeNull(); // mixed suits
    expect(asRun([c(3), c(3), c(4), c(5)])).toBeNull(); // duplicate rank
    expect(ranks(asRun([c(12), c(13), J(), J()])?.cards)).toBe("J J 12H 13H"); // can't go past the king, so jokers sit below
  });

  it("adding to groups", () => {
    const set = asSet([c(9, "H"), c(9, "S"), c(9, "C")])!;
    expect(canAdd(set, [c(9, "D")])).not.toBeNull();
    expect(canAdd(set, [c(8, "D")])).toBeNull();
    const run = asRun([c(4), c(5), c(6), c(7)])!;
    expect(ranks(canAdd(run, [c(8)])?.cards)).toBe("4H 5H 6H 7H 8H");
    expect(ranks(canAdd(run, [c(3)])?.cards)).toBe("3H 4H 5H 6H 7H");
    expect(canAdd(run, [c(10)])).toBeNull();
    expect(canAdd(run, [c(9), J()])).not.toBeNull();
  });

  it("finds the contract inside the cards you picked", () => {
    const hand = [c(9, "H"), c(9, "S"), c(9, "C"), c(4, "D"), c(5, "D"), c(6, "D"), J()];
    const set1 = findContract(hand, { sets: 1, runs: 1 }, true);
    expect(set1?.map((m) => m.kind).sort()).toEqual(["run", "set"]);
    expect(findContract(hand, { sets: 2, runs: 0 }, true)).toBeNull();
    // Extra cards are fine when they extend a group.
    const extra = [...hand, c(9, "D"), c(7, "D")];
    expect(findContract(extra, { sets: 1, runs: 1 }, true)).not.toBeNull();
    // ...but not if they don't fit anywhere.
    expect(findContract([...hand, c(2, "S")], { sets: 1, runs: 1 }, true)).toBeNull();
  });

  it("allocates runs before sets so a set can't steal the suit a run needs (regardless of card order)", () => {
    // Two 3♠s before 3♥ in tap order: set of 3s must leave one 3♠ for the spades run.
    const tapOrder = [c(3, "C"), c(3, "S"), c(3, "S"), c(4, "S"), c(5, "S"), c(3, "H"), J()];
    const melds = findContract(tapOrder, { sets: 1, runs: 1 }, true);
    expect(melds?.map((m) => m.kind).sort()).toEqual(["run", "set"]);
    // Same when the run's suit sorts first (Clubs).
    const clubsFirst = [c(3, "C"), c(3, "C"), c(3, "D"), c(3, "S"), c(4, "C"), c(5, "C"), J()];
    expect(findContract(clubsFirst, { sets: 1, runs: 1 }, true)?.map((m) => m.kind).sort()).toEqual(["run", "set"]);
  });
});

/** A round in the play stage with chosen hands. */
function table(hands: PCard[][], opts: Partial<E.RummyState> = {}) {
  const { state } = E.newRummy(members(hands.length), { rounds: 7, mayI: true, parts: false, table: 1 }, "p0", seeded(1));
  state.players.forEach((p, i) => (p.hand = hands[i]!));
  state.turn = 0;
  state.stage = "play";
  state.discard = [c(13, "S")];
  state.stock = Array.from({ length: 40 }, () => c(2, "C"));
  Object.assign(state, opts);
  return state;
}

describe("turns", () => {
  it("deals 10 cards for the first four contracts and 12 after; contracts in order", () => {
    const { state, events } = E.newRummy(members(3), { rounds: 7, mayI: true, parts: false, table: 1 }, "p0", seeded(2));
    expect(state.players.every((p) => p.hand.length === 10)).toBe(true);
    expect(events[0]).toMatchObject({ type: "deal", round: 1, contract: "2 sets of 3" });
    expect(E.handSize(4)).toBe(12);
    expect(E.handSize(6)).toBe(12); // 3 runs (also the last round of the short game)
    expect(state.stock.length + state.discard.length + 30).toBe(108);
  });

  it("draw, then play: out-of-turn and out-of-order actions are refused", () => {
    const s = table([[c(3)], [c(4)]]);
    s.stage = "draw";
    expect(() => E.discard(s, "p0", s.players[0]!.hand[0]!.id)).toThrow(/Draw a card first/);
    expect(() => E.draw(s, "p1", "stock", Math.random)).toThrow(/not your turn/);
    E.draw(s, "p0", "discard", Math.random);
    expect(s.players[0]!.hand.some((x) => x.rank === 13)).toBe(true);
    expect(() => E.draw(s, "p0", "stock", Math.random)).toThrow(/already drawn/);
  });

  it("laying down the contract, then hitting, then going out scores everyone else", () => {
    const s = table([
      [c(9, "H"), c(9, "S"), c(9, "C"), c(5, "D"), c(5, "S"), c(5, "C"), c(9, "D"), c(3, "S")],
      [c(1, "S"), c(0), c(10, "H")],
    ]);
    expect(() => E.hit(s, "p0", [s.players[0]!.hand[6]!.id], 1)).toThrow(/Lay down your own contract/);
    const lay = s.players[0]!.hand.slice(0, 6).map((x) => x.id);
    E.layDown(s, "p0", lay);
    expect(s.players[0]!.down).toBe(true);
    expect(s.melds).toHaveLength(2);
    const nineSet = s.melds.find((m) => m.cards[0]!.rank === 9)!;
    E.hit(s, "p0", [s.players[0]!.hand.find((x) => x.rank === 9)!.id], nineSet.id);
    expect(nineSet.cards).toHaveLength(4);
    const ev = E.discard(s, "p0", s.players[0]!.hand[0]!.id);
    expect(ev.at(-1)).toMatchObject({ type: "out", pid: "p0", points: { p0: 0, p1: 75 } });
    expect(s.phase).toBe("roundOver");
    expect(s.players[1]!.score).toBe(75);
  });

  it("refuses cards that don't make the contract", () => {
    const s = table([[c(9, "H"), c(9, "S"), c(8, "C"), c(5, "D"), c(5, "S"), c(5, "C"), c(2, "S")], [c(3)]]);
    expect(() => E.layDown(s, "p0", s.players[0]!.hand.slice(0, 6).map((x) => x.id))).toThrow(/don't make 2 sets of 3/);
  });

  it("the last contract (3 runs) plays like any other: lay down, then discard to go out", () => {
    // Three runs of 4 plus a card that fits none of them (what happened at the table).
    const s = table([[c(1, "H"), c(2, "H"), c(3, "H"), c(4, "H"), c(5, "S"), c(6, "S"), c(7, "S"), c(8, "S"), c(9, "D"), c(10, "D"), c(11, "D"), c(12, "D"), c(3, "C")], [c(3)]], { round: 7 });
    // Everything including the odd card: not three runs.
    expect(() => E.layDown(s, "p0", s.players[0]!.hand.map((x) => x.id))).toThrow(/don't make 3 runs/);
    E.layDown(s, "p0", s.players[0]!.hand.slice(0, 12).map((x) => x.id));
    expect(s.players[0]!.down).toBe(true);
    const ev = E.discard(s, "p0", s.players[0]!.hand[0]!.id);
    expect(ev.at(-1)).toMatchObject({ type: "gameOver" });
  });

  it("the last round allows adding to groups once you're down", () => {
    const s = table([[1, 2, 3, 4].map((r) => c(r, "H")).concat([5, 6, 7, 8].map((r) => c(r, "S")), [9, 10, 11, 12].map((r) => c(r, "D")), [c(9, "S"), c(2, "C")]), [c(3)]], { round: 7 });
    E.layDown(s, "p0", s.players[0]!.hand.slice(0, 12).map((x) => x.id));
    const spades = s.melds.find((m) => m.cards.some((x) => x.suit === "S"))!;
    E.hit(s, "p0", [s.players[0]!.hand.find((x) => x.rank === 9)!.id], spades.id);
    expect(spades.cards).toHaveLength(5);
  });

  it("house rule: lay the contract down in parts", () => {
    const hand = () => [c(9, "H"), c(9, "S"), c(9, "C"), c(5, "D"), c(5, "S"), c(5, "C"), c(3, "S"), c(12, "D")];
    // Off (the default): one set on its own is refused.
    const off = table([hand(), [c(3)]]);
    expect(() => E.layDown(off, "p0", off.players[0]!.hand.slice(0, 3).map((x) => x.id))).toThrow(/don't make 2 sets of 3/);

    const s = table([hand(), [c(1, "S"), c(0)]]);
    s.settings.parts = true;
    const ev = E.layDown(s, "p0", s.players[0]!.hand.slice(0, 3).map((x) => x.id));
    expect(ev[0]).toMatchObject({ type: "down", partial: true });
    expect(s.players[0]!.down).toBe(false);
    expect(s.players[0]!.laid).toEqual({ sets: 1, runs: 0 });
    expect(E.publicView(s).players[0]).toMatchObject({ partial: true, down: false });
    expect(E.privateView(s, "p0")?.left).toEqual({ sets: 1, runs: 0 });
    // Half down: no adding to groups yet, and junk is still refused.
    expect(() => E.hit(s, "p0", [s.players[0]!.hand.find((x) => x.rank === 12)!.id], s.melds[0]!.id)).toThrow(/rest of your contract/);
    expect(() => E.layDown(s, "p0", s.players[0]!.hand.filter((x) => x.rank !== 5).map((x) => x.id))).toThrow(/you still need \(1 set of 3\)|still need/);
    // The second set (on a later turn, or the same one) finishes it.
    E.layDown(s, "p0", s.players[0]!.hand.filter((x) => x.rank === 5).map((x) => x.id));
    expect(s.players[0]!.down).toBe(true);
    expect(s.melds).toHaveLength(2);
    // Fully down: can't lay down again.
    expect(() => E.layDown(s, "p0", [s.players[0]!.hand[0]!.id])).toThrow(/already down/);
  });

  it("laying down in parts works in the last round too", () => {
    const s = table([[1, 2, 3, 4, 5, 6, 7, 8].map((r) => c(r, "S")).concat([c(9, "D"), c(10, "D"), c(11, "D"), c(12, "D"), c(2, "C")]), [c(3)]], { round: 7 });
    s.settings.parts = true;
    expect(E.canLayParts(s)).toBe(true);
    E.layDown(s, "p0", s.players[0]!.hand.slice(0, 4).map((x) => x.id));
    expect(s.players[0]!.laid).toEqual({ sets: 0, runs: 1 });
    expect(s.players[0]!.down).toBe(false);
  });

  it("the host can resize the TV cards any time", () => {
    const s = table([[c(3)], [c(4)]]);
    expect(() => E.setTable(s, false, 2)).toThrow(/host/);
    expect(() => E.setTable(s, true, 7)).toThrow(/isn't available/);
    E.setTable(s, true, 2);
    expect(E.publicView(s).table).toBe(2);
  });

  it("May I?: the first asker in seat order gets the discard plus a penalty card", () => {
    const s = table([[c(3)], [c(4)], [c(5)]]);
    s.stage = "draw";
    s.lastDiscardBy = "p2";
    expect(() => E.mayI(s, "p0")).toThrow(/your turn/);
    expect(() => E.mayI(s, "p2")).toThrow(/own discard/);
    E.mayI(s, "p1");
    const ev = E.draw(s, "p0", "stock", Math.random);
    expect(ev.find((e) => e.type === "bought")).toMatchObject({ pid: "p1" });
    expect(s.players[1]!.hand).toHaveLength(3);
    expect(s.players[1]!.buys).toBe(1);
    expect(s.players[0]!.hand).toHaveLength(2);
  });

  it("May I? is void if the current player takes the discard", () => {
    const s = table([[c(3)], [c(4)]]);
    s.stage = "draw";
    E.mayI(s, "p1");
    E.draw(s, "p0", "discard", Math.random);
    expect(s.players[1]!.hand).toHaveLength(1);
    expect(s.mayI).toEqual([]);
  });

  it("May I? stays open after the current player draws from the deck, until they discard", () => {
    const s = table([[c(3), c(9)], [c(4)], [c(5)]]);
    s.stage = "draw";
    s.lastDiscardBy = "p2";
    const top = s.discard[s.discard.length - 1]!;
    E.draw(s, "p0", "stock", Math.random);
    expect(E.mayIOpen(s)).toBe("take");
    expect(E.privateView(s, "p1")!.canMayI).toBe(true);
    expect(E.privateView(s, "p2")!.canMayI).toBe(false); // their own discard
    // The first to ask gets it straight away, plus a penalty card.
    const ev = E.mayI(s, "p1", Math.random);
    expect(ev.find((e) => e.type === "bought")).toMatchObject({ pid: "p1", card: top });
    expect(s.players[1]!.hand).toHaveLength(3);
    expect(s.players[1]!.buys).toBe(1);
    // It's gone now: nothing left to ask for until the next discard.
    expect(E.mayIOpen(s)).toBeNull();
    expect(() => E.mayI(s, "p2", Math.random)).toThrow(/gone|nothing/);
  });

  it("May I? closes when the current player discards", () => {
    const s = table([[c(3), c(9)], [c(4)], [c(5)]]);
    s.stage = "draw";
    E.draw(s, "p0", "stock", Math.random);
    const card = s.players[0]!.hand[0]!;
    E.discard(s, "p0", card.id);
    // The new discard is p0's: p1 is now drawing, so it's the usual "ask before they draw".
    expect(E.mayIOpen(s)).toBe("ask");
    expect(() => E.mayI(s, "p0", Math.random)).toThrow(/own discard/);
  });

  it("May I? is closed for the rest of the turn if the current player takes the discard", () => {
    const s = table([[c(3)], [c(4)], [c(5)]]);
    s.stage = "draw";
    E.draw(s, "p0", "discard", Math.random);
    expect(E.mayIOpen(s)).toBeNull();
    expect(E.privateView(s, "p1")!.canMayI).toBe(false);
    expect(() => E.mayI(s, "p1", Math.random)).toThrow(/themselves|nothing/);
  });

  it("a card bought when the current player drew isn't up for another May I", () => {
    const s = table([[c(3)], [c(4)], [c(5)]]);
    s.stage = "draw";
    s.discard.push(c(7));
    E.mayI(s, "p1");
    E.draw(s, "p0", "stock", Math.random);
    // p1 got the 7; the card underneath was never passed on, so it's not up for grabs.
    expect(E.mayIOpen(s)).toBeNull();
  });

  it("lowest total after the last round wins", () => {
    const s = table([[c(3)], [c(4)]], { round: 7 });
    s.players[0]!.score = 80;
    s.players[1]!.score = 20;
    s.stage = "play";
    s.players[1]!.hand = [c(5), c(6)];
    const ev = E.discard(s, "p0", s.players[0]!.hand[0]!.id); // p0 goes out by discarding (didn't need to be down in this setup)
    expect(ev.at(-1)).toMatchObject({ type: "gameOver", winner: "p1" });
  });
});

describe("bots", () => {
  function playOut(players: number, rounds: number, seed: number) {
    const rng = seeded(seed);
    const r = R.newRoom("X");
    R.join(r, "host-player-1", "H", undefined, rng);
    R.selectGame(r, "host-player-1", "rummy");
    R.updateSettings(r, "host-player-1", "rummy", { rounds });
    for (let i = 0; i < players; i++) R.addBot(r, "host-player-1", rng);
    r.members = r.members.filter((m) => m.bot);
    R.start(r, "host-player-1", rng);
    let steps = 0;
    while (steps++ < 40000) {
      const g = r.game as E.RummyState;
      if (g.phase === "roundOver") E.nextRound(g, true, rng);
      if (g.phase === "gameOver") break;
      const due = R.nextBot(r, rng);
      if (!due) break;
      R.runBot(r, due.pid, rng);
    }
    return { g: r.game as E.RummyState, steps };
  }

  it("a table of bots finishes a classic 7-round game", () => {
    for (const [n, seed] of [
      [2, 1],
      [3, 2],
      [4, 3],
      [6, 4],
    ] as const) {
      const { g, steps } = playOut(n, 7, seed);
      expect(g.phase, `${n} bots, seed ${seed}, ${steps} steps`).toBe("gameOver");
      expect(g.players.every((p) => p.roundScores.length === 7)).toBe(true);
    }
  });

  it("bots never make an illegal move over many short games", () => {
    for (let seed = 10; seed < 40; seed++) {
      const { g } = playOut(2 + (seed % 4), 4, seed);
      expect(g.phase, `seed ${seed}`).toBe("gameOver");
    }
  });
});

describe("duplicates (two or three decks)", () => {
  it("parallel runs and two sets of the same rank", () => {
    const D = (r: number) => c(r, "D");
    const hand = [3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9].map(D);
    expect(findContract(hand, { sets: 0, runs: 3 }, true)).not.toBeNull();
    const nines = [c(9, "H"), c(9, "S"), c(9, "C"), c(9, "D"), c(9, "H"), c(9, "S")];
    expect(findContract(nines, { sets: 2, runs: 0 }, true)).not.toBeNull();
  });
});

describe("selection hint", () => {
  // Imported lazily so this block stays self-contained.
  it("explains why Lay down isn't ready (and when it is)", async () => {
    const { selectionHint } = await import("../src/shared/games/rummy/hint");
    const D = (r: number) => c(r, "D");
    const run = [7, 8, 9, 10].map(D);
    const opts = {};
    // Round 1 (2 sets): a run doesn't count.
    expect(selectionHint(run, { sets: 2, runs: 0 }, opts)?.text).toMatch(/needs sets only/);
    // Round 2 (set + run): the run is half of it.
    expect(selectionHint(run, { sets: 1, runs: 1 }, opts)).toEqual({ ok: false, text: expect.stringMatching(/That's 1 run of 4\. You still need 1 set of 3/) });
    // Round 3 (2 runs): one of two.
    expect(selectionHint(run, { sets: 0, runs: 2 }, opts)?.text).toMatch(/You still need 1 run of 4/);
    // Whole contract selected.
    const set = [c(5, "S"), c(5, "H"), c(5, "C")];
    expect(selectionHint([...run, ...set], { sets: 1, runs: 1 }, opts)).toMatchObject({ ok: true });
    // Round 1, one set so far.
    expect(selectionHint(set, { sets: 2, runs: 0 }, opts)?.text).toMatch(/That's 1 set of 3\. You still need 1 set of 3/);
    // Not a group yet.
    expect(selectionHint([c(2, "S"), c(9, "H"), c(13, "C")], { sets: 2, runs: 0 }, opts)?.text).toMatch(/don't make a group yet/);
    // Laying down in parts: one piece is enough.
    expect(selectionHint(set, { sets: 2, runs: 0 }, { ...opts, parts: true })).toEqual({ ok: true, text: expect.stringMatching(/Lay it down now; you'll still need 1 set of 3/) });
    expect(selectionHint(set, { sets: 1, runs: 0 }, { ...opts, parts: true, started: true })?.text).toMatch(/rest of your contract/);
    // Nothing selected: no hint.
    expect(selectionHint([], { sets: 2, runs: 0 }, opts)).toBeNull();
    // Last round: three runs is just the contract, like any other round.
    const three = [...[1, 2, 3, 4].map((r) => c(r, "S")), ...[5, 6, 7, 8].map((r) => c(r, "H")), ...[9, 10, 11, 12].map((r) => c(r, "C"))];
    expect(selectionHint(three, { sets: 0, runs: 3 }, opts)?.ok).toBe(true);
  });
});
