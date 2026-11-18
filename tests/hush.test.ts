import { describe, expect, it } from "vitest";
import type { Member } from "../src/shared/common";
import * as H from "../src/shared/games/hush/engine";

const members = (n: number): Member[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, hue: i, connected: true }));

/** A game in the "playing" phase with hand-picked cards. */
function table(hands: number[][], level = hands[0]!.length): H.HushState {
  const { state } = H.newHush(members(hands.length), { goal: 0 }, "p0", Math.random);
  state.level = level;
  state.players.forEach((p, i) => (p.hand = [...hands[i]!].sort((a, b) => a - b)));
  state.phase = "playing";
  return state;
}

describe("Hush", () => {
  it("deals level N with N unique cards each, waits for everyone to be ready", () => {
    const { state, events } = H.newHush(members(3), { goal: 0 }, "p0", Math.random);
    expect(events[0]).toEqual({ type: "deal", level: 1 });
    expect(state.goal).toBe(9);
    expect(state.hearts).toBe(3);
    expect(state.players.every((p) => p.hand.length === 1)).toBe(true);
    expect(() => H.playLowest(state, "p0", Math.random)).toThrow(/ready/);
    H.ready(state, "p0");
    H.ready(state, "p1");
    expect(state.phase).toBe("ready");
    const ev = H.ready(state, "p2");
    expect(ev.at(-1)).toEqual({ type: "go", level: 1 });
    expect(state.phase).toBe("playing");
  });

  it("disconnected players count as ready", () => {
    const { state } = H.newHush(members(2), { goal: 0 }, "p0", Math.random);
    state.players[1]!.connected = false;
    H.ready(state, "p0");
    expect(state.phase).toBe("playing");
  });

  it("playing in order clears the level and deals the next", () => {
    const s = table([[10, 40], [25, 60]]);
    H.playLowest(s, "p0", Math.random); // 10
    H.playLowest(s, "p1", Math.random); // 25
    H.playLowest(s, "p0", Math.random); // 40
    const ev = H.playLowest(s, "p1", Math.random); // 60
    expect(ev.find((e) => e.type === "levelDone")).toMatchObject({ level: 2 });
    expect(s.level).toBe(3);
    expect(s.phase).toBe("ready");
    expect(s.players.every((p) => p.hand.length === 3)).toBe(true);
    expect(s.hearts).toBe(2);
  });

  it("you always play your lowest card", () => {
    const s = table([[70, 5, 33], [90, 91, 92]]);
    const ev = H.playLowest(s, "p0", Math.random);
    expect(ev[0]).toEqual({ type: "play", pid: "p0", card: 5 });
  });

  it("a mistake costs a heart and discards every lower card still held", () => {
    const s = table([[50, 80], [12, 30, 70]], 3);
    const ev = H.playLowest(s, "p0", Math.random); // plays 50 while p1 holds 12 and 30
    const m = ev.find((e) => e.type === "mistake");
    expect(m).toMatchObject({ card: 50, hearts: 1, lost: [{ pid: "p1", cards: [12, 30] }] });
    expect(s.players[1]!.hand).toEqual([70]);
  });

  it("losing the last heart ends the game and reveals hands", () => {
    const s = table([[50], [12, 90]], 2);
    s.hearts = 1;
    const ev = H.playLowest(s, "p0", Math.random);
    expect(ev.at(-1)).toEqual({ type: "lost" });
    expect(s.phase).toBe("lost");
    expect(H.publicView(s).reveal).toEqual({ p0: [], p1: [90] });
  });

  it("a star needs everyone holding cards; then each discards their lowest", () => {
    const s = table([[8, 60], [20, 75]]);
    H.voteStar(s, "p0");
    expect(s.stars).toBe(1);
    H.voteStar(s, "p0"); // changed their mind
    expect(s.players[0]!.star).toBe(false);
    H.voteStar(s, "p0");
    const ev = H.voteStar(s, "p1");
    expect(ev.at(-1)).toEqual({ type: "star", discards: [{ pid: "p0", card: 8 }, { pid: "p1", card: 20 }] });
    expect(s.stars).toBe(0);
    expect(() => H.voteStar(s, "p0")).toThrow(/No stars/);
  });

  it("rewards: a star after level 3, a heart after level 4", () => {
    const s = table([[1, 2, 3], [4, 5, 6]], 3);
    for (let i = 0; i < 6; i++) H.playLowest(s, s.players[i < 3 ? 0 : 1]!.id, Math.random);
    expect(s.stars).toBe(2);
    expect(s.level).toBe(4);
    const s4 = table([[1, 2, 3, 4], [5, 6, 7, 8]], 4);
    const hearts = s4.hearts;
    for (let i = 0; i < 8; i++) H.playLowest(s4, s4.players[i < 4 ? 0 : 1]!.id, Math.random);
    expect(s4.hearts).toBe(hearts + 1);
  });

  it("clearing the goal level wins", () => {
    const s = table([[3], [7]], 1);
    s.goal = 1;
    H.playLowest(s, "p0", Math.random);
    const ev = H.playLowest(s, "p1", Math.random);
    expect(ev.at(-1)).toEqual({ type: "won" });
    expect(s.phase).toBe("won");
  });

  it("host can restart from level 1", () => {
    const s = table([[3], [7]], 1);
    s.phase = "lost";
    expect(() => H.restart(s, false, Math.random)).toThrow(/host/);
    H.restart(s, true, Math.random);
    expect(s.level).toBe(1);
    expect(s.phase).toBe("ready");
  });

  it("joining during the ready phase deals you in; leaving mid-level can finish it", () => {
    const { state } = H.newHush(members(2), { goal: 0 }, "p0", Math.random);
    H.addPlayer(state, { id: "late", name: "Late", hue: 5, connected: true }, Math.random);
    expect(state.players.at(-1)!.hand).toHaveLength(1);
    const all = state.players.flatMap((p) => p.hand);
    expect(new Set(all).size).toBe(all.length);

    const s = table([[5], [9], [50]]);
    H.playLowest(s, "p0", Math.random);
    H.playLowest(s, "p1", Math.random);
    const ev = H.removePlayer(s, "p2", Math.random);
    expect(ev[0]).toMatchObject({ type: "levelDone" });
  });

  it("bot timing grows with the gap to the last card", () => {
    const s = table([[10, 90], [95]]);
    s.last = { pid: "p1", card: 5 };
    const near = H.botDelay(s, s.players[0]!, () => 0.5);
    s.players[0]!.hand = [90];
    const far = H.botDelay(s, s.players[0]!, () => 0.5);
    expect(far).toBeGreaterThan(near * 5);
  });
});
