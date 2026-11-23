import { describe, expect, it } from "vitest";
import { dealDuration, dealOrder, dealStep, landsAt, seatLandings, turnUpAt } from "../src/shared/games/rummy/deal";
import { rummy } from "../src/shared/games/rummy/module";

describe("Rummy deal timing", () => {
  it("deals one card at a time, starting with the first player, the whole hand each", () => {
    const order = dealOrder(4, 1, 10);
    expect(order.slice(0, 5)).toEqual([1, 2, 3, 0, 1]);
    expect(order).toHaveLength(40);
    for (const seat of [0, 1, 2, 3]) expect(order.filter((s) => s === seat)).toHaveLength(10);
  });

  it("takes about 3 to 5 seconds however many cards there are", () => {
    for (const [seats, each] of [[2, 10], [4, 10], [4, 12], [8, 12]] as const) {
      expect(dealDuration(seats, each)).toBeGreaterThan(2500);
      expect(dealDuration(seats, each)).toBeLessThan(5500);
    }
    expect(dealStep(96)).toBeLessThan(dealStep(20));
  });

  it("a phone's landings match the TV's for that seat, and the turn-up comes last", () => {
    const step = dealStep(4 * 10);
    const tv = dealOrder(4, 2, 10).flatMap((s, i) => (s === 3 ? [landsAt(i, step)] : []));
    expect(seatLandings(4, 2, 10, 3)).toEqual(tv);
    expect(turnUpAt(4, 10)).toBeGreaterThan(landsAt(39, step));
  });
});

describe("Rummy bots wait for the deal", () => {
  it("the first move of a round waits until the deal is over", () => {
    const members = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, hue: i, connected: true, bot: true }));
    const ctx = { isHost: true, hostId: "p0", rng: () => 0.5 };
    const { state: s } = rummy.start(members, { rounds: 7, mayI: false, parts: false, table: 1 }, ctx);
    const each = s.players[0]!.hand.length;
    expect(rummy.nextBot(s, ctx)!.delay).toBeGreaterThanOrEqual(dealDuration(4, each));
    // Once the first player has drawn, bots play at their normal pace.
    for (const a of rummy.botActions(s, s.players[s.turn]!.id, ctx).slice(0, 1)) rummy.action(s, s.players[s.turn]!.id, a, ctx);
    expect(rummy.nextBot(s, ctx)!.delay).toBeLessThan(dealDuration(4, each));
  });
});
