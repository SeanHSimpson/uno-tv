// Arranging the cards in your hand on a phone (Contract Rummy and Euchre):
// - sort by rank, by suit, or keep your own order ("My order"),
// - drag a card to move it (which switches to your own order),
// - lay the hand out as a tidy grid, or fanned and overlapping like cards held in your hand.
// Taps still select cards: a press only becomes a drag once the finger moves.

type Card = { id: number };
export type SortMode = "rank" | "suit" | "free";
export type HandLayout = "grid" | "fan";

const SORT_LABEL: Record<SortMode, string> = { rank: "Rank", suit: "Suit", free: "My order" };

function loadStr<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(`ohno.${key}`) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function saveStr(key: string, v: string) {
  try {
    localStorage.setItem(`ohno.${key}`, v);
  } catch {
    /* private mode etc. */
  }
}

/** Remembers how this player likes their hand, per game, on this phone. */
export class HandArranger<C extends Card> {
  mode: SortMode;
  layout: HandLayout;
  /** Your own order (card ids). New cards go on the end. */
  private custom: number[] = [];
  private shown: number[] = [];

  constructor(
    private game: string,
    private sorts: { rank: (a: C, b: C) => number; suit: (a: C, b: C) => number },
    defaultMode: SortMode = "rank",
  ) {
    this.mode = loadStr(`${game}.sort`, ["rank", "suit", "free"] as const, defaultMode);
    this.layout = loadStr(`${game}.layout`, ["grid", "fan"] as const, "grid");
  }

  arrange(cards: C[]): C[] {
    let out: C[];
    if (this.mode === "free") {
      const byId = new Map(cards.map((c) => [c.id, c]));
      const kept = this.custom.filter((id) => byId.has(id));
      const fresh = cards.filter((c) => !kept.includes(c.id));
      out = [...kept.map((id) => byId.get(id)!), ...fresh];
    } else out = [...cards].sort(this.sorts[this.mode]);
    this.shown = out.map((c) => c.id);
    this.custom = [...this.shown];
    return out;
  }

  setMode(mode: SortMode) {
    // Switching to "My order" starts from whatever is on screen right now.
    if (mode === "free") this.custom = [...this.shown];
    this.mode = mode;
    saveStr(`${this.game}.sort`, mode);
  }

  toggleLayout() {
    this.layout = this.layout === "grid" ? "fan" : "grid";
    saveStr(`${this.game}.layout`, this.layout);
  }

  /** After a drag: this exact order, from now on. */
  setOrder(ids: number[]) {
    this.custom = ids;
    this.shown = ids;
    this.mode = "free";
    saveStr(`${this.game}.sort`, "free");
  }

  /** Start a new hand with a clean slate (the cards are all different now). */
  reset() {
    this.custom = [];
  }

  /** The little toolbar above the hand. Buttons carry data-sort / data-layout / data-glance. */
  toolbar(opts: { glance?: string } = {}): string {
    const modes: SortMode[] = ["rank", "suit", "free"];
    return `<div class="hand-tools">
      <div class="seg" role="group" aria-label="Sort your cards">${modes
        .map((m) => `<button class="seg-btn ${this.mode === m ? "on" : ""}" data-sort="${m}" aria-pressed="${this.mode === m}">${SORT_LABEL[m]}</button>`)
        .join("")}</div>
      <button class="tool-btn" data-layout aria-label="${this.layout === "fan" ? "Show cards in a grid" : "Fan the cards like a real hand"}">${this.layout === "fan" ? "▦ Grid" : "🂠 Fan"}</button>
      ${opts.glance ? `<button class="tool-btn" data-glance>${opts.glance}</button>` : ""}
    </div>`;
  }
}

/**
 * Size the cards so the whole hand fits without scrolling.
 * Grid: rows and columns. Fan: one or two overlapping, slightly curved rows.
 */
export function fitHand(box: HTMLElement, layout: HandLayout, maxCw: number) {
  const cards = [...box.querySelectorAll<HTMLElement>(":scope > .pcard")];
  const n = Math.max(1, cards.length);
  const cs = getComputedStyle(box);
  const W = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
  const H = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 16;
  box.classList.toggle("fan", layout === "fan");
  if (layout === "grid") {
    const gap = n > 12 ? 4 : 6;
    let best = { w: 0, cols: 1 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows / 1.5);
      if (w > best.w) best = { w, cols };
    }
    box.style.setProperty("--cw", `${Math.floor(Math.min(best.w, maxCw))}px`);
    box.style.setProperty("--cols", String(best.cols));
    box.style.setProperty("--gap", `${gap}px`);
    for (const el of cards) for (const v of ["--k", "--rot", "--dip"]) el.style.removeProperty(v);
    return;
  }
  // Fan: big cards overlapping, so you see each corner like a hand of real cards.
  const rows = n > 11 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const rowStep = 0.45; // the second row starts this far down a card (they overlap)
  const arc = 16; // px the ends of a row dip
  const cwByH = (H - arc - 20) / (1.5 * (1 + (rows - 1) * rowStep));
  // Every card must show its corner (about 28% of a card), so long rows use smaller cards.
  const SHOW = 0.28;
  const cwByW = W / (1.7 + SHOW * (perRow - 1));
  const cw = Math.floor(Math.min(maxCw * 1.1, cwByH, W * 0.36, cwByW));
  // Tilted cards poke out sideways: keep a margin for that. Each card shows at least its
  // corner; with room to spare they spread out (up to a small gap).
  const room = W - cw * 0.7;
  const step = perRow > 1 ? Math.min(cw * 0.62, (room - cw) / (perRow - 1)) : 0;
  // A grid whose columns are narrower than the cards: each card spills over the next one.
  box.style.setProperty("--cw", `${cw}px`);
  box.style.setProperty("--fan-cols", perRow > 1 ? `repeat(${perRow - 1}, ${step.toFixed(1)}px) ${cw}px` : `${cw}px`);
  box.style.setProperty("--fan-rows", rows > 1 ? `${Math.round(cw * 1.5 * rowStep)}px auto` : "auto");
  cards.forEach((el, i) => {
    const col = i % perRow;
    const inRow = Math.min(perRow, n - Math.floor(i / perRow) * perRow);
    const k = col - (inRow - 1) / 2;
    const spread = inRow > 1 ? k / ((inRow - 1) / 2) : 0; // -1 … 1
    el.style.setProperty("--k", String(k));
    el.style.setProperty("--rot", `${(spread * Math.min(8, inRow * 1.3)).toFixed(2)}deg`);
    // The middle of the fan rises; the ends stay put (so nothing drops off the bottom).
    el.style.setProperty("--dip", `${((spread * spread - 1) * arc).toFixed(1)}px`);
  });
}

/**
 * Let the player drag cards around inside `box` to reorder them.
 * `onDrop` gets the new order of card ids; `onMove` runs after each shuffle (to re-fan).
 */
export function attachReorder(box: HTMLElement, opts: { onDrop(ids: number[]): void; onMove?(): void; signal: AbortSignal }) {
  type Drag = { el: HTMLElement; pointerId: number; sx: number; sy: number; started: boolean; gx: number; gy: number };
  let drag: Drag | null = null;
  let swallowClick = false;
  const { signal } = opts;

  const place = (d: Drag, x: number, y: number) => {
    d.el.style.translate = "none";
    const r = d.el.getBoundingClientRect();
    d.el.style.translate = `${x - d.gx - r.left}px ${y - d.gy - r.top}px`;
  };

  box.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>(".pcard");
      if (!el || el.parentElement !== box) return;
      const r = el.getBoundingClientRect();
      drag = { el, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, started: false, gx: e.clientX - r.left, gy: e.clientY - r.top };
    },
    { signal },
  );

  box.addEventListener(
    "pointermove",
    (e) => {
      const d = drag;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.started) {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 10) return;
        d.started = true;
        try {
          d.el.setPointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        d.el.classList.add("reorder-drag");
        box.classList.add("reordering");
      }
      e.preventDefault();
      // Which card is under the finger (ignoring the one being dragged)?
      const under = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((n) => (n as HTMLElement).closest?.(".pcard") as HTMLElement | null)
        .find((n) => n && n !== d.el && n.parentElement === box);
      if (under) {
        const kids = [...box.children];
        const from = kids.indexOf(d.el);
        const to = kids.indexOf(under);
        const r = under.getBoundingClientRect();
        const sameRow = Math.abs(e.clientY - (r.top + r.height / 2)) < r.height / 2;
        // In the same row, only swap once the finger is past the middle of the other card
        // (overlapping fanned cards would otherwise flicker back and forth).
        const past = !sameRow || (from < to ? e.clientX > r.left + r.width / 2 : e.clientX < r.left + r.width / 2);
        if (past) {
          if (from < to) under.after(d.el);
          else under.before(d.el);
          opts.onMove?.();
        }
      }
      place(d, e.clientX, e.clientY);
    },
    { signal },
  );

  const end = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    drag = null;
    if (!d.started) return;
    d.el.classList.remove("reorder-drag");
    d.el.style.translate = "";
    box.classList.remove("reordering");
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 50);
    opts.onDrop([...box.querySelectorAll<HTMLElement>(":scope > .pcard")].map((el) => Number(el.dataset.id)));
  };
  box.addEventListener("pointerup", end, { signal });
  box.addEventListener("pointercancel", end, { signal });
  // The click that ends a drag isn't a tap on a card.
  box.addEventListener(
    "click",
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    { capture: true, signal },
  );

  return { dragging: () => !!drag?.started };
}
