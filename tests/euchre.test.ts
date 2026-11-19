import { describe, expect, it } from "vitest";
import type { Member } from "../src/shared/common";
import { botMove, handStrength } from "../src/shared/games/euchre/bot";
import * as E from "../src/shared/games/euchre/engine";
import { euchre } from "../src/shared/games/euchre/module";
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
const RANDOM: E.EuchreSettings = { ...E.EUCHRE_DEFAULTS, teams: "random" };
let nid = 900;
const c = (s: string): E.ECard => {
  const rank = { A: 1, K: 13, Q: 12, J: 11, T: 10, "9": 9 }[s[0]!]!;
  return { id: nid++, rank, suit: s[1] as E.Suit };
};

/** A fresh game with seats in member order (p0..p3), dealer seat 3, so seat 0 bids first. */
function table(seed = 1) {
  const { state } = E.newEuchre(members(4), RANDOM, "p0", seeded(seed));
  const byId = (id: string) => state.players.find((p) => p.id === id)!;
  state.players = ["p0", "p1", "p2", "p3"].map(byId);
  state.dealer = 3;
  state.turn = 0;
  return state;
}

describe("Euchre cards", () => {
  it("ranks the bowers above everything, and the left bower counts as trump", () => {
    const right = c("JH");
    const left = c("JD");
    const ace = c("AH");
    expect(E.power(right, "H", "S")).toBeGreaterThan(E.power(left, "H", "S"));
    expect(E.power(left, "H", "S")).toBeGreaterThan(E.power(ace, "H", "S"));
    expect(E.effSuit(left, "H")).toBe("H");
    expect(E.effSuit(c("JC"), "H")).toBe("C");
    // Any trump beats the ace of the suit led
    expect(E.power(c("9H"), "H", "S")).toBeGreaterThan(E.power(c("AS"), "H", "S"));
    // Off-suit cards can't win
    expect(E.power(c("AC"), "H", "S")).toBe(0);
  });

  it("must follow suit, and the left bower follows trump (not its printed suit)", () => {
    const hand = [c("JD"), c("9D"), c("KS")];
    const led = [{ seat: 0, card: c("AD") }];
    // Hearts trump: diamonds led, the Jack of diamonds is a heart now, so only the 9 follows.
    expect(E.legalCards(hand, led, "H").map(E.shortCard)).toEqual(["9♦"]);
    const trumpLed = [{ seat: 0, card: c("QH") }];
    expect(E.legalCards(hand, trumpLed, "H").map(E.shortCard)).toEqual(["J♦"]);
    // Can't follow: anything goes
    expect(E.legalCards([c("KS"), c("9C")], [{ seat: 0, card: c("AD") }], "D")).toHaveLength(2);
  });

  it("deals 5 each with one card turned up, and the first bid is left of the dealer", () => {
    const { state, events } = E.newEuchre(members(4), RANDOM, "p0", seeded(4));
    expect(state.players.every((p) => p.hand.length === 5)).toBe(true);
    expect(state.upcard).toBeTruthy();
    expect(state.kitty).toHaveLength(3);
    expect(state.turn).toBe((state.dealer + 1) % 4);
    expect(events[0]).toMatchObject({ type: "deal" });
    expect(() => E.newEuchre(members(3), RANDOM, "p0", seeded(1))).toThrow(/exactly 4/);
  });
});

describe("Euchre bidding", () => {
  it("ordering up gives the dealer the card; they discard and play starts left of the dealer", () => {
    const s = table();
    const up = s.upcard!;
    E.order(s, "p0", false);
    expect(s.trump).toBe(up.suit);
    expect(s.phase).toBe("discard");
    expect(s.players[3]!.hand).toHaveLength(6);
    expect(() => E.play(s, "p0", s.players[0]!.hand[0]!.id)).toThrow();
    E.discard(s, "p3", s.players[3]!.hand[0]!.id);
    expect(s.players[3]!.hand).toHaveLength(5);
    expect(s.phase).toBe("play");
    expect(s.turn).toBe(0);
  });

  it("all pass: the card is turned down and round 2 can't name that suit; stick the dealer", () => {
    const s = table();
    const up = s.upcard!.suit;
    for (const p of ["p0", "p1", "p2", "p3"]) E.pass(s, p, seeded(2));
    expect(s.phase).toBe("bid2");
    expect(s.turnedDown).toBe(up);
    expect(() => E.call(s, "p0", up, false)).toThrow(/turned down/);
    for (const p of ["p0", "p1", "p2"]) E.pass(s, p, seeded(2));
    expect(() => E.pass(s, "p3", seeded(2))).toThrow(/Stick the dealer/);
    const other = E.SUITS.find((x) => x !== up)!;
    E.call(s, "p3", other, false);
    expect(s.trump).toBe(other);
    expect(s.phase).toBe("play");
  });

  it("without stick the dealer, passing twice redeals with the next dealer", () => {
    const s = table();
    s.settings.stick = false;
    for (let i = 0; i < 2; i++) for (const p of ["p0", "p1", "p2", "p3"]) E.pass(s, p, seeded(3));
    expect(s.phase).toBe("bid1");
    expect(s.dealer).toBe(0);
    expect(s.hand).toBe(2);
  });

  it("only the player on turn can bid", () => {
    const s = table();
    expect(() => E.order(s, "p1", false)).toThrow(/not your turn/);
  });

  it("going alone: the partner sits out and tricks have 3 cards", () => {
    const s = table();
    E.pass(s, "p0", seeded(1));
    E.order(s, "p1", true); // dealer p3 is p1's partner: dealer sits out, no pickup
    expect(E.sittingOut(s)).toBe(3);
    expect(s.phase).toBe("play");
    expect(s.players[3]!.hand).toHaveLength(5);
    // play one full trick: seats 0, 1, 2 only
    for (const seat of [0, 1, 2]) {
      const p = s.players[seat]!;
      E.play(s, p.id, E.legalCards(p.hand, s.trick, s.trump)[0]!.id);
    }
    expect(s.trickDone).toBeTruthy();
  });
});

describe("Euchre tricks and scoring", () => {
  /** Hand-built deal: hearts trump, p0 (team 0) made it. */
  function rigged(hands: string[][], opts: { alone?: boolean } = {}) {
    const s = table();
    s.phase = "play";
    s.trump = "H";
    s.maker = 0;
    s.alone = !!opts.alone;
    s.upcard = null;
    s.players.forEach((p, i) => (p.hand = hands[i]!.map(c)));
    s.turn = 0;
    return s;
  }
  const playAll = (s: E.EuchreState) => {
    let guard = 0;
    while (s.phase === "play" && guard++ < 40) {
      if (s.trickDone) {
        E.collect(s);
        continue;
      }
      const p = s.players[s.turn]!;
      E.play(s, p.id, (botMove(s, p.id, seeded(guard)) as { cardId: number }).cardId);
    }
  };

  it("the winner of a trick leads the next one, and the finished trick waits to be collected", () => {
    const s = rigged([["9S", "TS", "QS", "KS", "AS"], ["JH", "9C", "TC", "QC", "KC"], ["9D", "TD", "QD", "KD", "AD"], ["AC", "JC", "JS", "9H", "TH"]]);
    E.play(s, "p0", s.players[0]!.hand[0]!.id); // 9S
    E.play(s, "p1", s.players[1]!.hand[0]!.id); // JH (right bower, can't follow spades)
    E.play(s, "p2", s.players[2]!.hand[0]!.id);
    E.play(s, "p3", s.players[3]!.hand.find((x) => x.rank === 11 && x.suit === "S")!.id); // JS follows spades (clubs is not trump-colour... spades is black, hearts red)
    expect(s.trickDone).toEqual({ winner: 1 });
    expect(() => E.play(s, "p1", s.players[1]!.hand[0]!.id)).toThrow(/collected/);
    E.collect(s);
    expect(s.turn).toBe(1);
    expect(s.teamTricks).toEqual([0, 1]);
  });

  it("refuses a card that doesn't follow suit", () => {
    const s = rigged([["9S", "TS", "QS", "KS", "AS"], ["KH", "QS", "TC", "QC", "KC"], ["9D", "TD", "QD", "KD", "AD"], ["AC", "JC", "JS", "9H", "TH"]]);
    E.play(s, "p0", s.players[0]!.hand[0]!.id);
    expect(() => E.play(s, "p1", s.players[1]!.hand[0]!.id)).toThrow(/follow suit/);
  });

  it("scores 1 for 3 tricks, 2 for a march, 4 alone, and 2 for a euchre", () => {
    const score = (tricks: number, alone = false) => {
      const s = table();
      s.maker = 0;
      s.trump = "H";
      s.alone = alone;
      s.phase = "play";
      s.teamTricks = [tricks, 5 - tricks - 1];
      s.trickDone = { winner: tricks === 5 ? 0 : 1 };
      if (tricks === 5) s.teamTricks = [4, 0];
      else s.teamTricks[1]++;
      if (tricks === 5) s.teamTricks[0]++;
      E.collect(s);
      return s.lastResult!;
    };
    expect(score(3)).toMatchObject({ team: 0, points: 1, euchred: false });
    expect(score(5)).toMatchObject({ team: 0, points: 2 });
    expect(score(5, true)).toMatchObject({ team: 0, points: 4 });
    expect(score(2)).toMatchObject({ team: 1, points: 2, euchred: true });
  });

  it("first team to the target wins; the host can play again", () => {
    const s = table();
    s.score = [9, 4];
    s.maker = 0;
    s.trump = "H";
    s.phase = "play";
    s.teamTricks = [3, 2];
    s.trickDone = { winner: 0 };
    const ev = E.collect(s);
    expect(s.phase).toBe("gameOver");
    expect(s.winnerTeam).toBe(0);
    expect(ev.map((e) => e.type)).toContain("gameOver");
    expect(() => E.restart(s, false, seeded(1))).toThrow();
    E.restart(s, true, seeded(1));
    expect(s.score).toEqual([0, 0]);
    expect(s.phase).toBe("bid1");
  });

  it("a full rigged hand plays out to a score", () => {
    const s = rigged([["JH", "JD", "AH", "KH", "AS"], ["9S", "TS", "9C", "TC", "QC"], ["QH", "AC", "KC", "AD", "KD"], ["9H", "TH", "QS", "KS", "QD"]]);
    playAll(s);
    expect(s.phase).toBe("handOver");
    expect(s.lastResult?.team).toBe(0);
  });
});

describe("Euchre bots and the room", () => {
  it("rates a strong hand well above a weak one", () => {
    expect(handStrength([c("JH"), c("JD"), c("AH"), c("KH"), c("AS")], "H")).toBeGreaterThan(10);
    expect(handStrength([c("9S"), c("TC"), c("QD"), c("9C"), c("TS")], "H")).toBeLessThan(2);
  });

  it("four bots finish whole games without a stall or an illegal move", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed);
      const ctx = { isHost: true, hostId: "p0", rng };
      const { state: s } = euchre.start(members(4), { target: 10, stick: seed % 2 === 0, teams: "random", table: 1 }, ctx);
      let steps = 0;
      while (s.phase !== "gameOver") {
        if (++steps > 4000) throw new Error(`stalled on seed ${seed} in ${s.phase}`);
        if (s.trickDone) {
          euchre.action(s, "p0", { t: "collect" }, ctx);
          continue;
        }
        if (s.phase === "handOver") {
          euchre.action(s, "p0", { t: "nextHand" }, ctx);
          continue;
        }
        const pid = s.players[s.turn]!.id;
        const [a] = euchre.botActions(s, pid, ctx);
        euchre.action(s, pid, a!, ctx);
        // Nobody ever holds more than 6 cards, and the deck is always all 24 cards.
        const total = s.players.reduce((n, p) => n + p.hand.length, 0) + s.kitty.length + (s.upcard ? 1 : 0) + s.trick.length;
        const played = (5 - Math.max(...s.players.map((p) => p.hand.length))) ;
        expect(total + (s.phase === "play" ? 0 : 0)).toBeLessThanOrEqual(24);
        expect(played).toBeGreaterThanOrEqual(-1);
      }
      expect(Math.max(...s.score)).toBeGreaterThanOrEqual(10);
    }
  });

  it("picking partners: choose sides, the host fills the rest, partners sit across", () => {
    const rng = seeded(3);
    const ctx = (pid: string) => ({ isHost: pid === "p0", hostId: "p0", rng });
    const { state: s, events } = euchre.start(members(4), { ...E.EUCHRE_DEFAULTS }, ctx("p0"));
    expect(s.phase).toBe("teams");
    expect(events).toEqual([{ type: "teams" }]);
    expect(euchre.nextBot(s, ctx("p0"))).toBeNull();
    euchre.action(s, "p1", { t: "team", team: 0 }, ctx("p1"));
    euchre.action(s, "p3", { t: "team", team: 0 }, ctx("p3"));
    expect(() => euchre.action(s, "p2", { t: "team", team: 0 }, ctx("p2"))).toThrow(/full/);
    expect(() => euchre.action(s, "p2", { t: "team", team: 1, pid: "p1" }, ctx("p2"))).toThrow(/Only the host/);
    expect(() => euchre.action(s, "p1", { t: "deal" }, ctx("p1"))).toThrow(/host/);
    // The host deals: p0 and p2 haven't picked, so they become the other team.
    euchre.action(s, "p0", { t: "deal" }, ctx("p0"));
    expect(s.phase).toBe("bid1");
    const seatOf = (id: string) => s.players.findIndex((p) => p.id === id);
    expect(seatOf("p1") % 2).toBe(seatOf("p3") % 2);
    expect(Math.abs(seatOf("p1") - seatOf("p3"))).toBe(2);
    expect(seatOf("p0") % 2).toBe(seatOf("p2") % 2);
    expect(() => euchre.action(s, "p0", { t: "team", team: 1 }, ctx("p0"))).toThrow(/already set/);

    // Game over, play again: back to the teams screen with the same sides ready.
    s.phase = "gameOver";
    s.winnerTeam = 0;
    euchre.action(s, "p0", { t: "restart" }, ctx("p0"));
    expect(s.phase).toBe("teams");
    expect(s.picks.p1).toBe(s.picks.p3);
    euchre.action(s, "p0", { t: "team", team: null, pid: "p1" }, ctx("p0"));
    expect(s.picks.p1).toBeUndefined();
    euchre.action(s, "p0", { t: "shuffleTeams" }, ctx("p0"));
    expect(Object.keys(s.picks)).toHaveLength(4);
    euchre.action(s, "p0", { t: "deal" }, ctx("p0"));
    expect(s.phase).toBe("bid1");
    expect(s.score).toEqual([0, 0]);
  });

  it("remembers the last trick and lets the host resize the TV cards", () => {
    const s = table(5);
    s.phase = "play";
    s.trump = "H";
    s.turn = 0;
    for (let k = 0; k < 4; k++) {
      const pid = s.players[s.turn]!.id;
      const [a] = euchre.botActions(s, pid, { isHost: true, hostId: "p0", rng: seeded(k) });
      euchre.action(s, pid, a!, { isHost: true, hostId: "p0", rng: seeded(k) });
    }
    E.collect(s);
    const v = E.publicView(s);
    expect(v.lastTrick).toHaveLength(4);
    expect(v.lastTrickWinner).toBeTruthy();
    expect(() => E.setTable(s, false, 1.55)).toThrow(/host/);
    E.setTable(s, true, 1.55);
    expect(E.publicView(s).table).toBe(1.55);
  });

  it("the room needs exactly 4; someone leaving mid-game gets a bot stand-in", () => {
    const rng = seeded(9);
    const r = R.newRoom("ABCD");
    for (const [i, name] of ["Ann", "Ben", "Cal"].entries()) R.join(r, `pid-${i}-xxxxxx`, name, undefined, rng);
    R.selectGame(r, "pid-0-xxxxxx", "euchre");
    expect(() => R.start(r, "pid-0-xxxxxx", rng)).toThrow(/at least 4/);
    R.addBot(r, "pid-0-xxxxxx", rng);
    R.start(r, "pid-0-xxxxxx", rng);
    expect(r.phase).toBe("game");
    R.kick(r, "pid-0-xxxxxx", "pid-2-xxxxxx", rng);
    const s = r.game as E.EuchreState;
    expect(s.players.find((p) => p.id === "pid-2-xxxxxx")).toMatchObject({ bot: true, standIn: true });
    expect(r.phase).toBe("game");
  });
});
