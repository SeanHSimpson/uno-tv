import { describe, expect, it } from "vitest";
import { CARDS_EACH, dealOrder, landsAt, leavesAt, seatLandings } from "../src/shared/games/euchre/deal";

describe("Euchre deal timing", () => {
  it("deals one card at a time, starting left of the dealer, five each", () => {
    const order = dealOrder(4, 2);
    expect(order.slice(0, 5)).toEqual([3, 0, 1, 2, 3]);
    expect(order).toHaveLength(4 * CARDS_EACH);
    for (const seat of [0, 1, 2, 3]) expect(order.filter((s) => s === seat)).toHaveLength(CARDS_EACH);
  });

  it("cards leave the deck in turn and land after they leave", () => {
    for (let i = 1; i < 20; i++) expect(leavesAt(i)).toBeGreaterThan(leavesAt(i - 1));
    expect(landsAt(0)).toBeGreaterThan(leavesAt(0));
  });

  it("a phone's landings match the TV's for that seat", () => {
    const order = dealOrder(4, 0);
    const tv = order.flatMap((s, i) => (s === 1 ? [landsAt(i)] : []));
    expect(seatLandings(4, 0, 1)).toEqual(tv);
    // The dealer gets the last card.
    expect(seatLandings(4, 0, 0).at(-1)).toBe(landsAt(19));
  });
});

describe("Euchre bots wait for the deal", () => {
  it("the first bid of a hand waits until the last card lands; later bids don't", async () => {
    const { euchre } = await import("../src/shared/games/euchre/module");
    const { dealDuration } = await import("../src/shared/games/euchre/deal");
    const members = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, hue: i, connected: true, bot: true }));
    const rng = () => 0.5;
    const ctx = { isHost: true, hostId: "p0", rng };
    const { state: s } = euchre.start(members, { target: 10, stick: true, teams: "random", table: 1 }, ctx);
    expect(s.phase).toBe("bid1");
    const first = euchre.nextBot(s, ctx)!;
    expect(first.delay).toBeGreaterThanOrEqual(dealDuration(4));
    s.bids[(s.dealer + 1) % 4] = "Pass";
    expect(euchre.nextBot(s, ctx)!.delay).toBeLessThan(dealDuration(4));
  });
});
