// Lobby pieces shared by the TV and phone shells.

import { GAME_ORDER, GAMES } from "../../shared/games";
import type { GameId } from "../../shared/games/types";
import type { RoomPublic } from "../../shared/room";
import { gameEmblem, icoNextTrack, icoTrophy } from "../icons";
import { esc } from "../ui";

export const playersText = (id: GameId) => {
  const m = GAMES[id].meta;
  return m.minPlayers === m.maxPlayers ? `${m.minPlayers} players` : `${m.minPlayers}–${m.maxPlayers} players`;
};

/** One card per game. `act` makes them tappable (host's phone). */
export function gameCards(room: RoomPublic, act: boolean): string {
  return GAME_ORDER.map((id) => {
    const m = GAMES[id].meta;
    const on = id === room.gameId;
    const attrs = act ? `data-act="selectGame" role="radio" aria-checked="${on}"` : "";
    return `<${act ? "button" : "div"} class="game-card ${on ? "on" : ""}" data-game="${id}" ${attrs}>
      <span class="gc-emoji">${gameEmblem(id)}</span>
      <span class="gc-text"><b>${esc(m.name)}</b><small>${esc(m.tagline)}</small><em>${playersText(id)}${m.coop ? " · co-op" : ""}</em></span>
      ${on ? `<span class="gc-next">Up next</span>` : ""}
    </${act ? "button" : "div"}>`;
  }).join("");
}

/** The chosen game's settings as readable chips (TV). */
export function settingsChips(room: RoomPublic): string {
  return GAMES[room.gameId].settings
    .map((d) => {
      const opt = d.options.find((o) => o.value === room.settings[d.key]);
      return `<span>${esc(d.label)}: <b>${esc(opt?.label ?? String(room.settings[d.key]))}</b></span>`;
    })
    .join("");
}

/** The chosen game's settings as tappable segmented controls (host's phone). */
export function settingsControls(room: RoomPublic): string {
  const defs = GAMES[room.gameId].settings;
  if (!defs.length) return "";
  return `<div class="settings">${defs
    .map(
      (d) => `<div class="setting"><span>${esc(d.label)}</span><div class="seg">${d.options
        .map(
          (o) =>
            `<button data-act="set" data-key="${esc(d.key)}" data-val='${JSON.stringify(o.value)}' class="${room.settings[d.key] === o.value ? "on" : ""}">${esc(o.label)}</button>`,
        )
        .join("")}</div></div>`,
    )
    .join("")}</div>`;
}

export function tvAudioControls(room: RoomPublic): string {
  const seg = (key: "tvMusic" | "tvSounds", label: string) =>
    `<div class="setting"><span>${label}</span><div class="seg">${[true, false]
      .map((v) => `<button data-act="audio" data-key="${key}" data-val="${v}" class="${room.audio[key] === v ? "on" : ""}">${v ? "On" : "Off"}</button>`)
      .join("")}</div></div>`;
  return `<div class="settings">${seg("tvMusic", "Music on the TV")}${seg("tvSounds", "Sound effects on the TV")}${
    room.audio.tvMusic ? `<button class="btn btn-ghost btn-small wide" data-act="skipTrack">${icoNextTrack(15)} Next song on TV</button>` : ""
  }</div>`;
}

export function turnTimerControl(room: RoomPublic): string {
  const opts: [number, string][] = [
    [0, "Off"],
    [30, "30s"],
    [60, "60s"],
  ];
  return `<div class="setting"><span>Turn timer</span><div class="seg">${opts
    .map(([v, label]) => `<button data-act="turnTimer" data-val="${v}" class="${room.turnTimer === v ? "on" : ""}">${label}</button>`)
    .join("")}</div></div>`;
}

export function winBadge(wins: number): string {
  return wins > 0 ? `<span class="win-badge" title="${wins} game-night win${wins === 1 ? "" : "s"}">${icoTrophy("win-ico")} ${wins}</span>` : "";
}
