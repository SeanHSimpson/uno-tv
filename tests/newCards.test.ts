import { describe, expect, it, vi } from "vitest";
import { NewCards } from "../src/client/newCards";

describe("NewCards", () => {
  it("the cards you're dealt aren't new; a card drawn later is, for 20 seconds", () => {
    const n = new NewCards(() => {});
    n.update([1, 2, 3], 0);
    expect([1, 2, 3].some((id) => n.isNew(id, 0))).toBe(false);
    n.update([1, 2, 3, 4], 1000);
    expect(n.isNew(4, 1000)).toBe(true);
    expect(n.isNew(4, 20_999)).toBe(true);
    expect(n.isNew(4, 21_000)).toBe(false);
  });

  it("several cards at once (a penalty, a May I) are all new", () => {
    const n = new NewCards(() => {});
    n.update([1, 2], 0);
    n.update([1, 2, 7, 8, 9], 500);
    expect([7, 8, 9].every((id) => n.isNew(id, 600))).toBe(true);
  });

  it("a card stays new for its own 20 seconds even as more arrive", () => {
    const n = new NewCards(() => {});
    n.update([1], 0);
    n.update([1, 2], 1000);
    n.update([1, 2, 3], 15_000);
    expect(n.isNew(2, 22_000)).toBe(false);
    expect(n.isNew(3, 22_000)).toBe(true);
  });

  it("a fresh deal (none of the old cards left) starts over with nothing new", () => {
    const n = new NewCards(() => {});
    n.update([1, 2, 3], 0);
    n.update([1, 2, 3, 4], 100);
    n.update([10, 11, 12, 13], 5000);
    expect([10, 11, 12, 13].some((id) => n.isNew(id, 5000))).toBe(false);
  });

  it("going out and being dealt in again (empty hand in between) isn't new", () => {
    const n = new NewCards(() => {});
    n.update([1], 0);
    n.update([], 100);
    n.update([5, 6, 7], 200);
    expect(n.isNew(5, 200)).toBe(false);
  });

  it("a card played and gone is forgotten", () => {
    const n = new NewCards(() => {});
    n.update([1, 2], 0);
    n.update([1, 2, 3], 10);
    n.update([1, 2], 20);
    n.update([1, 2, 3], 30_000); // same id back later (it can't really happen, but don't keep stale times)
    expect(n.isNew(3, 30_000)).toBe(true);
  });

  it("redraws the hand when the marker should come off", () => {
    vi.useFakeTimers();
    const redraw = vi.fn();
    const n = new NewCards(redraw);
    n.update([1], Date.now());
    n.update([1, 2], Date.now());
    vi.advanceTimersByTime(19_000);
    expect(redraw).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_200);
    expect(redraw).toHaveBeenCalledTimes(1);
    n.stop();
    vi.useRealTimers();
  });
});
