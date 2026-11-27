// Contract Rummy on a phone: draw, pick cards, lay down, add to groups, discard.

import { canAdd, contractLabel, type PCard } from "../../../shared/games/rummy/cards";
import type { RummyEvent, RummyPrivate, RummyPublic } from "../../../shared/games/rummy/engine";
import { evaluateSelection, type SelectionEval } from "../../../shared/games/rummy/hint";
import { audio, haptic } from "../../audio";
import { confetti } from "../../fx";
import { animateCardFlip, attachReorder, captureCardRects, fitHand, HandArranger, type SortMode } from "../../handArrange";
import { icoEye } from "../../icons";
import { pcardEl, pcardHtml, shortCard } from "../../playingCards";
import { $, avatar, esc, reducedMotion, toast } from "../../ui";
import { tableSizeMenu } from "../tableSize";
import type { GameSnap, GameView, PhoneCtx } from "../types";
import { NewCards } from "../../newCards";
import { seatLandings } from "../../../shared/games/rummy/deal";

export function rummyPhone(ctx: PhoneCtx): GameView {
  const pid = ctx.pid;
  const ac = new AbortController();
  let state: RummyPublic | null = null;
  let me: RummyPrivate | null = null;
  let isHost = false;
  let selected = new Set<number>();
  // Cards that just came into your hand wear a "New" badge for a while.
  const fresh = new NewCards(() => me && renderHand(true));
  let wasMyTurn = false;
  /** While the TV is dealing: when it started and when each of my cards lands on my board there. */
  let dealing: { start: number; lands: number[] } | null = null;
  let dealTimers: ReturnType<typeof setTimeout>[] = [];
  /** In-flight action guard so taps feel immediate and double-taps can't collide. */
  let pendingAct: string | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Memoized contract evaluation so repeated renders don't re-run the solver. */
  let evalCache: { key: string; res: SelectionEval } | null = null;
  const rankOf = (c: PCard) => c.rank || 99;
  // Suit order everywhere: clubs, diamonds, spades, hearts (colors alternate); jokers last.
  const ROW_SUITS = ["C", "D", "S", "H"];
  const suitIdx = (c: PCard) => (c.suit ? ROW_SUITS.indexOf(c.suit) : 9);
  const arranger = new HandArranger<PCard>(
    "rummy",
    {
      rank: (a, b) => rankOf(a) - rankOf(b) || suitIdx(a) - suitIdx(b) || a.id - b.id,
      suit: (a, b) => suitIdx(a) - suitIdx(b) || rankOf(a) - rankOf(b) || a.id - b.id,
    },
    {
      rowsOf: (c) => (c.suit ? { row: ROW_SUITS.indexOf(c.suit), col: c.rank } : null),
      groups: { rank: rankOf, suit: suitIdx },
    },
  );

  ctx.el.innerHTML = `
  <div class="rummy-phone">
    <section class="rm-status" id="rm-status"></section>
    <section class="hand-toolbar" id="rm-tools"></section>
    <main class="hand rm-hand" id="rm-hand" aria-label="Your hand"></main>
    <footer class="rm-actions" id="rm-actions">
      <button class="btn btn-primary" id="rm-lay" hidden></button>
      <button class="btn btn-ghost" id="rm-hit" hidden></button>
      <button class="btn btn-danger" id="rm-discard" hidden>Discard</button>
    </footer>
    <div class="rm-swipe-cue" id="rm-swipe-cue" aria-hidden="true"></div>
    <section class="sheet" id="rm-hit-sheet" hidden></section>
    <section class="sheet glance-sheet" id="rm-glance" hidden></section>
    <section class="ph-results overlay" id="rm-results" hidden></section>
  </div>`;

  const send = ctx.send;
  const hand = $("#rm-hand");
  const name = (id: string) => esc(state?.players.find((p) => p.id === id)?.name ?? "someone");
  const selectedCards = (): PCard[] => (me?.hand ?? []).filter((c) => selected.has(c.id));

  function clearPending() {
    pendingAct = null;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }
  function sendAction(kind: string, action: unknown) {
    if (pendingAct) return;
    pendingAct = kind;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingAct = null;
      pendingTimer = null;
      render();
    }, 3500);
    send(action);
    render();
  }

  function evalSelected(cards: PCard[], m: RummyPrivate, s: RummyPublic): SelectionEval {
    if (m.down || s.phase !== "playing" || !cards.length) return { hint: null, whole: false, part: null };
    const started = m.left.sets + m.left.runs < s.contract.sets + s.contract.runs;
    const key = `${cards.map((c) => c.id).join(",")}|${m.left.sets},${m.left.runs}|${s.parts ? 1 : 0}|${started ? 1 : 0}`;
    if (evalCache?.key === key) return evalCache.res;
    const res = evaluateSelection(cards, m.left, { parts: s.parts, started });
    evalCache = { key, res };
    return res;
  }

  // The deck and the discard pile at the top: tap one to draw from it on your turn. On someone
  // else's turn, tap the discard pile twice for "May I?" (the second tap confirms, since it costs
  // a penalty card if you get it).
  let mayIArmed = 0;
  let mayITimer: ReturnType<typeof setTimeout> | null = null;
  $("#rm-status").addEventListener("click", (e) => {
    const pile = (e.target as HTMLElement).closest<HTMLElement>("[data-pile]")?.dataset.pile;
    if (!pile || !me || !state || dealing) return;
    if (me.canDraw) {
      if (pile === "discard" && !state.discardTop) return;
      haptic("select");
      sendAction("draw", { t: "draw", from: pile === "discard" ? "discard" : "stock" });
      return;
    }
    if (pile !== "discard") return;
    if (!me.canMayI) {
      if (state.mayI.includes(pid)) toast("You've asked. You'll get it if they draw from the deck.");
      else if (me.myTurn) return;
      else if (me.buysLeft <= 0) toast("You've used all your \"May I?\"s this round.");
      else if (state.discardTop) toast("\"May I?\" works until the player whose turn it is discards, unless they took the card themselves. Not on your own discard.");
      return;
    }
    if (Date.now() < mayIArmed) {
      mayIArmed = 0;
      haptic("select");
      sendAction("mayI", { t: "mayI" });
    } else {
      mayIArmed = Date.now() + 3000;
      haptic("select");
      const turnP = state.players.find((p) => p.id === state!.turnId);
      const who = turnP ? turnP.name : "they";
      toast(
        state.stage === "play"
          ? `Tap again for "May I?": you take the ${shortCard(state.discardTop!)} now, plus a penalty card.`
          : `Tap again for "May I?". If ${who} draw${turnP ? "s" : ""} from the deck, you get the ${shortCard(state.discardTop!)} plus a penalty card.`,
      );
      if (mayITimer) clearTimeout(mayITimer);
      mayITimer = setTimeout(() => render(), 3050);
    }
    render();
  });
  $("#rm-tools").addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const sort = t.closest<HTMLElement>("[data-sort]");
    if (sort) {
      const before = captureCardRects(hand);
      const note = arranger.setMode(sort.dataset.sort as SortMode);
      if (note) toast(note);
      haptic("select");
      render();
      animateCardFlip(hand, before);
      return;
    }
    if (t.closest("[data-layout]")) {
      const before = captureCardRects(hand);
      arranger.toggleLayout();
      haptic("select");
      render();
      animateCardFlip(hand, before);
      return;
    }
    if (t.closest("[data-glance]")) {
      renderGlance();
      ctx.openSheet($("#rm-glance"));
      return;
    }
  });
  // Upward swipe on selected cards lays down your contract, adds to a group, or discards!
  // Sideways drag still rearranges cards freely.
  let swipe: {
    els: HTMLElement[];
    kind: "lay" | "hit" | "discard";
    x0: number;
    y0: number;
    pointer: number;
    active: boolean;
  } | null = null;
  let suppressClick = false;

  function swipeActionFor(id: number): "lay" | "hit" | "discard" | null {
    if (!me || !state || !me.canPlay || pendingAct || !selected.has(id)) return null;
    const cards = selectedCards();
    if (!me.down && cards.length >= 3) {
      const ev = evalSelected(cards, me, state);
      if (ev.whole || !!ev.part) return "lay";
    }
    if (me.down && fittingMelds().length > 0) return "hit";
    if (cards.length === 1) return "discard";
    return null;
  }

  const reorder = attachReorder(hand, {
    signal: ac.signal,
    canStart: (dx, dy) => !swipe?.active && (dy > -10 || Math.abs(dx) >= Math.abs(dy)),
    onMove: () => fitHand(hand, arranger, 120),
    onDrop: (ids) => {
      arranger.setOrder(ids);
      haptic("select");
      render();
    },
  });

  hand.addEventListener(
    "pointerdown",
    (e) => {
      if (!e.isPrimary) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>(".pcard");
      if (!el) return;
      const kind = swipeActionFor(Number(el.dataset.id));
      if (!kind) return;
      const els = [...hand.querySelectorAll<HTMLElement>(":scope > .pcard.selected")];
      if (els.length) swipe = { els, kind, x0: e.clientX, y0: e.clientY, pointer: e.pointerId, active: false };
    },
    { signal: ac.signal },
  );
  const swipeThreshold = () => Math.min(95, Math.max(58, hand.clientHeight * 0.16));
  const cueEl = () => document.getElementById("rm-swipe-cue");
  window.addEventListener(
    "pointermove",
    (e) => {
      if (!swipe || e.pointerId !== swipe.pointer) return;
      if (reorder.dragging()) return void (swipe = null);
      const dx = e.clientX - swipe.x0;
      const dy = e.clientY - swipe.y0;
      if (!swipe.active) {
        if (dy > -14 || Math.abs(dy) <= Math.abs(dx) * 1.15) return;
        swipe.active = true;
        for (const el of swipe.els) el.classList.add("dragging");
      }
      const lift = Math.min(0, dy);
      const armed = lift < -swipeThreshold();
      for (const el of swipe.els) {
        el.style.transform = `translate(${dx * 0.35}px, ${lift}px) scale(1.06)`;
        el.classList.toggle("will-play", armed);
      }
      const cue = cueEl();
      if (cue) {
        cue.textContent =
          swipe.kind === "lay"
            ? armed
              ? "Release to lay down! ✓"
              : "Swipe up to lay down"
            : swipe.kind === "hit"
              ? armed
                ? "Release to add to group!"
                : "Swipe up to add"
              : armed
                ? "Release to discard!"
                : "Swipe up to discard";
        cue.className = `rm-swipe-cue show ${armed ? "armed" : ""} ${swipe.kind === "discard" ? "danger" : ""}`;
      }
    },
    { signal: ac.signal },
  );
  const endSwipe = (e: PointerEvent) => {
    if (!swipe || e.pointerId !== swipe.pointer) return;
    const d = swipe;
    swipe = null;
    const cue = cueEl();
    if (cue) cue.className = "rm-swipe-cue";
    if (!d.active) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 300);
    for (const el of d.els) {
      el.classList.remove("dragging", "will-play");
      el.style.transform = "";
    }
    const far = e.type === "pointerup" && e.clientY - d.y0 < -swipeThreshold();
    if (!far) return;
    if (d.kind === "lay") {
      haptic("play");
      sendAction("lay", { t: "layDown", cardIds: [...selected] });
    } else if (d.kind === "hit") {
      haptic("play");
      triggerHit();
    } else if (d.kind === "discard") {
      triggerDiscard();
    }
  };
  window.addEventListener("pointerup", endSwipe, { signal: ac.signal });
  window.addEventListener("pointercancel", endSwipe, { signal: ac.signal });

  hand.addEventListener("click", (e) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const el = (e.target as HTMLElement).closest<HTMLElement>(".pcard");
    if (!el) return;
    const id = Number(el.dataset.id);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    haptic("select");
    audio.tick();
    render();
  });

  function triggerDiscard() {
    const [id] = [...selected];
    if (id === undefined || !me) return;
    if (id === me.tookFromDiscard && me.hand.length > 1) {
      haptic("error");
      audio.error();
      toast("You just picked that card up — discard a different card.", "error");
      return;
    }
    haptic("select");
    sendAction("discard", { t: "discard", cardId: id });
  }

  function triggerHit() {
    const fits = fittingMelds();
    if (!fits.length) return;
    if (fits.length === 1) return hitInto(fits[0]!.id);
    const sheet = $("#rm-hit-sheet");
    sheet.innerHTML = `<h3>Add to which group?</h3>
      <div class="rm-hit-list">${fits
        .map(
          (m) => `<button class="rm-hit-choice" data-meld="${m.id}"><span>${name(m.owner)}'s ${m.kind}</span><span class="rm-hit-cards">${m.cards
            .map((c) => pcardHtml(c, "rm-mini"))
            .join("")}</span></button>`,
        )
        .join("")}</div>
      <button class="btn btn-ghost wide" data-close>Cancel</button>`;
    ctx.openSheet(sheet);
  }

  $("#rm-lay").addEventListener("click", () => {
    if (me?.canDraw) {
      haptic("error");
      toast("Draw a card from the deck or discard pile first, then lay down!");
      return;
    }
    haptic("select");
    sendAction("lay", { t: "layDown", cardIds: [...selected] });
  });
  $("#rm-discard").addEventListener("click", triggerDiscard);
  $("#rm-hit").addEventListener("click", triggerHit);
  $("#rm-hit-sheet").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-meld]");
    if (b) {
      hitInto(Number(b.dataset.meld));
      ctx.closeSheets();
    }
  });
  window.addEventListener("resize", () => layoutHand(), { signal: ac.signal });

  function hitInto(meldId: number) {
    haptic("select");
    sendAction("hit", { t: "hit", cardIds: [...selected], meldId });
  }

  function fittingMelds() {
    const cards = selectedCards();
    return cards.length && state ? state.melds.filter((m) => canAdd(m, cards)) : [];
  }

  function update(snap: GameSnap<RummyPublic, RummyPrivate>) {
    const receivedAt = performance.now();
    clearPending();
    state = snap.pub;
    me = snap.me;
    if (me) fresh.update(me.hand.map((c) => c.id));
    isHost = snap.room.hostId === pid;
    // Forget selections for cards that left the hand.
    const ids = new Set((me?.hand ?? []).map((c) => c.id));
    selected = new Set([...selected].filter((id) => ids.has(id)));
    if (me?.myTurn && !wasMyTurn && !snap.first) {
      haptic("turn");
      audio.turn();
    }
    wasMyTurn = !!me?.myTurn;
    // A deal (also the opening one, which arrives with the game screen): follow it on the TV.
    const deal = (snap.events as RummyEvent[]).find((e) => e.type === "deal");
    if (deal && deal.type === "deal") followDeal(deal.first, receivedAt);
    if (!snap.first) react(snap.events as RummyEvent[]);
    render();
    if ($("#rm-glance").classList.contains("open")) renderGlance();
  }

  function render() {
    if (!state || !me) return;
    const s = state;
    const m = me;
    document.body.classList.toggle("my-turn", m.myTurn);
    const turnP = s.players.find((p) => p.id === s.turnId);
    let msg: string;
    if (s.phase !== "playing") msg = "Round over";
    else if (m.canDraw) msg = `<b>Your turn!</b> Tap the deck or the discard pile to draw.`;
    else if (m.canPlay)
      msg = m.down
        ? `<b>Your turn.</b> Add cards to groups, then pick one card to discard.`
        : partDown(m)
            ? `<b>Your turn.</b> Lay down the rest of your contract (${esc(contractLabel(m.left))}), or pick one card to discard.`
            : s.parts
              ? `<b>Your turn.</b> Select a set or run from your contract to lay down (one at a time is fine), or pick one card to discard.`
              : `<b>Your turn.</b> Select cards for your contract to lay down, or pick one card to discard.`;
    else msg = turnP ? `${avatar(turnP, "xs")} <b>${esc(turnP.name)}</b>'s turn` : "";
    // Say what the selection makes, so a greyed-out "Lay down" is never a mystery. It takes the
    // message's place up here, so the hand doesn't jump when it appears.
    const cards = selectedCards();
    const cantReturnDiscard = m.canPlay && cards.length === 1 && cards[0]!.id === m.tookFromDiscard && m.hand.length > 1;
    const ev = evalSelected(cards, m, s);
    const contractReady = !m.down && (ev.whole || !!ev.part);
    const hint = cantReturnDiscard
      ? { ok: false, text: "You just picked that card up — pick a different card to discard." }
      : contractReady && m.canDraw
        ? { ok: true, text: `✓ Contract ready! Tap the deck or discard pile to draw first, then lay down.` }
        : contractReady && !m.myTurn
          ? { ok: true, text: `✓ Contract ready! Once it's your turn, draw and tap Lay down (or swipe up).` }
          : ev.hint;

    // Nothing to tap until all my cards have landed.
    const canTake = m.canDraw && !dealing && !pendingAct;
    const canMayI = m.canMayI && !dealing && !pendingAct && !!s.discardTop;
    const armed = canMayI && Date.now() < mayIArmed;
    const asked = s.mayI.includes(pid);
    const discardLabel = canTake
      ? s.discardTop
        ? "Tap to take"
        : "Empty"
      : pendingAct === "draw"
        ? "Drawing…"
        : armed
          ? "Tap again"
          : asked
            ? "May I? ✓"
            : canMayI
              ? `May I? (${m.buysLeft})`
              : "Discard";
    $("#rm-status").innerHTML = `
      <div class="rm-status-text">
        <div class="rm-chip"><small>Round ${s.round}/${s.rounds}</small><b>${esc(s.contractText)}</b>${
          m.down ? `<span class="rm-down">✓ You're down</span>` : partDown(m) ? `<span class="rm-part">Still need ${esc(contractLabel(m.left))}</span>` : ""
        }</div>
        <div class="rm-msg ${hint ? `rm-hint ${hint.ok ? "ok" : ""}` : ""}"><span class="rm-clamp">${hint ? esc(hint.text) : msg}</span></div>
      </div>
      <div class="rm-ph-piles">
        <button class="rm-ph-pile ${canTake ? "live" : ""}" data-pile="stock" aria-label="Deck, ${s.stockCount} cards${canTake ? ". Tap to draw" : ""}">
          ${pcardHtml(null, "rm-ph-top")}<small>${pendingAct === "draw" ? "Drawing…" : canTake ? "Tap to draw" : `Deck · ${s.stockCount}`}</small>
        </button>
        <button class="rm-ph-pile ${canTake || canMayI ? "live" : ""} ${armed ? "armed" : ""}" data-pile="discard" aria-label="Discard pile${s.discardTop ? `, ${shortCard(s.discardTop)} on top` : ", empty"}. ${discardLabel}">
          ${s.discardTop ? pcardHtml(s.discardTop, "rm-ph-top") : `<div class="rm-ph-empty">Empty</div>`}<small>${discardLabel}</small>
        </button>
      </div>`;

    renderHand(false);

    // Action buttons depend on what's selected.
    const lay = $("#rm-lay") as HTMLButtonElement;
    const hit = $("#rm-hit") as HTMLButtonElement;
    const dis = $("#rm-discard") as HTMLButtonElement;
    const playing = m.canPlay;
    const { whole, part } = ev;
    const contractOk = !m.down && (whole || !!part);
    const showDrawFirst = m.canDraw && contractOk;
    lay.hidden = (!playing && !showDrawFirst) || m.down || cards.length < 3;
    lay.disabled = (!contractOk && !showDrawFirst) || !!pendingAct;
    lay.textContent =
      pendingAct === "lay"
        ? "Laying down…"
        : showDrawFirst
          ? "Draw first to lay down"
          : whole
            ? `Lay down ✓ (or swipe up)`
            : part
              ? `Lay down ${contractLabel(part.used)} ✓`
              : `Lay down (${cards.length} selected)`;
    lay.classList.toggle("ready", playing && contractOk && !pendingAct);
    lay.classList.toggle("draw-first", showDrawFirst);
    const fits = playing && m.down ? fittingMelds() : [];
    hit.hidden = !fits.length;
    hit.disabled = !!pendingAct;
    hit.textContent = pendingAct === "hit" ? "Adding…" : fits.length === 1 ? "Add to group" : `Add to a group (${fits.length})`;
    dis.hidden = !playing || cards.length !== 1;
    dis.disabled = !!pendingAct;
    dis.classList.toggle("blocked", cantReturnDiscard);
    dis.textContent = pendingAct === "discard" ? "Discarding…" : "Discard";

    renderResults();
    // The buttons change how much room the hand has: size the cards last (once).
    layoutHand();
  }


  const partDown = (m: RummyPrivate) => !m.down && m.left.sets + m.left.runs < (state?.contract.sets ?? 0) + (state?.contract.runs ?? 0);

  function renderHand(relayout = true) {
    const m = me!;
    $("#rm-tools").innerHTML = arranger.toolbar({ glance: `${icoEye(15)} Table` });
    // Don't yank the cards out from under a finger that's on one (maybe starting a drag).
    if (reorder.holding()) {
      reorder.later(() => me && renderHand(true));
      return;
    }
    const arranged = arranger.arrange(m.hand);
    // Reuse existing elements by ID (like OhNo) so draws/sorts don't rebuild the whole hand.
    const existing = new Map([...hand.querySelectorAll<HTMLElement>(":scope > .pcard")].map((el) => [Number(el.dataset.id), el]));
    const shown = cardsLanded();
    const els = arranged.map((c, i) => {
      let el = existing.get(c.id);
      if (el) {
        // Clear any leftover drag state (reorder uses style.translate).
        el.style.translate = "";
        el.classList.remove("reorder-drag");
      } else {
        el = pcardEl(c, "hand-card");
        el.setAttribute("role", "button");
      }
      // During the deal a card appears when it lands on my board on the TV.
      el.classList.toggle("deal-wait", i >= shown);
      el.classList.toggle("selected", selected.has(c.id));
      el.classList.toggle("just-drew", c.id === m.tookFromDiscard || fresh.isNew(c.id));
      el.setAttribute("aria-pressed", String(selected.has(c.id)));
      return el;
    });
    // Only touch the DOM order when the hand actually changed: calling replaceChildren on
    // unchanged cards detaches and re-inserts every node, which flickers and restarts animations.
    const sameOrder = els.length === hand.children.length && els.every((el, i) => hand.children[i] === el);
    if (!sameOrder) {
      if (!dealing) for (const el of els) el.classList.remove("deal-in");
      hand.replaceChildren(...els);
    }
    // Covers the deferred reorder.later and NewCards paths that call renderHand alone.
    if (relayout) layoutHand();
  }

  /** How many of my cards have landed on the TV so far (all of them when nobody's dealing). */
  function cardsLanded() {
    if (!dealing) return Infinity;
    const t = performance.now() - dealing.start + 20; // timers can fire a hair early
    return dealing.lands.filter((at) => at <= t).length;
  }

  /** Follow the TV's deal: show each of my cards as it lands on my board there (timing in shared/games/rummy/deal.ts). */
  function followDeal(first: string, start: number) {
    for (const t of dealTimers) clearTimeout(t);
    dealTimers = [];
    dealing = null;
    const ps = state?.players ?? [];
    const seat = ps.findIndex((p) => p.id === pid);
    const f = ps.findIndex((p) => p.id === first);
    if (seat < 0 || f < 0 || reducedMotion()) return;
    const each = Math.min(...ps.map((p) => p.count));
    const lands = seatLandings(ps.length, f, each, seat);
    dealing = { start, lands };
    const at = (ms: number) => Math.max(0, ms - (performance.now() - start));
    dealTimers = lands.map((ms, k) =>
      setTimeout(() => {
        const el = hand.children[k] as HTMLElement | undefined;
        if (el?.classList.contains("deal-wait")) {
          el.classList.remove("deal-wait");
          el.classList.add("deal-in");
          el.addEventListener("animationend", () => el.classList.remove("deal-in"), { once: true });
          haptic("select");
        }
      }, at(ms)),
    );
    dealTimers.push(
      setTimeout(() => {
        dealing = null;
        // All my cards are in: show any still hidden, and the draw buttons.
        render();
      }, at((lands.at(-1) ?? 0) + 50)),
    );
  }

  /** Same idea as OhNo!: size cards so the whole hand fits without scrolling. */
  function layoutHand() {
    if (!me || reorder.dragging()) return;
    fitHand(hand, arranger, 120);
  }

  /** A look at the whole table from the phone: everyone's groups, big enough to read. */
  function renderGlance() {
    const s = state;
    if (!s) return;
    $("#rm-glance").innerHTML = `
      <h3>The table</h3>
      <div class="glance-top">
        <span><small>Round ${s.round}/${s.rounds}</small> <b>${esc(s.contractText)}</b></span>
        <span class="glance-discard">${s.discardTop ? pcardHtml(s.discardTop, "glance-card") : ""}<small>Discard<br>${s.stockCount} in deck</small></span>
      </div>
      <div class="glance-players">${s.players
        .map((p) => {
          const melds = s.melds.filter((x) => x.owner === p.id);
          return `<div class="glance-player ${p.id === s.turnId ? "turn" : ""}">
            <div class="glance-who">${avatar(p, "xs")}<b>${p.id === pid ? "You" : esc(p.name)}</b>
              <small>${p.count} card${p.count === 1 ? "" : "s"} · ${p.score} pts</small>
              ${p.down ? `<span class="rm-down">✓ Down</span>` : p.partial ? `<span class="rm-part">Part down</span>` : ""}</div>
            <div class="glance-melds">${
              melds.length
                ? melds.map((x) => `<div class="glance-meld"><span class="rm-kind">${x.kind}</span>${x.cards.map((c) => pcardHtml(c, "glance-card")).join("")}</div>`).join("")
                : `<span class="muted">Nothing down yet</span>`
            }</div>
          </div>`;
        })
        .join("")}</div>
      <button class="btn btn-ghost wide" data-close>Back to my hand</button>`;
  }

  function renderResults() {
    const s = state!;
    const el = $("#rm-results");
    if (s.phase === "playing") {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    const key = `${s.phase}-${s.round}-${isHost}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const over = s.phase === "gameOver";
    const ranked = [...s.players].sort((a, b) => a.score - b.score);
    const mine = s.players.find((p) => p.id === pid);
    const won = over ? ranked[0]?.id === pid : s.roundWinner === pid;
    el.hidden = false;
    el.innerHTML = `
      <div class="ph-lobby-inner">
        <h2>${won ? (over ? "You win! 🏆" : "You went out! 🎉") : over ? `${esc(ranked[0]?.name ?? "")} wins!` : `${name(s.roundWinner ?? "")} went out`}</h2>
        <p class="muted">${over ? "Lowest score wins." : `You picked up ${mine?.roundScores[s.round - 1] ?? 0} points this round. Next: ${esc(s.plan[s.round] ?? "")}`}</p>
        <div class="mini-scores">${ranked.map((p) => `<div>${avatar(p, "xs")}<span class="name">${esc(p.name)}</span><b>${p.score}</b></div>`).join("")}</div>
        ${
          isHost
            ? `<button class="btn btn-primary btn-xl wide" data-gact='{"t":"nextRound"}'>${over ? "Play again" : `Deal round ${s.round + 1}`}</button>
               <button class="btn btn-ghost wide" data-act="endGame">Pick another game</button>`
            : `<p class="muted">Waiting for the host…</p>`
        }
      </div>`;
    if (won) confetti(el, 80);
  }

  function react(events: RummyEvent[]) {
    for (const e of events) {
      if (e.type === "draw" && e.pid === pid) audio.draw(1);
      if (e.type === "discard" && e.pid === pid) audio.cardPlay("normal");
      if (e.type === "down" && e.pid === pid) {
        audio.cardPlay("wild");
        if (e.partial && me) toast(`Part of your contract is down. Lay down the rest (${contractLabel(me.left)}) now or on a later turn.`);
        else toast("You're down! Now add cards to any group to get rid of them.");
      }
      if (e.type === "hit" && e.pid === pid) audio.cardPlay("normal");
      if (e.type === "bought" && e.pid === pid) {
        audio.pop();
        toast(`You got the ${shortCard(e.card)} (+1 card from the deck).`);
      }
      if (e.type === "out" && e.pid === pid) audio.fanfare();
      if (e.type === "deal") {
        selected.clear();
        arranger.reset();
      }
    }
  }

  return {
    update,
    onError() {
      clearPending();
      render();
    },
    hostMenu(snap: GameSnap<RummyPublic>) {
      const s = snap.pub;
      const cur = s.players.find((p) => p.id === s.turnId);
      const skip = s.phase === "playing" && cur && cur.id !== pid ? `<button class="btn btn-ghost wide" data-gact='{"t":"skip"}'>Skip ${esc(cur.name)}'s turn</button>` : "";
      return skip + tableSizeMenu(s.table, [1, 1.5, 2]);
    },
    destroy() {
      clearPending();
      fresh.stop();
      if (mayITimer) clearTimeout(mayITimer);
      for (const t of dealTimers) clearTimeout(t);
      ac.abort();
      document.body.classList.remove("my-turn");
      ctx.el.innerHTML = "";
    },
  };
}
