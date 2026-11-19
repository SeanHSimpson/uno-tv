// Euchre plugged into the room, plus its bot and the little pauses that keep it readable.

import { fail } from "../../common";
import type { GameModule } from "../types";
import { botMove } from "./bot";
import * as E from "./engine";

/** How long a finished trick stays on the table, and the hand summary before the next deal. */
export const TRICK_PAUSE = 1500;
export const HAND_PAUSE = 5200;

export const euchre: GameModule<E.EuchreState, E.EuchreSettings, E.EuchreAction, E.EuchreEvent> = {
  meta: {
    id: "euchre",
    name: "Euchre",
    tagline: "Michigan's card game. Two teams, five tricks, and bowers.",
    howTo:
      "Partners sit across from each other. Order up the turned card or name trump, then take tricks: follow suit if you can. The Jack of trump is highest, then the other Jack of the same colour. Take 3 tricks for a point, all 5 for 2. Fall short and you're euchred: the other team gets 2. First to 10 wins.",
    emoji: "🦌",
    minPlayers: 4,
    maxPlayers: 4,
    music: "game",
  },
  settings: [
    { key: "target", label: "Play to", options: [{ value: 10, label: "10 points" }, { value: 5, label: "5 (quick)" }] },
    { key: "stick", label: "Stick the dealer", options: [{ value: true, label: "On" }, { value: false, label: "Off (redeal)" }] },
    { key: "teams", label: "Teams", options: [{ value: "pick", label: "Pick partners" }, { value: "random", label: "Random" }] },
    { key: "table", label: "Cards on the TV", options: [{ value: 1, label: "Normal" }, { value: 1.3, label: "Big" }, { value: 1.55, label: "Huge" }] },
  ],
  defaultSettings: { ...E.EUCHRE_DEFAULTS },

  start(members, settings, ctx) {
    return E.newEuchre(members, settings, ctx.hostId, ctx.rng);
  },

  action(s, pid, a, ctx) {
    s.hostId = ctx.hostId;
    switch (a?.t) {
      case "order":
        return E.order(s, pid, !!a.alone);
      case "call":
        return E.call(s, pid, a.suit, !!a.alone);
      case "pass":
        return E.pass(s, pid, ctx.rng);
      case "discard":
        return E.discard(s, pid, Number(a.cardId));
      case "play":
        return E.play(s, pid, Number(a.cardId));
      case "collect":
        return E.collect(s);
      case "nextHand":
        return E.nextHand(s, ctx.rng);
      case "restart":
        return E.restart(s, ctx.isHost, ctx.rng);
      case "team":
        return E.pickTeam(s, pid, ctx.isHost, a.team, a.pid);
      case "shuffleTeams":
        return E.shuffleTeams(s, ctx.isHost, ctx.rng);
      case "deal":
        return E.dealTeams(s, ctx.isHost, ctx.rng);
      case "table":
        return E.setTable(s, ctx.isHost, Number(a.size));
      case "autoplay": {
        // The host nudges a stuck player: a bot makes their move for them.
        if (!ctx.isHost) fail("Only the host can do that.");
        const cur = s.players[s.turn];
        const move = cur && botMove(s, cur.id, ctx.rng);
        if (!cur || !move || move.t === "autoplay") return [];
        return euchre.action(s, cur.id, move, ctx);
      }
      default:
        return [];
    }
  },

  // The table is full: newcomers watch until the next game.
  join() {
    return [];
  },
  leave(s, pid) {
    return E.standIn(s, pid);
  },
  sync(s, members, hostId) {
    for (const p of s.players) {
      const m = members.find((x) => x.id === p.id);
      if (!m) continue;
      p.name = m.name;
      p.avatar = m.avatar;
      p.hue = m.hue;
      p.bot = m.bot || p.standIn;
      p.connected = p.standIn ? true : m.connected;
    }
    s.hostId = hostId;
  },

  publicView: E.publicView,
  privateView: E.privateView,

  nextBot(s, ctx) {
    // The pauses run on the same timer as the bots, "played" by whoever is seated.
    if (s.trickDone) return { pid: s.players[s.trickDone.winner]!.id, delay: TRICK_PAUSE };
    if (s.phase === "handOver") return { pid: s.players[s.dealer]!.id, delay: HAND_PAUSE };
    if (!["bid1", "bid2", "discard", "play"].includes(s.phase)) return null;
    const cur = s.players[s.turn]!;
    if (!cur.bot) return null;
    const delay = s.phase === "play" ? 750 + ctx.rng() * 650 : 900 + ctx.rng() * 800;
    return { pid: cur.id, delay };
  },
  botActions(s, pid, ctx) {
    if (s.trickDone) return [{ t: "collect" }];
    if (s.phase === "handOver") return [{ t: "nextHand" }];
    const move = botMove(s, pid, ctx.rng);
    return move ? [move] : [];
  },
  botRescue(s, pid, ctx) {
    const seat = s.players.findIndex((p) => p.id === pid);
    if (seat !== s.turn) return [];
    const p = s.players[seat]!;
    if (s.phase === "play") return E.play(s, pid, E.legalCards(p.hand, s.trick, s.trump)[0]!.id);
    if (s.phase === "discard") return E.discard(s, pid, p.hand[0]!.id);
    if (s.phase === "bid2" && s.dealer === seat && s.settings.stick) return E.call(s, pid, E.SUITS.find((x) => x !== s.turnedDown)!, false);
    if (s.phase === "bid1" || s.phase === "bid2") return E.pass(s, pid, ctx.rng);
    return [];
  },

  status(s) {
    if (s.players.every((p) => p.bot)) return "abort";
    return s.phase === "gameOver" ? "over" : "playing";
  },
  tvActions: ["restart", "deal"],
};
