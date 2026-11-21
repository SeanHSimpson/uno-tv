# Hand piles and stacks (Contract Rummy, Euchre) — short design

## Why
Players want their hand grouped the way they'd hold it: matching ranks piled together, suits stacked in order,
with every card's rank and suit still readable. Mockups (five phone screens) were reviewed and all liked.

## What
Sort buttons stay **Rank · Suit · Rows · Free** (Rows is Rummy only).

- **Rank**, first tap: **piles**, one pile per rank (ace to king; jokers last). Extra copies sit a little to the
  right (and slightly lower) of the one under them so each corner shows. Tap Rank again: **columns**, the same
  piles cascading downward like solitaire. Next tap: back to piles.
- **Suit**, first tap: **stacked rows**, one row per suit, each card tucked over the one before it, rows overlapping
  only when space is short. Tap again: **stacked columns**, one cascading column per suit. Next tap: back.
- The selected button shows its version as a small second line ("piles", "columns", "rows"); switching versions
  also shows a short toast. The phone remembers the last version per game.
- Rows and Free behave as today. **Fan** shows only in Free.
- Tapping still selects any card, including a partly covered one; dragging still switches to Free.
- Cards are as big as fit the hand area (capped as today), overlapping more only when needed.

Rummy: suit order clubs, diamonds, spades, hearts (same as Rows); jokers form their own pile/row at the end.
Euchre: suit grouping puts trump first (bowers on top, by power); rank grouping goes ace down to nine.

## Approaches
1. **Absolute positions computed in JS (chosen).** One layout routine places every card (x, y, size) for piles,
   cascades and stacked rows; cards are absolutely positioned in the hand box. Handles uneven pile sizes and
   overlap precisely, matches the mockups' math.
2. CSS grid with negative margins per pile: fewer lines, but uneven piles and "overlap only when short of
   room" are awkward to express, and the fit-to-screen sizing still needs JS.
3. Nested flex containers per group: changes the hand's DOM shape, which breaks drag-to-reorder (cards must stay
   direct children of the hand).

## Non-goals
No change to Rows, Free, drag behaviour, or OhNo!'s hand. No new server state (all of this is per phone).

## Left to the builder
Exact overlap fractions (mockups used ~32% across for piles, 30% of a card's height for cascades, 34% across for
stacked rows), tag/toast wording, and test coverage (unit test for the grouping/variant toggling; headless
phone check that piles/stacks fit and every corner shows).
