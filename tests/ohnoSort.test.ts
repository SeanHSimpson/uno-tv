import { describe, expect, it } from "vitest";
import { byColor, byNumber } from "../src/client/cards";

const c = (id: number, color: string, value: string) => ({ id, color, value }) as never;

describe("OhNo! hand sorts", () => {
  const hand = [c(1, "blue", "7"), c(2, "red", "skip"), c(3, "red", "7"), c(4, "wild", "wild"), c(5, "green", "2")];
  it("Color: by color, then number", () => {
    expect([...hand].sort(byColor).map((x: { id: number }) => x.id)).toEqual([3, 2, 5, 1, 4]);
  });
  it("Number: matching numbers together, then by color", () => {
    expect([...hand].sort(byNumber).map((x: { id: number }) => x.id)).toEqual([5, 3, 1, 2, 4]);
  });
});
