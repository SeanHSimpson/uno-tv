// OhNo! on the TV: the table, seats, piles, animations and round results.

import type { Card, Color, GameEvent, PublicPlayer, PublicState } from "../../../shared/games/ohno/types";
import { audio } from "../../audio";
import { cardBackSvg, cardEl, COLOR_NAMES, shapeSvg, shortLabel } from "../../cards";
import { confetti } from "../../fx";
import { icoCrown } from "../../icons";
import { $, avatar, esc, fly, reducedMotion } from "../../ui";
import type { GameSnap, GameView, TvCtx } from "../types";

export function ohnoTv(ctx: TvCtx): GameView {
  const ac = new AbortController();
  let alive = true;
  ctx.el.innerHTML = `
  <div class="ohno-tv">
    <main class="table-wrap" id="table-wrap">
      <div class="felt">
        <svg class="ring" id="ring" viewBox="-100 -100 200 200" aria-hidden="true">
          <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor"/></marker></defs>
          <g class="ring-flip"><g class="ring-spin">${[0, 1, 2, 3]
            .map((i) => `<path d="M ${arcPt(i * 90 + 12)} A 92 92 0 0 1 ${arcPt(i * 90 + 72)}" marker-end="url(#arrowhead)"/>`)
            .join("")}</g></g>
        </svg>
        <div class="piles">
          <div class="deck" id="deck"><div class="deck-stack"><div class="deck-top">${cardBackSvg()}</div></div><span class="deck-count" id="deck-count"></span></div>
          <div class="discard" id="discard"></div>
          <div class="color-chip" id="color-chip"></div>
          <div class="pending" id="pending"></div>
        </div>
      </div>
      <div class="seats" id="seats"></div>
    </main>
    <footer class="ticker" id="ticker"><div class="ticker-main" id="ticker-main"></div><div class="ticker-sub" id="ticker-sub"></div></footer>
    <section class="tv-results overlay" id="tv-results" hidden></section>
  </div>`;

  let state: PublicState | null = null;
  const seatEls = new Map<string, HTMLElement>();
  const names = (pid: string) => state?.players.find((p) => p.id === pid)?.name ?? "Someone";
  window.addEventListener("resize", () => state && layoutSeats(state.players), { signal: ac.signal });

  function update(snap: GameSnap<PublicState>) {
    state = snap.pub;
    render(snap.pub);
    if (!snap.first) animate(snap.events as GameEvent[]);
  }

  // ---------------- rendering ----------------

  function render(s: PublicState) {
    ctx.setStatus(
      `Round ${s.round}${s.settings.targetScore ? ` · first to ${s.settings.targetScore}` : ""}${s.settings.stacking ? " · stacking on" : ""}${
        s.phase === "playing" ? ` · <span class="dir">${s.direction === 1 ? "↻ clockwise" : "↺ counter-clockwise"}</span>` : ""
      }`,
    );
    // Like the classic falling-blocks games: the music speeds up when someone's on their last card.
    audio.setTempo(s.phase === "playing" && s.players.some((p) => p.count === 1) ? 1.22 : 1);

    $("#deck-count").textContent = String(s.drawPileCount);
    renderDiscard(s.discard);
    const chip = $("#color-chip");
    if (s.color) {
      chip.innerHTML = `${shapeSvg(s.color, 28)}<span>${COLOR_NAMES[s.color]}</span>`;
      chip.dataset.color = s.color;
      $("#discard").dataset.color = s.color;
      $("#ring").dataset.color = s.color;
    }
    const pend = $("#pending");
    pend.textContent = s.pendingDraw ? `+${s.pendingDraw}` : "";
    pend.classList.toggle("show", s.pendingDraw > 0);
    $("#ring").classList.toggle("ccw", s.direction === -1);
    $("#ring").classList.toggle("hidden", s.phase !== "playing");

    renderSeats(s);

    if (s.phase === "playing" && s.turnId) {
      const p = s.players.find((x) => x.id === s.turnId)!;
      $("#ticker-main").innerHTML = `${avatar(p, "sm")} <b>${esc(p.name)}</b>'s turn${
        s.pendingDraw ? ` <span class="tag-pending">stack or draw ${s.pendingDraw}</span>` : ""
      }${p.connected ? "" : ` <span class="tag-off">(phone disconnected)</span>`}`;
    } else if (s.phase === "roundOver") {
      $("#ticker-main").innerHTML = `<b>${esc(names(s.roundWinner ?? ""))}</b> went out!`;
    }
    renderResults(s);
  }

  function renderDiscard(cards: Card[]) {
    const el = $("#discard");
    const existing = new Map([...el.children].map((c) => [(c as HTMLElement).dataset.id, c as HTMLElement]));
    const keep = new Set(cards.map((c) => String(c.id)));
    for (const [id, node] of existing) if (!keep.has(id!)) node.remove();
    cards.forEach((card, i) => {
      let node = existing.get(String(card.id));
      if (!node) {
        node = cardEl(card, "pile-card");
        node.style.setProperty("--r", `${((card.id * 47) % 34) - 17}deg`);
        node.style.setProperty("--x", `${((card.id * 13) % 14) - 7}%`);
        node.style.setProperty("--y", `${((card.id * 29) % 10) - 5}%`);
      }
      node.style.zIndex = String(i);
      el.append(node);
    });
  }

  function renderSeats(s: PublicState) {
    const wrap = $("#seats");
    wrap.dataset.density = s.players.length >= 7 ? "crowded" : "";
    const ids = new Set(s.players.map((p) => p.id));
    for (const [id, el] of seatEls) if (!ids.has(id)) (el.remove(), seatEls.delete(id));
    for (const p of s.players) {
      let el = seatEls.get(p.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "seat";
        el.dataset.pid = p.id;
        el.innerHTML = `<div class="seat-content" style="display:contents"></div>`;
        wrap.append(el);
        seatEls.set(p.id, el);
      }
      el.classList.toggle("turn", s.turnId === p.id);
      el.classList.toggle("offline", !p.connected);
      el.classList.toggle("last-card", p.count === 1 && s.phase === "playing");
      const fan = Math.min(p.count, 10);
      const html = `
        <div class="seat-fan" style="--n:${fan}">${Array.from({ length: fan }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>
        <div class="seat-body">
          ${avatar(p)}
          <div class="seat-text">
            <div class="seat-name">${esc(p.name)}${p.bot ? ' <span class="bot-tag">bot</span>' : ""}${p.id === s.hostId ? ` ${icoCrown()}` : ""}</div>
            <div class="seat-meta"><b>${p.count}</b> card${p.count === 1 ? "" : "s"}${
              s.settings.targetScore || s.round > 1 ? ` · ${p.score} pts` : ""
            }${p.calledOhNo && p.count <= 1 ? ' · <span class="ohno-tag">OhNo!</span>' : ""}</div>
          </div>
        </div>
        <div class="seat-last">${p.lastPlayed ? cardEl(p.lastPlayed, "mini").outerHTML : ""}</div>
        ${s.turnId === p.id ? '<div class="seat-pointer">▼</div>' : ""}`;
      const content = el.firstElementChild as HTMLElement;
      if (content.dataset.html !== html) {
        content.dataset.html = html;
        content.innerHTML = html;
      }
    }
    layoutSeats(s.players);
  }

  function layoutSeats(players: PublicPlayer[]) {
    const n = players.length;
    const wrapEl = document.getElementById("table-wrap");
    if (!wrapEl) return;
    const wrap = wrapEl.getBoundingClientRect();
    const portrait = wrap.height > wrap.width;
    players.forEach((p, i) => {
      const el = seatEls.get(p.id);
      if (!el) return;
      // Start at the bottom and go clockwise (matches the direction arrows).
      const a = ((90 + (i * 360) / n) * Math.PI) / 180;
      const rx = portrait ? 40 : 43;
      const ry = portrait ? 43 : 40;
      el.style.left = `${50 + rx * Math.cos(a)}%`;
      el.style.top = `${50 + ry * Math.sin(a)}%`;
      el.dataset.side = Math.sin(a) > 0.5 ? "bottom" : Math.sin(a) < -0.5 ? "top" : Math.cos(a) < 0 ? "left" : "right";
    });
  }

  function renderResults(s: PublicState) {
    const el = $("#tv-results");
    if (s.phase !== "roundOver") {
      el.hidden = true;
      el.dataset.round = "";
      return;
    }
    const key = `${s.round}-${s.players.map((p) => p.score).join(",")}`;
    if (el.dataset.round === key) return;
    el.dataset.round = key;
    const winner = s.players.find((p) => p.id === s.roundWinner);
    const target = s.settings.targetScore;
    const ranked = [...s.players].sort((a, b) => b.score - a.score);
    const gameOver = !!s.gameWinner;
    const top = ranked[0]?.score || 1;
    el.innerHTML = `
      <div class="results-card">
        <div class="results-head">
          ${winner ? avatar(winner, "xl") : ""}
          <h1>${gameOver ? `${esc(winner?.name)} wins${target ? " the game" : ""}!` : `${esc(winner?.name)} takes the round!`}</h1>
          <p class="results-points">+${s.roundPoints} points from everyone's leftover cards</p>
        </div>
        <div class="scoreboard">
          ${ranked
            .map((p, idx) => {
              const hand = s.reveal?.[p.id] ?? [];
              const pct = Math.round((p.score / (target || top)) * 100);
              return `<div class="score-row ${p.id === s.roundWinner ? "win" : ""}" style="--row:${idx}">
                <span class="score-rank">${idx + 1}</span>
                ${avatar(p, "sm")}<span class="score-name">${esc(p.name)}</span>
                <span class="score-hand">${hand.slice(0, 14).map((c) => cardEl(c, "micro").outerHTML).join("")}${hand.length > 14 ? `<em>+${hand.length - 14}</em>` : ""}</span>
                <span class="score-bar"><i style="width:${Math.min(100, pct)}%"></i></span>
                <b class="score-num">${p.score}</b></div>`;
            })
            .join("")}
        </div>
        <p class="results-next">${
          gameOver ? "The host can start a new game or pick another one" : "The host can deal the next round from their phone"
        } — or press <kbd>Enter</kbd> here.</p>
      </div>`;
    // Give the last card a moment to land before covering the table.
    setTimeout(() => {
      if (!alive || state?.phase !== "roundOver") return;
      el.hidden = false;
      if (gameOver) confetti(el);
    }, 1100);
  }

  // ---------------- animation & sound ----------------

  function seatRect(pid: string, part = ".seat-body") {
    return seatEls.get(pid)?.querySelector(part)?.getBoundingClientRect() ?? null;
  }

  function sound(e: GameEvent, delay: number) {
    const at = (fn: () => void, extra = 0) => setTimeout(fn, delay + extra);
    switch (e.type) {
      case "play": {
        const v = e.card.value;
        const kind = v === "draw2" || v === "wild4" ? "draw" : v === "wild" ? "wild" : v === "skip" || v === "reverse" ? "action" : "normal";
        at(() => audio.cardPlay(kind), 480);
        break;
      }
      case "draw":
        if (e.reason !== "join" && e.count) at(() => audio.draw(e.count));
        break;
      case "skip":
        at(() => audio.skip());
        break;
      case "reverse":
      case "swap":
      case "rotate":
        at(() => audio.reverse());
        break;
      case "ohno":
        audio.ohno();
        break;
      case "caught":
        at(() => audio.caught());
        break;
      case "deal":
      case "reshuffle":
        at(() => audio.shuffle());
        break;
      case "roundOver":
        at(() => audio.fanfare(), 700);
        break;
    }
  }

  function animate(events: GameEvent[]) {
    const quick = reducedMotion();
    let delay = 0;
    const msgs: string[] = [];
    for (const e of events) {
      const text = describe(e);
      if (text) msgs.push(text);
      sound(e, quick ? 0 : delay);
      if (quick) continue;
      switch (e.type) {
        case "play": {
          const from = seatRect(e.pid);
          const topEl = $("#discard").lastElementChild as HTMLElement | null;
          if (from && topEl) {
            const to = topEl.getBoundingClientRect();
            topEl.style.visibility = "hidden";
            const r = ((e.card.id * 47) % 34) - 17;
            fly(cardEl(e.card), from, to, { delay, spin: r - 40, duration: 560 }).then(() => {
              topEl.style.visibility = "";
              topEl.classList.add("landed");
            });
            if (e.card.color === "wild") colorBurst(e.color, delay + 520);
          }
          delay += 380;
          break;
        }
        case "draw": {
          const to = seatRect(e.pid, ".seat-fan");
          const from = $("#deck").getBoundingClientRect();
          if (to) {
            const flights = Math.min(e.count, 6);
            const target = new DOMRect(to.left + to.width / 2 - from.width * 0.2, to.top, from.width * 0.4, from.height * 0.4);
            for (let k = 0; k < flights; k++) fly(cardEl(null), from, target, { delay: delay + k * 110, duration: 480 });
            delay += 120 * flights + 120;
          }
          if (e.reason === "penalty" && e.count) bubble(e.pid, `+${e.count}`, "bad", delay - 200);
          break;
        }
        case "skip":
          bubble(e.pid, "Skipped!", "bad", delay);
          stamp(e.pid, delay);
          delay += 250;
          break;
        case "reverse":
          $("#ring").animate([{ transform: "rotate(0deg) scale(1)" }, { transform: `rotate(${e.direction === 1 ? 180 : -180}deg) scale(1.06)` }, { transform: "rotate(0) scale(1)" }], {
            duration: 900,
            delay,
            easing: "ease-in-out",
          });
          break;
        case "swap":
          bubble(e.pid, "Swapped!", "good", delay);
          bubble(e.withPid, "Swapped!", "bad", delay);
          delay += 300;
          break;
        case "rotate":
          $("#ring").animate([{ transform: "rotate(0deg) scale(1)" }, { transform: `rotate(${e.direction === 1 ? 360 : -360}deg) scale(1.08)` }, { transform: "rotate(0) scale(1)" }], {
            duration: 950,
            delay,
            easing: "ease-in-out",
          });
          if (state) for (const p of state.players) bubble(p.id, "Pass hands!", "good", delay);
          delay += 350;
          break;
        case "ohno":
          bubble(e.pid, "OhNo!", "good", delay);
          break;
        case "caught":
          bubble(e.pid, `Caught! +${e.count}`, "bad", delay);
          break;
        case "deal":
          dealAnimation();
          break;
        case "joined":
          requestAnimationFrame(() => seatEls.get(e.pid)?.classList.add("pop"));
          break;
      }
    }
    if (msgs.length) $("#ticker-sub").innerHTML = msgs.slice(-3).join(" <span class='dot'>•</span> ");
  }

  function describe(e: GameEvent): string {
    const n = (pid: string) => `<b>${esc(names(pid))}</b>`;
    switch (e.type) {
      case "play":
        return `${n(e.pid)} played ${esc(shortLabel(e.card))}${e.card.color === "wild" ? ` → ${COLOR_NAMES[e.color]}` : ""}`;
      case "draw":
        if (e.reason === "join") return `${n(e.pid)} joined and was dealt in`;
        if (e.reason === "penalty") return `${n(e.pid)} picks up ${e.count}`;
        if (e.reason === "caught") return "";
        return `${n(e.pid)} drew ${e.count === 1 ? "a card" : `${e.count} cards`}`;
      case "pass":
        return `${n(e.pid)} passed`;
      case "skip":
        return `${n(e.pid)} is skipped`;
      case "reverse":
        return `Reversed — now going ${e.direction === 1 ? "↻ clockwise" : "↺ counter-clockwise"}`;
      case "swap":
        return `${n(e.pid)} swapped hands with ${n(e.withPid)}!`;
      case "rotate":
        return `Zero played — everyone passed hands ${e.direction === 1 ? "clockwise" : "counter-clockwise"}!`;
      case "ohno":
        return `${n(e.pid)} called OhNo!`;
      case "caught":
        return `${n(e.by)} caught ${n(e.pid)}! +${e.count}`;
      case "reshuffle":
        return "Reshuffled the discard pile";
      case "deal":
        return `Round ${e.round} — ${n(e.first)} goes first`;
      default:
        return "";
    }
  }

  function later(delay: number, fn: () => void) {
    setTimeout(() => alive && fn(), delay);
  }

  function bubble(pid: string, text: string, kind: "good" | "bad", delay: number) {
    const seat = seatEls.get(pid);
    if (!seat) return;
    later(delay, () => {
      const b = document.createElement("div");
      b.className = `bubble ${kind}`;
      b.textContent = text;
      seat.append(b);
      setTimeout(() => b.remove(), 1900);
    });
  }

  /** A big ⊘ stamped over a skipped player's seat. */
  function stamp(pid: string, delay: number) {
    const seat = seatEls.get(pid);
    if (!seat) return;
    later(delay, () => {
      const st = document.createElement("div");
      st.className = "skip-stamp";
      st.textContent = "⊘";
      seat.append(st);
      setTimeout(() => st.remove(), 1600);
    });
  }

  function colorBurst(color: Color, delay: number) {
    later(delay, () => {
      const ring = document.createElement("div");
      ring.className = `burst c-${color}`;
      $("#discard").parentElement!.append(ring);
      setTimeout(() => ring.remove(), 900);
    });
  }

  function dealAnimation() {
    if (!state) return;
    const from = $("#deck").getBoundingClientRect();
    const players = state.players;
    players.forEach((p, i) => {
      const to = seatRect(p.id, ".seat-fan");
      if (!to) return;
      const target = new DOMRect(to.left + to.width / 2 - from.width * 0.2, to.top, from.width * 0.4, from.height * 0.4);
      for (let k = 0; k < 3; k++) fly(cardEl(null), from, target, { delay: (k * players.length + i) * 90, duration: 420 });
    });
  }

  return {
    update,
    onEnter() {
      if (state?.phase === "roundOver") ctx.send({ t: "nextRound" });
    },
    destroy() {
      alive = false;
      ac.abort();
      audio.setTempo(1);
      ctx.el.innerHTML = "";
    },
  };
}

function arcPt(deg: number) {
  const a = (deg * Math.PI) / 180;
  return `${(92 * Math.cos(a)).toFixed(2)} ${(92 * Math.sin(a)).toFixed(2)}`;
}
