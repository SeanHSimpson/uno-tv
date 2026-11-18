// Fizzle! plugged into the room, plus its bot.

import type { Rng } from "../../common";
import type { GameModule } from "../types";
import * as F from "./engine";

/** One move at a time, so a bot can look at what Peek showed it before deciding. */
export function botMove(s: F.FizzleState, pid: string, rng: Rng): F.FizzleAction | null {
  const me = s.players.find((p) => p.id === pid);
  if (!me || s.phase !== "playing" || F.currentPlayer(s).id !== pid) return null;
  const has = (k: F.FizzleKind) => me.hand.find((c) => c.kind === k);

  // A lit firecracker must be dealt with this turn.
  if (me.lit.length) {
    const water = has("water");
    if (water) return { t: "play", cardId: water.id };
    const toss = has("toss");
    if (toss) {
      // Throw it at whoever has the fewest cards (least likely to have an answer).
      const targets = s.players.filter((p) => p.id !== pid && !p.out && !p.waiting);
      targets.sort((a, b) => a.hand.length - b.hand.length || rng() - 0.5);
      if (targets[0]) return { t: "play", cardId: toss.id, target: targets[0].id };
    }
  }

  // Is the top card a firecracker? Use what Peek showed, or play Peek to find out (sometimes).
  const known = me.peek?.[0];
  if (!me.peek && has("peek") && rng() < 0.45) return { t: "play", cardId: has("peek")!.id };
  if (known?.kind === "cracker") {
    const dodge = has("nap") ?? has("fish") ?? has("shuffle");
    if (dodge) return { t: "play", cardId: dodge.id };
  }
  // With lots of firecrackers in a small deck, napping is tempting.
  const risk = s.deck.length ? s.deck.filter((c) => c.kind === "cracker").length / s.deck.length : 0;
  if (!known && risk > 0.3 && has("nap") && rng() < 0.6) return { t: "play", cardId: has("nap")!.id };
  return { t: "draw" };
}

export const fizzle: GameModule<F.FizzleState, Record<string, never>, F.FizzleAction, F.FizzleEvent> = {
  meta: {
    id: "fizzle",
    name: "Fizzle!",
    tagline: "Pass the lit firecracker before it goes 💥. Last one standing wins.",
    howTo:
      "Play any action cards, then draw. Draw a firecracker and it's lit in front of you: next turn, Toss it to someone or douse it with Water, or it goes boom and you're out. Peek at the deck, Shuffle, Nap to skip drawing, or Fish from the bottom.",
    emoji: "🧨",
    minPlayers: 2,
    maxPlayers: 8,
    music: "game",
  },
  settings: [],
  defaultSettings: {},

  start(members, _settings, ctx) {
    return F.newFizzle(members, ctx.hostId, ctx.rng);
  },

  action(s, pid, a, ctx) {
    s.hostId = ctx.hostId;
    switch (a?.t) {
      case "play":
        return F.play(s, pid, Number(a.cardId), a.target ? String(a.target) : undefined, ctx.rng);
      case "draw":
        return F.draw(s, pid, ctx.rng);
      case "restart":
        return F.restart(s, ctx.isHost, ctx.rng);
      case "skip":
        return F.skipTurn(s, pid, ctx.isHost, ctx.rng);
      default:
        return [];
    }
  },

  join(s, m) {
    return F.addPlayer(s, m);
  },
  leave(s, pid, ctx) {
    return F.removePlayer(s, pid, ctx.rng);
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

  publicView: F.publicView,
  privateView: F.privateView,

  nextBot(s, ctx) {
    if (s.phase !== "playing") return null;
    const cur = F.currentPlayer(s);
    return cur.bot ? { pid: cur.id, delay: 1000 + ctx.rng() * 900 } : null;
  },
  botActions(s, pid, ctx) {
    const move = botMove(s, pid, ctx.rng);
    return move ? [move] : [];
  },
  botRescue(s, pid, ctx) {
    return F.currentPlayer(s).id === pid && s.phase === "playing" ? F.draw(s, pid, ctx.rng) : [];
  },

  status(s) {
    if (s.players.filter((p) => !p.waiting).length < 2 && s.phase === "playing") return "abort";
    return s.phase === "over" ? "over" : "playing";
  },
  tvActions: ["restart"],
};
