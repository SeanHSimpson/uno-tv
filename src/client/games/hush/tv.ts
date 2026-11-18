// Hush on the TV: the rising pile, hearts and stars, who's ready, and the quiet drama.

import type { HushEvent, HushPublic } from "../../../shared/games/hush/engine";
import { audio } from "../../audio";
import { confetti } from "../../fx";
import { $, avatar, esc, reducedMotion } from "../../ui";
import type { GameSnap, GameView, TvCtx } from "../types";
import { hearts, nameOf, numCard, pitchFor, stars } from "./common";

export function hushTv(ctx: TvCtx): GameView {
  let alive = true;
  let state: HushPublic | null = null;
  let flashTimer = 0;
  ctx.el.innerHTML = `
  <div class="hush-tv">
    <div class="hush-tokens" id="hush-tokens"></div>
    <div class="hush-stage">
      <div class="hush-pile" id="hush-pile"></div>
      <div class="hush-banner" id="hush-banner"></div>
      <div class="hush-discards" id="hush-discards"></div>
    </div>
    <div class="hush-players" id="hush-players"></div>
    <section class="hush-results overlay" id="hush-results" hidden></section>
  </div>`;

  function update(snap: GameSnap<HushPublic>) {
    const prev = state;
    state = snap.pub;
    render(snap.pub, prev);
    if (!snap.first) react(snap.events as HushEvent[]);
  }

  function render(s: HushPublic, prev: HushPublic | null) {
    ctx.setStatus(`Hush · Level <b>${s.level}</b> of ${s.goal}`);
    $("#hush-tokens").innerHTML = `${hearts(s.hearts)}<span class="hush-sep"></span>${stars(s.stars)}`;

    // The pile: the last few cards, rising left to right, newest biggest.
    const pile = $("#hush-pile");
    if (!s.pile.length) pile.innerHTML = `<div class="hush-empty">🤫</div>`;
    else {
      pile.innerHTML = s.pile.map((n, i) => numCard(n, i === s.pile.length - 1 ? "nc-top" : "nc-trail")).join("");
      if (prev && prev.played < s.played && !reducedMotion()) pile.lastElementChild?.classList.add("nc-land");
    }
    $("#hush-discards").innerHTML = s.discarded.length
      ? `<span class="muted">Thrown away</span>${s.discarded.map((n) => numCard(n, "nc-mini nc-out")).join("")}`
      : "";

    const readyCount = s.players.filter((p) => p.ready).length;
    if (!flashTimer) {
      const banner = $("#hush-banner");
      if (s.phase === "ready")
        banner.innerHTML = `Level ${s.level}: everyone gets <b>${s.level}</b> card${s.level === 1 ? "" : "s"}.<br><small>Tap <b>Ready</b> on your phone when you're settled · ${readyCount}/${s.players.length} ready</small>`;
      else if (s.phase === "playing")
        banner.innerHTML = s.pile.length
          ? `<small>Next card must be higher than <b>${s.pile[s.pile.length - 1]}</b></small>`
          : `Shh… no talking.<br><small>Whoever holds the lowest card: go when it feels right.</small>`;
      else banner.innerHTML = "";
      banner.className = "hush-banner";
    }

    $("#hush-players").innerHTML = s.players
      .map(
        (p) => `<div class="hush-player ${p.connected ? "" : "offline"} ${p.count === 0 && s.phase === "playing" ? "done" : ""}">
          ${avatar(p)}
          <div class="hp-name">${esc(p.name)}${p.bot ? ' <span class="bot-tag">bot</span>' : ""}</div>
          <div class="hp-cards">${Array.from({ length: Math.min(p.count, 12) }, () => "<i></i>").join("")}${p.count > 12 ? `<em>+${p.count - 12}</em>` : ""}</div>
          <div class="hp-flag">${s.phase === "ready" ? (p.ready ? "✓ Ready" : "…") : p.star ? "⭐ wants a star" : p.count === 0 ? "done" : ""}</div>
        </div>`,
      )
      .join("");

    renderResults(s);
  }

  function renderResults(s: HushPublic) {
    const el = $("#hush-results");
    const over = s.phase === "won" || s.phase === "lost";
    if (!over) {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    const key = `${s.phase}-${s.level}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const won = s.phase === "won";
    el.innerHTML = `
      <div class="results-card">
        <div class="results-head">
          <div class="hush-big-emoji">${won ? "🌙" : "💔"}</div>
          <h1>${won ? `You did it! All ${s.goal} levels, together.` : `Out of hearts on level ${s.level}`}</h1>
          <p class="results-points">${won ? "Not a word spoken. Impressive." : "So close. The quiet got the better of you this time."}</p>
        </div>
        ${
          !won && s.reveal
            ? `<div class="hush-reveal">${s.players
                .filter((p) => (s.reveal![p.id] ?? []).length)
                .map((p) => `<div>${avatar(p, "sm")}<b>${esc(p.name)}</b> still held ${(s.reveal![p.id] ?? []).map((n) => numCard(n, "nc-mini")).join("")}</div>`)
                .join("")}</div>`
            : ""
        }
        <p class="results-next">The host can play again or pick another game, or press <kbd>Enter</kbd> here to play again.</p>
      </div>`;
    setTimeout(() => {
      if (!alive || state?.phase !== s.phase) return;
      el.hidden = false;
      if (won) confetti(el);
    }, 900);
  }

  /** A short message in the middle of the table, then back to the usual prompt. */
  function flash(html: string, kind: "good" | "bad", ms = 2600) {
    const banner = $("#hush-banner");
    banner.innerHTML = html;
    banner.className = `hush-banner flash ${kind}`;
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      flashTimer = 0;
      if (alive && state) render(state, null);
    }, ms);
  }

  function react(events: HushEvent[]) {
    const players = state?.players ?? [];
    for (const e of events) {
      switch (e.type) {
        case "play":
          audio.note(pitchFor(e.card));
          break;
        case "ready":
          audio.tick();
          break;
        case "go":
          audio.turn();
          flash(`Shh… 🤫<br><small>Level ${e.level}. Go when it feels right.</small>`, "good", 2200);
          break;
        case "mistake": {
          audio.caught();
          const lost = e.lost.map((l) => `${nameOf(players, l.pid)} had ${l.cards.join(", ")}`).join(" · ");
          flash(`Oops! ${nameOf(players, e.pid)} played <b>${e.card}</b> too soon.<br><small>${lost} · −1 ❤️</small>`, "bad", 3600);
          if (!reducedMotion()) $(".hush-tv").animate([{ translate: "0" }, { translate: "-10px" }, { translate: "10px" }, { translate: "0" }], { duration: 300 });
          break;
        }
        case "starVote":
          if (e.on) audio.pop();
          break;
        case "star":
          audio.reverse();
          flash(`⭐ Star used! Everyone threw away their lowest card.<br><small>${e.discards.map((d) => `${nameOf(players, d.pid)}: ${d.card}`).join(" · ")}</small>`, "good", 3200);
          break;
        case "levelDone":
          audio.fanfare();
          flash(`Level ${e.level} cleared! ✨${e.reward === "star" ? "<br><small>+1 ⭐ star</small>" : e.reward === "heart" ? "<br><small>+1 ❤️ heart</small>" : ""}`, "good", 2800);
          break;
        case "lost":
          audio.ohno();
          break;
      }
    }
  }

  return {
    update,
    onEnter() {
      if (state?.phase === "won" || state?.phase === "lost") ctx.send({ t: "restart" });
    },
    destroy() {
      alive = false;
      clearTimeout(flashTimer);
      ctx.el.innerHTML = "";
    },
  };
}
