// Which cards in your hand are new: anything that arrived after the deal (a draw, a card from
// the discard pile, a May I, a penalty) wears a "New" badge for 20 seconds.

export const NEW_FOR_MS = 20_000;

export class NewCards {
  private held: Set<number> | null = null;
  private arrived = new Map<number, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** `redraw` runs when a badge should come off (so the hand can be drawn again). */
  constructor(private redraw: () => void) {}

  /** Tell it what's in your hand now. */
  update(ids: number[], now = Date.now()) {
    const prev = this.held;
    const next = new Set(ids);
    // The first look, or a fresh deal (none of the old cards left): nothing is new.
    const fresh = !prev || prev.size === 0 || ![...prev].some((id) => next.has(id));
    if (fresh) this.arrived.clear();
    else for (const id of ids) if (!prev.has(id)) this.arrived.set(id, now);
    for (const id of [...this.arrived.keys()]) if (!next.has(id)) this.arrived.delete(id);
    this.held = next;
    this.schedule(now);
  }

  isNew(id: number, now = Date.now()): boolean {
    const t = this.arrived.get(id);
    return t !== undefined && now - t < NEW_FOR_MS;
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(now: number) {
    this.stop();
    const live = [...this.arrived.values()].filter((t) => now - t < NEW_FOR_MS);
    if (!live.length) return;
    const next = Math.min(...live) + NEW_FOR_MS - now;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.redraw();
      this.schedule(Date.now());
    }, next + 50);
  }
}
