// Contract Rummy on the TV: the contract, the piles, and everyone's laid-down groups.

import type { RummyEvent, RummyPublic } from "../../../shared/games/rummy/engine";
import { audio } from "../../audio";
import { confetti } from "../../fx";
import type { PCard } from "../../../shared/games/rummy/cards";
import { pcardEl, pcardHtml, shortCard } from "../../playingCards";
import { $, avatar, esc, fly, reducedMotion } from "../../ui";
import type { GameSnap, GameView, TvCtx } from "../types";

export function rummyTv(ctx: TvCtx): GameView {
  let alive = true;
  let state: RummyPublic | null = null;
  ctx.el.innerHTML = `
  <div class="rummy-tv">
    <div class="rm-top">
      <div class="rm-contract" id="rm-contract"></div>
      <div class="rm-piles">
        <div class="rm-stock" id="rm-stock"></div>
        <div class="rm-discard" id="rm-discard"></div>
      </div>
      <div class="rm-mayi" id="rm-mayi"></div>
    </div>
    <div class="rm-boards" id="rm-boards"></div>
    <footer class="ticker"><div class="ticker-main" id="rm-turn"></div><div class="ticker-sub" id="rm-log"></div></footer>
    <section class="tv-results overlay" id="rm-results" hidden></section>
  </div>`;

  const names = (pid: string) => esc(state?.players.find((p) => p.id === pid)?.name ?? "Someone");

  /** Wait two animation frames so the just-rendered table has real sizes. */
  function afterLayout(fn: () => void) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (alive) fn();
    }));
  }

  /** Rounds of cards dealt around the table before the discard lands. */
  const DEAL_ROUNDS = 3;

  /** How long the deal animation lasts for `n` players. */
  function dealDuration(n: number) {
    return DEAL_ROUNDS * n * 85 + 500;
  }

  function update(snap: GameSnap<RummyPublic>) {
    state = snap.pub;
    render(snap.pub);
    if (!snap.first) react(snap.events as RummyEvent[]);
    else {
      // Opening deal: wait for layout so the stock and hand targets have real rects.
      const deal = (snap.events as RummyEvent[]).find((e) => e.type === "deal");
      if (deal && deal.type === "deal" && !reducedMotion()) {
        afterLayout(() => dealAnimation(deal.first));
      }
    }
  }

  function render(s: RummyPublic) {
    ctx.setStatus(`Contract Rummy · Round <b>${s.round}</b> of ${s.rounds}`);
    $("#rm-contract").innerHTML = `<small>Round ${s.round} of ${s.rounds} · contract</small><b>${esc(s.contractText)}</b>`;
    $("#rm-stock").innerHTML = `${pcardHtml(null, "rm-pile")}<span>${s.stockCount} left</span>`;
    $("#rm-discard").innerHTML = s.discardTop ? `${pcardHtml(s.discardTop, "rm-pile rm-top-discard")}<span>Discard</span>` : `<div class="rm-empty">Empty</div><span>Discard</span>`;
    $("#rm-mayi").innerHTML = s.mayI.length ? `🙋 ${s.mayI.map((pid) => `<b>${names(pid)}</b>`).join(", ")} asked “May I?”` : "";

    const boards = $("#rm-boards");
    boards.style.setProperty("--n", String(s.players.length));
    boards.innerHTML = s.players
      .map((p) => {
        const melds = s.melds.filter((m) => m.owner === p.id);
        const fan = Math.min(p.count, 14);
        return `<div class="rm-board ${s.turnId === p.id ? "turn" : ""} ${p.connected ? "" : "offline"}" data-pid="${esc(p.id)}">
          <div class="rm-head">
            ${avatar(p, "sm")}
            <div class="rm-who"><div class="rm-name"><b>${esc(p.name)}</b>${p.bot ? ' <span class="bot-tag">bot</span>' : ""}${p.id === s.hostId ? ' <i class="crown">♛</i>' : ""}</div>
              <small>${p.count} card${p.count === 1 ? "" : "s"} · ${p.score} pts${p.buys ? ` · ${p.buys} May I` : ""}</small></div>
            ${p.partial ? `<span class="rm-part">Part down</span>` : ""}
            ${p.down ? `<span class="rm-down">✓ Down</span>` : `<span class="rm-fan">${Array.from({ length: fan }, () => "<i></i>").join("")}</span>`}
          </div>
          <div class="rm-melds">${
            melds.length
              ? melds.map((m) => `<div class="rm-meld" data-meld="${m.id}"><span class="rm-kind">${m.kind}</span>${m.cards.map((c) => pcardHtml(c, "rm-mini")).join("")}</div>`).join("")
              : `<span class="muted">${p.down ? "" : "Not down yet"}</span>`
          }</div>
        </div>`;
      })
      .join("");
    fitBoards(s.table);

    if (s.phase === "playing" && s.turnId) {
      const p = s.players.find((x) => x.id === s.turnId)!;
      $("#rm-turn").innerHTML = `${avatar(p, "sm")} <b>${esc(p.name)}</b> ${s.stage === "draw" ? "is drawing" : "is playing"}${p.connected ? "" : ` <span class="tag-off">(phone disconnected)</span>`}`;
    } else if (s.roundWinner) $("#rm-turn").innerHTML = `<b>${names(s.roundWinner)}</b> went out!`;
    renderResults(s);
  }

  /** The host picks the card size; if that many groups won't fit, shrink until they do. */
  function fitBoards(want: number) {
    const root = ctx.el.querySelector<HTMLElement>(".rummy-tv")!;
    const boards = $("#rm-boards");
    let ts = want || 1;
    root.style.setProperty("--ts", String(ts));
    while (ts > 0.7 && boards.scrollHeight > boards.clientHeight + 2) {
      ts = Math.round((ts - 0.1) * 100) / 100;
      root.style.setProperty("--ts", String(ts));
    }
  }

  function renderResults(s: RummyPublic) {
    const el = $("#rm-results");
    if (s.phase === "playing") {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    const key = `${s.phase}-${s.round}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const over = s.phase === "gameOver";
    const ranked = [...s.players].sort((a, b) => a.score - b.score);
    const winner = over ? ranked[0] : s.players.find((p) => p.id === s.roundWinner);
    el.innerHTML = `
      <div class="results-card">
        <div class="results-head">
          ${winner ? avatar(winner, "xl") : ""}
          <h1>${over ? `${esc(winner?.name)} wins with ${winner?.score} points!` : `${esc(winner?.name)} went out in round ${s.round}!`}</h1>
          <p class="results-points">${over ? "Lowest score wins." : `Next: ${esc(s.plan[s.round] ?? "")}`}</p>
        </div>
        <table class="rm-scores">
          <thead><tr><th></th>${s.plan.map((_, i) => `<th>${i + 1}</th>`).join("")}<th>Total</th></tr></thead>
          <tbody>${ranked
            .map(
              (p) => `<tr class="${p.id === s.roundWinner ? "win" : ""}"><td>${avatar(p, "xs")} ${esc(p.name)}</td>${s.plan
                .map((_, i) => `<td>${p.roundScores[i] ?? ""}</td>`)
                .join("")}<td><b>${p.score}</b></td></tr>`,
            )
            .join("")}</tbody>
        </table>
        <p class="results-next">${over ? "The host can play again or pick another game" : "The host deals the next round from their phone"} — or press <kbd>Enter</kbd> here.</p>
      </div>`;
    setTimeout(() => {
      if (!alive || state?.phase === "playing") return;
      el.hidden = false;
      if (over) confetti(el);
    }, 1000);
  }

  function boardOf(pid: string) {
    return document.querySelector<HTMLElement>(`.rm-board[data-pid="${CSS.escape(pid)}"]`);
  }

  function bubble(pid: string, text: string, kind: "good" | "bad") {
    const b = boardOf(pid);
    if (!b) return;
    const el = document.createElement("div");
    el.className = `bubble ${kind}`;
    el.textContent = text;
    b.append(el);
    setTimeout(() => el.remove(), 1900);
  }

  /** Like $, but null when it isn't there (an empty discard pile, nobody down yet). */
  const q = (sel: string) => document.querySelector<HTMLElement>(sel);

  // ---------- cards flying around the table ----------

  /** A card-sized box centred on an element (where a flying card starts or lands). */
  function cardBox(el: Element | null | undefined, w: number): DOMRect | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return new DOMRect(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - (w * 1.5) / 2, w, w * 1.5);
  }
  const miniW = () => (q("#rm-boards .rm-mini") as HTMLElement | null)?.getBoundingClientRect().width || innerHeight * 0.054;
  /** Where a player's hand is on the TV: their little fan of card backs (or their name once down). */
  const handOf = (pid: string) => cardBox(boardOf(pid)?.querySelector(".rm-fan, .rm-down, .rm-head .avatar"), miniW());
  const stockBox = () => q("#rm-stock .pcard")?.getBoundingClientRect() ?? null;

  /** Fly a card onto a card that's already drawn in place (hidden until it lands). */
  function flyOnto(card: PCard | null, from: DOMRect | null, target: HTMLElement | null | undefined, delay: number, spin = 0) {
    if (!from || !target) return;
    target.style.visibility = "hidden";
    fly(pcardEl(card), from, target.getBoundingClientRect(), { delay, spin, duration: 520 }).then(() => (target.style.visibility = ""));
  }
  const spinOf = (c: PCard) => ((c.id * 47) % 34) - 17;

  /** The deal: card backs go round the table from the deck, a few each. */
  function dealAnimation(first: string, retries = 1) {
    if (!state) return;
    const from = stockBox();
    if (!from || from.width < 8) {
      if (retries > 0) setTimeout(() => alive && dealAnimation(first, retries - 1), 80);
      return;
    }
    const ps = state.players;
    const start = Math.max(0, ps.findIndex((p) => p.id === first));
    const n = ps.length;
    for (let k = 0; k < DEAL_ROUNDS; k++)
      for (let j = 0; j < n; j++) {
        const p = ps[(start + j) % n]!;
        const to = handOf(p.id);
        if (to) fly(pcardEl(null), from, to, { delay: (k * n + j) * 85, duration: 430, spin: (j % 2 ? 1 : -1) * 20 });
      }
    const discard = q("#rm-discard .pcard") as HTMLElement | null;
    if (discard) flyOnto(state.discardTop ?? null, from, discard, DEAL_ROUNDS * n * 85 + 150, -12);
  }

  function react(events: RummyEvent[]) {
    const log: string[] = [];
    const quick = reducedMotion();
    let delay = 0;
    for (const e of events) {
      if (!quick) delay = animate(e, delay);
      switch (e.type) {
        case "deal":
          audio.shuffle();
          log.push(`Round ${e.round}: ${esc(e.contract)}. ${names(e.first)} goes first`);
          break;
        case "draw":
          audio.draw(1);
          log.push(e.from === "discard" && e.card ? `${names(e.pid)} took the ${shortCard(e.card)}` : `${names(e.pid)} drew from the deck`);
          break;
        case "mayI":
          audio.tick();
          bubble(e.pid, "May I?", "good");
          break;
        case "bought":
          audio.pop();
          bubble(e.pid, `Got it! +1`, "good");
          log.push(`${names(e.pid)} bought the ${shortCard(e.card)} (+1 card)`);
          break;
        case "down":
          audio.cardPlay("wild");
          bubble(e.pid, e.partial ? "Part down!" : "Down! ✓", "good");
          log.push(e.partial ? `${names(e.pid)} laid down part of their contract` : `${names(e.pid)} laid down their contract`);
          break;
        case "hit":
          audio.cardPlay("normal");
          log.push(`${names(e.pid)} added ${e.cards.map(shortCard).join(" ")} to a group`);
          break;
        case "discard":
          audio.cardPlay("normal");
          log.push(`${names(e.pid)} discarded the ${shortCard(e.card)}`);
          break;
        case "reshuffle":
          audio.shuffle();
          log.push("Reshuffled the discards into the deck");
          break;
        case "out":
          setTimeout(() => audio.fanfare(), 400);
          bubble(e.pid, "Out! 🎉", "good");
          break;
      }
    }
    if (log.length) $("#rm-log").innerHTML = log.slice(-3).join(" <span class='dot'>•</span> ");
  }

  /** Start this event's flying cards `delay` ms from now; returns when the next event's should start. */
  function animate(e: RummyEvent, delay: number): number {
    const meldCards = (id: number) => [...document.querySelectorAll<HTMLElement>(`[data-meld="${id}"] .pcard`)];
    switch (e.type) {
      case "deal": {
        const dur = state ? dealDuration(state.players.length) : 800;
        setTimeout(() => afterLayout(() => dealAnimation(e.first)), delay);
        return delay + dur;
      }
      case "draw": {
        const to = handOf(e.pid);
        const from = e.from === "discard" ? cardBox(q("#rm-discard"), q("#rm-stock .pcard")?.getBoundingClientRect().width ?? 60) : stockBox();
        if (from && to) fly(pcardEl(e.from === "discard" ? (e.card ?? null) : null), from, to, { delay, duration: 480 });
        return delay + 260;
      }
      case "bought": {
        const to = handOf(e.pid);
        const from = cardBox(q("#rm-discard"), q("#rm-stock .pcard")?.getBoundingClientRect().width ?? 60);
        if (from && to) fly(pcardEl(e.card), from, to, { delay, duration: 480 });
        const stock = stockBox();
        if (stock && to) fly(pcardEl(null), stock, to, { delay: delay + 200, duration: 480 });
        return delay + 420;
      }
      case "down": {
        // Each new group's cards fly out of the player's hand into place, one after another.
        const from = handOf(e.pid);
        let k = 0;
        for (const id of e.melds) {
          const m = state?.melds.find((x) => x.id === id);
          meldCards(id).forEach((el, i) => m?.cards[i] && flyFace(m.cards[i]!, from, el, delay + k++ * 70));
        }
        return delay + k * 70 + 300;
      }
      case "hit": {
        const from = handOf(e.pid);
        const els = meldCards(e.meldId);
        e.cards.forEach((c, i) => flyFace(c, from, els.find((el) => el.dataset.id === String(c.id)), delay + i * 90));
        return delay + e.cards.length * 90 + 250;
      }
      case "discard": {
        flyFace(e.card, handOf(e.pid), q("#rm-discard .pcard") as HTMLElement | null, delay, spinOf(e.card) - 30);
        return delay + 380;
      }
      default:
        return delay;
    }
  }

  function flyFace(card: PCard, from: DOMRect | null, target: HTMLElement | null | undefined, delay: number, spin = 0) {
    flyOnto(card, from, target, delay, spin);
  }

  return {
    update,
    onEnter() {
      if (state && state.phase !== "playing") ctx.send({ t: "nextRound" });
    },
    destroy() {
      alive = false;
      ctx.el.innerHTML = "";
    },
  };
}
