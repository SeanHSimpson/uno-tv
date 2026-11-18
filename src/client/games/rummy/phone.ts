// Contract Rummy on a phone: draw, pick cards, lay down, add to groups, discard.

import { canAdd, findContract, type PCard } from "../../../shared/games/rummy/cards";
import type { RummyEvent, RummyPrivate, RummyPublic } from "../../../shared/games/rummy/engine";
import { selectionHint } from "../../../shared/games/rummy/hint";
import { audio, haptic } from "../../audio";
import { confetti } from "../../fx";
import { pcardEl, pcardHtml, shortCard } from "../../playingCards";
import { $, avatar, esc, toast } from "../../ui";
import type { GameSnap, GameView, PhoneCtx } from "../types";

export function rummyPhone(ctx: PhoneCtx): GameView {
  const pid = ctx.pid;
  const ac = new AbortController();
  let state: RummyPublic | null = null;
  let me: RummyPrivate | null = null;
  let isHost = false;
  let selected = new Set<number>();
  let sortBy: "rank" | "suit" = "rank";
  let wasMyTurn = false;

  ctx.el.innerHTML = `
  <div class="rummy-phone">
    <section class="rm-status" id="rm-status"></section>
    <section class="rm-drawbar" id="rm-drawbar" hidden>
      <button class="btn btn-primary" id="rm-draw-stock">Draw from deck</button>
      <button class="btn btn-ghost" id="rm-draw-discard"></button>
    </section>
    <section class="rm-mayibar" id="rm-mayibar" hidden><button class="btn btn-ghost wide" id="rm-mayi"></button></section>
    <main class="hand rm-hand" id="rm-hand" aria-label="Your hand"></main>
    <p class="rm-hint" id="rm-hint" hidden></p>
    <footer class="rm-actions" id="rm-actions">
      <button class="btn btn-ghost rm-sort" id="rm-sort">Sort: rank</button>
      <button class="btn btn-primary" id="rm-lay" hidden></button>
      <button class="btn btn-ghost" id="rm-hit" hidden></button>
      <button class="btn btn-danger" id="rm-discard" hidden>Discard</button>
    </footer>
    <section class="sheet" id="rm-hit-sheet" hidden></section>
    <section class="ph-results overlay" id="rm-results" hidden></section>
  </div>`;

  const send = ctx.send;
  const hand = $("#rm-hand");
  const name = (id: string) => esc(state?.players.find((p) => p.id === id)?.name ?? "someone");
  const selectedCards = (): PCard[] => (me?.hand ?? []).filter((c) => selected.has(c.id));

  $("#rm-draw-stock").addEventListener("click", () => send({ t: "draw", from: "stock" }));
  $("#rm-draw-discard").addEventListener("click", () => send({ t: "draw", from: "discard" }));
  $("#rm-mayi").addEventListener("click", () => {
    send({ t: "mayI" });
    haptic("select");
  });
  $("#rm-sort").addEventListener("click", () => {
    sortBy = sortBy === "rank" ? "suit" : "rank";
    render();
  });
  hand.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".pcard");
    if (!el) return;
    const id = Number(el.dataset.id);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    haptic("select");
    audio.tick();
    render();
  });
  $("#rm-lay").addEventListener("click", () => send({ t: "layDown", cardIds: [...selected] }));
  $("#rm-discard").addEventListener("click", () => {
    const [id] = [...selected];
    if (id !== undefined) send({ t: "discard", cardId: id });
  });
  $("#rm-hit").addEventListener("click", () => {
    const fits = fittingMelds();
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
  });
  $("#rm-hit-sheet").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-meld]");
    if (b) {
      hitInto(Number(b.dataset.meld));
      ctx.closeSheets();
    }
  });
  window.addEventListener("resize", () => layoutHand(), { signal: ac.signal });

  function hitInto(meldId: number) {
    send({ t: "hit", cardIds: [...selected], meldId });
  }

  function fittingMelds() {
    const cards = selectedCards();
    return cards.length && state ? state.melds.filter((m) => canAdd(m, cards)) : [];
  }

  function update(snap: GameSnap<RummyPublic, RummyPrivate>) {
    state = snap.pub;
    me = snap.me;
    isHost = snap.room.hostId === pid;
    // Forget selections for cards that left the hand.
    const ids = new Set((me?.hand ?? []).map((c) => c.id));
    selected = new Set([...selected].filter((id) => ids.has(id)));
    if (me?.myTurn && !wasMyTurn && !snap.first) {
      haptic("turn");
      audio.turn();
    }
    wasMyTurn = !!me?.myTurn;
    if (!snap.first) react(snap.events as RummyEvent[]);
    render();
  }

  function render() {
    if (!state || !me) return;
    const s = state;
    const m = me;
    document.body.classList.toggle("my-turn", m.myTurn);
    const turnP = s.players.find((p) => p.id === s.turnId);
    let msg: string;
    if (s.phase !== "playing") msg = "Round over";
    else if (m.canDraw) msg = `<b>Your turn!</b> Draw from the deck or take the discard.`;
    else if (m.canPlay)
      msg = m.down
        ? `<b>Your turn.</b> Add cards to groups, then pick one card to discard.`
        : s.finalRound
          ? `<b>Your turn.</b> To go out, select your whole hand and lay down 3 runs. Otherwise discard one card.`
          : `<b>Your turn.</b> Select cards for your contract to lay down, or pick one card to discard.`;
    else msg = turnP ? `${avatar(turnP, "xs")} <b>${esc(turnP.name)}</b>'s turn` : "";
    $("#rm-status").innerHTML = `
      <div class="rm-status-text">
        <div class="rm-chip"><small>Round ${s.round}/${s.rounds}</small><b>${esc(s.contractText)}</b>${m.down ? `<span class="rm-down">✓ You're down</span>` : ""}</div>
        <div class="rm-msg">${msg}</div>
      </div>
      <div class="rm-ph-discard" aria-label="Top of the discard pile">
        ${s.discardTop ? pcardHtml(s.discardTop, "rm-ph-top") : `<div class="rm-ph-empty">Empty</div>`}
        <small>Discard · ${s.stockCount} in deck</small>
      </div>`;

    $("#rm-drawbar").hidden = !m.canDraw;
    const takeBtn = $("#rm-draw-discard") as HTMLButtonElement;
    takeBtn.disabled = !s.discardTop;
    takeBtn.innerHTML = s.discardTop ? `Take the ${shortCard(s.discardTop)}` : "Discard pile empty";
    $("#rm-mayibar").hidden = !m.canMayI;
    $("#rm-mayi").innerHTML = s.discardTop ? `🙋 May I? Take the ${shortCard(s.discardTop)} (+1 penalty card, ${m.buysLeft} left)` : "";

    renderHand();

    // Action buttons depend on what's selected.
    const cards = selectedCards();
    const lay = $("#rm-lay") as HTMLButtonElement;
    const hit = $("#rm-hit") as HTMLButtonElement;
    const dis = $("#rm-discard") as HTMLButtonElement;
    const playing = m.canPlay;
    const contractOk = !m.down && cards.length > 0 && !!findContract(cards, s.contract, true) && (!s.finalRound || cards.length === m.hand.length);
    lay.hidden = !playing || m.down || cards.length < 3;
    lay.disabled = !contractOk;
    lay.textContent = contractOk ? `Lay down ✓` : `Lay down (${cards.length} selected)`;
    lay.classList.toggle("ready", contractOk);
    const fits = playing && m.down && !s.finalRound ? fittingMelds() : [];
    hit.hidden = !fits.length;
    hit.textContent = fits.length === 1 ? "Add to group" : `Add to a group (${fits.length})`;
    dis.hidden = !playing || cards.length !== 1;
    dis.disabled = cards.length === 1 && cards[0]!.id === m.tookFromDiscard && m.hand.length > 1;
    $("#rm-sort").textContent = `Sort: ${sortBy}`;

    // Say what the selection makes, so a greyed-out "Lay down" is never a mystery.
    const hintEl = $("#rm-hint");
    const hint = !m.down && s.phase === "playing" ? selectionHint(cards, s.contract, { final: s.finalRound, handSize: m.hand.length }) : null;
    hintEl.hidden = !hint;
    if (hint) {
      hintEl.textContent = hint.text;
      hintEl.classList.toggle("ok", hint.ok);
    }
    renderResults();
    // The hint and buttons change how much room the hand has: size the cards last.
    layoutHand();
  }


  function sorted(cards: PCard[]) {
    const rankOf = (c: PCard) => c.rank || 99;
    return [...cards].sort((a, b) =>
      sortBy === "rank"
        ? rankOf(a) - rankOf(b) || (a.suit ?? "z").localeCompare(b.suit ?? "z")
        : (a.suit ?? "z").localeCompare(b.suit ?? "z") || rankOf(a) - rankOf(b),
    );
  }

  function renderHand() {
    const m = me!;
    hand.replaceChildren(
      ...sorted(m.hand).map((c) => {
        const el = pcardEl(c, "hand-card");
        el.classList.toggle("selected", selected.has(c.id));
        el.classList.toggle("just-drew", c.id === m.tookFromDiscard);
        el.setAttribute("role", "button");
        el.setAttribute("aria-pressed", String(selected.has(c.id)));
        return el;
      }),
    );
    layoutHand();
  }

  /** Same idea as OhNo!: size cards so the whole hand fits without scrolling. */
  function layoutHand() {
    if (!me) return;
    const n = Math.max(1, me.hand.length);
    // Measure the space inside the padding (selected cards also lift a little).
    const cs = getComputedStyle(hand);
    const W = hand.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
    const H = hand.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 14;
    const gap = n > 12 ? 4 : 6;
    let best = { w: 0, cols: 1 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows / 1.5);
      if (w > best.w) best = { w, cols };
    }
    hand.style.setProperty("--cw", `${Math.floor(Math.min(best.w, 120))}px`);
    hand.style.setProperty("--cols", String(best.cols));
    hand.style.setProperty("--gap", `${gap}px`);
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
        toast("You're down! Now add cards to any group to get rid of them.");
      }
      if (e.type === "hit" && e.pid === pid) audio.cardPlay("normal");
      if (e.type === "bought" && e.pid === pid) {
        audio.pop();
        toast(`You got the ${shortCard(e.card)} (+1 card from the deck).`);
      }
      if (e.type === "out" && e.pid === pid) audio.fanfare();
      if (e.type === "deal") selected.clear();
    }
  }

  return {
    update,
    hostMenu(snap: GameSnap<RummyPublic>) {
      const s = snap.pub;
      const cur = s.players.find((p) => p.id === s.turnId);
      return s.phase === "playing" && cur && cur.id !== pid ? `<button class="btn btn-ghost wide" data-gact='{"t":"skip"}'>Skip ${esc(cur.name)}'s turn</button>` : "";
    },
    destroy() {
      ac.abort();
      document.body.classList.remove("my-turn");
      ctx.el.innerHTML = "";
    },
  };
}
