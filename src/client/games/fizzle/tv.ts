// Fizzle! on the TV: the deck with its hidden firecrackers, everyone's seat, and the
// lit fuses burning down in front of people.

import type { FizzleEvent, FizzlePublic } from "../../../shared/games/fizzle/engine";
import { CARD_INFO } from "../../../shared/games/fizzle/engine";
import { audio } from "../../audio";
import { confetti } from "../../fx";
import { $, avatar, esc, reducedMotion } from "../../ui";
import type { GameSnap, GameView, TvCtx } from "../types";
import { fcardHtml, litHtml } from "./common";

export function fizzleTv(ctx: TvCtx): GameView {
  let alive = true;
  let state: FizzlePublic | null = null;
  ctx.el.innerHTML = `
  <div class="fizzle-tv">
    <div class="fz-center">
      <div class="fz-deck" id="fz-deck"></div>
      <div class="fz-discard" id="fz-discard"></div>
    </div>
    <div class="fz-seats" id="fz-seats"></div>
    <footer class="ticker"><div class="ticker-main" id="fz-turn"></div><div class="ticker-sub" id="fz-log"></div></footer>
    <section class="tv-results overlay" id="fz-results" hidden></section>
  </div>`;
  const name = (pid: string) => esc(state?.players.find((p) => p.id === pid)?.name ?? "Someone");

  function update(snap: GameSnap<FizzlePublic>) {
    state = snap.pub;
    render(snap.pub);
    if (!snap.first) react(snap.events as FizzleEvent[]);
  }

  function render(s: FizzlePublic) {
    const inGame = s.players.filter((p) => !p.out && !p.waiting).length;
    ctx.setStatus(`Fizzle! · <b>${inGame}</b> still in`);
    $("#fz-deck").innerHTML = `${fcardHtml(null, "fz-big")}<b>${s.deckCount} cards</b><span class="fz-danger">🧨 × ${s.crackersInDeck} hidden inside</span>`;
    $("#fz-discard").innerHTML = s.discardTop ? `${fcardHtml(s.discardTop, "fz-big")}<b>Last played</b>` : `<div class="fz-empty">Nothing played yet</div>`;
    $("#fz-seats").innerHTML = s.players
      .map(
        (p) => `<div class="fz-seat ${s.turnId === p.id ? "turn" : ""} ${p.out ? "out" : ""} ${p.waiting ? "waiting" : ""} ${p.connected ? "" : "offline"} ${p.lit.length ? "burning" : ""}" data-pid="${esc(p.id)}">
          ${avatar(p)}
          <div class="fz-name">${esc(p.name)}${p.bot ? ' <span class="bot-tag">bot</span>' : ""}</div>
          <div class="fz-meta">${p.out ? "💥 Out" : p.waiting ? "Joins next game" : `${p.count} card${p.count === 1 ? "" : "s"}`}</div>
          <div class="fz-lit">${litHtml(p.lit)}</div>
          ${s.turnId === p.id ? '<div class="seat-pointer">▼</div>' : ""}
        </div>`,
      )
      .join("");
    if (s.phase === "playing" && s.turnId) {
      const p = s.players.find((x) => x.id === s.turnId)!;
      const lit = p.lit.length ? ` <span class="tag-pending">🧨 must toss or douse it!</span>` : "";
      $("#fz-turn").innerHTML = `${avatar(p, "sm")} <b>${esc(p.name)}</b>'s turn${lit}${p.connected ? "" : ` <span class="tag-off">(phone disconnected)</span>`}`;
    }
    renderResults(s);
  }

  function renderResults(s: FizzlePublic) {
    const el = $("#fz-results");
    if (s.phase !== "over") {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    if (el.dataset.key === s.winner) return;
    el.dataset.key = s.winner ?? "";
    const w = s.players.find((p) => p.id === s.winner);
    el.innerHTML = `
      <div class="results-card">
        <div class="results-head">
          ${w ? avatar(w, "xl") : ""}
          <h1>${w ? `${esc(w.name)} is the last one standing!` : "Everyone went boom!"}</h1>
          <p class="results-points">Not a singed eyebrow in sight. 🧯</p>
        </div>
        <p class="results-next">The host can play again or pick another game, or press <kbd>Enter</kbd> here to play again.</p>
      </div>`;
    setTimeout(() => {
      if (!alive || state?.phase !== "over") return;
      el.hidden = false;
      confetti(el);
    }, 1400);
  }

  function seat(pid: string) {
    return document.querySelector<HTMLElement>(`.fz-seat[data-pid="${CSS.escape(pid)}"]`);
  }
  function bubble(pid: string, text: string, kind: "good" | "bad") {
    const s = seat(pid);
    if (!s) return;
    const b = document.createElement("div");
    b.className = `bubble ${kind}`;
    b.textContent = text;
    s.append(b);
    setTimeout(() => b.remove(), 2000);
  }

  function react(events: FizzleEvent[]) {
    const log: string[] = [];
    for (const e of events) {
      switch (e.type) {
        case "deal":
          audio.shuffle();
          log.push(`New game: ${e.crackers} firecracker${e.crackers === 1 ? "" : "s"} hidden in the deck. ${name(e.first)} goes first`);
          break;
        case "play":
          if (e.card.kind !== "water" && e.card.kind !== "toss") audio.cardPlay("normal");
          if (e.card.kind === "peek") audio.tick();
          if (e.card.kind === "nap") audio.pop();
          log.push(`${name(e.pid)} played ${CARD_INFO[e.card.kind].emoji} ${CARD_INFO[e.card.kind].name}`);
          break;
        case "draw":
          audio.draw(1);
          break;
        case "lit":
          audio.hiss();
          bubble(e.pid, "🧨 Lit!", "bad");
          log.push(`${name(e.pid)} drew a firecracker! 🧨 The fuse is lit`);
          break;
        case "douse":
          audio.splash();
          bubble(e.pid, "💧 Phew!", "good");
          log.push(`${name(e.pid)} doused it. Back into the deck it goes`);
          break;
        case "toss":
          audio.reverse();
          bubble(e.target, "🧨 Catch!", "bad");
          log.push(`${name(e.pid)} tossed the firecracker to ${name(e.target)}!`);
          break;
        case "shuffle":
          audio.shuffle();
          break;
        case "boom":
          audio.boom();
          bubble(e.pid, "💥 BOOM!", "bad");
          log.push(`💥 ${name(e.pid)} went boom!`);
          if (!reducedMotion()) {
            $(".fizzle-tv").animate([{ translate: "0 0" }, { translate: "-14px 8px" }, { translate: "12px -8px" }, { translate: "-6px 4px" }, { translate: "0 0" }], { duration: 450 });
            const flash = document.createElement("div");
            flash.className = "fz-flash";
            ctx.el.append(flash);
            setTimeout(() => flash.remove(), 700);
          }
          break;
        case "won":
          setTimeout(() => audio.fanfare(), 900);
          break;
      }
    }
    if (log.length) $("#fz-log").innerHTML = log.slice(-3).join(" <span class='dot'>•</span> ");
  }

  return {
    update,
    onEnter() {
      if (state?.phase === "over") ctx.send({ t: "restart" });
    },
    destroy() {
      alive = false;
      ctx.el.innerHTML = "";
    },
  };
}
