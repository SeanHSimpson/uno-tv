import { describe, expect, it } from "vitest";
import { HandArranger } from "../src/client/handArrange";

type C = { id: number; rank: number; suit: number };
const cards: C[] = [
  { id: 1, rank: 7, suit: 2 },
  { id: 2, rank: 1, suit: 0 },
  { id: 3, rank: 7, suit: 0 },
  { id: 4, rank: 4, suit: 3 },
  { id: 5, rank: 1, suit: 3 },
];
const make = () =>
  new HandArranger<C>(
    "test",
    {
      rank: (a, b) => a.rank - b.rank || a.suit - b.suit,
      suit: (a, b) => a.suit - b.suit || a.rank - b.rank,
    },
    { defaultMode: "free", groups: { rank: (c) => c.rank, suit: (c) => c.suit } },
  );

describe("HandArranger piles and stacks", () => {
  it("first tap on Rank keeps the remembered version; tapping again switches it", () => {
    const a = make();
    expect(a.setMode("rank")).toBeNull();
    expect(a.rankStyle).toBe("piles");
    expect(a.setMode("rank")).toBe("Rank · columns");
    expect(a.rankStyle).toBe("columns");
    expect(a.setMode("rank")).toBe("Rank · piles");
  });

  it("Suit switches between stacked rows and columns", () => {
    const a = make();
    a.setMode("suit");
    expect(a.suitStyle).toBe("rows");
    expect(a.setMode("suit")).toBe("Suit · columns");
    expect(a.setMode("suit")).toBe("Suit · rows");
  });

  it("going to Suit and back keeps the Rank version", () => {
    const a = make();
    a.setMode("rank");
    a.setMode("rank"); // columns
    a.setMode("suit");
    expect(a.setMode("rank")).toBeNull();
    expect(a.rankStyle).toBe("columns");
  });

  it("arrange groups by key, in key order, members sorted", () => {
    const a = make();
    a.setMode("rank");
    const out = a.arrange(cards);
    expect(out.map((c) => c.id)).toEqual([2, 5, 4, 3, 1]);
    expect(a.piles).toEqual({ style: "piles", groups: [[2, 5], [4], [3, 1]] });
    a.setMode("rank");
    a.arrange(cards);
    expect(a.piles?.style).toBe("cascade");
    a.setMode("suit");
    a.arrange(cards);
    expect(a.piles).toEqual({ style: "rows", groups: [[2, 3], [1], [5, 4]] });
    a.setMode("suit");
    a.arrange(cards);
    expect(a.piles?.style).toBe("cascade");
  });

  it("Free has no piles and keeps its own order", () => {
    const a = make();
    a.setMode("free");
    a.arrange(cards);
    expect(a.piles).toBeNull();
  });

  it("toolbar: the active Rank button names its version; Fan only in Free", () => {
    const a = make();
    a.setMode("rank");
    expect(a.toolbar()).toMatch(/Rank<small>piles<\/small>/);
    expect(a.toolbar()).not.toMatch(/data-layout/);
    a.setMode("free");
    expect(a.toolbar()).toMatch(/data-layout/);
  });
});

describe("HandArranger options (OhNo!)", () => {
  const ohno = () =>
    new HandArranger<C>(
      "ohno-test",
      { rank: (a, b) => a.rank - b.rank, suit: (a, b) => a.suit - b.suit },
      { defaultMode: "suit", modes: ["suit", "rank", "free"], labels: { suit: "Color", rank: "Number" } },
    );

  it("shows its own labels, in its own order", () => {
    const html = ohno().toolbar({ fan: false });
    const labels = [...html.matchAll(/data-sort="(\w+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["suit", "rank", "free"]);
    expect(html).toMatch(/>Color</);
    expect(html).toMatch(/>Number</);
  });

  it("can leave out the Fan button even in Free", () => {
    const a = ohno();
    a.setMode("free");
    expect(a.toolbar({ fan: false })).not.toMatch(/data-layout/);
  });

  it("without groups, Color/Number are plain sorts", () => {
    const a = ohno();
    expect(a.arrange(cards).map((c) => c.id)).toEqual([2, 3, 1, 4, 5]);
    expect(a.piles).toBeNull();
    a.setMode("rank");
    expect(a.arrange(cards).map((c) => c.id)).toEqual([2, 5, 4, 1, 3]);
  });
});
