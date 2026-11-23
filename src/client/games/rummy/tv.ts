// Contract Rummy on the TV: the contract, the piles, and everyone's laid-down groups.

import type { RummyEvent, RummyPublic } from "../../../shared/games/rummy/engine";
import { audio } from "../../audio";
import { confetti } from "../../fx";
import type { PCard } from "../../../shared/games/rummy/cards";
import { pcardEl, pcardHtml, shortCard } from "../../playingCards";
import { $, avatar, esc, fly, reducedMotion } from "../../ui";
import { DEAL_FLY, dealDuration, dealOrder, dealStep, landsAt, leavesAt, TURN_UP_FLY, turnUpAt } from "../../../shared/games/rummy/deal";
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

  /** While a deal is flying: when it started, the seat each card goes to and the time between cards. */
  let deal: { start: number; order: number[]; step: number } | null = null;
  let dealTimers: ReturnType<typeof setTimeout>[] = [];
  /** When the latest update arrived: the deal's clock starts then, on the TV and on every phone. */
  let receivedAt = 0;
  /** The top of the discard pile before the latest update, shown under a card being discarded. */
  let prevTop: PCard | null = null;

  function update(snap: GameSnap<RummyPublic>) {
    receivedAt = performance.now();
    prevTop = state?.discardTop ?? null;
    state = snap.pub;
    render(snap.pub);
    if (!snap.first) react(snap.events as RummyEvent[]);
    else {
      // The game screen appears with the opening deal itself.
      const deal = (snap.events as RummyEvent[]).find((e) => e.type === "deal");
      if (deal && deal.type === "deal" && !reducedMotion()) dealAnimation(deal.first);
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
      .map((p, i) => {
        const melds = s.melds.filter((m) => m.owner === p.id);
        const fan = Math.min(cardsShown(i, p.count), 14);
        return `<div class="rm-board ${s.turnId === p.id ? "turn" : ""} ${p.connected ? "" : "offline"}" data-pid="${esc(p.id)}">
          <div class="rm-head">
            ${avatar(p, "sm")}
            <div class="rm-who"><div class="rm-name"><b>${esc(p.name)}</b>${p.bot ? ' <span class="bot-tag">bot</span>' : ""}${p.id === s.hostId ? ' <i class="crown">♛</i>' : ""}</div>
              <small><span class="rm-count">${countText(cardsShown(i, p.count))}</span> · ${p.score} pts${p.buys ? ` · ${p.buys} May I` : ""}</small></div>
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

  const countText = (n: number) => `${n} card${n === 1 ? "" : "s"}`;

  /** How many cards a player shows: during the deal, only the ones that have landed. */
  function cardsShown(seat: number, count: number) {
    if (!deal) return count;
    // A timer can fire a hair before its time: count a card as landed just before it does.
    const t = performance.now() - deal.start + 20;
    const landed = deal.order.filter((s, i) => s === seat && landsAt(i, deal!.step) <= t).length;
    return Math.min(count, landed);
  }

  /** During the deal: grow each player's fan of card backs as their cards land. */
  function updateFans() {
    if (!state) return;
    state.players.forEach((p, i) => {
      const b = boardOf(p.id);
      const n = cardsShown(i, p.count);
      const fan = b?.querySelector(".rm-fan");
      if (fan && fan.childElementCount !== Math.min(n, 14)) fan.innerHTML = "<i></i>".repeat(Math.min(n, 14));
      const c = b?.querySelector(".rm-count");
      if (c) c.textContent = countText(n);
    });
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
  function flyOnto(card: PCard | null, from: DOMRect | null, target: HTMLElement | null | undefined, delay: number, spin = 0, duration = 520) {
    if (!from || !target) return;
    target.style.visibility = "hidden";
    fly(pcardEl(card), from, target.getBoundingClientRect(), { delay, spin, duration }).then(() => (target.style.visibility = ""));
  }

  /** A discard: the card slides from the player's hand across to the pile. Until it lands, the pile
   *  keeps showing the card that was on top before (or stays empty), so it never blinks out. */
  function flyToDiscard(card: PCard, from: DOMRect | null, under: PCard | null, delay: number) {
    const target = q("#rm-discard .pcard");
    if (!from || !target) return;
    const to = target.getBoundingClientRect();
    const stand = under ? pcardEl(under, "rm-pile rm-top-discard") : null;
    if (stand) target.replaceWith(stand);
    else target.style.visibility = "hidden";
    // Made when it leaves the hand, so a face-up card never waits there before its turn.
    setTimeout(() => {
      if (!alive) return;
      fly(pcardEl(card), from, to, { spin: spinOf(card) - 30, duration: 700 }).then(() => {
        if (stand?.isConnected) stand.replaceWith(target);
        target.style.visibility = "";
      });
    }, delay);
  }
  const spinOf = (c: PCard) => ((c.id * 47) % 34) - 17;

  /** The deal: one card at a time from the deck, round the table starting with the first player.
   *  Each phone shows its card as it lands on that player's board (timing in shared/games/rummy/deal.ts). */
  function dealAnimation(first: string) {
    if (!state) return;
    const start = receivedAt;
    const ps = state.players;
    const seats = ps.length;
    const each = Math.min(...ps.map((p) => p.count));
    const step = dealStep(seats * each);
    const order = dealOrder(seats, Math.max(0, ps.findIndex((p) => p.id === first)), each);
    for (const t of dealTimers) clearTimeout(t);
    deal = { start, order, step };
    updateFans();
    const at = (ms: number) => Math.max(0, ms - (performance.now() - start));
    // Each player's fan grows as their cards land.
    dealTimers = [...new Set(order.map((_, i) => landsAt(i, step)))].map((ms) => setTimeout(() => alive && updateFans(), at(ms)));
    dealTimers.push(
      setTimeout(() => {
        deal = null;
        if (alive) updateFans();
      }, at(dealDuration(seats, each))),
    );
    // The turned-up card stays hidden until it lands on the discard pile.
    const discard = q("#rm-discard .pcard");
    if (discard) discard.style.visibility = "hidden";
    // Wait for layout so the deck and the boards have their real sizes.
    const go = (retries: number) => {
      const from = stockBox();
      if (!from || from.width < 8) {
        if (retries > 0) setTimeout(() => alive && go(retries - 1), 80);
        else if (discard) discard.style.visibility = "";
        return;
      }
      // Each card is made when it leaves the deck, so nothing waits in a pile on top of it
      // (and the turned-up card can't be seen early).
      order.forEach((seat, i) => {
        const to = handOf(ps[seat]!.id);
        const delay = at(leavesAt(i, step));
        if (to && delay > 0) dealTimers.push(setTimeout(() => alive && fly(pcardEl(null), from, to, { duration: DEAL_FLY, spin: (seat % 2 ? 1 : -1) * 20 }), delay));
      });
      const top = state?.discardTop ?? null;
      if (discard) dealTimers.push(setTimeout(() => alive && flyOnto(top, from, discard, 0, -12, TURN_UP_FLY), at(turnUpAt(seats, each))));
    };
    afterLayout(() => go(1));
  }

  function react(events: RummyEvent[]) {
    const log: string[] = [];
    const quick = reducedMotion();
    let delay = 0;
    // What's on top of the discard pile as the events play out, to show under a new discard.
    let top = prevTop;
    for (const e of events) {
      if (!quick) delay = animate(e, delay, top);
      if (e.type === "discard") top = e.card;
      else if (e.type === "deal" || e.type === "reshuffle" || e.type === "bought" || (e.type === "draw" && e.from === "discard")) top = null;
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
  function animate(e: RummyEvent, delay: number, top: PCard | null): number {
    const meldCards = (id: number) => [...document.querySelectorAll<HTMLElement>(`[data-meld="${id}"] .pcard`)];
    switch (e.type) {
      case "deal": {
        // The deal starts when it arrives (the phones count from then too), not after earlier events.
        dealAnimation(e.first);
        const ps = state?.players ?? [];
        return Math.max(delay, ps.length ? dealDuration(ps.length, Math.min(...ps.map((p) => p.count))) : 0);
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
        flyToDiscard(e.card, handOf(e.pid), top, delay);
        return delay + 450;
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
      for (const t of dealTimers) clearTimeout(t);
      ctx.el.innerHTML = "";
    },
  };
}
