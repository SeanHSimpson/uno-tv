// A player's phone: header, the lobby (game picker for the host), host menu, picture
// picker, sound toggle, and whichever game is running.

import { cleanEmote, EMOTE_ICONS, EMOTES, MAX_EMOTE_LABEL, type CustomEmote } from "../../shared/common";
import { GAMES } from "../../shared/games";
import type { GameId } from "../../shared/games/types";
import type { ClientMessage, RoomPublic } from "../../shared/room";
import { audio, haptic, loadPref, savePref, unlockOnFirstGesture } from "../audio";
import { SCREENS } from "../games";
import type { GameSnap, GameView } from "../games/types";
import { gameEmblem, icoBot, icoClose, icoCrown, icoDoor, icoHelp, icoSettings, icoSmile, icoSound } from "../icons";
import { connectRoom, playerId, saveAvatar, savedAvatar, type Snapshot } from "../net";
import { rulesBodyHtml } from "../rules";
import { $, avatar, avatarPicker, esc, keepAwake, toast } from "../ui";
import { gameCards, playersText, settingsControls, turnTimerControl, tvAudioControls, winBadge } from "./common";

export function mountPhone(root: HTMLElement, code: string, name: string) {
  document.body.className = "mode-phone";
  const pid = playerId();
  root.innerHTML = `
  <div class="phone">
    <header class="ph-top">
      <div class="ph-me" id="ph-me"></div>
      <div class="ph-room">Room <b>${esc(code)}</b></div>
      <button class="icon-btn" id="ph-react" aria-label="Send reaction to TV" aria-expanded="false">${icoSmile(19)}</button>
      <button class="icon-btn" id="ph-rules" aria-label="How to play">${icoHelp(19)}</button>
      <button class="icon-btn" id="ph-sound" aria-label="Phone sounds on/off">${icoSound(true, 19)}</button>
      <button class="icon-btn" id="ph-menu" aria-label="Host controls" hidden>${icoSettings(19)}</button>
    </header>
    <div class="emote-tray" id="emote-tray" hidden></div>
    <div class="ph-game" id="ph-game"></div>
    <section class="ph-lobby overlay" id="ph-lobby" hidden></section>
    <div class="sheet-backdrop" id="sheet-backdrop" hidden></div>
    <section class="sheet" id="host-sheet" hidden></section>
    <section class="sheet" id="rules-sheet" hidden></section>
    <section class="sheet" id="avatar-sheet" hidden></section>
    <section class="sheet" id="emote-sheet" hidden></section>
    <div class="conn-lost" id="conn-lost" hidden>Reconnecting…</div>
  </div>`;

  // ---------- custom reactions ----------
  const EMOTE_KEY = "ohno.emotes";
  const defaultEmotes = (): CustomEmote[] => EMOTES.map((e) => ({ icon: e.icon, label: e.label }));
  function loadEmotes(): CustomEmote[] {
    try {
      const raw = JSON.parse(localStorage.getItem(EMOTE_KEY) ?? "null");
      if (Array.isArray(raw) && raw.length === EMOTES.length) {
        const cleaned = raw.map((x) => cleanEmote(x));
        if (cleaned.every(Boolean)) return cleaned as CustomEmote[];
      }
    } catch {
      /* ignore corrupt storage */
    }
    return defaultEmotes();
  }
  function saveEmotes(list: CustomEmote[]) {
    try {
      localStorage.setItem(EMOTE_KEY, JSON.stringify(list));
    } catch {
      /* private mode */
    }
  }
  let myEmotes: CustomEmote[] = loadEmotes();
  let editSlot = 0;

  function renderEmoteTray() {
    $("#emote-tray").innerHTML = `${myEmotes
      .map(
        (em, i) =>
          `<button class="emote-btn" data-emote-idx="${i}" aria-label="${esc(em.label || em.icon)}"><span>${esc(em.icon)}</span>${
            em.label ? `<small>${esc(em.label)}</small>` : ""
          }</button>`,
      )
      .join("")}<button class="emote-btn emote-edit-btn" data-act="editEmotes" aria-label="Customize reactions" title="Customize reactions"><span>✏️</span><small>Edit</small></button>`;
  }
  renderEmoteTray();

  function renderEmoteEditor() {
    const cur = myEmotes[editSlot] ?? myEmotes[0]!;
    $("#emote-sheet").innerHTML = `
      <h3>Customize reactions</h3>
      <p class="muted small">Tap a slot to customize the emoji &amp; caption that pops on the TV.</p>
      <div class="emote-slots">${myEmotes
        .map(
          (em, i) =>
            `<button type="button" class="emote-slot ${i === editSlot ? "on" : ""}" data-eslot="${i}"><span>${esc(em.icon)}</span><small>${esc(em.label || "—")}</small></button>`,
        )
        .join("")}</div>
      <div class="emote-preview"><span class="emote-preview-pill"><span>${esc(cur.icon)}</span>${cur.label ? `<small>${esc(cur.label)}</small>` : ""}</span></div>
      <div class="emote-fields">
        <label class="emote-field emote-field-ico"><span>Emoji</span><input id="em-ico-in" type="text" maxlength="8" value="${esc(cur.icon)}" aria-label="Reaction emoji" /></label>
        <label class="emote-field emote-field-lbl"><span>Caption (optional)</span><input id="em-lbl-in" type="text" maxlength="${MAX_EMOTE_LABEL}" placeholder="e.g. MAY I?!" value="${esc(cur.label)}" aria-label="Reaction caption" /></label>
      </div>
      <div class="emote-palette">${EMOTE_ICONS.map(
        (ico) => `<button type="button" class="emote-pick ${ico === cur.icon ? "on" : ""}" data-epick="${ico}">${ico}</button>`,
      ).join("")}</div>
      <div class="emote-sheet-acts">
        <button type="button" class="btn btn-ghost" data-act="resetEmotes">Reset defaults</button>
        <button type="button" class="btn btn-primary" data-close>Done</button>
      </div>`;
    const icoIn = $("#em-ico-in") as HTMLInputElement;
    const lblIn = $("#em-lbl-in") as HTMLInputElement;
    const syncPreview = () => {
      const cleaned = cleanEmote({ icon: icoIn.value, label: lblIn.value }) ?? { icon: cur.icon, label: "" };
      myEmotes[editSlot] = cleaned;
      saveEmotes(myEmotes);
      renderEmoteTray();
      const slotEl = document.querySelector<HTMLElement>(`.emote-slot[data-eslot="${editSlot}"]`);
      if (slotEl) slotEl.innerHTML = `<span>${esc(cleaned.icon)}</span><small>${esc(cleaned.label || "—")}</small>`;
      const prev = document.querySelector<HTMLElement>(".emote-preview-pill");
      if (prev) prev.innerHTML = `<span>${esc(cleaned.icon)}</span>${cleaned.label ? `<small>${esc(cleaned.label)}</small>` : ""}`;
    };
    icoIn.addEventListener("input", syncPreview);
    lblIn.addEventListener("input", syncPreview);
  }

  let room: RoomPublic | null = null;
  let lastGameSnap: GameSnap | null = null;
  let view: GameView | null = null;
  let viewId: GameId | null = null;

  // ---------- sound ----------
  let soundOn = loadPref("phoneSound", true);
  unlockOnFirstGesture();
  const syncSoundBtn = () => {
    $("#ph-sound").innerHTML = icoSound(soundOn, 19);
    audio.sfxEnabled = soundOn;
  };
  syncSoundBtn();
  $("#ph-sound").addEventListener("click", () => {
    soundOn = !soundOn;
    savePref("phoneSound", soundOn);
    syncSoundBtn();
    if (soundOn) audio.tick();
  });

  const conn = connectRoom(code, { role: "player", pid, name, avatar: savedAvatar() ?? "" }, {
    onState: handle,
    onError(m) {
      toast(m, "error");
      haptic("error");
      audio.error();
      view?.onError?.();
    },
    onFatal(m) {
      view?.destroy();
      root.innerHTML = `<div class="fatal"><div class="logo">Oh<span>No!</span></div><p>${esc(m)}</p><a class="btn btn-primary" href="/">Back</a></div>`;
    },
    onStatus(ok) {
      $("#conn-lost").hidden = ok;
    },
  });
  keepAwake();
  const send = (m: ClientMessage) => conn.send(m);

  // ---------- state ----------

  function handle(snap: Snapshot) {
    room = snap.room;
    const isHost = room.hostId === pid;
    const self = room.members.find((m) => m.id === pid);
    $("#ph-me").innerHTML = self ? `${avatar(self, "sm")}<span>${esc(self.name)}</span>${isHost ? icoCrown() : ""}` : "";
    $("#ph-menu").hidden = !isHost;

    const inLobby = room.phase === "lobby" || !snap.game;
    $("#ph-lobby").hidden = !inLobby;
    if (inLobby) {
      if (view) {
        view.destroy();
        view = null;
        viewId = null;
        closeSheets();
      }
      lastGameSnap = null;
      renderLobby(room);
    } else {
      const game = snap.game!;
      let first = false;
      if (viewId !== game.id) {
        view?.destroy();
        view = SCREENS[game.id].phone({ el: $("#ph-game"), pid, send: (action) => send({ t: "game", action }), openSheet, closeSheets });
        viewId = game.id;
        first = true;
        if (snap.events.room.some((e) => e.type === "started")) haptic("turn");
      }
      lastGameSnap = { room, pub: game.pub, me: game.me, events: snap.events.game, first };
      view!.update(lastGameSnap);
    }
    if (isHost) renderHostSheet();
  }

  function renderLobby(r: RoomPublic) {
    const isHost = r.hostId === pid;
    const meta = GAMES[r.gameId].meta;
    const enough = r.members.length >= meta.minPlayers;
    const tooMany = r.members.length > meta.maxPlayers;
    $("#ph-lobby").innerHTML = `
      <div class="ph-lobby-inner">
        <div class="logo">Oh<span>No!</span></div>
        <h2>You're in! 🎉</h2>
        <p class="muted small">Tap your picture to change it.</p>
        ${r.notice ? `<p class="notice">${esc(r.notice)}</p>` : ""}
        <div class="lobby-players">${r.members
          .map(
            (p) =>
              `<div class="lobby-player ${p.id === pid ? "me" : ""}">${
                p.id === pid ? `<button class="avatar-edit" data-act="pickAvatar" aria-label="Change your picture">${avatar(p)}</button>` : avatar(p)
              }<span>${esc(p.name)}${p.id === pid ? " (you)" : ""}</span>${p.id === r.hostId ? icoCrown() : ""}${winBadge(p.wins)}${
                isHost && p.bot ? `<button class="remove-bot" data-act="kick" data-pid="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">${icoClose(13)}</button>` : ""
              }</div>`,
          )
          .join("")}</div>
        ${
          isHost
            ? `<h3 class="pick-title">Pick a game</h3>
               <div class="hub-games" role="radiogroup">${gameCards(r, true)}</div>
               <p class="hub-howto">${esc(meta.howTo)}</p>
               <button class="btn btn-ghost wide" data-act="addBot">${icoBot(18)} Add a bot player</button>
               ${settingsControls(r)}
               <div class="settings">${turnTimerControl(r)}</div>
               <button class="btn btn-primary btn-xl wide" data-act="start" ${enough && !tooMany ? "" : "disabled"}>${
                 tooMany ? `${esc(meta.name)} is for up to ${meta.maxPlayers}` : enough ? `Start ${esc(meta.name)}` : `${esc(meta.name)} needs ${playersText(r.gameId)} (or add a bot)`
               }</button>`
            : `<h3 class="pick-title">Up next</h3>
               <div class="hub-games">${gameCardFor(r)}</div>
               <p class="hub-howto">${esc(meta.howTo)}</p>
               <p class="muted">Waiting for ${esc(r.members.find((m) => m.id === r.hostId)?.name ?? "the host")} to start…</p>`
        }
        <button class="btn btn-ghost btn-small leave-btn" data-act="leave">${icoDoor(15)} Leave table</button>
      </div>`;
  }

  /** Non-hosts just see the chosen game. */
  function gameCardFor(r: RoomPublic) {
    const m = GAMES[r.gameId].meta;
    return `<div class="game-card on" data-game="${r.gameId}"><span class="gc-emoji">${gameEmblem(r.gameId)}</span><span class="gc-text"><b>${esc(m.name)}</b><small>${esc(m.tagline)}</small><em>${playersText(r.gameId)}${m.coop ? " · co-op" : ""}</em></span></div>`;
  }

  function renderHostSheet() {
    const r = room!;
    const playing = r.phase === "game";
    $("#host-sheet").innerHTML = `
      <h3>Host controls</h3>
      ${playing && view?.hostMenu && lastGameSnap ? view.hostMenu(lastGameSnap) : ""}
      <h4>TV sound</h4>
      ${tvAudioControls(r)}
      <h4>Table</h4>
      <div class="settings">${turnTimerControl(r)}</div>
      <h4>Players</h4>
      <div class="host-players">${r.members
        .map(
          (p) => `<div class="host-player ${p.connected ? "" : "offline"}">${avatar(p, "xs")}<span class="name">${esc(p.name)}${p.connected ? "" : " · offline"}</span>${
            p.id === pid
              ? "<em>you</em>"
              : `<span class="host-player-acts">${
                  !p.bot && p.connected ? `<button class="btn btn-small btn-ghost" data-act="transferHost" data-pid="${esc(p.id)}">Make host</button>` : ""
                }<button class="btn btn-small btn-danger" data-act="kick" data-pid="${esc(p.id)}">Remove</button></span>`
          }</div>`,
        )
        .join("")}</div>
      <button class="btn btn-ghost wide" data-act="addBot">${icoBot(18)} Add a bot player${playing ? " (joins now)" : ""}</button>
      ${playing ? `<button class="btn btn-ghost wide" data-act="endGame">End game &amp; pick another</button>` : ""}
      <button class="btn btn-ghost wide" data-act="leave">${icoDoor(16)} Leave table</button>
      <button class="btn btn-ghost wide" data-close>Close</button>`;
  }

  // ---------- taps ----------

  $("#ph-menu").addEventListener("click", () => {
    $("#emote-tray").hidden = true;
    renderHostSheet();
    openSheet($("#host-sheet"));
  });
  $("#ph-rules").addEventListener("click", () => {
    if (!room) return;
    $("#emote-tray").hidden = true;
    $("#rules-sheet").innerHTML = `${rulesBodyHtml(room.gameId, room.settings)}
      <button class="btn btn-ghost btn-small wide" data-act="leave">${icoDoor(15)} Leave table</button>
      <button class="btn btn-ghost wide" data-close>Got it</button>`;
    openSheet($("#rules-sheet"));
  });
  $("#ph-react").addEventListener("click", () => {
    const tray = $("#emote-tray");
    tray.hidden = !tray.hidden;
    $("#ph-react").setAttribute("aria-expanded", String(!tray.hidden));
  });
  $("#emote-tray").addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-emote-idx]");
    if (!btn) return;
    const em = myEmotes[Number(btn.dataset.emoteIdx)];
    if (!em) return;
    send({ t: "emote", emote: em });
    haptic("select");
    audio.tick();
    $("#emote-tray").hidden = true;
    $("#ph-react").setAttribute("aria-expanded", "false");
  });
  $("#emote-sheet").addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const slot = t.closest<HTMLElement>("[data-eslot]");
    if (slot) {
      editSlot = Number(slot.dataset.eslot);
      haptic("select");
      renderEmoteEditor();
      return;
    }
    const pick = t.closest<HTMLElement>("[data-epick]");
    if (pick) {
      const ico = pick.dataset.epick!;
      const cur = myEmotes[editSlot] ?? myEmotes[0]!;
      myEmotes[editSlot] = { icon: ico, label: cur.label };
      saveEmotes(myEmotes);
      renderEmoteTray();
      haptic("select");
      renderEmoteEditor();
    }
  });
  $("#sheet-backdrop").addEventListener("click", closeSheets);
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-close]")) closeSheets();
    const pic = t.closest<HTMLElement>("#avatar-sheet [data-avatar]");
    if (pic) {
      send({ t: "avatar", avatar: pic.dataset.avatar! });
      saveAvatar(pic.dataset.avatar!);
      closeSheets();
      return;
    }
    const g = t.closest<HTMLElement>("[data-gact]");
    if (g) {
      send({ t: "game", action: JSON.parse(g.dataset.gact!) });
      if (g.closest("#host-sheet")) closeSheets();
      return;
    }
    const act = t.closest<HTMLElement>("[data-act]");
    if (act) onAct(act);
  });

  function onAct(btn: HTMLElement) {
    const r = room;
    if (!r) return;
    switch (btn.dataset.act) {
      case "start":
        send({ t: "start" });
        break;
      case "endGame":
        send({ t: "endGame" });
        closeSheets();
        break;
      case "addBot":
        send({ t: "addBot" });
        break;
      case "kick":
        send({ t: "kick", pid: btn.dataset.pid! });
        break;
      case "selectGame":
        send({ t: "selectGame", gameId: btn.dataset.game as GameId });
        haptic("select");
        break;
      case "set":
        send({ t: "settings", gameId: r.gameId, settings: { [btn.dataset.key!]: JSON.parse(btn.dataset.val!) } });
        break;
      case "audio":
        send({ t: "audio", audio: { [btn.dataset.key!]: btn.dataset.val === "true" } });
        break;
      case "skipTrack":
        send({ t: "skipTrack" });
        haptic("select");
        toast("Skipped to next song on TV.");
        break;
      case "turnTimer":
        send({ t: "turnTimer", seconds: Number(btn.dataset.val) });
        haptic("select");
        break;
      case "transferHost":
        send({ t: "transferHost", pid: btn.dataset.pid! });
        closeSheets();
        toast("Handed over host controls.");
        break;
      case "leave":
        send({ t: "leave" });
        conn.close();
        location.href = "/";
        break;
      case "editEmotes":
        $("#emote-tray").hidden = true;
        $("#ph-react").setAttribute("aria-expanded", "false");
        renderEmoteEditor();
        openSheet($("#emote-sheet"));
        break;
      case "resetEmotes":
        myEmotes = defaultEmotes();
        saveEmotes(myEmotes);
        renderEmoteTray();
        renderEmoteEditor();
        haptic("select");
        toast("Reactions reset to defaults.");
        break;
      case "pickAvatar": {
        const mine = r.members.find((p) => p.id === pid)?.avatar ?? savedAvatar();
        $("#avatar-sheet").innerHTML = `<h3>Pick your picture</h3>${avatarPicker(mine ?? null)}<button class="btn btn-ghost wide" data-close>Done</button>`;
        openSheet($("#avatar-sheet"));
        break;
      }
    }
  }

  function openSheet(sheet: HTMLElement) {
    $("#sheet-backdrop").hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("open"));
  }
  function closeSheets() {
    $("#sheet-backdrop").hidden = true;
    root.querySelectorAll<HTMLElement>(".sheet").forEach((s) => {
      s.classList.remove("open");
      s.hidden = true;
    });
  }
}
