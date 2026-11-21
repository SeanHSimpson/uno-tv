// Arranging the cards in your hand on a phone (Contract Rummy and Euchre):
// - sort by rank, by suit, in suit rows with ranks lined up in columns ("Rows", Rummy),
//   or keep your own order ("Free"),
// - drag a card to move it (which switches to your own order),
// - lay the hand out as a tidy grid, or fanned and overlapping like cards held in your hand.
// - Rank and Suit group the cards: Rank as piles or columns, Suit as stacked rows or columns
//   (tap the button again to switch; see handPiles.ts).
// Taps still select cards: a press only becomes a drag once the finger moves.

import { layoutPiles, type PileStyle } from "./handPiles";

type Card = { id: number };
export type SortMode = "rank" | "suit" | "rows" | "free";
export type HandLayout = "grid" | "fan";
export type RankStyle = "piles" | "columns";
export type SuitStyle = "rows" | "columns";
/** Where each card sits in the "Rows" layout: row and column (0-based), and the size of the grid. */
export type HandMatrix = { rows: number; cols: number; at: Map<number, [number, number]> };

const SORT_LABEL: Record<SortMode, string> = { rank: "Rank", suit: "Suit", rows: "Rows", free: "Free" };

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
  /** Set while sorted into rows: where each card goes. */
  matrix: HandMatrix | null = null;
  /** Set while grouped by rank or suit: the groups (card ids) and how to lay them out. */
  piles: { style: PileStyle; groups: number[][] } | null = null;
  rankStyle: RankStyle;
  suitStyle: SuitStyle;
  private rowsOf?: (c: C) => { row: number; col: number } | null;
  private groups?: { rank: (c: C) => number; suit: (c: C) => number };
  private order?: SortMode[];
  private labels: Record<SortMode, string>;

  constructor(
    private game: string,
    private sorts: { rank: (a: C, b: C) => number; suit: (a: C, b: C) => number },
    opts: {
      defaultMode?: SortMode;
      /** For "Rows": which row a card belongs to (lower first) and its column value. Jokers: null. */
      rowsOf?: (c: C) => { row: number; col: number } | null;
      /** Which pile a card goes in when grouped by rank / by suit (lower keys first). */
      groups?: { rank: (c: C) => number; suit: (c: C) => number };
      /** Which sort buttons to show, in order (default rank, suit, [rows], free). */
      modes?: SortMode[];
      /** Button names, e.g. OhNo!'s "Color" and "Number". */
      labels?: Partial<Record<SortMode, string>>;
    } = {},
  ) {
    this.rowsOf = opts.rowsOf;
    this.groups = opts.groups;
    this.order = opts.modes;
    this.labels = { ...SORT_LABEL, ...opts.labels };
    this.mode = loadStr(`${game}.sort`, this.modes(), opts.defaultMode ?? "rank");
    this.layout = loadStr(`${game}.layout`, ["grid", "fan"] as const, "grid");
    this.rankStyle = loadStr(`${game}.rankStyle`, ["piles", "columns"] as const, "piles");
    this.suitStyle = loadStr(`${game}.suitStyle`, ["rows", "columns"] as const, "rows");
  }

  private modes(): SortMode[] {
    if (this.order) return this.order;
    return this.rowsOf ? ["rank", "suit", "rows", "free"] : ["rank", "suit", "free"];
  }

  arrange(cards: C[]): C[] {
    let out: C[];
    this.matrix = null;
    this.piles = null;
    if ((this.mode === "rank" || this.mode === "suit") && this.groups) {
      const mode = this.mode;
      const key = this.groups[mode];
      const byKey = new Map<number, C[]>();
      for (const c of [...cards].sort(this.sorts[mode])) {
        const k = key(c);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(c);
      }
      const groups = [...byKey.keys()].sort((a, b) => a - b).map((k) => byKey.get(k)!);
      out = groups.flat();
      const style: PileStyle =
        mode === "rank" ? (this.rankStyle === "piles" ? "piles" : "cascade") : this.suitStyle === "rows" ? "rows" : "cascade";
      this.piles = { style, groups: groups.map((g) => g.map((c) => c.id)) };
    } else if (this.mode === "rows" && this.rowsOf) {
      const r = rowsLayout(cards, this.rowsOf);
      out = r.out;
      this.matrix = r.matrix;
    } else if (this.mode === "free") {
      const byId = new Map(cards.map((c) => [c.id, c]));
      const kept = this.custom.filter((id) => byId.has(id));
      const fresh = cards.filter((c) => !kept.includes(c.id));
      out = [...kept.map((id) => byId.get(id)!), ...fresh];
    } else out = [...cards].sort(this.sorts[this.mode === "rows" ? "suit" : this.mode]);
    this.shown = out.map((c) => c.id);
    this.custom = [...this.shown];
    return out;
  }

  /**
   * Pick a sort. Tapping Rank or Suit while it's already on switches its version
   * (piles ↔ columns, stacked rows ↔ columns) and returns a line to show the player.
   */
  setMode(mode: SortMode): string | null {
    let note: string | null = null;
    if (mode === this.mode && this.groups) {
      if (mode === "rank") {
        this.rankStyle = this.rankStyle === "piles" ? "columns" : "piles";
        saveStr(`${this.game}.rankStyle`, this.rankStyle);
        note = `${this.labels.rank} · ${this.rankStyle}`;
      } else if (mode === "suit") {
        this.suitStyle = this.suitStyle === "rows" ? "columns" : "rows";
        saveStr(`${this.game}.suitStyle`, this.suitStyle);
        note = `${this.labels.suit} · ${this.suitStyle}`;
      }
    }
    // Switching to "Free" starts from whatever is on screen right now.
    if (mode === "free" && this.mode !== "free") this.custom = [...this.shown];
    this.mode = mode;
    saveStr(`${this.game}.sort`, mode);
    return note;
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

  private styleTag(m: SortMode) {
    if (!this.groups) return "";
    if (m === "rank") return `<small>${this.rankStyle}</small>`;
    if (m === "suit") return `<small>${this.suitStyle}</small>`;
    return "";
  }

  /** The little toolbar above the hand. Buttons carry data-sort / data-layout / data-glance. */
  toolbar(opts: { glance?: string; fan?: boolean } = {}): string {
    const modes = this.modes();
    // Only your own order can be fanned: the other sorts already place every card.
    const layoutBtn =
      this.mode !== "free" || opts.fan === false
        ? ""
        : `<button class="tool-btn" data-layout aria-label="${this.layout === "fan" ? "Show cards in a grid" : "Fan the cards like a real hand"}">${this.layout === "fan" ? "▦ Grid" : "🂠 Fan"}</button>`;
    return `<div class="hand-tools">
      <div class="seg" role="group" aria-label="Sort your cards">${modes
        .map((m) => `<button class="seg-btn ${this.mode === m ? "on" : ""}" data-sort="${m}" aria-pressed="${this.mode === m}">${this.labels[m]}${this.mode === m ? this.styleTag(m) : ""}</button>`)
        .join("")}</div>
      ${layoutBtn}
      ${opts.glance ? `<button class="tool-btn" data-glance>${opts.glance}</button>` : ""}
    </div>`;
  }
}

/**
 * "Rows": one row per suit (in the order rowsOf gives), cards in rank order, and every rank in
 * its own column, so all your 4s line up down the hand. Only ranks you hold get a column.
 * Two of the same card (two decks) start a second row for that suit; jokers get the last row.
 */
export function rowsLayout<C extends Card>(cards: C[], rowsOf: (c: C) => { row: number; col: number } | null) {
  const info = cards.map((c) => ({ c, k: rowsOf(c) }));
  const colVals = [...new Set(info.flatMap((x) => (x.k ? [x.k.col] : [])))].sort((a, b) => a - b);
  const groups = [...new Set(info.flatMap((x) => (x.k ? [x.k.row] : [])))].sort((a, b) => a - b);
  const at = new Map<number, [number, number]>();
  let row = 0;
  for (const g of groups) {
    const mine = info.filter((x) => x.k?.row === g).sort((a, b) => a.k!.col - b.k!.col || a.c.id - b.c.id);
    const used = new Map<number, number>(); // column -> copies placed so far
    for (const { c, k } of mine) {
      const n = used.get(k!.col) ?? 0;
      used.set(k!.col, n + 1);
      at.set(c.id, [row + n, colVals.indexOf(k!.col)]);
    }
    row += Math.max(...used.values());
  }
  const loose = info.filter((x) => !x.k).map((x) => x.c);
  const cols = colVals.length || Math.min(Math.max(1, loose.length), 6);
  // Jokers on their own row (wrapping if there are more of them than columns).
  loose.forEach((c, i) => at.set(c.id, [row + Math.floor(i / cols), i % cols]));
  row += Math.ceil(loose.length / cols);
  // Row by row, left to right, so each card overlaps the one before and every corner shows.
  const out = [...cards].sort((a, b) => at.get(a.id)![0] - at.get(b.id)![0] || at.get(a.id)![1] - at.get(b.id)![1]);
  const matrix: HandMatrix = { rows: Math.max(1, row), cols, at };
  return { out, matrix };
}

/**
 * Size the cards so the whole hand fits without scrolling.
 * Grid: rows and columns. Fan: one or two overlapping, slightly curved rows.
 * Matrix ("Rows" sort): cards at fixed row/column spots, overlapping only when space is short.
 */
export function fitHand(
  box: HTMLElement,
  arr: { mode: SortMode; layout: HandLayout; matrix: HandMatrix | null; piles: { style: PileStyle; groups: number[][] } | null },
  maxCw: number,
) {
  const { matrix, piles } = arr;
  const layout: HandLayout = arr.mode === "free" ? arr.layout : "grid";
  const cards = [...box.querySelectorAll<HTMLElement>(":scope > .pcard")];
  const n = Math.max(1, cards.length);
  const cs = getComputedStyle(box);
  const W = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
  const H = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 16;
  box.classList.toggle("fan", layout === "fan" && !matrix && !piles);
  box.classList.toggle("rows", !!matrix && !piles);
  box.classList.toggle("placed", !!piles);
  if (piles) {
    // Grouped: every card absolutely placed (see handPiles.ts).
    const spots = layoutPiles(piles.groups, piles.style, { W, H }, maxCw);
    const left = parseFloat(cs.paddingLeft) + 4;
    const top = parseFloat(cs.paddingTop) + 8;
    for (const el of cards) {
      for (const v of ["--k", "--rot", "--dip"]) el.style.removeProperty(v);
      el.style.gridArea = "";
      const s = spots.get(Number(el.dataset.id));
      if (!s) continue;
      el.style.left = `${(left + s.x).toFixed(1)}px`;
      el.style.top = `${(top + s.y).toFixed(1)}px`;
      el.style.setProperty("--cw", `${s.w}px`);
    }
    return;
  }
  for (const el of cards) {
    el.style.left = "";
    el.style.top = "";
    el.style.removeProperty("--cw");
  }
  if (matrix) {
    for (const el of cards) for (const v of ["--k", "--rot", "--dip"]) el.style.removeProperty(v);
    const { rows: R, cols: C } = matrix;
    const gap = 6;
    // The biggest card where each one still shows its corner: a column step of at least `fx`
    // of a card's width, a row step of at least `fy` of its height. Overlap only as needed.
    const size = (fx: number, fy: number) => Math.min(maxCw, W / (1 + fx * (C - 1)), H / (1.5 * (1 + fy * (R - 1))));
    let cw = size(1, 1);
    if (cw < 64) cw = Math.min(64, size(0.5, 0.55));
    if (cw < 50) cw = Math.min(50, size(0.36, 0.42));
    cw = Math.floor(cw);
    const ch = cw * 1.5;
    const sx = C > 1 ? Math.min(cw + gap, (W - cw) / (C - 1)) : 0;
    const sy = R > 1 ? Math.min(ch + gap, (H - ch) / (R - 1)) : 0;
    box.style.setProperty("--cw", `${cw}px`);
    box.style.setProperty("--fan-cols", C > 1 ? `repeat(${C - 1}, ${sx.toFixed(1)}px) ${cw}px` : `${cw}px`);
    box.style.setProperty("--fan-rows", R > 1 ? `repeat(${R - 1}, ${sy.toFixed(1)}px) ${ch.toFixed(1)}px` : "auto");
    for (const el of cards) {
      const spot = matrix.at.get(Number(el.dataset.id));
      el.style.gridArea = spot ? `${spot[0] + 1} / ${spot[1] + 1}` : "";
    }
    return;
  }
  for (const el of cards) el.style.gridArea = "";
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
export function attachReorder(
  box: HTMLElement,
  opts: {
    onDrop(ids: number[]): void;
    onMove?(): void;
    signal: AbortSignal;
    /** The cards (direct children of box). Default ".pcard". */
    selector?: string;
    /** May this movement (from where the finger went down) start a drag? E.g. OhNo!: only sideways. */
    canStart?(dx: number, dy: number): boolean;
  },
) {
  const sel = opts.selector ?? ".pcard";
  type Drag = { el: HTMLElement; pointerId: number; sx: number; sy: number; started: boolean; gx: number; gy: number };
  let drag: Drag | null = null;
  let swallowClick = false;
  let afterRelease: (() => void) | null = null;
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
      const el = (e.target as HTMLElement).closest<HTMLElement>(sel);
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
        if (opts.canStart && !opts.canStart(e.clientX - d.sx, e.clientY - d.sy)) return;
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
        .map((n) => (n as HTMLElement).closest?.(sel) as HTMLElement | null)
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
    // A redraw that waited for the finger: run it once the tap's click has landed.
    const later = afterRelease;
    afterRelease = null;
    if (later) setTimeout(later, 0);
    if (!d.started) return;
    d.el.classList.remove("reorder-drag");
    d.el.style.translate = "";
    box.classList.remove("reordering");
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 50);
    opts.onDrop([...box.querySelectorAll<HTMLElement>(`:scope > ${sel}`)].map((el) => Number(el.dataset.id)));
  };
  window.addEventListener("pointerup", end, { signal });
  window.addEventListener("pointercancel", end, { signal });
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

  return {
    dragging: () => !!drag?.started,
    /**
     * A finger is on a card (it may be about to drag it). Redrawing the hand now would swap the
     * card out from under it, so call `later(fn)` to redraw when it lets go instead.
     */
    holding: () => !!drag,
    later: (fn: () => void) => {
      afterRelease = fn;
    },
  };
}
