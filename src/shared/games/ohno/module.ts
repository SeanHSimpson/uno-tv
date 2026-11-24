// OhNo! plugged into the room. Thin adapter over the existing engine.

import type { Member } from "../../common";
import type { GameModule } from "../types";
import { botTurn } from "./bot";
import * as E from "./engine";
import { DEFAULT_SETTINGS, type GameEvent, type GameState, type OhNoAction, type Settings } from "./types";

export const ohno: GameModule<GameState, Settings, OhNoAction, GameEvent> = {
  meta: {
    id: "ohno",
    name: "OhNo!",
    tagline: "Match colors or symbols and empty your hand first.",
    howTo: "Play a card that matches the top card's color or symbol. Skips, reverses, +2s and wilds keep everyone on their toes. Down to one card? Hit OhNo!, or get caught.",
    emoji: "🃏",
    minPlayers: 2,
    maxPlayers: 10,
    music: "game",
  },

  settings: [
    { key: "targetScore", label: "Game length", options: [{ value: 0, label: "One round" }, { value: 200, label: "To 200" }, { value: 500, label: "To 500" }] },
    { key: "stacking", label: "Stack +2 / +4", options: [{ value: false, label: "Off" }, { value: true, label: "On" }] },
    { key: "drawUntilPlayable", label: "When you can't play", options: [{ value: false, label: "Draw 1" }, { value: true, label: "Draw till playable" }] },
    { key: "catchPenalty", label: "Forgot OhNo! penalty", options: [{ value: 2, label: "+2" }, { value: 4, label: "+4" }] },
    { key: "sevenZero", label: "7–0 hand swap", options: [{ value: false, label: "Off" }, { value: true, label: "On" }] },
  ],
  defaultSettings: { ...DEFAULT_SETTINGS },

  start(members, settings, ctx) {
    const s = E.newGame("ohno");
    s.settings = { ...DEFAULT_SETTINGS, ...settings };
    for (const m of members) E.joinPlayer(s, m.id, m.name, ctx.rng, m.avatar);
    this.sync(s, members, ctx.hostId);
    const host = ctx.hostId ?? members[0]!.id;
    s.hostId = host;
    return { state: s, events: E.startGame(s, host, ctx.rng) };
  },

  action(s, pid, a, ctx) {
    s.hostId = ctx.hostId;
    switch (a?.t) {
      case "play":
        return E.play(s, pid, Number(a.cardId), a.color, ctx.rng);
      case "draw":
        return E.draw(s, pid, ctx.rng);
      case "pass":
        return E.pass(s, pid, ctx.rng);
      case "take":
        return E.take(s, pid, ctx.rng);
      case "ohno":
        return E.callOhNo(s, pid);
      case "catch":
        return E.catchPlayer(s, pid, String(a.target), ctx.rng);
      case "skip":
        return E.skipCurrent(s, pid, ctx.rng);
      case "nextRound":
        return E.nextRound(s, pid, ctx.rng);
      default:
        return [];
    }
  },

  join(s, m, ctx) {
    const events = E.joinPlayer(s, m.id, m.name, ctx.rng, m.avatar);
    this.sync(s, [m], ctx.hostId);
    return events;
  },

  leave(s, pid, ctx) {
    return E.removePlayer(s, pid, false, ctx.rng);
  },

  sync(s, members, hostId) {
    for (const p of s.players) {
      const m: Member | undefined = members.find((x) => x.id === p.id);
      if (!m) continue;
      p.name = m.name;
      p.avatar = m.avatar;
      p.hue = m.hue;
      p.bot = m.bot;
      p.connected = m.connected;
    }
    s.hostId = hostId;
  },

  publicView: E.publicView,
  privateView: E.privateView,

  nextBot(s, ctx) {
    if (s.phase !== "playing") return null;
    const current = s.players[s.turn];
    if (current?.bot) return { pid: current.id, delay: 1100 + ctx.rng() * 1000 };
    // Bots sometimes catch people who forget to call OhNo!, after giving humans a head start.
    const catcher = s.vulnerable ? s.players.find((p) => p.bot && p.id !== s.vulnerable) : undefined;
    if (catcher && ctx.rng() < 0.55) return { pid: catcher.id, delay: 2500 + ctx.rng() * 2500 };
    return null;
  },

  botActions(s, pid, ctx) {
    if (s.players[s.turn]?.id === pid) return botTurn(s, pid, ctx.rng);
    if (s.vulnerable && s.vulnerable !== pid) return [{ t: "catch", target: s.vulnerable }];
    return [];
  },

  botRescue(s, pid, ctx) {
    if (s.players[s.turn]?.id !== pid) return [];
    try {
      return s.drawnCardId !== null || s.pendingDraw ? E.pass(s, pid, ctx.rng) : E.draw(s, pid, ctx.rng);
    } catch {
      return E.skipCurrent(s, s.hostId ?? pid, ctx.rng);
    }
  },

  status(s) {
    if (s.phase === "lobby") return "abort"; // too few players left
    if (s.phase === "roundOver" && s.gameWinner) return "over";
    return "playing";
  },
  winners(s) {
    return s.gameWinner ? [s.gameWinner] : [];
  },
  activeTurn(s) {
    if (s.phase !== "playing") return null;
    const cur = s.players[s.turn];
    return cur ? { pid: cur.id, key: `${s.round}:${s.turn}:${s.discard.length}:${s.drawnCardId ?? ""}:${s.pendingDraw}` } : null;
  },
  timeout(s, pid, ctx) {
    return ohno.botRescue!(s, pid, ctx);
  },

  tvActions: ["nextRound"],
};

