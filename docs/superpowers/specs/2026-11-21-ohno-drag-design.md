# OhNo! drag to reorder — short design

**Why:** Rummy and Euchre players can arrange their own hand; OhNo! players want the same.

**What:** toolbar above the OhNo! hand: **Color · Number · Free** (Color = today's sort; Number = all 7s, then all skips…).
Dragging a card: the first direction decides. Mostly up = swipe to play (unchanged). Mostly sideways = pick it up and move it
anywhere in the hand (then up/down is free too), which switches to Free. New cards go at the end of the Free order. Remembered per phone.
No Fan button in OhNo! (its hand is a fit-to-screen grid).

**Approaches:** (1) reuse handArrange's HandArranger + attachReorder with a card selector, start test, labels and mode order (chosen:
same behaviour as Rummy/Euchre, little new code); (2) a separate OhNo!-only drag (duplicate logic); (3) long-press to reorder
(slower, and long-press is easy to trigger by accident while choosing a card).
