// Fizzle! on the TV: the deck with its hidden firecrackers, everyone's seat, and the
// lit fuses burning down in front of people.

import type { FizzleEvent, FizzlePublic } from "../../../shared/games/fizzle/engine";
import { CARD_INFO } from "../../../shared/games/fizzle/engine";
import { audio } from "../../audio";
import { callout, confetti } from "../../fx";
import { tvFx } from "../../fxCanvas";
import { $, avatar, esc, fly, reducedMotion } from "../../ui";
import type { GameSnap, GameView, TvCtx } from "../types";
import { fcardEl, fcardHtml, litCrackerSvg, litHtml } from "./common";

export function fizzleTv(ctx: TvCtx): GameView {
  let alive = true;
  let state: FizzlePublic | null = null;
  const seatEls = new Map<string, HTMLElement>();
  ctx.el.innerHTML = `
  <div class="fizzle-tv">
    <div class="table-spot" id="fz-spot" aria-hidden="true"></div>
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
    $("#fz-deck").innerHTML = `<div class="fz-deck-stack">${fcardHtml(null, "fz-big")}</div><b>${s.deckCount} cards</b><span class="fz-danger">${litCrackerSvg(22)} × ${s.crackersInDeck} hidden inside</span>`;
    $("#fz-discard").innerHTML = s.discardTop ? `${fcardHtml(s.discardTop, "fz-big")}<b>Last played</b>` : `<div class="fz-empty">Nothing played yet</div>`;
    const seats = $("#fz-seats");
    const ids = new Set(s.players.map((p) => p.id));
    for (const [id, el] of seatEls) if (!ids.has(id)) (el.remove(), seatEls.delete(id));
    s.players.forEach((p, i) => {
      let el = seatEls.get(p.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "fz-seat";
        el.dataset.pid = p.id;
        el.innerHTML = `<div class="fz-seat-inner"></div>`;
        seatEls.set(p.id, el);
        seats.append(el);
      } else if (seats.children[i] !== el) {
        seats.insertBefore(el, seats.children[i] ?? null);
      }
      el.classList.toggle("turn", s.turnId === p.id);
      el.classList.toggle("out", p.out);
      el.classList.toggle("waiting", p.waiting);
      el.classList.toggle("offline", !p.connected);
      el.classList.toggle("burning", p.lit.length > 0);
      const html = `
          ${avatar(p)}
          <div class="fz-name">${esc(p.name)}${p.bot ? ' <span class="bot-tag">bot</span>' : ""}</div>
          <div class="fz-meta">${p.out ? "💥 Out" : p.waiting ? "Joins next game" : `${p.count} card${p.count === 1 ? "" : "s"}`}</div>
          <div class="fz-lit">${litHtml(p.lit)}</div>
          ${s.turnId === p.id ? '<div class="seat-pointer">▼</div>' : ""}`;
      const inner = el.firstElementChild as HTMLElement;
      if (inner.dataset.html !== html) {
        inner.dataset.html = html;
        inner.innerHTML = html;
      }
    });
    if (s.phase === "playing" && s.turnId) {
      const p = s.players.find((x) => x.id === s.turnId)!;
      const lit = p.lit.length ? ` <span class="tag-pending">🧨 must toss or douse it!</span>` : "";
      $("#fz-turn").innerHTML = `${avatar(p, "sm")} <b>${esc(p.name)}</b>'s turn${lit}${p.connected ? "" : ` <span class="tag-off">(phone disconnected)</span>`}`;
      const spot = document.getElementById("fz-spot");
      const seatEl = seat(s.turnId);
      if (spot && seatEl) {
        const sr = spot.getBoundingClientRect();
        const br = seatEl.getBoundingClientRect();
        if (sr.width > 10 && sr.height > 10) {
          spot.style.setProperty("--sx", `${(((br.left + br.width / 2 - (sr.left + sr.width / 2)) / sr.width) * 38).toFixed(1)}%`);
          spot.style.setProperty("--sy", `${(((br.top + br.height / 2 - (sr.top + sr.height / 2)) / sr.height) * 38).toFixed(1)}%`);
        }
      }
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

  function seatBox(pid: string): DOMRect | null {
    const r = seat(pid)?.getBoundingClientRect();
    if (!r) return null;
    const w = Math.min(innerWidth, innerHeight) * 0.1;
    return new DOMRect(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - w * 0.75, w, w * 1.5);
  }

  function react(events: FizzleEvent[]) {
    const log: string[] = [];
    const quick = reducedMotion();
    for (const e of events) {
      switch (e.type) {
        case "deal":
          audio.shuffle();
          log.push(`New game: ${e.crackers} firecracker${e.crackers === 1 ? "" : "s"} hidden in the deck. ${name(e.first)} goes first`);
          break;
        case "play": {
          if (e.card.kind !== "water" && e.card.kind !== "toss") audio.cardPlay("normal");
          if (e.card.kind === "peek") audio.tick();
          if (e.card.kind === "nap") audio.pop();
          if (!quick) {
            const from = seatBox(e.pid);
            const target = document.querySelector<HTMLElement>("#fz-discard .fcard");
            if (from && target) {
              target.style.visibility = "hidden";
              fly(fcardEl(e.card), from, target.getBoundingClientRect(), { duration: 480, spin: -18 }).then(() => (target.style.visibility = ""));
            }
          }
          log.push(`${name(e.pid)} played ${CARD_INFO[e.card.kind].emoji} ${CARD_INFO[e.card.kind].name}`);
          break;
        }
        case "draw": {
          audio.draw(1);
          if (!quick) {
            const from = document.querySelector<HTMLElement>("#fz-deck .fcard")?.getBoundingClientRect();
            const to = seatBox(e.pid);
            if (from && to) fly(fcardEl(null), from, to, { duration: 460, spin: 16 });
          }
          break;
        }
        case "lit":
          audio.hiss();
          bubble(e.pid, "Lit!", "bad");
          log.push(`${name(e.pid)} drew a firecracker! The fuse is lit`);
          break;
        case "douse": {
          audio.splash();
          bubble(e.pid, "Phew!", "good");
          const sr = seat(e.pid)?.getBoundingClientRect();
          if (sr) {
            tvFx.burst(sr.left + sr.width / 2, sr.top + sr.height / 2, ["#5cc8f2", "#bce8ff", "#fff6e6"], 32);
            tvFx.shockwave(sr.left + sr.width / 2, sr.top + sr.height / 2, "#5cc8f2", 160);
          }
          callout("DOUSED!", { sub: state?.players.find((p) => p.id === e.pid)?.name, tone: "cool", icon: "💧", duration: 1400 });
          log.push(`${name(e.pid)} doused it. Back into the deck it goes`);
          break;
        }
        case "toss": {
          audio.reverse();
          if (!quick) {
            const from = seatBox(e.pid);
            const to = seatBox(e.target);
            if (from && to) fly(fcardEl({ kind: "cracker" }), from, to, { duration: 540, spin: 320 });
          }
          bubble(e.target, "Catch!", "bad");
          log.push(`${name(e.pid)} tossed the firecracker to ${name(e.target)}!`);
          break;
        }
        case "shuffle":
          audio.shuffle();
          break;
        case "boom": {
          audio.boom();
          bubble(e.pid, "💥 BOOM!", "bad");
          const who = state?.players.find((p) => p.id === e.pid)?.name ?? "Someone";
          callout("BOOM!", { sub: `${who} is out!`, tone: "danger", icon: "💥", duration: 2000 });
          const sr = seat(e.pid)?.getBoundingClientRect();
          if (sr) {
            tvFx.burst(sr.left + sr.width / 2, sr.top + sr.height / 2, ["#ff5938", "#ff9b42", "#ffd166", "#fff6e6"], 64);
            tvFx.shockwave(sr.left + sr.width / 2, sr.top + sr.height / 2, "#ff5938", 280);
          } else tvFx.centerBurst(["#ff5938", "#ff9b42", "#ffd166"], 60, "#ff5938");
          log.push(`💥 ${name(e.pid)} went boom!`);
          if (!reducedMotion()) {
            $(".fizzle-tv").animate([{ translate: "0 0" }, { translate: "-14px 8px" }, { translate: "12px -8px" }, { translate: "-6px 4px" }, { translate: "0 0" }], { duration: 450 });
            const flash = document.createElement("div");
            flash.className = "fz-flash";
            ctx.el.append(flash);
            setTimeout(() => flash.remove(), 700);
          }
          break;
        }
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
