// Euchre on the TV: an up-north cabin table by the lake. Four seats around a cedar-rimmed
// table, the turned-up card (then trump) in the middle, tricks landing in front of
// each player, and the two teams' scores on top.

import type { EuchreEvent, EuchrePublic } from "../../../shared/games/euchre/engine";
import { shortCard, SUIT_NAMES, TEAM_EMOJI, TEAM_NAMES } from "../../../shared/games/euchre/engine";
import { audio } from "../../audio";
import { confetti } from "../../fx";
import { $, avatar, esc, fly, reducedMotion } from "../../ui";
import type { GameSnap, GameView, TvCtx } from "../types";
import { ecardEl, ecardHtml, suitIcon } from "./cards";
import { DEAL_FLY, dealOrder, landsAt, leavesAt } from "../../../shared/games/euchre/deal";

/** Seat 0 sits at the bottom, then clockwise: left, top, right. */
const POS = ["bottom", "left", "top", "right"] as const;
/** Where a seat is, relative to the middle of the table (for flying cards). */
const DIR: Record<(typeof POS)[number], [number, number]> = { bottom: [0, 1], left: [-1, 0], top: [0, -1], right: [1, 0] };

export const SCENERY = `<svg class="eu-scenery" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><linearGradient id="eu-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a5a73"/><stop offset="1" stop-color="#0f2a38"/></linearGradient></defs>
  <circle cx="1310" cy="150" r="58" fill="#fbe9c0" fill-opacity=".9"/>
  <circle cx="1290" cy="135" r="58" fill="#1a2f45" fill-opacity=".25"/>
  <g fill="#fff6e6" fill-opacity=".6">${Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 233) % 1600}" cy="${30 + ((i * 97) % 260)}" r="${1 + (i % 3) * 0.6}"/>`).join("")}</g>
  <rect y="560" width="1600" height="340" fill="url(#eu-water)"/>
  <path d="M1250 580h120M1270 610h80M1290 640h40" stroke="#fbe9c0" stroke-opacity=".35" stroke-width="4" stroke-linecap="round"/>
  <path fill="#0d241c" d="M0 560${Array.from({ length: 40 }, (_, i) => {
    const x = i * 41;
    const h = 70 + ((i * 53) % 90);
    return `L${x} ${560 - h * 0.35}L${x + 14} ${560 - h}L${x + 28} ${560 - h * 0.35}`;
  }).join("")}L1600 560Z"/>
</svg>`;

export const MITTEN = `<svg class="eu-mitten" viewBox="0 0 120 120" aria-hidden="true"><g fill="currentColor">
  <path d="M8 22C20 14 34 15 46 19C53 12 70 9 86 13L100 19L95 25C84 25 72 26 63 29C49 27 33 28 19 31L10 28Z"/>
  <path d="M44 116 41 78C35 64 37 48 46 39C48 30 56 24 63 26C70 22 78 27 78 37C81 44 81 53 79 60L85 55C92 53 96 60 93 68L84 82 82 116Z"/></g></svg>`;

export function euchreTv(ctx: TvCtx): GameView {
  let alive = true;
  let state: EuchrePublic | null = null;
  let trickKey = "";
  /** While a deal is flying: when it started and the seat each card goes to, so seats fill up card by card. */
  let deal: { start: number; order: number[] } | null = null;
  let dealTimers: ReturnType<typeof setTimeout>[] = [];
  document.body.classList.add("theme-mi");
  ctx.el.innerHTML = `
  <div class="euchre-tv">
    ${SCENERY}
    <header class="eu-scores" id="eu-scores"></header>
    <div class="eu-table">
      <div class="eu-felt">
        ${MITTEN}
        <div class="eu-center" id="eu-center"></div>
        <div class="eu-trick" id="eu-trick"></div>
      </div>
      ${POS.map((p, i) => `<div class="eu-seat pos-${p}" id="eu-seat-${i}"></div>`).join("")}
    </div>
    <footer class="ticker"><div class="ticker-main" id="eu-turn"></div><div class="ticker-sub" id="eu-log"></div></footer>
    <section class="eu-banner" id="eu-banner" hidden></section>
    <section class="eu-teams-tv" id="eu-teams" hidden></section>
    <section class="tv-results overlay" id="eu-results" hidden></section>
  </div>`;

  const name = (pid: string | null) => esc(state?.players.find((p) => p.id === pid)?.name ?? "Someone");
  const seatIndex = (pid: string) => state?.players.findIndex((p) => p.id === pid) ?? -1;
  const teamLabel = (t: 0 | 1) => `${TEAM_EMOJI[t]} ${TEAM_NAMES[t]}`;

  function update(snap: GameSnap<EuchrePublic>) {
    const prev = state;
    state = snap.pub;
    render(snap.pub, prev);
    if (!snap.first) react(snap.events as EuchreEvent[]);
  }

  function render(s: EuchrePublic, prev: EuchrePublic | null) {
    const root = ctx.el.querySelector<HTMLElement>(".euchre-tv")!;
    root.style.setProperty("--ts", String(s.table || 1));
    const picking = s.phase === "teams";
    root.classList.toggle("picking", picking);
    $("#eu-teams").hidden = !picking;
    if (picking) {
      ctx.setStatus(`Euchre · choosing sides · first to ${s.target}`);
      renderTeams(s);
      renderResults(s);
      return;
    }
    ctx.setStatus(`Euchre · Hand <b>${s.hand}</b> · first to ${s.target}`);
    renderScores(s);
    renderCenter(s);
    renderSeats(s);
    renderTrick(s, prev);
    const cur = s.players.find((p) => p.id === s.turnId);
    if (cur) {
      const doing = s.phase === "bid1" ? (cur.id === s.dealerId ? "picks it up or passes" : "orders it up or passes") : s.phase === "bid2" ? "names trump or passes" : s.phase === "discard" ? "is discarding" : "plays";
      $("#eu-turn").innerHTML = `${avatar(cur, "sm")} <b>${esc(cur.name)}</b> ${doing}${cur.connected ? "" : ` <span class="tag-off">(phone disconnected)</span>`}`;
    } else if (s.trickWinner) $("#eu-turn").innerHTML = `<b>${name(s.trickWinner)}</b> takes the trick`;
    renderBanner(s);
    renderResults(s);
  }

  /** Before the deal: two teams filling up as people pick on their phones. */
  function renderTeams(s: EuchrePublic) {
    const team = (t: 0 | 1) => {
      const members = s.players.filter((p) => s.picks[p.id] === t);
      return `<div class="eu-pick-tv t${t}">
        <h2>${TEAM_EMOJI[t]} ${TEAM_NAMES[t]}</h2>
        <div class="eu-pick-tv-slots">${[0, 1]
          .map((i) => {
            const p = members[i];
            return p
              ? `<div class="eu-pick-tv-who">${avatar(p, "xl")}<b>${esc(p.name)}</b>${p.bot ? '<span class="bot-tag">bot</span>' : ""}</div>`
              : `<div class="eu-pick-tv-who empty"><span class="eu-pick-tv-open">?</span><b>Open seat</b></div>`;
          })
          .join("")}</div>
      </div>`;
    };
    const undecided = s.players.filter((p) => s.picks[p.id] === undefined);
    $("#eu-teams").innerHTML = `
      <h1>Pick your partner</h1>
      <p>Choose a team on your phone. Partners sit across the table from each other.</p>
      <div class="eu-pick-tv-row">${team(0)}<div class="eu-pick-tv-vs">vs</div>${team(1)}</div>
      ${undecided.length ? `<div class="eu-pick-tv-undecided"><small>Still choosing</small>${undecided.map((p) => `<span>${avatar(p, "sm")}${esc(p.name)}</span>`).join("")}</div>` : ""}
      <p class="results-next">The host deals from their phone when the teams are set (or press <kbd>Enter</kbd> here). Anyone who hasn't picked fills an open seat.</p>`;
  }

  function renderScores(s: EuchrePublic) {
    const team = (t: 0 | 1) => {
      const members = s.players.filter((p) => p.team === t);
      const pips = Array.from({ length: s.target }, (_, i) => `<i class="${i < s.score[t] ? "on" : ""}"></i>`).join("");
      const making = s.makerId && s.players.find((p) => p.id === s.makerId)?.team === t;
      return `<div class="eu-team t${t} ${making ? "making" : ""}">
        <div class="eu-team-name">${TEAM_EMOJI[t]} ${TEAM_NAMES[t]}</div>
        <div class="eu-team-who">${members.map((p) => `${avatar(p, "xs")}<span>${esc(p.name)}</span>`).join("")}</div>
        <div class="eu-team-score"><b>${s.score[t]}</b><span class="eu-pips">${pips}</span></div>
        <div class="eu-team-tricks">${s.phase === "play" || s.trickWinner || s.phase === "handOver" ? `Tricks this hand: <b>${s.teamTricks[t]}</b>` : "&nbsp;"}</div>
      </div>`;
    };
    let mid: string;
    if (s.trump) {
      const maker = s.players.find((p) => p.id === s.makerId);
      mid = `<div class="eu-trump-chip s-${s.trump}"><small>Trump</small>${suitIcon(s.trump, 64, "currentColor")}<b>${SUIT_NAMES[s.trump]}</b>
        <em>called by ${esc(maker?.name ?? "")}${s.alone ? " · <strong>going alone!</strong>" : ""}</em></div>`;
    } else
      mid = `<div class="eu-trump-chip bidding"><small>Hand ${s.hand}</small><b>${s.phase === "bid2" ? "Name trump" : "Bidding"}</b><em>${
        s.phase === "bid2" ? `${SUIT_NAMES[s.turnedDown!]} was turned down${s.stick ? " · stick the dealer" : ""}` : `Order up the ${s.upcard ? shortCard(s.upcard) : "card"}?`
      }</em></div>`;
    $("#eu-scores").innerHTML = `${team(0)}${mid}${team(1)}`;
  }

  function renderCenter(s: EuchrePublic) {
    const el = $("#eu-center");
    if (s.phase === "bid1" && s.upcard) el.innerHTML = `<div class="eu-kitty">${ecardHtml(null, "eu-kitty-back")}${ecardHtml(s.upcard, "eu-upcard")}</div><small>Turned up</small>`;
    else if (s.phase === "bid2") el.innerHTML = `<div class="eu-kitty">${ecardHtml(null, "eu-kitty-back")}</div><small>${SUIT_NAMES[s.turnedDown!]} turned down</small>`;
    else if (s.trump && !s.trick.length) el.innerHTML = `<div class="eu-big-trump s-${s.trump}">${suitIcon(s.trump, 120, "currentColor")}</div>`;
    else el.innerHTML = "";
  }

  /** How many cards a seat shows: during the deal, only the ones that have landed. */
  function backsShown(seat: number, count: number) {
    if (!deal) return count;
    const t = performance.now() - deal.start;
    const landed = deal.order.filter((s, i) => s === seat && landsAt(i) <= t).length;
    return Math.min(count, landed);
  }

  function renderSeats(s: EuchrePublic) {
    const bidding = s.phase === "bid1" || s.phase === "bid2" || s.phase === "discard";
    s.players.forEach((p, i) => {
      const el = $(`#eu-seat-${i}`);
      el.dataset.pid = p.id;
      const out = s.outId === p.id;
      el.className = `eu-seat pos-${POS[i]} t${p.team} ${s.turnId === p.id ? "turn" : ""} ${out ? "out" : ""} ${p.connected ? "" : "offline"}`;
      const backs = Math.min(backsShown(i, p.count), 6);
      el.innerHTML = `
        ${avatar(p)}
        <div class="eu-seat-info">
          <div class="eu-seat-name">${esc(p.name)}${p.bot ? ' <span class="bot-tag">bot</span>' : ""}</div>
          <div class="eu-seat-tags">
            <span class="eu-team-dot t${p.team}">${TEAM_EMOJI[p.team]}</span>
            ${s.dealerId === p.id ? `<span class="eu-dealer">Dealer</span>` : ""}
            ${s.makerId === p.id ? `<span class="eu-maker">Called it${s.alone ? " · alone" : ""}</span>` : ""}
            ${out ? `<span class="eu-out">Sitting out</span>` : ""}
          </div>
          <div class="eu-seat-hand">${out ? "" : Array.from({ length: backs }, () => "<i></i>").join("")}${
            p.tricks ? `<span class="eu-taken">${"▮".repeat(p.tricks)} ${p.tricks} trick${p.tricks === 1 ? "" : "s"}</span>` : ""
          }</div>
        </div>
        ${bidding && p.bid ? `<div class="eu-bid ${p.bid === "Pass" ? "pass" : "call"}">${esc(p.bid)}</div>` : ""}`;
    });
  }

  function renderTrick(s: EuchrePublic, prev: EuchrePublic | null) {
    const el = $("#eu-trick");
    const key = s.trick.map((t) => t.card.id).join(",") + (s.trickWinner ?? "");
    if (key === trickKey) return;
    const before = new Set((prev?.trick ?? []).map((t) => t.card.id));
    trickKey = key;
    // The trick was just collected: sweep the old cards toward whoever won it.
    if (!s.trick.length && prev?.trickWinner && prev.trick.length && !reducedMotion()) {
      const w = POS[seatIndex(prev.trickWinner)] ?? "bottom";
      const [dx, dy] = DIR[w];
      for (const c of el.querySelectorAll<HTMLElement>(".eu-slot")) {
        c.animate([{ translate: "0 0", opacity: 1 }, { translate: `${dx * 26}vmin ${dy * 22}vmin`, opacity: 0, scale: 0.6 }], { duration: 450, easing: "ease-in", fill: "forwards" });
      }
      setTimeout(() => alive && !state?.trick.length && (el.innerHTML = ""), 460);
      return;
    }
    el.innerHTML = s.trick
      .map((t, n) => {
        const pos = POS[seatIndex(t.pid)] ?? "bottom";
        const win = s.trickWinner === t.pid;
        return `<div class="eu-slot pos-${pos} ${win ? "win" : ""}" data-card="${t.card.id}" style="--n:${n}">${ecardHtml(t.card)}</div>`;
      })
      .join("");
    if (reducedMotion()) return;
    for (const t of s.trick) {
      if (before.has(t.card.id)) continue;
      // The card flies from the player's seat into their spot in front of them.
      const slot = el.querySelector<HTMLElement>(`[data-card="${t.card.id}"]`);
      const seat = document.getElementById(`eu-seat-${seatIndex(t.pid)}`)?.getBoundingClientRect();
      if (!slot || !seat) continue;
      const to = slot.getBoundingClientRect();
      const dx = seat.left + seat.width / 2 - (to.left + to.width / 2);
      const dy = seat.top + seat.height / 2 - (to.top + to.height / 2);
      const spin = ((t.card.id * 47) % 50) - 25;
      slot.animate(
        [{ translate: `${dx}px ${dy}px`, rotate: `${spin}deg`, scale: 0.7, opacity: 0.4 }, { opacity: 1, offset: 0.25 }, { translate: "0 0", rotate: "0deg", scale: 1, opacity: 1 }],
        { duration: 520, easing: "cubic-bezier(.2,.8,.25,1)" },
      );
    }
  }

  function renderBanner(s: EuchrePublic) {
    const el = $("#eu-banner");
    const r = s.lastResult;
    if (s.phase !== "handOver" || !r) {
      el.hidden = true;
      return;
    }
    const scorers = teamLabel(r.team);
    const head = r.euchred ? "Euchred! 🪶" : r.tricks === 5 ? (r.alone ? "Alone, and all five!" : "A march! All five tricks") : `${r.tricks} tricks`;
    const line = r.euchred ? `${teamLabel(r.makers)} called it but only took ${r.tricks}. ${scorers} get <b>+2</b>` : `${scorers} ${r.points === 1 ? "get <b>+1</b>" : `get <b>+${r.points}</b>`}`;
    el.className = `eu-banner t${r.team} ${r.euchred ? "euchred" : ""}`;
    el.innerHTML = `<h2>${head}</h2><p>${line}</p><div class="eu-banner-score">${TEAM_EMOJI[0]} <b>${s.score[0]}</b> · <b>${s.score[1]}</b> ${TEAM_EMOJI[1]}</div><small>Next hand coming up…</small>`;
    el.hidden = false;
  }

  function renderResults(s: EuchrePublic) {
    const el = $("#eu-results");
    if (s.phase !== "gameOver" || s.winnerTeam === null) {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    const key = `${s.hand}-${s.winnerTeam}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const t = s.winnerTeam;
    const winners = s.players.filter((p) => p.team === t);
    el.innerHTML = `
      <div class="results-card eu-results-card t${t}">
        <div class="results-head">
          <div class="eu-winners">${winners.map((p) => avatar(p, "xl")).join("")}</div>
          <h1>${teamLabel(t)} wins, ${s.score[t]} to ${s.score[1 - t]}!</h1>
          <p class="results-points">${winners.map((p) => esc(p.name)).join(" & ")}. Good game, up north. 🌲</p>
        </div>
        <p class="results-next">The host can play again or pick another game, or press <kbd>Enter</kbd> here to play again.</p>
      </div>`;
    setTimeout(() => {
      if (!alive || state?.phase !== "gameOver") return;
      el.hidden = false;
      confetti(el);
    }, 1600);
  }

  function bubble(pid: string, text: string, kind: "good" | "bad") {
    const i = seatIndex(pid);
    const seat = i >= 0 ? $(`#eu-seat-${i}`) : null;
    if (!seat) return;
    const b = document.createElement("div");
    b.className = `bubble ${kind}`;
    b.textContent = text;
    seat.append(b);
    setTimeout(() => b.remove(), 2000);
  }

  /** The deal: one card at a time from the deck, round the table from the dealer's left. Each phone
   *  shows its card as it lands here (see deal.ts for the shared timing). */
  function dealAnimation(dealer: string) {
    const ps = state?.players ?? [];
    const center = $("#eu-center").getBoundingClientRect();
    const w = Math.min(innerWidth, innerHeight) * 0.075;
    const from = new DOMRect(center.left + center.width / 2 - w / 2, center.top + center.height / 2 - w * 0.75, w, w * 1.5);
    const d = Math.max(0, ps.findIndex((p) => p.id === dealer));
    const order = dealOrder(ps.length, d);
    for (const t of dealTimers) clearTimeout(t);
    deal = { start: performance.now(), order };
    order.forEach((seat, i) => {
      const r = document.getElementById(`eu-seat-${seat}`)?.getBoundingClientRect();
      if (!r) return;
      const to = new DOMRect(r.left + r.width / 2 - w * 0.4, r.top + r.height / 2 - w * 0.6, w * 0.8, w * 1.2);
      fly(ecardEl(null), from, to, { delay: leavesAt(i), duration: DEAL_FLY, spin: (seat % 2 ? 1 : -1) * 25 });
    });
    // Each seat's hand grows as its cards land.
    dealTimers = order.map((_, i) => setTimeout(() => alive && state && renderSeats(state), landsAt(i)));
    const done = landsAt(order.length - 1);
    dealTimers.push(setTimeout(() => (deal = null), done + 50));
    if (state) renderSeats(state);
    // The turned-up card flips over last.
    document.querySelector("#eu-center .eu-upcard")?.animate([{ scale: "0 1", opacity: 0 }, { scale: "0 1", opacity: 0, offset: 0.01 }, { scale: "1 1", opacity: 1 }], { duration: 300, delay: done + 100, fill: "backwards" });
  }

  function react(events: EuchreEvent[]) {
    const log: string[] = [];
    for (const e of events) {
      switch (e.type) {
        case "deal":
          audio.shuffle();
          if (!reducedMotion()) dealAnimation(e.dealer);
          log.push(`Hand ${e.hand}: ${name(e.dealer)} deals and turns up the ${shortCard(e.upcard)}`);
          break;
        case "pass":
          audio.tick();
          break;
        case "trump":
          audio.cardPlay("wild");
          bubble(e.pid, e.alone ? "Going alone!" : e.round === 1 ? "Order it up!" : `${SUIT_NAMES[e.suit]}!`, "good");
          log.push(`${name(e.pid)} ${e.round === 1 ? "ordered up" : "named"} ${SUIT_NAMES[e.suit]}${e.alone ? ", going alone" : ""}`);
          break;
        case "pickup":
          audio.draw(1);
          log.push(`${name(e.pid)} picks up the ${shortCard(e.card)}`);
          break;
        case "redeal":
          audio.shuffle();
          log.push("Everybody passed. Throw 'em in, next dealer");
          break;
        case "play":
          audio.cardPlay("normal");
          break;
        case "trick":
          setTimeout(() => audio.pop(), 250);
          log.push(`${name(e.winner)} takes the trick for ${TEAM_EMOJI[e.team]}`);
          break;
        case "hand":
          if (e.result.euchred) setTimeout(() => audio.loon(), 300);
          else if (e.result.points >= 2) setTimeout(() => audio.fanfare(), 300);
          break;
        case "gameOver":
          setTimeout(() => audio.fanfare(), 1500);
          break;
        case "standIn":
          log.push(`A bot is keeping ${name(e.pid)}'s seat warm`);
          break;
        case "picked":
          audio.tick();
          break;
      }
    }
    if (log.length) $("#eu-log").innerHTML = log.slice(-3).join(" <span class='dot'>•</span> ");
  }

  return {
    update,
    onEnter() {
      if (state?.phase === "gameOver") ctx.send({ t: "restart" });
      else if (state?.phase === "teams") ctx.send({ t: "deal" });
    },
    destroy() {
      alive = false;
      for (const t of dealTimers) clearTimeout(t);
      document.body.classList.remove("theme-mi");
      ctx.el.innerHTML = "";
    },
  };
}

