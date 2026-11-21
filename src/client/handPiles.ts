// Where each card goes when the hand is grouped (Contract Rummy, Euchre):
// - "piles":   one pile per group, flowing left to right; copies sit a little right and down.
// - "cascade": the same piles, copies stepping down like solitaire columns.
// - "rows":    one row per group, each card tucked over the one before it.
// Every card keeps its top-left corner (rank and suit) showing. Cards are 2:3.

export type PileStyle = "piles" | "cascade" | "rows";
export type Spot = { x: number; y: number; w: number };

const GAP = 10;
const MIN_W = 30;
/** How far each copy moves, as a share of a card's width (dx) and height (dy). */
const SPREAD: Record<"piles" | "cascade", { dx: number; dy: number }> = {
  piles: { dx: 0.32, dy: 0.06 },
  cascade: { dx: 0, dy: 0.3 },
};
const ROW_DX = 0.34;
/** Rows may overlap, but never so much that the corner of the row above is hidden. */
const MIN_ROW_STEP = 0.42;

export function layoutPiles(groups: number[][], style: PileStyle, box: { W: number; H: number }, maxCw: number): Map<number, Spot> {
  const gs = groups.filter((g) => g.length);
  for (let w = Math.floor(maxCw); w >= MIN_W; w--) {
    const spots = style === "rows" ? stackedRows(gs, w, box) : flow(gs, SPREAD[style], w, box);
    if (spots) return spots;
  }
  return style === "rows" ? stackedRows(gs, MIN_W, box, true)! : flow(gs, SPREAD[style], MIN_W, box, true)!;
}

/** Piles left to right, wrapping into rows; each row centred, the whole block centred. */
function flow(groups: number[][], { dx, dy }: { dx: number; dy: number }, w: number, box: { W: number; H: number }, force = false) {
  const h = w * 1.5;
  type Row = { piles: { ids: number[]; pw: number }[]; width: number; height: number };
  const rows: Row[] = [];
  let row: Row = { piles: [], width: 0, height: 0 };
  for (const ids of groups) {
    const pw = w + dx * w * (ids.length - 1);
    const ph = h + dy * h * (ids.length - 1);
    if (row.piles.length && row.width + GAP + pw > box.W) {
      rows.push(row);
      row = { piles: [], width: 0, height: 0 };
    }
    row.width = row.piles.length ? row.width + GAP + pw : pw;
    row.piles.push({ ids, pw });
    row.height = Math.max(row.height, ph);
  }
  rows.push(row);
  const total = rows.reduce((s, r) => s + r.height, 0) + GAP * (rows.length - 1);
  const widest = Math.max(...rows.map((r) => r.width));
  if (!force && (total > box.H || widest > box.W)) return null;
  const out = new Map<number, Spot>();
  let y = Math.max(0, (box.H - total) / 2);
  for (const r of rows) {
    let x = Math.max(0, (box.W - r.width) / 2);
    for (const p of r.piles) {
      p.ids.forEach((id, i) => out.set(id, { x: x + dx * w * i, y: y + dy * h * i, w }));
      x += p.pw + GAP;
    }
    y += r.height + GAP;
  }
  return out;
}

/** One row per group, left-aligned as a block that's centred in the box. */
function stackedRows(groups: number[][], w: number, box: { W: number; H: number }, force = false) {
  const h = w * 1.5;
  const R = groups.length;
  const step = R > 1 ? Math.min(h + GAP, (box.H - h) / (R - 1)) : 0;
  const widest = Math.max(0, ...groups.map((g) => w + ROW_DX * w * (g.length - 1)));
  if (!force && ((R > 1 && step < MIN_ROW_STEP * h) || widest > box.W || h > box.H)) return null;
  const x0 = Math.max(0, (box.W - widest) / 2);
  const y0 = Math.max(0, (box.H - (h + step * (R - 1))) / 2);
  const out = new Map<number, Spot>();
  groups.forEach((g, r) => g.forEach((id, i) => out.set(id, { x: x0 + ROW_DX * w * i, y: y0 + step * r, w })));
  return out;
}
