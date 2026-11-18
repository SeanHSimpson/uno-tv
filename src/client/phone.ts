import { COLORS, type Color, type GameEvent, type PrivateState, type PublicState, type Settings } from "../shared/types";
import { cardEl, COLOR_NAMES, shapeSvg, shortLabel, sortHand } from "./cards";
import { confetti } from "./fx";
import { connectRoom, playerId } from "./net";
import { $, avatar, esc, fly, keepAwake, reducedMotion, toast, vibrate } from "./ui";

export function mountPhone(root: HTMLElement, code: string, name: string) {
  document.body.className = "mode-phone";
  const pid = playerId();
  root.innerHTML = `
  <div class="phone">
    <header class="ph-top">
      <div class="ph-me" id="ph-me"></div>
      <div class="ph-room">Room <b>${esc(code)}</b></div>
      <button class="icon-btn" id="ph-menu" aria-label="Host controls" hidden>⚙︎</button>
    </header>
    <section class="ph-status" id="ph-status"></section>
    <section class="ph-catch" id="ph-catch"></section>
    <main class="hand" id="hand" aria-label="Your hand"></main>
    <footer class="ph-actions" id="ph-actions">
      <button class="btn btn-ghost" id="btn-draw">Draw</button>
      <button class="btn-ohno" id="btn-ohno" aria-label="Call OhNo!">Oh<span>No!</span></button>
      <button class="btn btn-ghost" id="btn-alt" hidden></button>
    </footer>

    <section class="ph-lobby overlay" id="ph-lobby" hidden></section>
    <section class="ph-results overlay" id="ph-results" hidden></section>

    <div class="sheet-backdrop" id="sheet-backdrop" hidden></div>
    <section class="sheet" id="color-sheet" hidden>
      <h3>Pick a color</h3>
      <div class="color-grid">${COLORS.map(
        (c) => `<button class="color-btn c-${c}" data-color="${c}">${shapeSvg(c, 34)}<span>${COLOR_NAMES[c]}</span></button>`,
      ).join("")}</div>
      <button class="btn btn-ghost wide" data-close>Cancel</button>
    </section>
    <section class="sheet" id="host-sheet" hidden></section>
    <div class="conn-lost" id="conn-lost" hidden>Reconnecting…</div>
  </div>`;

  let state: PublicState | null = null;
  let me: PrivateState | null = null;
  let selected: number | null = null;
  let wildPending: number | null = null;
  let prevHandIds = new Set<number>();
  let wasMyTurn = false;
  let firstSync = true;

  const conn = connectRoom(code, { role: "player", pid, name }, {
    onState(snap) {
      const prevState = state;
      state = snap.state;
      me = snap.me;
      if (!me) return;
      if (selected !== null && !me.hand.some((c) => c.id === selected)) selected = null;
      if (!me.playable.includes(selected ?? -1)) selected = null;
      const myTurn = state.turnId === pid;
      if (myTurn && !wasMyTurn && !firstSync) {
        vibrate([60, 40, 60]);
        flashTurn();
      }
      wasMyTurn = myTurn;
      animateOut(snap.events);
      render(prevState);
      firstSync = false;
    },
    onError(m) {
      toast(m, "error");
      vibrate(120);
    },
    onFatal(m) {
      root.innerHTML = `<div class="fatal"><div class="logo">Oh<span>No!</span></div><p>${esc(m)}</p><a class="btn btn-primary" href="/">Back</a></div>`;
    },
    onStatus(ok) {
      $("#conn-lost").hidden = ok;
    },
  });
  keepAwake();

  // ---------- actions ----------

  const send = conn.send;
  $("#btn-draw").addEventListener("click", () => send({ t: "draw" }));
  $("#btn-ohno").addEventListener("click", () => {
    send({ t: "ohno" });
    vibrate(30);
  });
  $("#btn-alt").addEventListener("click", () => {
    if (me?.canPass) send({ t: "pass" });
    else if (me?.canTake) send({ t: "take" });
  });
  $("#ph-menu").addEventListener("click", () => openSheet("host-sheet"));
  $("#sheet-backdrop").addEventListener("click", closeSheets);
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-close]")) closeSheets();
    const colorBtn = t.closest<HTMLElement>(".color-btn");
    if (colorBtn && wildPending !== null) {
      send({ t: "play", cardId: wildPending, color: colorBtn.dataset.color as Color });
      wildPending = null;
      selected = null;
      closeSheets();
    }
    const act = t.closest<HTMLElement>("[data-act]");
    if (act) hostAction(act);
  });

  $("#hand").addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".card");
    if (!el || !me || !state) return;
    const id = Number(el.dataset.id);
    const card = me.hand.find((c) => c.id === id);
    if (!card) return;
    if (state.turnId !== pid) {
      toast(`Hang on — it's ${playerName(state.turnId)}'s turn.`);
      return;
    }
    if (!me.playable.includes(id)) {
      el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 220 });
      toast(state.pendingDraw ? `Stack a draw card or take +${state.pendingDraw}.` : me.drawnCardId !== null ? "Play the card you drew, or keep it." : "That one doesn't match.");
      return;
    }
    if (selected !== id) {
      selected = id;
      renderHand();
      return;
    }
    // second tap: play it
    if (card.color === "wild") {
      wildPending = id;
      openSheet("color-sheet");
    } else {
      send({ t: "play", cardId: id });
    }
  });

  window.addEventListener("resize", () => layoutHand());

  function hostAction(btn: HTMLElement) {
    const a = btn.dataset.act!;
    if (a === "start") send({ t: "start" });
    else if (a === "next") send({ t: "nextRound" });
    else if (a === "lobby") (send({ t: "lobby" }), closeSheets());
    else if (a === "skip") (send({ t: "skip" }), closeSheets());
    else if (a === "kick") send({ t: "kick", pid: btn.dataset.pid! });
    else if (a === "catch") send({ t: "catch", target: btn.dataset.pid! });
    else if (a === "set") {
      const key = btn.dataset.key as keyof Settings;
      const raw = btn.dataset.val!;
      const val = raw === "true" ? true : raw === "false" ? false : Number(raw);
      send({ t: "settings", settings: { [key]: val } as Partial<Settings> });
    }
  }

  function openSheet(id: string) {
    $("#sheet-backdrop").hidden = false;
    $(`#${id}`).hidden = false;
    requestAnimationFrame(() => $(`#${id}`).classList.add("open"));
  }
  function closeSheets() {
    $("#sheet-backdrop").hidden = true;
    root.querySelectorAll<HTMLElement>(".sheet").forEach((s) => {
      s.classList.remove("open");
      s.hidden = true;
    });
    wildPending = null;
  }

  const playerName = (id: string | null) => state?.players.find((p) => p.id === id)?.name ?? "someone";

  // ---------- rendering ----------

  function render(prev: PublicState | null) {
    if (!state || !me) return;
    const s = state;
    const self = s.players.find((p) => p.id === pid)!;
    const isHost = s.hostId === pid;
    const myTurn = s.turnId === pid;
    document.body.classList.toggle("my-turn", myTurn);

    $("#ph-me").innerHTML = `${avatar(self, "sm")}<span>${esc(self.name)}</span>${isHost ? '<i class="crown">♛</i>' : ""}${
      s.round > 0 ? `<em>${self.score} pts</em>` : ""
    }`;
    $("#ph-menu").hidden = !isHost;

    // Status strip: what's on the pile + whose turn.
    const topCard = s.discard[s.discard.length - 1];
    const turnP = s.players.find((p) => p.id === s.turnId);
    let msg = "";
    if (s.phase === "playing") {
      if (myTurn) {
        msg = s.pendingDraw
          ? `<b>Your turn!</b> Stack a draw card or take +${s.pendingDraw}`
          : me.drawnCardId !== null
            ? `<b>You drew a playable card.</b> Play it or keep it`
            : `<b>Your turn!</b> Tap a card, then tap again to play`;
      } else if (turnP) msg = `${avatar(turnP, "xs")} <b>${esc(turnP.name)}</b>'s turn`;
    }
    $("#ph-status").innerHTML =
      s.phase === "playing" && topCard
        ? `<div class="ph-top-card c-${s.color}" id="ph-top-card">${cardEl(topCard, "mini").outerHTML}<span class="ph-color">${shapeSvg(s.color!, 16)} ${COLOR_NAMES[s.color!]}</span></div>
           <div class="ph-msg">${msg}</div>`
        : "";

    // Catch buttons for anyone who forgot to call.
    const vul = s.vulnerable && s.vulnerable !== pid ? s.players.find((p) => p.id === s.vulnerable) : null;
    $("#ph-catch").innerHTML = vul
      ? `<button class="btn btn-catch" data-act="catch" data-pid="${esc(vul.id)}">🫵 Catch ${esc(vul.name)}! They didn't say OhNo!</button>`
      : turnP && !turnP.connected && turnP.id !== pid && s.phase === "playing"
        ? `<button class="btn btn-ghost wide skip-offline" data-act="skip">${esc(turnP.name)}'s phone disconnected — skip their turn</button>`
        : "";
    if (vul && prev?.vulnerable !== s.vulnerable) vibrate(40);

    renderHand();
    renderActions();
    renderLobby(isHost);
    renderResults(isHost);
    renderHostSheet(isHost);
  }

  function renderActions() {
    const s = state!;
    const m = me!;
    const playing = s.phase === "playing";
    $("#ph-actions").hidden = !playing;
    const draw = $("#btn-draw") as HTMLButtonElement;
    draw.disabled = !m.canDraw;
    draw.hidden = m.canPass || m.canTake;
    const alt = $("#btn-alt") as HTMLButtonElement;
    alt.hidden = !(m.canPass || m.canTake);
    alt.textContent = m.canPass ? "Keep it" : m.canTake ? `Take +${s.pendingDraw}` : "";
    alt.classList.toggle("btn-danger", m.canTake);
    const self = s.players.find((p) => p.id === pid)!;
    const ohno = $("#btn-ohno") as HTMLButtonElement;
    const canCall = playing && !self.calledOhNo && (m.hand.length === 1 || (m.hand.length === 2 && s.turnId === pid));
    ohno.disabled = !canCall;
    ohno.classList.toggle("urgent", canCall);
    ohno.classList.toggle("called", self.calledOhNo && m.hand.length <= 1);
  }

  function renderHand() {
    const s = state!;
    const m = me!;
    const hand = $("#hand");
    if (s.phase !== "playing") {
      hand.innerHTML = "";
      prevHandIds = new Set();
      return;
    }
    const sorted = sortHand(m.hand);
    const myTurn = s.turnId === pid;
    const existing = new Map([...hand.children].map((c) => [Number((c as HTMLElement).dataset.id), c as HTMLElement]));
    const fresh: HTMLElement[] = [];
    hand.replaceChildren(
      ...sorted.map((card) => {
        let el = existing.get(card.id);
        if (!el) {
          el = cardEl(card, "hand-card");
          if (!prevHandIds.has(card.id) && prevHandIds.size) fresh.push(el);
        }
        const playable = m.playable.includes(card.id);
        el.classList.toggle("playable", myTurn && playable);
        el.classList.toggle("dim", myTurn && !playable);
        el.classList.toggle("selected", selected === card.id);
        el.classList.toggle("just-drew", m.drawnCardId === card.id);
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", `${shortLabel(card)}${playable ? ", playable" : ""}`);
        el.dataset.hint = selected === card.id ? (card.color === "wild" ? "Tap to pick color" : "Tap to play") : "";
        return el;
      }),
    );
    prevHandIds = new Set(m.hand.map((c) => c.id));
    layoutHand();
    if (!reducedMotion())
      fresh.forEach((el, i) =>
        el.animate([{ transform: "translateY(-60vh) rotate(-12deg)", opacity: 0 }, { transform: "none", opacity: 1 }], {
          duration: 450,
          delay: i * 90,
          easing: "cubic-bezier(.2,.8,.25,1)",
          fill: "backwards",
        }),
      );
  }

  /** Size cards so the whole hand always fits on screen, no scrolling. */
  function layoutHand() {
    const hand = document.getElementById("hand");
    if (!hand || !me) return;
    const n = Math.max(1, me.hand.length);
    const W = hand.clientWidth - 8;
    const H = hand.clientHeight - 8;
    const gap = n > 12 ? 4 : 8;
    let best = { w: 0, cols: 1 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows / 1.5);
      if (w > best.w) best = { w, cols };
    }
    const w = Math.min(best.w, 150, W / 2.4);
    hand.style.setProperty("--cw", `${Math.floor(w)}px`);
    hand.style.setProperty("--cols", String(best.cols));
    hand.style.setProperty("--gap", `${gap}px`);
  }

  function animateOut(events: GameEvent[]) {
    if (reducedMotion()) return;
    for (const e of events) {
      if (e.type === "play" && e.pid === pid) {
        const el = document.querySelector<HTMLElement>(`#hand .card[data-id="${e.card.id}"]`);
        const target = document.getElementById("ph-top-card")?.getBoundingClientRect();
        if (el && target) {
          const from = el.getBoundingClientRect();
          const to = new DOMRect(target.left, target.top, target.height / 1.5, target.height);
          fly(cardEl(e.card), from, to, { duration: 420 });
        }
      }
      if (e.type === "caught" && e.pid === pid) toast(`Caught! You forgot to say OhNo! (+${e.count})`, "error");
      if (e.type === "caught" && e.by === pid) toast(`Gotcha! ${playerName(e.pid)} draws ${e.count}.`);
      if (e.type === "draw" && e.pid === pid && e.reason === "auto") toast(`Nothing to play — drew ${e.count === 1 ? "a card" : `${e.count} cards`}.`);
      if (e.type === "draw" && e.pid === pid && e.reason === "penalty") toast(`Ouch! +${e.count}`, "error");
    }
  }

  function flashTurn() {
    const el = document.createElement("div");
    el.className = "turn-flash";
    el.textContent = "Your turn!";
    document.body.append(el);
    setTimeout(() => el.remove(), 1300);
  }

  function settingsHtml(s: PublicState) {
    const seg = (key: keyof Settings, label: string, opts: [string, string][]) =>
      `<div class="setting"><span>${label}</span><div class="seg">${opts
        .map(([v, t]) => `<button data-act="set" data-key="${key}" data-val="${v}" class="${String(s.settings[key]) === v ? "on" : ""}">${t}</button>`)
        .join("")}</div></div>`;
    return `<div class="settings">
      ${seg("targetScore", "Game length", [["0", "One round"], ["200", "To 200"], ["500", "To 500"]])}
      ${seg("stacking", "Stack +2 / +4", [["false", "Off"], ["true", "On"]])}
      ${seg("drawUntilPlayable", "When you can't play", [["false", "Draw 1"], ["true", "Draw till playable"]])}
      ${seg("catchPenalty", "Forgot OhNo! penalty", [["2", "+2"], ["4", "+4"]])}
    </div>`;
  }

  function renderLobby(isHost: boolean) {
    const s = state!;
    const el = $("#ph-lobby");
    el.hidden = s.phase !== "lobby";
    if (s.phase !== "lobby") return;
    const enough = s.players.length >= 2;
    el.innerHTML = `
      <div class="ph-lobby-inner">
        <div class="logo">Oh<span>No!</span></div>
        <h2>You're in! 🎉</h2>
        <p class="muted">${isHost ? "You're the host. Start when everyone's here." : `Waiting for ${esc(playerName(s.hostId))} to start the game…`}</p>
        <div class="lobby-players">${s.players
          .map((p) => `<div class="lobby-player">${avatar(p)}<span>${esc(p.name)}${p.id === pid ? " (you)" : ""}</span>${p.id === s.hostId ? '<i class="crown">♛</i>' : ""}</div>`)
          .join("")}</div>
        ${isHost ? `${settingsHtml(s)}<button class="btn btn-primary btn-xl wide" data-act="start" ${enough ? "" : "disabled"}>${enough ? "Deal the cards" : "Waiting for one more player"}</button>` : ""}
      </div>`;
  }

  function renderResults(isHost: boolean) {
    const s = state!;
    const el = $("#ph-results");
    const show = s.phase === "roundOver";
    if (!show) {
      el.hidden = true;
      el.dataset.seq = "";
      return;
    }
    if (el.dataset.seq === String(s.seq)) return;
    el.dataset.seq = String(s.seq);
    const won = s.roundWinner === pid;
    const ranked = [...s.players].sort((a, b) => b.score - a.score);
    el.hidden = false;
    el.innerHTML = `
      <div class="ph-lobby-inner">
        <h2>${won ? (s.gameWinner ? "You win! 🏆" : "You went out! 🎉") : `${esc(playerName(s.roundWinner))} ${s.gameWinner ? "wins!" : "went out"}`}</h2>
        <p class="muted">+${s.roundPoints} points</p>
        <div class="mini-scores">${ranked.map((p) => `<div>${avatar(p, "xs")}<span>${esc(p.name)}</span><b>${p.score}</b></div>`).join("")}</div>
        ${
          isHost
            ? `<button class="btn btn-primary btn-xl wide" data-act="next">${s.gameWinner ? "New game" : "Deal next round"}</button>
               <button class="btn btn-ghost wide" data-act="lobby">Back to lobby</button>`
            : `<p class="muted">Waiting for the host…</p>`
        }
      </div>`;
    if (won) confetti(el, 80);
  }

  function renderHostSheet(isHost: boolean) {
    const s = state!;
    if (!isHost) return;
    const cur = s.players.find((p) => p.id === s.turnId);
    $("#host-sheet").innerHTML = `
      <h3>Host controls</h3>
      ${s.phase !== "playing" ? settingsHtml(s) : `<p class="muted small">Rules can be changed between rounds.</p>`}
      <h4>Players</h4>
      <div class="host-players">${s.players
        .map(
          (p) => `<div class="host-player ${p.connected ? "" : "offline"}">${avatar(p, "xs")}<span>${esc(p.name)}${p.connected ? "" : " · offline"}</span>${
            p.id === pid ? "<em>you</em>" : `<button class="btn btn-small btn-danger" data-act="kick" data-pid="${esc(p.id)}">Remove</button>`
          }</div>`,
        )
        .join("")}</div>
      ${s.phase === "playing" && cur && cur.id !== pid ? `<button class="btn btn-ghost wide" data-act="skip">Skip ${esc(cur.name)}'s turn</button>` : ""}
      ${s.phase !== "lobby" ? `<button class="btn btn-ghost wide" data-act="lobby">End game &amp; return to lobby</button>` : ""}
      <button class="btn btn-ghost wide" data-close>Close</button>`;
  }
}

