# Hand Piles and Stacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank sort shows piles/columns, Suit sort shows stacked rows/columns (tap again to switch), in Rummy and Euchre.

**Architecture:** `HandArranger` (src/client/handArrange.ts) learns per-game group keys and a remembered variant per sort; a new pure module `handPiles.ts` turns groups into absolute card positions (x, y, width); `fitHand` takes the arranger and applies those positions. Phones pass group keys and toast the variant on a repeat tap.

**Tech Stack:** TypeScript, Vite, Vitest, Puppeteer (headless checks in the scratchpad).

**Spec:** docs/superpowers/specs/2026-11-21-hand-piles-design.md

## Global Constraints

- Sort buttons stay "Rank · Suit · Rows · Free" (Rows only in Rummy). Labels unchanged.
- Variants: rank `"piles" | "columns"`, suit `"rows" | "columns"`; stored in localStorage `ohno.<game>.rankStyle` / `ohno.<game>.suitStyle`, wrapped in try/catch like the existing keys.
- Fan button only in Free.
- Rummy suit order C, D, S, H; jokers last. Euchre suit: trump first; rank: A down to 9.
- Cards stay direct children of the hand box (drag-to-reorder depends on it).

## Review Focus

- A hand of 1 card, and a hand of 14+ (two jokers, three copies of a rank) must fit with every corner showing → layout tests with 1 and 14 cards.
- Switching away from Rank and back keeps the remembered variant (first tap doesn't toggle) → arranger test.
- Window resize / rotation re-lays out piles → `fitHand` recomputes from the box size each call (covered by the headless 412px→360px check).
- Selected card lift (`translateY(-12px)`) must still show on an absolutely-positioned card → headless check that a tapped card gets `.selected`.
- Euchre's trump changes mid-hand (after bidding) regroup suits → group key reads trump at arrange time (Euchre phone already re-arranges on each render).

---

### Task 1: Pile layout math

**Files:**
- Create: `src/client/handPiles.ts`
- Test: `tests/handPiles.test.ts`

**Interfaces:**
- Produces: `export type PileStyle = "piles" | "cascade" | "rows";`
  `export type Spot = { x: number; y: number; w: number };`
  `export function layoutPiles(groups: number[][], style: PileStyle, box: { W: number; H: number }, maxCw: number): Map<number, Spot>` — groups are card ids in display order; card height is 1.5 × w.
  - `piles`: groups flow left→right, wrapping, each copy offset 0.32w right and 0.06h down; rows centred.
  - `cascade`: same flow, copies offset 0.3h down.
  - `rows`: one row per group, copies offset 0.34w right; row step = min(h + 10, (H − h)/(R − 1)), never below 0.42h; block centred.
  - Largest integer w ≤ maxCw that fits (floor 30).

- [ ] **Step 1: Write failing tests** — `layoutPiles` for each style: every spot inside `[0, W] × [0, H]` (x + w ≤ W, y + 1.5w ≤ H); for 13 cards in 9 groups at 358×470, `piles` w ≥ 60; within a pile, later copy x > earlier x; `cascade` later copy y − earlier y ≥ 0.3·1.5w − 0.5; one card → w === maxCw; 14 cards (one group of 3, two jokers group) fit.
- [ ] **Step 2:** `npx vitest run tests/handPiles.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `layoutPiles` (the mockups' `flow`/`suitRows` math).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: pile/cascade/stacked-row layout math`.

### Task 2: Arranger variants + fitHand placement

**Files:**
- Modify: `src/client/handArrange.ts`
- Test: `tests/handArrange.test.ts` (jsdom not needed: test the arranger only, localStorage guarded)

**Interfaces:**
- Consumes: `layoutPiles` (Task 1).
- Produces: constructor gains `groups?: { rank: (c: C) => number; suit: (c: C) => number }` as an options field; `arranger.rankStyle: "piles" | "columns"`, `arranger.suitStyle: "rows" | "columns"`; `setMode(mode): string | null` returns a toast text ("Rank · columns") when a repeat tap switched the variant, else null; `arranger.piles: { style: PileStyle; groups: number[][] } | null` set by `arrange()` for rank/suit when `groups` is given; `fitHand(box, arranger, maxCw)` replaces the old signature.

- [ ] **Step 1: Failing tests** — arranger with groups: `setMode("rank")` from free → null, `rankStyle` unchanged; `setMode("rank")` again → "Rank · columns", then → "Rank · piles"; suit: "Suit · columns" then "Suit · rows"; switching rank→suit→rank keeps rankStyle; `arrange()` in rank mode yields `piles.groups` grouped by key in ascending key order with members sorted by the rank comparator; `piles.style` maps piles→"piles", columns→"cascade", rows→"rows", suit columns→"cascade".
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. `fitHand`: if `arranger.piles` → add class `placed`, set each card's `left/top` + `--cw` per spot (cards absolutely positioned), clear grid/fan state; else clear `left/top` and fall through to today's matrix/grid/fan code. Toolbar: active rank/suit button gets `<small>` with its variant word; Fan button only when `mode === "free"`; free mode uses `layout`, rank/suit without groups keep today's grid.
- [ ] **Step 4:** Run all tests → PASS; `npm run typecheck`.
- [ ] **Step 5:** Commit `feat: rank piles/columns and suit stacked rows/columns in the hand arranger`.

### Task 3: Wire Rummy and Euchre phones, CSS, README

**Files:**
- Modify: `src/client/games/rummy/phone.ts`, `src/client/games/euchre/phone.ts`, `src/client/styles.css`, `README.md`

**Interfaces:**
- Consumes: Task 2's constructor option, `setMode` return, `fitHand(box, arranger, maxCw)`.

- [ ] **Step 1:** Rummy groups: rank key `c.rank || 99`; suit key index in `["C","D","S","H"]`, joker 9. Rummy suit comparator uses that same order. Euchre groups: rank key `-RANK_ORDER[c.rank]`; suit key `suitKey(c)`. Both phones `toast()` the `setMode` result when non-null; all `fitHand` calls switch to the new signature.
- [ ] **Step 2:** CSS: `.hand.placed { display: block; position: relative; }` `.hand.placed > .pcard { position: absolute; }`; `.hand-tools .seg button small { display: block; font-size: 0.62rem; opacity: 0.75; }`.
- [ ] **Step 3:** README "Arrange your hand" lines (Rummy and Euchre) describe tap-again switching.
- [ ] **Step 4:** `npm run build`; headless: Rummy and Euchre phones at 412 and 360 wide — Rank piles, tap → columns, Suit rows, tap → columns: every card inside the hand box, each card's top-left 28%×30% corner not covered by a later card, tap selects, drag → Free; existing featuretest passes.
- [ ] **Step 5:** Commit `feat: piles and stacks on Rummy and Euchre phones`.
