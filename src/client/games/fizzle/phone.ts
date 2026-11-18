// Fizzle! on a phone: your action cards, the big Draw button, a warning when a
// firecracker is lit in front of you, a target picker for Toss, and what Peek showed.

import type { FizzleEvent, FizzlePrivate, FizzlePublic } from "../../../shared/games/fizzle/engine";
import { CARD_INFO } from "../../../shared/games/fizzle/engine";
import { audio, haptic } from "../../audio";
import { confetti } from "../../fx";
import { $, avatar, esc, toast } from "../../ui";
import type { GameSnap, GameView, PhoneCtx } from "../types";
import { fcardHtml, litHtml } from "./common";

export function fizzlePhone(ctx: PhoneCtx): GameView {
  const pid = ctx.pid;
  let state: FizzlePublic | null = null;
  let me: FizzlePrivate | null = null;
  let isHost = false;
  let selected: number | null = null;
  let wasMyTurn = false;
  ctx.el.innerHTML = `
  <div class="fizzle-phone">
    <section class="fz-status" id="fz-status"></section>
    <section class="fz-alert" id="fz-alert" hidden></section>
    <section class="fz-peek" id="fz-peek" hidden></section>
    <main class="fz-hand" id="fz-hand" aria-label="Your cards"></main>
    <footer class="fz-actions">
      <button class="btn btn-ghost" id="fz-play" hidden></button>
      <button class="btn btn-primary btn-xl" id="fz-draw">Draw a card</button>
    </footer>
    <section class="sheet" id="fz-toss-sheet" hidden></section>
    <section class="ph-results overlay" id="fz-results" hidden></section>
  </div>`;
  const send = ctx.send;
  const hand = $("#fz-hand");

  hand.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".fcard");
    if (!el || !me) return;
    const id = Number(el.dataset.id);
    selected = selected === id ? null : id;
    haptic("select");
    audio.tick();
    render();
  });
  $("#fz-play").addEventListener("click", () => {
    const card = me?.hand.find((c) => c.id === selected);
    if (!card) return;
    if (card.kind === "toss") return openToss();
    send({ t: "play", cardId: card.id });
    selected = null;
  });
  $("#fz-draw").addEventListener("click", () => {
    send({ t: "draw" });
    haptic("play");
  });
  $("#fz-toss-sheet").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-target]");
    if (!b || selected === null) return;
    send({ t: "play", cardId: selected, target: b.dataset.target });
    selected = null;
    ctx.closeSheets();
  });

  function openToss() {
    const targets = (state?.players ?? []).filter((p) => p.id !== pid && !p.out && !p.waiting);
    const sheet = $("#fz-toss-sheet");
    sheet.innerHTML = `<h3>Toss it to…</h3>
      <div class="fz-targets">${targets
        .map((p) => `<button class="fz-target" data-target="${esc(p.id)}">${avatar(p)}<span>${esc(p.name)}</span><small>${p.count} cards${p.lit.length ? " · already has one 🧨" : ""}</small></button>`)
        .join("")}</div>
      <button class="btn btn-ghost wide" data-close>Cancel</button>`;
    ctx.openSheet(sheet);
  }

  function update(snap: GameSnap<FizzlePublic, FizzlePrivate>) {
    const prev = me;
    state = snap.pub;
    me = snap.me;
    isHost = snap.room.hostId === pid;
    if (me && selected !== null && !me.hand.some((c) => c.id === selected)) selected = null;
    if (me?.myTurn && !wasMyTurn && !snap.first) {
      haptic(me.lit.length ? "caught" : "turn");
      audio.turn();
    }
    wasMyTurn = !!me?.myTurn;
    if (!snap.first) react(snap.events as FizzleEvent[], prev);
    render();
  }

  function render() {
    if (!state || !me) return;
    const s = state;
    const m = me;
    document.body.classList.toggle("my-turn", m.myTurn);
    const cur = s.players.find((p) => p.id === s.turnId);
    let msg: string;
    if (m.out) msg = "💥 You're out. Cheer from the sidelines!";
    else if (m.waiting) msg = "You'll be dealt in next game.";
    else if (s.phase === "over") msg = "Game over";
    else if (m.myTurn) msg = `<b>Your turn.</b> Play any cards you like, then draw.`;
    else msg = cur ? `${avatar(cur, "xs")} <b>${esc(cur.name)}</b>'s turn` : "";
    $("#fz-status").innerHTML = `<div class="fz-msg">${msg}</div><div class="fz-deckinfo"><b>${s.deckCount}</b> in deck<br><span class="fz-danger">🧨 × ${s.crackersInDeck}</span></div>`;

    const alert = $("#fz-alert");
    alert.hidden = !m.lit.length || m.out;
    if (m.lit.length) {
      const urgent = m.lit.some((f) => f <= 1);
      alert.className = `fz-alert ${urgent ? "urgent" : ""}`;
      alert.innerHTML = `${litHtml(m.lit)}<div>${
        urgent ? "<b>Your firecracker is about to go off!</b> Douse it with 💧 Water or 🤾 Toss it this turn." : "<b>Your firecracker is lit!</b> On your next turn, douse it or toss it."
      }</div>`;
    }

    const peek = $("#fz-peek");
    peek.hidden = !m.peek?.length || !!m.out;
    if (m.peek?.length) peek.innerHTML = `<small>👀 Top of the deck (you peeked)</small><div class="fz-peek-cards">${m.peek.map((c, i) => `<div class="fz-peek-slot"><em>${i === 0 ? "Next" : i + 1}</em>${fcardHtml(c, "fz-small")}</div>`).join("")}</div>`;

    hand.innerHTML = m.hand.length
      ? m.hand
          .map((c) => {
            const needsLit = c.kind === "water" || c.kind === "toss";
            const usable = m.myTurn && (!needsLit || m.lit.length > 0);
            return fcardHtml(c, `${selected === c.id ? "selected" : ""} ${m.myTurn && !usable ? "dim" : ""}`);
          })
          .join("")
      : `<p class="muted">${m.out ? "" : "No cards in hand."}</p>`;

    const card = m.hand.find((c) => c.id === selected);
    const play = $("#fz-play") as HTMLButtonElement;
    play.hidden = !card || !m.myTurn;
    if (card) {
      const needsLit = card.kind === "water" || card.kind === "toss";
      play.disabled = needsLit && !m.lit.length;
      play.textContent = `Play ${CARD_INFO[card.kind].emoji} ${CARD_INFO[card.kind].name}`;
    }
    const draw = $("#fz-draw") as HTMLButtonElement;
    draw.hidden = m.out || m.waiting || s.phase !== "playing";
    draw.disabled = !m.myTurn;
    draw.textContent = m.myTurn ? (m.lit.some((f) => f <= 1) ? "Draw (and hope 😬)" : "Draw a card") : "Waiting…";
    renderResults();
  }

  function renderResults() {
    const s = state!;
    const el = $("#fz-results");
    if (s.phase !== "over") {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    const key = `${s.winner}-${isHost}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const won = s.winner === pid;
    const w = s.players.find((p) => p.id === s.winner);
    el.hidden = false;
    el.innerHTML = `
      <div class="ph-lobby-inner">
        <div class="hush-big-emoji">${won ? "🏆" : "💥"}</div>
        <h2>${won ? "Last one standing: you!" : `${esc(w?.name ?? "Nobody")} wins!`}</h2>
        ${
          isHost
            ? `<button class="btn btn-primary btn-xl wide" data-gact='{"t":"restart"}'>Play again</button>
               <button class="btn btn-ghost wide" data-act="endGame">Pick another game</button>`
            : `<p class="muted">Waiting for the host…</p>`
        }
      </div>`;
    if (won) confetti(el, 80);
  }

  function react(events: FizzleEvent[], prev: FizzlePrivate | null) {
    for (const e of events) {
      if (e.type === "lit" && e.pid === pid) {
        audio.hiss();
        haptic("caught");
        toast("🧨 You drew a firecracker! Deal with it on your next turn.", "error");
      }
      if (e.type === "toss" && e.target === pid) {
        audio.hiss();
        haptic("caught");
        toast(`🧨 ${esc(state?.players.find((p) => p.id === e.pid)?.name ?? "Someone")} tossed you a firecracker!`, "error");
      }
      if (e.type === "douse" && e.pid === pid) audio.splash();
      if (e.type === "boom") {
        audio.boom();
        if (e.pid === pid) haptic("caught");
      }
      if (e.type === "won" && e.pid === pid) audio.fanfare();
      if (e.type === "draw" && e.pid === pid && prev) audio.draw(1);
    }
  }

  return {
    update,
    hostMenu(snap: GameSnap<FizzlePublic>) {
      const s = snap.pub;
      const cur = s.players.find((p) => p.id === s.turnId);
      return s.phase === "playing" && cur && cur.id !== pid ? `<button class="btn btn-ghost wide" data-gact='{"t":"skip"}'>Make ${esc(cur.name)} draw (skip their turn)</button>` : "";
    },
    destroy() {
      document.body.classList.remove("my-turn");
      ctx.el.innerHTML = "";
    },
  };
}
