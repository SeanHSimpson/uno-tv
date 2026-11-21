// Euchre on a phone: your five cards, a little table showing the trick so far, and the
// bidding buttons (order up / pass / name a suit / go alone) when it's your call.

import type { ECard, EuchreEvent, EuchrePrivate, EuchrePublic, Suit } from "../../../shared/games/euchre/engine";
import { effSuit, power, shortCard, SUIT_NAMES, SUITS, TEAM_EMOJI, TEAM_NAMES } from "../../../shared/games/euchre/engine";
import { audio, haptic } from "../../audio";
import { confetti } from "../../fx";
import { attachReorder, fitHand, HandArranger } from "../../handArrange";
import { $, avatar, esc, toast } from "../../ui";
import { tableSizeMenu } from "../tableSize";
import type { GameSnap, GameView, PhoneCtx } from "../types";
import { ecardEl, ecardHtml, suitIcon } from "./cards";

export function euchrePhone(ctx: PhoneCtx): GameView {
  const pid = ctx.pid;
  const ac = new AbortController();
  let state: EuchrePublic | null = null;
  let me: EuchrePrivate | null = null;
  let isHost = false;
  let selected: number | null = null;
  let alone = false;
  let wasMyTurn = false;
  document.body.classList.add("theme-mi");
  const RANK_ORDER: Record<number, number> = { 1: 6, 13: 5, 12: 4, 11: 3, 10: 2, 9: 1 };
  const trumpNow = () => state?.trump ?? null;
  // "Suit": trump first (bowers on top), then the other suits. "Rank": aces down to nines.
  const suitKey = (c: ECard) => (effSuit(c, trumpNow()) === trumpNow() ? 0 : 1 + SUITS.indexOf(c.suit));
  const arranger = new HandArranger<ECard>(
    "euchre",
    {
      suit: (a, b) => suitKey(a) - suitKey(b) || power(b, trumpNow(), effSuit(b, trumpNow())) - power(a, trumpNow(), effSuit(a, trumpNow())),
      rank: (a, b) => RANK_ORDER[b.rank]! - RANK_ORDER[a.rank]! || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit),
    },
    { defaultMode: "suit" },
  );

  ctx.el.innerHTML = `
  <div class="euchre-phone">
    <section class="eu-ph-status" id="eu-status"></section>
    <section class="eu-ph-table" id="eu-table"></section>
    <section class="eu-ph-bid" id="eu-bid" hidden></section>
    <section class="hand-toolbar" id="eu-tools"></section>
    <main class="hand eu-hand" id="eu-hand" aria-label="Your cards"></main>
    <footer class="eu-ph-actions"><button class="btn btn-primary btn-xl" id="eu-act" hidden></button></footer>
    <section class="eu-ph-teams" id="eu-teams" hidden></section>
    <section class="sheet glance-sheet" id="eu-glance" hidden></section>
    <section class="ph-results overlay" id="eu-results" hidden></section>
  </div>`;

  const send = ctx.send;
  const hand = $("#eu-hand");
  const name = (id: string | null) => esc(state?.players.find((p) => p.id === id)?.name ?? "someone");

  hand.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".pcard");
    if (!el || !me?.myTurn) return;
    const id = Number(el.dataset.id);
    const usable = me.canDiscard || me.legal.includes(id);
    if (!usable) {
      if (state?.phase === "play" && state.trick[0]) toast(`Follow suit if you can: ${followText()}.`, "error");
      return;
    }
    // Tap a card twice (or tap, then the button) to play it.
    if (selected === id) return act();
    selected = id;
    haptic("select");
    audio.tick();
    render();
  });
  $("#eu-act").addEventListener("click", () => act());
  $("#eu-tools").addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const sort = t.closest<HTMLElement>("[data-sort]");
    if (sort) arranger.setMode(sort.dataset.sort as "rank" | "suit" | "free");
    else if (t.closest("[data-layout]")) arranger.toggleLayout();
    else if (t.closest("[data-glance]")) {
      renderGlance();
      ctx.openSheet($("#eu-glance"));
      return;
    } else return;
    haptic("select");
    render();
  });
  const reorder = attachReorder(hand, {
    signal: ac.signal,
    onMove: () => fitHand(hand, arranger, 130),
    onDrop: (ids) => {
      arranger.setOrder(ids);
      haptic("select");
      render();
    },
  });
  $("#eu-bid").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-bid]");
    if (!b || !me?.myTurn) return;
    const kind = b.dataset.bid!;
    if (kind === "alone") {
      alone = !alone;
      haptic("select");
      return render();
    }
    haptic("play");
    if (kind === "pass") send({ t: "pass" });
    else if (kind === "order") send({ t: "order", alone });
    else send({ t: "call", suit: kind as Suit, alone });
  });
  window.addEventListener("resize", () => layoutHand(), { signal: ac.signal });

  function followText() {
    const s = state!;
    const led = s.trick[0]!.card;
    // The left bower counts as trump when it's led.
    const isLeftLed = s.trump && led.rank === 11 && led.suit !== s.trump && (led.suit === "H" || led.suit === "D") === (s.trump === "H" || s.trump === "D");
    return isLeftLed || led.suit === s.trump ? `trump (${SUIT_NAMES[s.trump!]}) was led` : `${SUIT_NAMES[led.suit]} were led`;
  }

  function act() {
    if (!me || selected === null) return;
    if (me.canDiscard) send({ t: "discard", cardId: selected });
    else send({ t: "play", cardId: selected });
    haptic("play");
    selected = null;
  }

  function update(snap: GameSnap<EuchrePublic, EuchrePrivate>) {
    state = snap.pub;
    me = snap.me;
    isHost = snap.room.hostId === pid;
    if (me && selected !== null && !me.hand.some((c) => c.id === selected)) selected = null;
    if (me?.myTurn && !wasMyTurn) {
      alone = false;
      if (!snap.first) {
        haptic("turn");
        audio.turn();
      }
      // Only one card you can play? Have it ready.
      if (me.legal.length === 1) selected = me.legal[0]!;
    }
    if (!me?.myTurn) selected = null;
    wasMyTurn = !!me?.myTurn;
    if (!snap.first) react(snap.events as EuchreEvent[]);
    render();
    if ($("#eu-glance").classList.contains("open")) renderGlance();
  }

  function render() {
    if (!state || !me) return;
    const s = state;
    const m = me;
    document.body.classList.toggle("my-turn", m.myTurn);
    const picking = s.phase === "teams";
    ctx.el.querySelector(".euchre-phone")!.classList.toggle("picking", picking);
    $("#eu-teams").hidden = !picking;
    if (picking) {
      renderTeams(s, m);
      renderResults();
      return;
    }
    renderStatus(s, m);
    renderTable(s, m);
    renderBid(s, m);
    renderHand(m);
    const btn = $("#eu-act") as HTMLButtonElement;
    const card = m.hand.find((c) => c.id === selected);
    btn.hidden = !m.myTurn || !(m.canDiscard || s.phase === "play");
    btn.disabled = !card;
    btn.textContent = card ? `${m.canDiscard ? "Discard" : "Play"} the ${shortCard(card)}` : m.canDiscard ? "Pick a card to discard" : "Pick a card to play";
    renderResults();
    layoutHand();
  }

  function renderStatus(s: EuchrePublic, m: EuchrePrivate) {
    const us = m.team ?? 0;
    const cur = s.players.find((p) => p.id === s.turnId);
    let msg: string;
    if (!m.seated) msg = "The table's full, so you're watching. You'll get a seat next game.";
    else if (m.sittingOut) msg = `Your partner is going alone. Sit back and cheer! 🍿`;
    else if (s.phase === "handOver") msg = handLine(s, us);
    else if (s.phase === "gameOver") msg = "Game over";
    else if (m.myTurn) {
      if (s.phase === "bid1") msg = m.dealer ? `<b>Your call.</b> Pick up the ${shortCard(s.upcard!)} or pass?` : `<b>Your call.</b> Order up ${SUIT_NAMES[s.upcard!.suit]} or pass?`;
      else if (s.phase === "bid2") msg = m.canPass ? `<b>Your call.</b> Name trump, or pass.` : `<b>Stick the dealer:</b> you have to name trump.`;
      else if (m.canDiscard) msg = `<b>You picked it up.</b> Now discard one card.`;
      else msg = s.trick.length ? `<b>Your turn.</b> ${followHint(s)}` : `<b>Your lead.</b> Play any card.`;
    } else if (s.trickWinner) msg = `<b>${name(s.trickWinner)}</b> takes the trick`;
    else msg = cur ? `${avatar(cur, "xs")} <b>${esc(cur.name)}</b> ${s.phase.startsWith("bid") ? "is deciding" : s.phase === "discard" ? "is discarding" : "is playing"}` : "";
    const partner = s.players.find((p) => p.id === m.partnerId);
    const trump = s.trump
      ? `<div class="eu-ph-trump s-${s.trump}">${suitIcon(s.trump, 26, "currentColor")}<span><small>Trump</small><b>${SUIT_NAMES[s.trump]}</b></span></div>`
      : `<div class="eu-ph-trump none"><span><small>Trump</small><b>${s.phase === "bid2" ? "?" : s.upcard ? `${shortCard(s.upcard)}?` : "…"}</b></span></div>`;
    $("#eu-status").innerHTML = `
      <div class="eu-ph-top">
        ${trump}
        <div class="eu-ph-score">
          <div class="t${us}"><small>${m.seated ? "Us" : TEAM_EMOJI[0] + " " + TEAM_NAMES[0]}</small><b>${s.score[us]}</b>${s.phase === "play" ? `<em>${s.teamTricks[us]} tricks</em>` : ""}</div>
          <div class="t${1 - us}"><small>${m.seated ? "Them" : TEAM_EMOJI[1] + " " + TEAM_NAMES[1]}</small><b>${s.score[1 - us]}</b>${s.phase === "play" ? `<em>${s.teamTricks[1 - us]} tricks</em>` : ""}</div>
        </div>
      </div>
      <div class="eu-ph-msg">${msg}</div>
      ${m.seated && partner ? `<div class="eu-ph-partner">${TEAM_EMOJI[us]} ${TEAM_NAMES[us]} · partner: ${avatar(partner, "xs")} <b>${esc(partner.name)}</b>${m.dealer ? " · <span class='eu-dealer'>You deal</span>" : ""}</div>` : ""}`;
  }

  function followHint(_s: EuchrePublic) {
    return me!.legal.length < me!.hand.length ? `Follow suit: ${followText()}.` : "You can't follow suit, so play anything.";
  }

  function handLine(s: EuchrePublic, us: number) {
    const r = s.lastResult;
    if (!r) return "";
    const ours = r.team === us;
    if (r.euchred) return ours ? `<b>Euchred 'em!</b> +2 for us 🪶` : `<b>We got euchred.</b> They get 2.`;
    return ours ? `<b>We got ${r.points}!</b> ${r.tricks} tricks${r.alone && r.tricks === 5 ? ", alone!" : ""}` : `They took ${r.tricks} tricks: +${r.points} for them.`;
  }

  /** A tiny table: partner across, opponents either side, you at the bottom. */
  function renderTable(s: EuchrePublic, m: EuchrePrivate) {
    const el = $("#eu-table");
    const mySeat = Math.max(0, s.players.findIndex((p) => p.id === pid));
    const spots = ["me", "left", "across", "right"];
    const slot = (k: number) => {
      const p = s.players[(mySeat + k) % 4]!;
      const t = s.trick.find((x) => x.pid === p.id);
      const win = s.trickWinner === p.id;
      const turn = s.turnId === p.id;
      return `<div class="eu-ph-spot ${spots[k]} ${win ? "win" : ""} ${turn ? "turn" : ""} ${s.outId === p.id ? "out" : ""}">
        ${t ? ecardHtml(t.card, "eu-ph-card") : `<div class="eu-ph-empty">${s.outId === p.id ? "out" : ""}</div>`}
        <span>${k === 0 ? "You" : esc(p.name)}${s.dealerId === p.id ? " · D" : ""}</span>
      </div>`;
    };
    let mid = "";
    if (s.phase === "bid1" && s.upcard) mid = `<div class="eu-ph-up">${ecardHtml(s.upcard, "eu-ph-card")}<small>Turned up</small></div>`;
    else if (s.phase === "bid2") mid = `<div class="eu-ph-up"><small>${SUIT_NAMES[s.turnedDown!]}<br>turned down</small></div>`;
    el.hidden = !m.seated && s.phase !== "play";
    el.innerHTML = `${[2, 1, 3, 0].map(slot).join("")}<div class="eu-ph-mid">${mid}</div>`;
  }

  function renderBid(s: EuchrePublic, m: EuchrePrivate) {
    const el = $("#eu-bid");
    const show = m.myTurn && (m.canOrder || m.canCall.length > 0);
    el.hidden = !show;
    if (!show) return;
    const aloneBtn = `<button class="btn btn-ghost eu-alone ${alone ? "on" : ""}" data-bid="alone" aria-pressed="${alone}">${alone ? "✓ Going alone" : "Go alone?"}</button>`;
    if (m.canOrder) {
      const up = s.upcard!;
      el.innerHTML = `<div class="eu-bid-row">
          <button class="btn btn-primary btn-xl" data-bid="order">${m.dealer ? "Pick it up" : "Order it up"} ${suitIcon(up.suit, 22, "currentColor")}</button>
          <button class="btn btn-ghost btn-xl" data-bid="pass">Pass</button>
        </div>${aloneBtn}`;
    } else {
      el.innerHTML = `<div class="eu-suits">${m.canCall
        .map((x) => `<button class="btn eu-suit s-${x}" data-bid="${x}">${suitIcon(x, 30, "currentColor")}<span>${SUIT_NAMES[x]}</span></button>`)
        .join("")}</div>
        <div class="eu-bid-row">${aloneBtn}${m.canPass ? `<button class="btn btn-ghost" data-bid="pass">Pass</button>` : ""}</div>`;
    }
  }

  /** Choosing sides before the deal: join a team, and the host can move people or deal. */
  function renderTeams(s: EuchrePublic, m: EuchrePrivate) {
    const mine = s.picks[pid];
    const act = (a: object) => esc(JSON.stringify(a));
    const chip = (p: EuchrePublic["players"][number], t: 0 | 1 | null) => {
      const label = `${avatar(p, "xs")}<span>${p.id === pid ? "You" : esc(p.name)}</span>${p.bot ? '<span class="bot-tag">bot</span>' : ""}`;
      if (!isHost || !m.seated) return `<div class="eu-pick-chip">${label}</div>`;
      // The host taps anyone to move them: onto the other team, or into a team with room.
      const to = t === null ? (Object.values(s.picks).filter((x) => x === 0).length < 2 ? 0 : 1) : 1 - t;
      return `<button class="eu-pick-chip move" data-gact="${act({ t: "team", team: to, pid: p.id })}" aria-label="Move ${esc(p.name)} to ${TEAM_NAMES[to as 0 | 1]}">${label}<i>⇄</i></button>`;
    };
    const team = (t: 0 | 1) => {
      const members = s.players.filter((p) => s.picks[p.id] === t);
      const slots = [0, 1].map((i) => (members[i] ? chip(members[i]!, t) : `<div class="eu-pick-chip empty">Open seat</div>`)).join("");
      let btn = "";
      if (m.seated)
        btn =
          mine === t
            ? `<button class="btn btn-ghost" data-gact="${act({ t: "team", team: null })}">Leave</button>`
            : `<button class="btn btn-primary" data-gact="${act({ t: "team", team: t })}" ${members.length >= 2 ? "disabled" : ""}>${members.length >= 2 ? "Full" : "Join"}</button>`;
      return `<div class="eu-pick t${t} ${mine === t ? "mine" : ""}"><h3>${TEAM_EMOJI[t]} ${TEAM_NAMES[t]}</h3><div class="eu-pick-slots">${slots}</div>${btn}</div>`;
    };
    const undecided = s.players.filter((p) => s.picks[p.id] === undefined);
    $("#eu-teams").innerHTML = `
      <h2>Pick your partner</h2>
      <p class="muted">Partners sit across from each other. ${mine === undefined ? "Tap a team to join it." : `You're on ${TEAM_EMOJI[mine]} ${TEAM_NAMES[mine]}.`}</p>
      ${team(0)}${team(1)}
      ${undecided.length ? `<div class="eu-pick-undecided"><small>Still choosing</small><div>${undecided.map((p) => chip(p, null)).join("")}</div></div>` : ""}
      ${
        isHost
          ? `<p class="muted">${isHost && m.seated ? "Tap a player to move them. " : ""}Anyone who hasn't picked fills an open seat.</p>
             <div class="eu-pick-host"><button class="btn btn-ghost" data-gact="${act({ t: "shuffleTeams" })}">🎲 Random teams</button>
             <button class="btn btn-primary btn-xl" data-gact="${act({ t: "deal" })}">Deal ▶</button></div>`
          : `<p class="muted">The host deals when the teams are set.</p>`
      }`;
  }

  /** A bigger look at the table: the trick so far, the last trick, and who's taken what. */
  function renderGlance() {
    const s = state;
    if (!s || s.phase === "teams") return;
    const mySeat = Math.max(0, s.players.findIndex((p) => p.id === pid));
    const spots = ["me", "left", "across", "right"];
    const who = (id: string) => (id === pid ? "You" : esc(s.players.find((p) => p.id === id)?.name ?? ""));
    const spot = (k: number) => {
      const p = s.players[(mySeat + k) % 4]!;
      const t = s.trick.find((x) => x.pid === p.id);
      return `<div class="glance-spot ${spots[k]} ${s.trickWinner === p.id ? "win" : ""} ${s.turnId === p.id ? "turn" : ""}">
        ${t ? ecardHtml(t.card, "glance-ecard") : `<div class="glance-empty">${s.outId === p.id ? "sitting out" : s.turnId === p.id ? "thinking…" : ""}</div>`}
        <span>${who(p.id)} <small>${TEAM_EMOJI[p.team]} ${p.tricks ? `· ${p.tricks} trick${p.tricks === 1 ? "" : "s"}` : ""}</small></span>
      </div>`;
    };
    const maker = s.players.find((p) => p.id === s.makerId);
    $("#eu-glance").innerHTML = `
      <h3>The table</h3>
      <div class="glance-top">
        ${
          s.trump
            ? `<span class="s-${s.trump}">${suitIcon(s.trump, 22, "currentColor")} <b>${SUIT_NAMES[s.trump]}</b> <small>called by ${who(maker?.id ?? "")}${s.alone ? ", alone" : ""}</small></span>`
            : `<span><b>Bidding</b> <small>${s.upcard && s.phase === "bid1" ? `${shortCard(s.upcard)} turned up` : s.turnedDown ? `${SUIT_NAMES[s.turnedDown]} turned down` : ""}</small></span>`
        }
        <span><small>${TEAM_EMOJI[0]}</small> <b>${s.score[0]}</b> · <b>${s.score[1]}</b> <small>${TEAM_EMOJI[1]}</small></span>
      </div>
      <div class="glance-table">${[2, 1, 3, 0].map(spot).join("")}</div>
      ${
        s.lastTrick.length
          ? `<div class="glance-last"><small>Last trick · ${who(s.lastTrickWinner ?? "")} took it</small><div>${s.lastTrick
              .map((t) => `<span class="${t.pid === s.lastTrickWinner ? "win" : ""}">${ecardHtml(t.card, "glance-mini")}<em>${who(t.pid)}</em></span>`)
              .join("")}</div></div>`
          : ""
      }
      <button class="btn btn-ghost wide" data-close>Back to my cards</button>`;
  }

  function renderHand(m: EuchrePrivate) {
    $("#eu-tools").innerHTML = arranger.toolbar({ glance: "👀 Table" });
    // Don't yank the cards out from under a finger that's on one (maybe starting a drag).
    if (reorder.holding()) {
      reorder.later(() => me && renderHand(me));
      return;
    }
    hand.replaceChildren(
      ...arranger.arrange(m.hand).map((c) => {
        const el = ecardEl(c, "hand-card");
        const usable = m.myTurn && (m.canDiscard || m.legal.includes(c.id));
        el.classList.toggle("selected", selected === c.id);
        el.classList.toggle("playable", usable && selected !== c.id);
        el.classList.toggle("dim", m.myTurn && state?.phase === "play" && !usable);
        el.classList.toggle("trump", !!state?.trump && isTrump(c.suit, c.rank, state.trump));
        el.setAttribute("role", "button");
        return el;
      }),
    );
    if (!m.hand.length) hand.innerHTML = `<p class="muted">${m.seated ? (m.sittingOut ? "Your partner's playing this one alone." : "") : "Watching this game."}</p>`;
  }
  const isTrump = (suit: Suit, rank: number, trump: Suit) =>
    suit === trump || (rank === 11 && (suit === "H" || suit === "D") === (trump === "H" || trump === "D"));

  function layoutHand() {
    if (!me || reorder.dragging()) return;
    fitHand(hand, arranger, 130);
  }

  function renderResults() {
    const s = state!;
    const el = $("#eu-results");
    if (s.phase !== "gameOver" || s.winnerTeam === null) {
      el.hidden = true;
      el.dataset.key = "";
      return;
    }
    const key = `${s.hand}-${isHost}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const won = me?.team === s.winnerTeam;
    const t = s.winnerTeam;
    el.hidden = false;
    el.innerHTML = `
      <div class="ph-lobby-inner">
        <div class="hush-big-emoji">${won ? "🏆" : TEAM_EMOJI[t]}</div>
        <h2>${won ? "We win!" : `${TEAM_EMOJI[t]} ${TEAM_NAMES[t]} wins`}</h2>
        <p class="muted">${s.score[t]} to ${s.score[1 - t]}</p>
        ${
          isHost
            ? `<button class="btn btn-primary btn-xl wide" data-gact='{"t":"restart"}'>Play again</button>
               <button class="btn btn-ghost wide" data-act="endGame">Pick another game</button>`
            : `<p class="muted">Waiting for the host…</p>`
        }
      </div>`;
    if (won) confetti(el, 80);
  }

  function react(events: EuchreEvent[]) {
    for (const e of events) {
      if (e.type === "deal") {
        audio.shuffle();
        selected = null;
        arranger.reset();
      }
      if (e.type === "play" && e.pid === pid) audio.cardPlay("normal");
      if (e.type === "pickup" && e.pid === pid) toast(`You picked up the ${shortCard(e.card)}. Discard one card.`);
      if (e.type === "trump" && e.pid === me?.partnerId && e.alone) toast("Your partner is going alone!");
      if (e.type === "trick" && e.team === me?.team) audio.pop();
      if (e.type === "hand") {
        if (e.result.euchred) audio.loon();
        else if (e.result.team === me?.team) audio.fanfare();
      }
    }
  }

  return {
    update,
    hostMenu(snap: GameSnap<EuchrePublic>) {
      const s = snap.pub;
      const cur = s.players.find((p) => p.id === s.turnId);
      const nudge = cur && cur.id !== pid && !cur.bot ? `<button class="btn btn-ghost wide" data-gact='{"t":"autoplay"}'>Let a bot make ${esc(cur.name)}'s move</button>` : "";
      return nudge + tableSizeMenu(s.table, [1, 1.3, 1.55]);
    },
    destroy() {
      ac.abort();
      document.body.classList.remove("my-turn", "theme-mi");
      ctx.el.innerHTML = "";
    },
  };
}
