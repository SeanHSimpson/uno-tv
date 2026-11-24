// The TV: header, the hub lobby (pick a game, QR code), music, and whichever game is running.

import QRCode from "qrcode";
import { GAMES } from "../../shared/games";
import type { GameId } from "../../shared/games/types";
import type { RoomPublic } from "../../shared/room";
import { audio, loadPref, savePref, unlockOnFirstGesture } from "../audio";
import { SCREENS } from "../games";
import type { GameView } from "../games/types";
import { gameEmblem, icoCrown, icoSound } from "../icons";
import { connectRoom, type Snapshot } from "../net";
import { $, avatar, esc, joinOrigin, keepAwake, toast } from "../ui";
import { gameCards, playersText, settingsChips } from "./common";

export function mountTv(root: HTMLElement, code: string) {
  const joinUrl = `${joinOrigin()}/?join=${code}`;
  const prettyUrl = joinOrigin().replace(/^https?:\/\//, "");
  document.body.className = "mode-tv";
  root.innerHTML = `
  <div class="tv">
    <header class="tv-top">
      <div class="logo">Oh<span>No!</span></div>
      <div class="tv-round" id="tv-status"></div>
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
    onError: (m) => toast(m, "error"),
    onFatal(m) {
      view?.destroy();
      root.innerHTML = `<div class="fatal"><div class="logo">Oh<span>No!</span></div><p>${esc(m)}</p><a class="btn btn-primary" href="/">Start over</a></div>`;
    },
    onStatus(ok) {
      $("#conn-lost").hidden = ok;
    },
  });

  function handle(snap: Snapshot) {
    room = snap.room;
    const inLobby = room.phase === "lobby" || !snap.game;
    $("#tv-lobby").hidden = !inLobby;
    if (inLobby) {
      renderLobby(room);
      if (view) {
        view.destroy();
        view = null;
        viewId = null;
      }
      $("#tv-status").innerHTML = "";
    } else {
      const game = snap.game!;
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
  }

  function renderLobby(r: RoomPublic) {
    const meta = GAMES[r.gameId].meta;
    $("#tv-lobby").dataset.selectedGame = r.gameId;
    $("#hub-games").innerHTML = gameCards(r, false);
    $("#hub-howto").innerHTML = `<span class="howto-emblem">${gameEmblem(r.gameId)}</span><b>${esc(meta.name)}:</b> ${esc(meta.howTo)}`;
    $("#lobby-players").innerHTML = r.members.length
      ? r.members
          .map((p) => `<div class="lobby-player">${avatar(p)}<span>${esc(p.name)}${p.id === r.hostId ? ` ${icoCrown()}` : ""}</span></div>`)
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
    $("#lobby-rules").innerHTML = settingsChips(r);
  }

  // ---------------- controls ----------------

  $("#tv-start").addEventListener("click", () => conn.send({ t: "start" }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "m" || e.key === "M") return toggleMute();
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
