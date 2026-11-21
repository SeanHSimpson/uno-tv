// OhNo! on a phone: your hand, the pile, OhNo!/Catch, color picker and round results.

import { COLORS, type Card, type Color, type GameEvent, type PrivateState, type PublicState } from "../../../shared/games/ohno/types";
import { audio, haptic } from "../../audio";
import { byColor, byNumber, cardEl, COLOR_NAMES, shapeSvg, shortLabel } from "../../cards";
import { attachReorder, HandArranger, type SortMode } from "../../handArrange";
import { confetti } from "../../fx";
import { $, avatar, esc, fly, reducedMotion, toast } from "../../ui";
import type { GameSnap, GameView, PhoneCtx } from "../types";

export function ohnoPhone(ctx: PhoneCtx): GameView {
  const pid = ctx.pid;
  const ac = new AbortController();
  const on = { signal: ac.signal };
  ctx.el.innerHTML = `
  <div class="ohno-phone">
    <section class="ph-status" id="ph-status"></section>
    <section class="ph-catch" id="ph-catch"></section>
    <section class="hand-toolbar" id="oh-tools"></section>
    <main class="hand" id="hand" aria-label="Your hand"></main>
    <footer class="ph-actions" id="ph-actions">
      <button class="btn btn-ghost" id="btn-draw">Draw</button>
      <button class="btn-ohno" id="btn-ohno" aria-label="Call OhNo!">Oh<span>No!</span></button>
      <button class="btn btn-ghost" id="btn-alt" hidden></button>
    </footer>
    <section class="ph-results overlay" id="ph-results" hidden></section>
    <section class="sheet" id="color-sheet" hidden>
      <h3>Pick a color</h3>
      <div class="color-grid">${COLORS.map(
        (c) => `<button class="color-btn c-${c}" data-color="${c}">${shapeSvg(c, 34)}<span>${COLOR_NAMES[c]}</span></button>`,
      ).join("")}</div>
      <button class="btn btn-ghost wide" data-close>Cancel</button>
    </section>
  </div>`;

  let state: PublicState | null = null;
  let me: PrivateState | null = null;
  let isHost = false;
  let selected: number | null = null;
  let wildPending: number | null = null;
  let prevHandIds = new Set<number>();
  let wasMyTurn = false;
  // Color (today's sort), Number, or Free (drag cards sideways to arrange them yourself).
  const arranger = new HandArranger<Card>(
    "ohno",
    { suit: byColor, rank: byNumber },
    { defaultMode: "suit", modes: ["suit", "rank", "free"], labels: { suit: "Color", rank: "Number" } },
  );
  const send = ctx.send;
  const playerName = (id: string | null) => state?.players.find((p) => p.id === id)?.name ?? "someone";

  function update(snap: GameSnap<PublicState, PrivateState>) {
    const prev = state;
    state = snap.pub;
    me = snap.me;
    isHost = snap.room.hostId === pid;
    if (!me) return;
    if (selected !== null && !me.playable.includes(selected)) selected = null;
    const myTurn = state.turnId === pid;
    if (myTurn && !wasMyTurn && !snap.first) {
      haptic("turn");
      audio.turn();
      flashTurn();
    }
    wasMyTurn = myTurn;
    if (!snap.first) animateOut(snap.events as GameEvent[]);
    render(prev);
  }

  // ---------- actions ----------

  $("#btn-draw").addEventListener("click", () => send({ t: "draw" }));
  $("#btn-ohno").addEventListener("click", () => {
    send({ t: "ohno" });
    haptic("ohno");
    audio.ohno(true);
  });
  $("#btn-alt").addEventListener("click", () => {
    if (me?.canPass) send({ t: "pass" });
    else if (me?.canTake) send({ t: "take" });
  });
  $("#color-sheet").addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".color-btn");
    if (btn && wildPending !== null) {
      send({ t: "play", cardId: wildPending, color: btn.dataset.color as Color });
      wildPending = null;
      selected = null;
      ctx.closeSheets();
    }
  });

  /** Try to play a card. `confirm` = the deliberate gesture (second tap or a swipe). Returns true if sent. */
  function attempt(el: HTMLElement, confirm: boolean): boolean {
    if (!me || !state) return false;
    const id = Number(el.dataset.id);
    const card = me.hand.find((c) => c.id === id);
    if (!card) return false;
    if (state.turnId !== pid) {
      toast(`Hang on — it's ${playerName(state.turnId)}'s turn.`);
      return false;
    }
    if (!me.playable.includes(id)) {
      el.animate([{ translate: "0" }, { translate: "-6px" }, { translate: "6px" }, { translate: "0" }], { duration: 220 });
      haptic("error");
      audio.error();
      toast(state.pendingDraw ? `Stack a draw card or take +${state.pendingDraw}.` : me.drawnCardId !== null ? "Play the card you drew, or keep it." : "That one doesn't match.");
      return false;
    }
    if (!confirm) {
      selected = id;
      haptic("select");
      audio.tick();
      renderHand();
      return false;
    }
    if (card.color === "wild") {
      selected = id;
      wildPending = id;
      ctx.openSheet($("#color-sheet"));
      return false;
    }
    send({ t: "play", cardId: id });
    return true;
  }

  const hand = $("#hand");
  let suppressClick = false;
  $("#oh-tools").addEventListener(
    "click",
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-sort]");
      if (!b) return;
      arranger.setMode(b.dataset.sort as SortMode);
      haptic("select");
      renderHand();
    },
    on,
  );
  // Sideways drag = rearrange (up = swipe to play, below). The first direction decides.
  const reorder = attachReorder(hand, {
    signal: ac.signal,
    selector: ".card",
    canStart: (dx, dy) => !drag?.active && Math.abs(dx) > Math.abs(dy),
    onDrop: (ids) => {
      arranger.setOrder(ids);
      haptic("select");
      renderHand();
    },
  });
  hand.addEventListener("click", (e) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const el = (e.target as HTMLElement).closest<HTMLElement>(".card");
    if (el) attempt(el, selected === Number(el.dataset.id));
  });

  // Swipe a card up (toward the TV) to play it.
  let drag: { el: HTMLElement; x0: number; y0: number; pointer: number; active: boolean } | null = null;
  hand.addEventListener("pointerdown", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".card");
    if (el && e.isPrimary) drag = { el, x0: e.clientX, y0: e.clientY, pointer: e.pointerId, active: false };
  });
  window.addEventListener(
    "pointermove",
    (e) => {
      if (!drag || e.pointerId !== drag.pointer) return;
      if (reorder.dragging()) return void (drag = null);
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.active) {
        if (dy > -12 || Math.abs(dy) < Math.abs(dx)) return;
        drag.active = true;
        drag.el.classList.add("dragging");
      }
      const lift = Math.min(0, dy);
      drag.el.style.transform = `translate(${dx * 0.6}px, ${lift}px) rotate(${dx / 14}deg) scale(1.08)`;
      drag.el.classList.toggle("will-play", lift < -swipeDistance());
    },
    on,
  );
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 350);
    d.el.classList.remove("dragging", "will-play");
    const far = e.type === "pointerup" && e.clientY - d.y0 < -swipeDistance();
    if (far && attempt(d.el, true)) {
      d.el.classList.add("sent"); // stays where the finger let go until the play lands
      haptic("play");
      return;
    }
    d.el.style.transform = "";
  };
  window.addEventListener("pointerup", endDrag, on);
  window.addEventListener("pointercancel", endDrag, on);
  window.addEventListener("resize", () => layoutHand(), on);
  const swipeDistance = () => Math.min(110, hand.clientHeight * 0.16);

  // ---------- rendering ----------

  function render(prev: PublicState | null) {
    if (!state || !me) return;
    const s = state;
    const myTurn = s.turnId === pid;
    document.body.classList.toggle("my-turn", myTurn);

    const topCard = s.discard[s.discard.length - 1];
    const turnP = s.players.find((p) => p.id === s.turnId);
    let msg = "";
    if (s.phase === "playing") {
      if (myTurn) {
        msg = s.pendingDraw
          ? `<b>Your turn!</b> Stack a draw card or take +${s.pendingDraw}`
          : me.drawnCardId !== null
            ? `<b>You drew a playable card.</b> Play it or keep it`
            : `<b>Your turn!</b> Swipe a card up to play it (or tap twice)`;
      } else if (turnP) msg = `${avatar(turnP, "xs")} <b>${esc(turnP.name)}</b>'s turn`;
    }
    $("#ph-status").innerHTML =
      s.phase === "playing" && topCard
        ? `<div class="ph-top-card c-${s.color}" id="ph-top-card">${cardEl(topCard, "mini").outerHTML}<span class="ph-color">${shapeSvg(s.color!, 16)} ${COLOR_NAMES[s.color!]}</span></div>
           <div class="ph-msg">${msg}</div>`
        : "";

    // Catch buttons for anyone who forgot to call.
    const vul = s.vulnerable && s.vulnerable !== pid ? s.players.find((p) => p.id === s.vulnerable) : null;
    $("#ph-catch").innerHTML = vul
      ? `<button class="btn btn-catch" data-gact='${JSON.stringify({ t: "catch", target: vul.id })}'>🫵 Catch ${esc(vul.name)}! They didn't say OhNo!</button>`
      : turnP && !turnP.connected && turnP.id !== pid && s.phase === "playing"
        ? `<button class="btn btn-ghost wide skip-offline" data-gact='{"t":"skip"}'>${esc(turnP.name)}'s phone disconnected — skip their turn</button>`
        : "";
    if (vul && prev?.vulnerable !== s.vulnerable) haptic("select");

    renderHand();
    renderActions();
    renderResults();
    // The action bar can appear or disappear: size the cards last.
    layoutHand();
  }

  function renderActions() {
    const s = state!;
    const m = me!;
    const playing = s.phase === "playing";
    $("#ph-actions").hidden = !playing;
    const draw = $("#btn-draw") as HTMLButtonElement;
    draw.disabled = !m.canDraw;
    draw.hidden = m.canPass || m.canTake;
    const alt = $("#btn-alt") as HTMLButtonElement;
    alt.hidden = !(m.canPass || m.canTake);
    alt.textContent = m.canPass ? "Keep it" : m.canTake ? `Take +${s.pendingDraw}` : "";
    alt.classList.toggle("btn-danger", m.canTake);
    const self = s.players.find((p) => p.id === pid)!;
    const ohno = $("#btn-ohno") as HTMLButtonElement;
    const canCall = playing && !self.calledOhNo && (m.hand.length === 1 || (m.hand.length === 2 && s.turnId === pid));
    ohno.disabled = !canCall;
    ohno.classList.toggle("urgent", canCall);
    ohno.classList.toggle("called", self.calledOhNo && m.hand.length <= 1);
  }

  function renderHand() {
    const s = state!;
    const m = me!;
    if (s.phase !== "playing") {
      hand.innerHTML = "";
      prevHandIds = new Set();
      return;
    }
    $("#oh-tools").innerHTML = arranger.toolbar({ fan: false });
    // Don't swap the cards out from under a finger that's on one (maybe starting a drag).
    if (reorder.holding()) {
      reorder.later(() => state && me && renderHand());
      return;
    }
    const sorted = arranger.arrange(m.hand);
    const myTurn = s.turnId === pid;
    const existing = new Map([...hand.children].map((c) => [Number((c as HTMLElement).dataset.id), c as HTMLElement]));
    const fresh: HTMLElement[] = [];
    hand.replaceChildren(
      ...sorted.map((card) => {
        let el = existing.get(card.id);
        if (el && !el.classList.contains("dragging")) {
          el.style.transform = "";
          el.classList.remove("sent");
        }
        if (!el) {
          el = cardEl(card, "hand-card");
          if (!prevHandIds.has(card.id) && prevHandIds.size) fresh.push(el);
        }
        const playable = m.playable.includes(card.id);
        el.classList.toggle("playable", myTurn && playable);
        el.classList.toggle("dim", myTurn && !playable);
        el.classList.toggle("selected", selected === card.id);
        el.classList.toggle("just-drew", m.drawnCardId === card.id);
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", `${shortLabel(card)}${playable ? ", playable" : ""}`);
        el.dataset.hint = selected === card.id ? (card.color === "wild" ? "Tap to pick color" : "Tap or swipe up") : "";
        return el;
      }),
    );
    prevHandIds = new Set(m.hand.map((c) => c.id));
    layoutHand();
    if (!reducedMotion())
      fresh.forEach((el, i) =>
        el.animate([{ transform: "translateY(-60vh) rotate(-12deg)", opacity: 0 }, { transform: "none", opacity: 1 }], {
          duration: 450,
          delay: i * 90,
          easing: "cubic-bezier(.2,.8,.25,1)",
          fill: "backwards",
        }),
      );
  }

  /** Size cards so the whole hand always fits on screen, no scrolling. */
  function layoutHand() {
    if (!me) return;
    const n = Math.max(1, me.hand.length);
    // Measure the space inside the padding (selected cards also lift a little).
    const cs = getComputedStyle(hand);
    const W = hand.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
    const H = hand.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 14;
    const gap = n > 12 ? 4 : 8;
    let best = { w: 0, cols: 1 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows / 1.5);
      if (w > best.w) best = { w, cols };
    }
    const w = Math.min(best.w, 150, W / 2.4);
    hand.style.setProperty("--cw", `${Math.floor(w)}px`);
    hand.style.setProperty("--cols", String(best.cols));
    hand.style.setProperty("--gap", `${gap}px`);
  }

  function renderResults() {
    const s = state!;
    const el = $("#ph-results");
    if (s.phase !== "roundOver") {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    const key = `${s.round}-${isHost}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const won = s.roundWinner === pid;
    const ranked = [...s.players].sort((a, b) => b.score - a.score);
    el.hidden = false;
    el.innerHTML = `
      <div class="ph-lobby-inner">
        <h2>${won ? (s.gameWinner ? "You win! 🏆" : "You went out! 🎉") : `${esc(playerName(s.roundWinner))} ${s.gameWinner ? "wins!" : "went out"}`}</h2>
        <p class="muted">+${s.roundPoints} points</p>
        <div class="mini-scores">${ranked.map((p) => `<div>${avatar(p, "xs")}<span class="name">${esc(p.name)}</span><b>${p.score}</b></div>`).join("")}</div>
        ${
          isHost
            ? `<button class="btn btn-primary btn-xl wide" data-gact='{"t":"nextRound"}'>${s.gameWinner ? "Play again" : "Deal next round"}</button>
               <button class="btn btn-ghost wide" data-act="endGame">Pick another game</button>`
            : `<p class="muted">Waiting for the host…</p>`
        }
      </div>`;
    if (won) confetti(el, 80);
  }

  function animateOut(events: GameEvent[]) {
    for (const e of events) {
      if (e.type === "play" && e.pid === pid) {
        const v = e.card.value;
        audio.cardPlay(v === "draw2" || v === "wild4" ? "draw" : v === "wild" ? "wild" : "normal");
      }
      if (e.type === "draw" && e.pid === pid && e.count && e.reason !== "join") audio.draw(e.count);
      if (e.type === "caught" && e.pid === pid) {
        audio.caught();
        haptic("caught");
      }
      if (e.type === "caught" && e.by === pid) audio.pop();
      if (e.type === "roundOver" && e.winner === pid) audio.fanfare();
    }
    if (reducedMotion()) return;
    for (const e of events) {
      if (e.type === "play" && e.pid === pid) {
        const el = document.querySelector<HTMLElement>(`#hand .card[data-id="${e.card.id}"]`);
        const target = document.getElementById("ph-top-card")?.getBoundingClientRect();
        if (el && target) {
          const from = el.getBoundingClientRect();
          const to = new DOMRect(target.left, target.top, target.height / 1.5, target.height);
          fly(cardEl(e.card), from, to, { duration: 420 });
        }
      }
      if (e.type === "caught" && e.pid === pid) toast(`Caught! You forgot to say OhNo! (+${e.count})`, "error");
      if (e.type === "caught" && e.by === pid) toast(`Gotcha! ${playerName(e.pid)} draws ${e.count}.`);
      if (e.type === "draw" && e.pid === pid && e.reason === "auto") toast(`Nothing to play — drew ${e.count === 1 ? "a card" : `${e.count} cards`}.`);
      if (e.type === "draw" && e.pid === pid && e.reason === "penalty") toast(`Ouch! +${e.count}`, "error");
    }
  }

  function flashTurn() {
    const el = document.createElement("div");
    el.className = "turn-flash";
    el.textContent = "Your turn!";
    document.body.append(el);
    setTimeout(() => el.remove(), 1300);
  }

  return {
    update,
    hostMenu(snap: GameSnap<PublicState>) {
      const s = snap.pub;
      const cur = s.players.find((p) => p.id === s.turnId);
      return s.phase === "playing" && cur && cur.id !== pid
        ? `<button class="btn btn-ghost wide" data-gact='{"t":"skip"}'>Skip ${esc(cur.name)}'s turn</button>`
        : "";
    },
    onError: resetSwipedCards,
    destroy() {
      ac.abort();
      document.body.classList.remove("my-turn");
      ctx.el.innerHTML = "";
    },
  };
}

/** Called by the shell when an action is refused, so a swiped card snaps back. */
export function resetSwipedCards() {
  document.querySelectorAll<HTMLElement>("#hand .card.sent").forEach((el) => {
    el.classList.remove("sent");
    el.style.transform = "";
  });
}
