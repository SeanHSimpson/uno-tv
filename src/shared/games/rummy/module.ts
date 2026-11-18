// Contract Rummy plugged into the room.

import type { GameModule } from "../types";
import { botTurn, botWantsMayI } from "./bot";
import * as E from "./engine";

export const rummy: GameModule<E.RummyState, E.RummySettings, E.RummyAction, E.RummyEvent> = {
  meta: {
    id: "rummy",
    name: "Contract Rummy",
    tagline: "Seven rounds, seven contracts. Build sets and runs, go out first, keep your score low.",
    howTo:
      "Each round has a contract, like 2 sets of 3 or a set plus a run of 4. Draw, collect, lay down your contract, then add cards to any group to empty your hand. Lowest total after all the rounds wins. Want a discard out of turn? Shout \"May I?\".",
    emoji: "♠️",
    minPlayers: 2,
    maxPlayers: 8,
    music: "game",
  },

  settings: [
    { key: "rounds", label: "Game length", options: [{ value: 7, label: "Classic (7 contracts)" }, { value: 4, label: "Short (4)" }] },
    { key: "mayI", label: "\"May I?\" (buy the discard)", options: [{ value: true, label: "On" }, { value: false, label: "Off" }] },
  ],
  defaultSettings: { ...E.RUMMY_DEFAULTS },

  start(members, settings, ctx) {
    return E.newRummy(members, settings, ctx.hostId, ctx.rng);
  },

  action(s, pid, a, ctx) {
    s.hostId = ctx.hostId;
    switch (a?.t) {
      case "draw":
        return E.draw(s, pid, a.from === "discard" ? "discard" : "stock", ctx.rng);
      case "layDown":
        return E.layDown(s, pid, Array.isArray(a.cardIds) ? a.cardIds : []);
      case "hit":
        return E.hit(s, pid, Array.isArray(a.cardIds) ? a.cardIds : [], Number(a.meldId));
      case "discard":
        return E.discard(s, pid, Number(a.cardId));
      case "mayI":
        return E.mayI(s, pid);
      case "nextRound":
        return E.nextRound(s, ctx.isHost, ctx.rng);
      case "skip":
        return E.skipTurn(s, pid, ctx.isHost);
      default:
        return [];
    }
  },

  join(s, m) {
    return E.addPlayer(s, m);
  },

  leave(s, pid) {
    return E.removePlayer(s, pid);
  },

  sync(s, members, hostId) {
    for (const p of s.players) {
      const m = members.find((x) => x.id === p.id);
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
    const cur = s.players[s.turn]!;
    // A bot that isn't on turn may shout "May I?" before the current player draws.
    if (s.stage === "draw" && s.settings.mayI) {
      const buyer = s.players.find((p) => p.bot && p.id !== cur.id && botWantsMayI(s, p.id, ctx.rng));
      if (buyer) return { pid: buyer.id, delay: 700 + ctx.rng() * 600 };
    }
    if (cur.bot) return { pid: cur.id, delay: (s.stage === "draw" ? 1300 : 900) + ctx.rng() * 900 };
    return null;
  },

  botActions(s, pid) {
    const cur = s.players[s.turn]!;
    if (cur.id !== pid) return s.stage === "draw" ? [{ t: "mayI" }] : [];
    return botTurn(s, pid);
  },

  botRescue(s, pid, ctx) {
    if (s.players[s.turn]?.id !== pid || s.phase !== "playing") return [];
    if (s.stage === "draw") return E.draw(s, pid, "stock", ctx.rng);
    const p = s.players.find((x) => x.id === pid)!;
    const card = p.hand.find((c) => c.id !== s.tookFromDiscard) ?? p.hand[0];
    return card ? E.discard(s, pid, card.id) : [];
  },

  status(s) {
    if (s.players.length < 2) return "abort";
    return s.phase === "gameOver" ? "over" : "playing";
  },

  tvActions: ["nextRound"],
};
