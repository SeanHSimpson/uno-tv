// Hush plugged into the room.

import type { GameModule } from "../types";
import * as H from "./engine";

export const hush: GameModule<H.HushState, H.HushSettings, H.HushAction, H.HushEvent> = {
  meta: {
    id: "hush",
    name: "Hush",
    tagline: "Play every number in rising order, together, without saying a word.",
    howTo:
      "Everyone gets a few numbers from 1 to 100. No turns and no talking: when you feel it's your moment, play your lowest card. If someone was still holding a lower one, the team loses a ❤️. Clear every level together.",
    emoji: "🤫",
    minPlayers: 2,
    maxPlayers: 6,
    music: "calm",
    coop: true,
  },

  settings: [
    {
      key: "goal",
      label: "Levels to clear",
      options: [
        { value: 0, label: "Auto" },
        { value: 6, label: "6" },
        { value: 8, label: "8" },
        { value: 10, label: "10" },
        { value: 12, label: "12" },
      ],
    },
  ],
  defaultSettings: { ...H.HUSH_DEFAULTS },

  start(members, settings, ctx) {
    return H.newHush(members, settings, ctx.hostId, ctx.rng);
  },

  action(s, pid, a, ctx) {
    s.hostId = ctx.hostId;
    switch (a?.t) {
      case "ready":
        return H.ready(s, pid);
      case "play":
        return H.playLowest(s, pid, ctx.rng);
      case "star":
        return H.voteStar(s, pid);
      case "restart":
        return H.restart(s, ctx.isHost, ctx.rng);
      default:
        return [];
    }
  },

  join(s, m, ctx) {
    return H.addPlayer(s, m, ctx.rng);
  },

  leave(s, pid, ctx) {
    return H.removePlayer(s, pid, ctx.rng);
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

  publicView: H.publicView,
  privateView: H.privateView,

  nextBot(s, ctx) {
    const bots = s.players.filter((p) => p.bot);
    if (!bots.length) return null;
    if (s.phase === "ready") {
      const waiting = bots.find((b) => !b.ready);
      return waiting ? { pid: waiting.id, delay: 600 + ctx.rng() * 900 } : null;
    }
    if (s.phase !== "playing") return null;
    // Someone asked for a star: bots go along with it.
    if (s.players.some((p) => p.star && !p.bot)) {
      const holdout = bots.find((b) => !b.star && b.hand.length > 0);
      if (holdout) return { pid: holdout.id, delay: 1200 + ctx.rng() * 800 };
    }
    // Otherwise the bot whose lowest card is "due" soonest plays it.
    let best: { pid: string; delay: number } | null = null;
    for (const b of bots) {
      if (!b.hand.length) continue;
      const delay = H.botDelay(s, b, ctx.rng);
      if (!best || delay < best.delay) best = { pid: b.id, delay };
    }
    return best;
  },

  botActions(s, pid) {
    const p = s.players.find((x) => x.id === pid);
    if (!p) return [];
    if (s.phase === "ready") return p.ready ? [] : [{ t: "ready" }];
    if (s.phase !== "playing") return [];
    if (s.players.some((x) => x.star && !x.bot) && !p.star && p.hand.length) return [{ t: "star" }];
    return p.hand.length ? [{ t: "play" }] : [];
  },

  status(s) {
    if (s.players.length < 2) return "abort";
    return s.phase === "won" || s.phase === "lost" ? "over" : "playing";
  },
  winners(s) {
    return s.phase === "won" ? s.players.map((p) => p.id) : [];
  },

  tvActions: ["restart"],
};
