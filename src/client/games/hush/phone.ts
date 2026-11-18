// Hush on a phone: your numbers, one big button, and the star.

import type { HushEvent, HushPrivate, HushPublic } from "../../../shared/games/hush/engine";
import { audio, haptic } from "../../audio";
import { confetti } from "../../fx";
import { $, toast } from "../../ui";
import type { GameSnap, GameView, PhoneCtx } from "../types";
import { hearts, numCard, pitchFor, stars } from "./common";

export function hushPhone(ctx: PhoneCtx): GameView {
  const pid = ctx.pid;
  const ac = new AbortController();
  let state: HushPublic | null = null;
  let me: HushPrivate | null = null;
  let isHost = false;
  ctx.el.innerHTML = `
  <div class="hush-phone">
    <div class="hush-ph-top" id="hush-top"></div>
    <div class="hush-ph-last" id="hush-last"></div>
    <div class="hush-ph-hand" id="hush-hand" aria-label="Your numbers"></div>
    <div class="hush-ph-actions">
      <button class="btn btn-primary btn-xl wide hush-go" id="hush-go"></button>
      <button class="btn btn-ghost wide" id="hush-star" hidden></button>
    </div>
    <section class="ph-results overlay" id="hush-results" hidden></section>
  </div>`;

  const send = ctx.send;
  $("#hush-go").addEventListener("click", () => {
    if (!state || !me) return;
    if (state.phase === "ready") {
      send({ t: "ready" });
      haptic("select");
    } else if (me.canPlay) playNow();
  });
  $("#hush-star").addEventListener("click", () => {
    send({ t: "star" });
    haptic("select");
  });

  function playNow() {
    send({ t: "play" });
    haptic("play");
  }

  // Swipe up anywhere on your cards to play the lowest one.
  let y0: number | null = null;
  const handEl = $("#hush-hand");
  handEl.addEventListener("pointerdown", (e) => (y0 = e.clientY), { signal: ac.signal });
  window.addEventListener(
    "pointerup",
    (e) => {
      if (y0 !== null && e.clientY - y0 < -60 && me?.canPlay) playNow();
      y0 = null;
    },
    { signal: ac.signal },
  );

  function update(snap: GameSnap<HushPublic, HushPrivate>) {
    const prev = state;
    state = snap.pub;
    me = snap.me;
    isHost = snap.room.hostId === pid;
    if (!snap.first) react(snap.events as HushEvent[], prev);
    render();
  }

  function render() {
    const s = state!;
    const m = me;
    $("#hush-top").innerHTML = `<span>Level <b>${s.level}</b>/${s.goal}</span>${hearts(s.hearts)}${stars(s.stars)}`;
    const top = s.pile[s.pile.length - 1];
    $("#hush-last").innerHTML = top !== undefined ? `<small>Last played</small>${numCard(top, "nc-small")}` : `<small>Nothing played yet</small><div class="hush-shh">🤫</div>`;

    const hand = m?.hand ?? [];
    $("#hush-hand").innerHTML = hand.length
      ? hand.map((n, i) => numCard(n, i === 0 ? "nc-lowest" : "")).join("")
      : `<p class="muted">${s.phase === "ready" ? "Waiting for cards…" : "You're out of cards this level. Enjoy the quiet. 🌙"}</p>`;

    const go = $("#hush-go") as HTMLButtonElement;
    const self = s.players.find((p) => p.id === pid);
    if (s.phase === "ready") {
      const ready = s.players.filter((p) => p.ready).length;
      go.disabled = !!self?.ready;
      go.textContent = self?.ready ? `Waiting for others… ${ready}/${s.players.length}` : "I'm ready 🤫";
    } else if (s.phase === "playing") {
      go.disabled = !m?.canPlay;
      go.textContent = m?.canPlay ? `Play ${hand[0]}` : "Nothing left to play";
    } else {
      go.disabled = true;
      go.textContent = s.phase === "won" ? "You won!" : "Game over";
    }

    const star = $("#hush-star") as HTMLButtonElement;
    const voting = s.players.filter((p) => p.star).length;
    const holders = s.players.filter((p) => p.count > 0 && p.connected).length;
    star.hidden = !(s.phase === "playing" && s.stars > 0 && hand.length > 0);
    star.textContent = self?.star ? `⭐ Waiting for everyone (${voting}/${holders}) · tap to cancel` : `⭐ Use a star${voting ? ` (${voting}/${holders} agree)` : ""}`;
    star.classList.toggle("on", !!self?.star);
    renderResults();
  }

  function renderResults() {
    const s = state!;
    const el = $("#hush-results");
    const over = s.phase === "won" || s.phase === "lost";
    if (!over) {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    const key = `${s.phase}-${s.level}-${isHost}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const won = s.phase === "won";
    el.hidden = false;
    el.innerHTML = `
      <div class="ph-lobby-inner">
        <div class="hush-big-emoji">${won ? "🌙" : "💔"}</div>
        <h2>${won ? "You did it, together!" : `Out of hearts on level ${s.level}`}</h2>
        <p class="muted">${won ? `All ${s.goal} levels without a word.` : "Shake it off and try again."}</p>
        ${
          isHost
            ? `<button class="btn btn-primary btn-xl wide" data-gact='{"t":"restart"}'>Play again</button>
               <button class="btn btn-ghost wide" data-act="endGame">Pick another game</button>`
            : `<p class="muted">Waiting for the host…</p>`
        }
      </div>`;
    if (won) confetti(el, 80);
  }

  function react(events: HushEvent[], prev: HushPublic | null) {
    for (const e of events) {
      if (e.type === "play" && e.pid === pid) audio.note(pitchFor(e.card), 0.25);
      if (e.type === "go") {
        haptic("turn");
        audio.turn();
      }
      if (e.type === "deal" && prev && e.level > prev.level) toast(`Level ${e.level}: ${e.level} cards each.`);
      if (e.type === "mistake") {
        const mine = e.lost.find((l) => l.pid === pid);
        if (mine) {
          haptic("error");
          toast(`Oops, your ${mine.cards.join(", ")} ${mine.cards.length === 1 ? "was" : "were"} lower. −1 ❤️`, "error");
        } else if (e.pid === pid) {
          haptic("error");
          toast("Too soon! Someone held a lower card. −1 ❤️", "error");
        } else toast("A card came out too soon. −1 ❤️", "error");
      }
      if (e.type === "star") toast("⭐ Star used: everyone dropped their lowest card.");
      if (e.type === "levelDone") audio.fanfare();
    }
  }

  return {
    update,
    destroy() {
      ac.abort();
      ctx.el.innerHTML = "";
    },
  };
}

