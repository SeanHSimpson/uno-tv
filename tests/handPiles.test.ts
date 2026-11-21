import { describe, expect, it } from "vitest";
import { layoutPiles, type PileStyle, type Spot } from "../src/client/handPiles";

const BOX = { W: 358, H: 470 };
// The mockups' hand: A A A, 4 5 6, 7 7 7, J, Q, K, joker → 9 rank piles.
const RANK_GROUPS = [[1, 2, 3], [4], [5], [6], [7, 8, 9], [10], [11], [12], [13]];
// The same hand by suit (C, D, S, H, joker).
const SUIT_GROUPS = [[8, 10], [3, 7, 11], [1, 9, 12], [2, 4, 5, 6], [13]];

function inside(spots: Map<number, Spot>, box = BOX) {
  for (const s of spots.values()) {
    expect(s.x).toBeGreaterThanOrEqual(-0.01);
    expect(s.y).toBeGreaterThanOrEqual(-0.01);
    expect(s.x + s.w).toBeLessThanOrEqual(box.W + 0.01);
    expect(s.y + s.w * 1.5).toBeLessThanOrEqual(box.H + 0.01);
  }
}

describe("layoutPiles", () => {
  for (const style of ["piles", "cascade", "rows"] as PileStyle[]) {
    it(`${style}: every card is placed inside the box`, () => {
      const groups = style === "rows" ? SUIT_GROUPS : RANK_GROUPS;
      const spots = layoutPiles(groups, style, BOX, 104);
      expect(spots.size).toBe(13);
      inside(spots);
    });

    it(`${style}: one card gets the biggest size`, () => {
      const spots = layoutPiles([[1]], style, BOX, 104);
      expect(spots.get(1)!.w).toBe(104);
      inside(spots);
    });

    it(`${style}: a big hand (14 cards, two jokers) still fits`, () => {
      const groups = [[1, 2, 3], [4, 5], [6], [7], [8, 9], [10], [11], [12], [13, 14]];
      const spots = layoutPiles(groups, style, { W: 328, H: 380 }, 104);
      expect(spots.size).toBe(14);
      inside(spots, { W: 328, H: 380 });
    });
  }

  it("piles are big enough to read and spread copies to the right", () => {
    const spots = layoutPiles(RANK_GROUPS, "piles", BOX, 104);
    expect(spots.get(1)!.w).toBeGreaterThanOrEqual(60);
    expect(spots.get(2)!.x).toBeGreaterThan(spots.get(1)!.x);
    expect(spots.get(3)!.x).toBeGreaterThan(spots.get(2)!.x);
  });

  it("cascades step down far enough to show each corner", () => {
    const spots = layoutPiles(RANK_GROUPS, "cascade", BOX, 104);
    const a = spots.get(1)!, b = spots.get(2)!;
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y - a.y).toBeGreaterThanOrEqual(0.3 * 1.5 * a.w - 0.5);
  });

  it("stacked rows: one row per group, each row lower than the last", () => {
    const spots = layoutPiles(SUIT_GROUPS, "rows", BOX, 104);
    const rowY = SUIT_GROUPS.map((g) => spots.get(g[0]!)!.y);
    for (let i = 1; i < rowY.length; i++) expect(rowY[i]!).toBeGreaterThan(rowY[i - 1]!);
    const w = spots.get(8)!.w;
    expect(rowY[1]! - rowY[0]!).toBeGreaterThanOrEqual(0.42 * 1.5 * w - 0.5);
    expect(spots.get(10)!.x).toBeGreaterThan(spots.get(8)!.x);
  });
});
