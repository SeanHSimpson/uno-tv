// The TV: header, the hub lobby (pick a game, QR code), music, and whichever game is running.

import QRCode from "qrcode";
import type { CustomEmote } from "../../shared/common";
import { GAMES } from "../../shared/games";
import type { GameId } from "../../shared/games/types";
import type { RoomPublic } from "../../shared/room";
import { audio, loadPref, savePref, unlockOnFirstGesture } from "../audio";
import { tvFx } from "../fxCanvas";
import { SCREENS } from "../games";
import type { GameView } from "../games/types";
import { gameEmblem, icoClose, icoCrown, icoMusic, icoSound } from "../icons";
import { connectRoom, type Snapshot } from "../net";
import { rulesBodyHtml } from "../rules";
import { $, avatar, esc, joinOrigin, keepAwake, toast } from "../ui";
import { gameCards, playersText, settingsChips, winBadge } from "./common";

export function mountTv(root: HTMLElement, code: string) {
  const joinUrl = `${joinOrigin()}/?join=${code}`;
  const prettyUrl = joinOrigin().replace(/^https?:\/\//, "");
  document.body.className = "mode-tv";
  root.innerHTML = `
  <div class="tv">
    <header class="tv-top">
      <div class="logo">Oh<span>No!</span></div>
      <div class="tv-round" id="tv-status"></div>
      <div class="tv-timer" id="tv-timer" hidden></div>
      <button class="sound-btn" id="tv-sound" title="Sound on/off (M)" aria-label="Sound on/off">${icoSound(true, 22)}</button>
      <div class="tv-join">
        <div class="qr qr-mini" id="qr-mini"></div>
        <div class="tv-join-text"><small>Join at <b>${esc(prettyUrl)}</b></small><span class="code">${esc(code)}</span></div>
      </div>
    </header>
    <main class="tv-game" id="tv-game"></main>

    <section class="tv-lobby overlay" id="tv-lobby">
      <div class="lobby-card">
        <div class="lobby-left">
          <div class="hub-title"><div class="logo logo-lg">Oh<span>No!</span></div><span class="hub-sub">game night</span></div>
          <p class="tagline">Scan the code to join · the host picks the game on their phone</p>
          <div class="hub-games" id="hub-games"></div>
          <p class="hub-howto" id="hub-howto"></p>
          <div class="lobby-players" id="lobby-players"></div>
          <div class="lobby-hint" id="lobby-hint"></div>
          <button class="btn btn-primary btn-xl" id="tv-start" hidden>Start</button>
        </div>
        <div class="lobby-right">
          <div class="qr qr-big" id="qr-big"></div>
          <div class="code code-xl">${esc(code)}</div>
          <p class="join-at">or visit <b>${esc(prettyUrl)}</b></p>
          <div class="lobby-rules" id="lobby-rules"></div>
        </div>
      </div>
    </section>
    <section class="tv-rules overlay" id="tv-rules" hidden></section>
    <div class="now-playing" id="now-playing" aria-live="polite"></div>
    <div class="conn-lost" id="conn-lost" hidden>Reconnecting…</div>
    <button class="tap-sound" id="tap-sound" hidden>${icoSound(true, 18)} Click anywhere for music &amp; sound</button>
  </div>`;

  QRCode.toString(joinUrl, { margin: 1, color: { dark: "#2b1d1a", light: "#fff6e6" }, type: "svg" }).then((svg) => {
    $("#qr-big").innerHTML = svg;
    $("#qr-mini").innerHTML = svg;
  });

  let room: RoomPublic | null = null;
  let view: GameView | null = null;
  let viewId: GameId | null = null;

  const conn = connectRoom(code, { role: "tv" }, {
    onState: handle,
    onEmote: showEmote,
    onSkipTrack: () => audio.skipSong(),
    onError: (m) => toast(m, "error"),
    onFatal(m) {
      view?.destroy();
      tvFx.unmount();
      root.innerHTML = `<div class="fatal"><div class="logo">Oh<span>No!</span></div><p>${esc(m)}</p><a class="btn btn-primary" href="/">Start over</a></div>`;
    },
    onStatus(ok) {
      $("#conn-lost").hidden = ok;
    },
  });
  tvFx.mount();
  tvFx.setTheme("lobby");

  function handle(snap: Snapshot) {
    room = snap.room;
    const inLobby = room.phase === "lobby" || !snap.game;
    $("#tv-lobby").hidden = !inLobby;
    if (inLobby) {
      tvFx.setTheme("lobby");
      renderLobby(room);
      if (view) {
        view.destroy();
        view = null;
        viewId = null;
      }
      $("#tv-status").innerHTML = "";
    } else {
      const game = snap.game!;
      tvFx.setTheme(game.id);
      let first = false;
      if (viewId !== game.id) {
        view?.destroy();
        view = SCREENS[game.id].tv({
          el: $("#tv-game"),
          setStatus: (html) => ($("#tv-status").innerHTML = html),
          send: (action) => conn.send({ t: "game", action }),
        });
        viewId = game.id;
        first = true;
      }
      view!.update({ room, pub: game.pub, me: null, events: snap.events.game, first });
    }
    for (const e of snap.events.room) if (e.type === "joined") audio.pop();
    syncAudio();
    syncTimer();
  }

  function renderLobby(r: RoomPublic) {
    const meta = GAMES[r.gameId].meta;
    $("#tv-lobby").dataset.selectedGame = r.gameId;
    $("#hub-games").innerHTML = gameCards(r, false);
    $("#hub-howto").innerHTML = `<span class="howto-emblem">${gameEmblem(r.gameId)}</span><b>${esc(meta.name)}:</b> ${esc(meta.howTo)}`;
    $("#lobby-players").innerHTML = r.members.length
      ? r.members
          .map(
            (p) =>
              `<div class="lobby-player" data-pid="${esc(p.id)}">${avatar(p)}<span>${esc(p.name)}${p.id === r.hostId ? ` ${icoCrown()}` : ""}</span>${winBadge(p.wins)}</div>`,
          )
          .join("")
      : `<div class="lobby-empty">Nobody here yet…</div>`;
    const host = r.members.find((p) => p.id === r.hostId);
    const enough = r.members.length >= meta.minPlayers;
    $("#lobby-hint").innerHTML = r.notice
      ? `<span class="notice">${esc(r.notice)}</span>`
      : !r.members.length
        ? ""
        : enough
          ? `${esc(host?.name ?? "The host")} can start <b>${esc(meta.name)}</b> from their phone, or press Start here.`
          : `${esc(meta.name)} needs ${playersText(r.gameId)} (the host can add a bot).`;
    const start = $("#tv-start");
    start.hidden = !enough;
    start.textContent = `Start ${meta.name}`;
    const timerChip = r.turnTimer ? `<span>Turn timer: <b>${r.turnTimer}s</b></span>` : "";
    $("#lobby-rules").innerHTML = settingsChips(r) + timerChip;
  }

  // ---------------- emotes, turn timer, rules, now playing ----------------

  function showEmote(pid: string, em: CustomEmote) {
    if (!em?.icon && !em?.label) return;
    audio.pop();
    // Only search the currently visible surface (never match a hidden #tv-lobby pill mid-game).
    const scope = $("#tv-lobby").hidden ? $("#tv-game") : $("#tv-lobby");
    const target = scope.querySelector<HTMLElement>(`[data-pid="${CSS.escape(pid)}"]`);
    const rect = target?.getBoundingClientRect();
    const visible = !!rect && rect.width > 0 && rect.height > 0;
    const who = room?.members.find((m) => m.id === pid)?.name;

    const b = document.createElement("div");
    b.className = `emote-bubble${em.label ? "" : " icon-only"}`;
    const labelText = visible ? em.label : [who, em.label].filter(Boolean).join(em.label ? ": " : "");
    b.innerHTML = `<span class="em-ico">${esc(em.icon)}</span>${labelText ? `<small>${esc(labelText)}</small>` : ""}`;

    // Always mount fixed on document.body so game containers with overflow:hidden (like Rummy's
    // .rm-boards or .tv) can never clip the bubble off-screen.
    if (visible && rect) {
      const cx = Math.max(innerWidth * 0.12, Math.min(innerWidth * 0.88, rect.left + rect.width / 2));
      const cy = Math.max(innerHeight * 0.14, Math.min(innerHeight * 0.86, rect.top + 8));
      b.style.left = `${cx}px`;
      b.style.top = `${cy}px`;
    } else {
      b.classList.add("emote-float");
    }
    document.body.append(b);
    setTimeout(() => b.remove(), 2300);
  }

  let timerHandle = 0;
  function syncTimer() {
    clearInterval(timerHandle);
    timerHandle = 0;
    const el = $("#tv-timer");
    const deadline = room?.turnDeadline;
    const total = (room?.turnTimer ?? 0) * 1000;
    if (!deadline || !total) {
      el.hidden = true;
      return;
    }
    const draw = () => {
      const left = Math.max(0, deadline - Date.now());
      const sec = Math.ceil(left / 1000);
      const pct = Math.max(0, Math.min(1, left / total));
      const dash = (pct * 75.4).toFixed(1);
      el.hidden = false;
      el.classList.toggle("urgent", sec <= 10);
      el.innerHTML = `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12" class="tt-bg"/><circle cx="14" cy="14" r="12" class="tt-arc" stroke-dasharray="${dash} 75.4"/></svg><span>${sec}s</span>`;
    };
    draw();
    timerHandle = window.setInterval(draw, 200);
  }

  let trackTimer = 0;
  audio.onTrackChange((track) => {
    const el = $("#now-playing");
    clearTimeout(trackTimer);
    if (!track) {
      el.classList.remove("show");
      return;
    }
    el.innerHTML = `${icoMusic(15)}<span><b>${esc(track.name)}</b> · ${esc(track.composer)}</span>`;
    el.classList.add("show");
    trackTimer = window.setTimeout(() => el.classList.remove("show"), 5200);
  });

  function toggleRules(force?: boolean) {
    const el = $("#tv-rules");
    const open = force ?? el.hidden;
    if (!open || !room) {
      el.hidden = true;
      return;
    }
    el.innerHTML = `<div class="rules-modal">${rulesBodyHtml(room.gameId, room.settings)}<button class="btn btn-ghost rules-close" id="tv-rules-close">${icoClose(16)} Close <small>(?)</small></button></div>`;
    el.hidden = false;
    $("#tv-rules-close").addEventListener("click", () => (el.hidden = true));
  }
  $("#tv-rules").addEventListener("click", (e) => {
    if (e.target === $("#tv-rules")) $("#tv-rules").hidden = true;
  });

  // ---------------- controls ----------------

  $("#tv-start").addEventListener("click", () => conn.send({ t: "start" }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "m" || e.key === "M") return toggleMute();
    if (e.key === "n" || e.key === "N") return audio.skipSong();
    if (e.key === "?" || e.key === "/") return toggleRules();
    if (e.key === "Escape" && !$("#tv-rules").hidden) return toggleRules(false);
    if (e.key !== "Enter" && e.key !== " ") return;
    if (room?.phase === "lobby") {
      if (room.members.length >= GAMES[room.gameId].meta.minPlayers) conn.send({ t: "start" });
    } else view?.onEnter?.();
  });
  keepAwake();

  // ---------------- audio ----------------
  // Browsers only allow sound after someone clicks/taps the page. Hosting from the
  // home page counts; after a refresh we show a small "click for sound" prompt.
  let muted = loadPref("tvMute", false);
  unlockOnFirstGesture();
  audio.onStateChange(syncAudio);
  function toggleMute() {
    muted = !muted;
    savePref("tvMute", muted);
    audio.unlock();
    syncAudio();
  }
  $("#tv-sound").addEventListener("click", toggleMute);
  $("#tap-sound").addEventListener("click", () => audio.unlock());

  function syncAudio() {
    $("#tap-sound").hidden = audio.ready || muted;
    $("#tv-sound").innerHTML = icoSound(!muted, 22);
    if (!room) return;
    audio.sfxEnabled = !muted && room.audio.tvSounds;
    const mood = room.phase === "game" ? GAMES[room.gameId].meta.music : "calm";
    audio.setMusic(muted || !room.audio.tvMusic ? null : mood);
    if (room.phase === "lobby") audio.setTempo(1);
  }
}
