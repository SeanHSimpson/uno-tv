import { describe, expect, it } from "vitest";
import { GameError } from "../src/shared/common";
import type { GameState } from "../src/shared/games/ohno/types";
import type { HushState } from "../src/shared/games/hush/engine";
import * as R from "../src/shared/room";

function seeded(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function lobby(...names: string[]) {
  const r = R.newRoom("ABCD");
  names.forEach((n, i) => R.join(r, `pid-${n.toLowerCase()}-${i}`, n, undefined, Math.random));
  return r;
}
const pid = (r: R.RoomState, name: string) => r.members.find((m) => m.name === name)!.id;

describe("membership", () => {
  it("first person is host; names and pictures are cleaned up", () => {
    const r = R.newRoom("ABCD");
    R.join(r, "pid-ann-0001", " <b>Ann</b> ", "🦊", Math.random);
    R.join(r, "pid-bob-0002", "Bob", "<img>", Math.random);
    expect(r.hostId).toBe("pid-ann-0001");
    expect(r.members.map((m) => [m.name, m.avatar])).toEqual([
      ["bAnn/b", "🦊"],
      ["Bob", undefined],
    ]);
    expect(new Set(r.members.map((m) => m.hue)).size).toBe(2);
  });

  it("reconnecting keeps your seat and picture", () => {
    const r = lobby("Ann");
    const id = pid(r, "Ann");
    R.setAvatar(r, id, "🐼");
    R.join(r, id, "Ann", "", Math.random);
    expect(r.members).toHaveLength(1);
    expect(r.members[0]!.avatar).toBe("🐼");
    expect(() => R.setAvatar(r, id, "nope")).toThrow(/pictures/);
  });

  it("leaving the lobby frees the seat and passes the host role to a person, never a bot", () => {
    const r = lobby("Ann", "Bob");
    R.addBot(r, pid(r, "Ann"), Math.random);
    R.setConnected(r, pid(r, "Ann"), false, Math.random);
    expect(r.members.map((m) => m.name)).toEqual(["Bob", "Robo Rita"]);
    expect(r.hostId).toBe(pid(r, "Bob"));
    R.setConnected(r, pid(r, "Bob"), false, Math.random);
    expect(r.hostId).toBeNull();
  });

  it("only the host can add bots, kick, pick games, change settings or TV sound", () => {
    const r = lobby("Ann", "Bob");
    const bob = pid(r, "Bob");
    const ann = pid(r, "Ann");
    expect(() => R.addBot(r, bob, Math.random)).toThrow(/host/);
    expect(() => R.kick(r, bob, ann, Math.random)).toThrow(/host/);
    expect(() => R.selectGame(r, bob, "hush")).toThrow(/host/);
    expect(() => R.updateSettings(r, bob, "ohno", { stacking: true })).toThrow(/host/);
    expect(() => R.setAudio(r, bob, { tvMusic: false })).toThrow(/host/);
    expect(() => R.kick(r, ann, ann, Math.random)).toThrow(/yourself/);
    R.kick(r, ann, bob, Math.random);
    expect(r.members).toHaveLength(1);
  });
});

describe("game selection & settings", () => {
  it("host picks a game; unknown games are refused", () => {
    const r = lobby("Ann");
    R.selectGame(r, pid(r, "Ann"), "hush");
    expect(r.gameId).toBe("hush");
    expect(() => R.selectGame(r, pid(r, "Ann"), "chess")).toThrow(GameError);
  });

  it("settings are validated against each game's options", () => {
    const r = lobby("Ann");
    const ann = pid(r, "Ann");
    R.updateSettings(r, ann, "ohno", { stacking: true, targetScore: 999, sneaky: 1, catchPenalty: 4 });
    expect(R.settingsFor(r, "ohno")).toMatchObject({ stacking: true, targetScore: 0, catchPenalty: 4 });
    expect(R.settingsFor(r, "ohno")).not.toHaveProperty("sneaky");
    R.updateSettings(r, ann, "hush", { goal: 6 });
    expect(R.settingsFor(r, "hush")).toEqual({ goal: 6 });
  });

  it("TV audio switches", () => {
    const r = lobby("Ann");
    R.setAudio(r, pid(r, "Ann"), { tvMusic: false, tvSounds: "yes" });
    expect(r.audio).toEqual({ tvMusic: false, tvSounds: true });
  });
});

describe("starting, playing and ending", () => {
  it("needs enough players; a bot counts", () => {
    const r = lobby("Ann");
    const ann = pid(r, "Ann");
    expect(() => R.start(r, ann, Math.random)).toThrow(/at least 2/);
    R.addBot(r, ann, Math.random);
    const res = R.start(r, ann, Math.random);
    expect(res.room).toEqual([{ type: "started", gameId: "ohno" }]);
    expect(r.phase).toBe("game");
    expect(() => R.selectGame(r, ann, "hush")).toThrow(/Finish/);
  });

  it("each player sees only their own cards", () => {
    const r = lobby("Ann", "Bob");
    R.start(r, pid(r, "Ann"), Math.random);
    const pub = JSON.stringify(R.gameView(r, null));
    expect(pub).not.toContain('"hand"');
    const mine = R.gameView(r, pid(r, "Ann"))!.me as { hand: unknown[] };
    // 7 cards (or 8 if Ann went first and auto-drew, or 9 if a +2 was turned up).
    expect([7, 8, 9]).toContain(mine.hand.length);
  });

  it("someone joining mid-OhNo! is dealt in; names and pictures flow into the game", () => {
    const r = lobby("Ann", "Bob");
    R.start(r, pid(r, "Ann"), Math.random);
    R.join(r, "pid-cat-0003", "Cat", "🐱", Math.random);
    const g = r.game as GameState;
    expect(g.players.find((p) => p.name === "Cat")?.hand).toHaveLength(7);
    R.setAvatar(r, pid(r, "Ann"), "🦉");
    expect(g.players.find((p) => p.name === "Ann")?.avatar).toBe("🦉");
  });

  it("if too few players remain, the room returns to the lobby with a note", () => {
    const r = lobby("Ann", "Bob");
    R.start(r, pid(r, "Ann"), Math.random);
    const res = R.kick(r, pid(r, "Ann"), pid(r, "Bob"), Math.random);
    expect(r.phase).toBe("lobby");
    expect(r.game).toBeNull();
    expect(r.notice).toMatch(/Not enough players/);
    expect(res.room.some((e) => e.type === "ended")).toBe(true);
  });

  it("ending a game returns to the lobby and clears seats of people who left", () => {
    const r = lobby("Ann", "Bob", "Cat");
    R.start(r, pid(r, "Ann"), Math.random);
    R.setConnected(r, pid(r, "Cat"), false, Math.random);
    expect(r.members).toHaveLength(3); // seat held during the game
    R.endGame(r, pid(r, "Ann"));
    expect(r.phase).toBe("lobby");
    expect(r.members.map((m) => m.name)).toEqual(["Ann", "Bob"]);
  });

  it("the TV can only send the actions a game allows", () => {
    const r = lobby("Ann", "Bob");
    R.start(r, pid(r, "Ann"), Math.random);
    expect(R.tvAction(r, { t: "draw" }, Math.random)).toEqual({ room: [], game: [] });
    expect(() => R.tvAction(r, { t: "nextRound" }, Math.random)).toThrow(/round isn't over/);
  });

  it("switching games in the same room keeps everyone", () => {
    const r = lobby("Ann", "Bob");
    const ann = pid(r, "Ann");
    R.start(r, ann, Math.random);
    R.endGame(r, ann);
    R.selectGame(r, ann, "hush");
    R.start(r, ann, Math.random);
    const g = r.game as HushState;
    expect(g.players.map((p) => p.name)).toEqual(["Ann", "Bob"]);
    expect(g.level).toBe(1);
  });
});

describe("bots through the room", () => {
  it("a table of bots finishes OhNo! games on their own", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seeded(seed);
      const r = lobby("Host");
      const host = pid(r, "Host");
      for (let i = 0; i < 2 + (seed % 3); i++) R.addBot(r, host, rng);
      R.remove(r, host, false, rng);
      r.hostId = host; // keep a host id for starting
      r.members.push({ id: host, name: "Host", hue: 9, connected: false });
      r.members = r.members.filter((m) => m.bot);
      R.start(r, host, rng);
      let steps = 0;
      while (steps++ < 3000) {
        const due = R.nextBot(r, rng);
        if (!due) break;
        R.runBot(r, due.pid, rng);
      }
      expect((r.game as GameState).phase, `seed ${seed}`).toBe("roundOver");
    }
  });

  it("bots play Hush to a win or a loss", () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seeded(seed);
      const r = lobby("Host");
      const host = pid(r, "Host");
      R.selectGame(r, host, "hush");
      for (let i = 0; i < 2 + (seed % 3); i++) R.addBot(r, host, rng);
      r.members = r.members.filter((m) => m.bot);
      R.start(r, host, rng);
      let steps = 0;
      while (steps++ < 5000) {
        const due = R.nextBot(r, rng);
        if (!due) break;
        R.runBot(r, due.pid, rng);
      }
      const phase = (r.game as HushState).phase;
      expect(["won", "lost"], `seed ${seed}`).toContain(phase);
      outcomes.add(phase);
    }
    expect(outcomes.size).toBeGreaterThan(0);
  });

  it("leave, transferHost, turnTimer, and session wins work cleanly", () => {
    const r = lobby("Ann", "Bob", "Cat");
    const ann = pid(r, "Ann");
    const bob = pid(r, "Bob");
    const cat = pid(r, "Cat");

    R.transferHost(r, ann, bob);
    expect(r.hostId).toBe(bob);
    expect(() => R.transferHost(r, ann, cat)).toThrow(/host/);

    R.setTurnTimer(r, bob, 30);
    expect(r.turnTimer).toBe(30);
    expect(() => R.setTurnTimer(r, bob, 45)).toThrow();

    R.start(r, bob, seeded(7));
    R.syncTurnTimer(r, 1000);
    expect(r.turnDeadline).toBe(31_000);
    const turn = R.activeTurn(r)!;
    R.runTimeout(r, turn.pid, seeded(8));
    expect(r.turnKey).toBeNull();

    // Awarding session wins on game over (and never double-counting).
    const g = r.game as GameState;
    g.turn = 0;
    g.color = "red";
    g.discard.push({ id: 800, color: "red", value: "3" });
    g.players[0]!.hand = [{ id: 801, color: "red", value: "5" }];
    g.players[1]!.hand = [{ id: 802, color: "blue", value: "9" }];
    g.players[2]!.hand = [{ id: 803, color: "green", value: "4" }];
    R.gameAction(r, g.players[0]!.id, { t: "play", cardId: 801 }, seeded(9));
    expect(r.members.find((m) => m.id === ann)?.wins).toBe(1);

    // Voluntary leave hands host to a remaining player if host leaves.
    R.leave(r, bob, seeded(10));
    expect(r.members.map((m) => m.name)).toEqual(["Ann", "Cat"]);
    expect(r.hostId).toBe(ann);
  });

  it("OhNo! 7-0 rule swaps hands on 7 and rotates hands on 0", () => {
    const r = lobby("Ann", "Bob", "Cat");
    const ann = pid(r, "Ann");
    R.updateSettings(r, ann, "ohno", { sevenZero: true });
    R.start(r, ann, seeded(3));
    const g = r.game as GameState;
    g.turn = 0;
    g.direction = 1;
    g.color = "red";
    g.discard.push({ id: 900, color: "red", value: "3" });
    g.players[0]!.hand = [
      { id: 901, color: "red", value: "7" },
      { id: 902, color: "blue", value: "2" },
    ];
    g.players[1]!.hand = [
      { id: 903, color: "green", value: "5" },
      { id: 904, color: "red", value: "0" },
    ];
    g.players[2]!.hand = [{ id: 905, color: "yellow", value: "9" }];

    // Ann plays red 7 -> swaps remaining hand [902] with Bob [903, 904]
    const ev7 = R.gameAction(r, g.players[0]!.id, { t: "play", cardId: 901 }, seeded(4)).game;
    expect(ev7.some((e: any) => e.type === "swap")).toBe(true);
    expect(g.players[0]!.hand.map((c) => c.id)).toEqual([903, 904]);
    expect(g.players[1]!.hand.map((c) => c.id)).toContain(902);

    // Bob plays red 0 -> rotates everyone's hands clockwise
    g.turn = 1;
    g.color = "red";
    g.drawnCardId = null;
    g.pendingDraw = 0;
    g.players[0]!.hand = [{ id: 910, color: "blue", value: "1" }];
    g.players[1]!.hand = [
      { id: 911, color: "red", value: "0" },
      { id: 912, color: "green", value: "4" },
    ];
    g.players[2]!.hand = [
      { id: 913, color: "red", value: "8" },
      { id: 914, color: "yellow", value: "6" },
    ];
    const ev0 = R.gameAction(r, g.players[1]!.id, { t: "play", cardId: 911 }, seeded(5)).game;
    expect(ev0.some((e: any) => e.type === "rotate")).toBe(true);
    expect(g.players[0]!.hand.map((c) => c.id)).toEqual([913, 914]);
    expect(g.players[1]!.hand.map((c) => c.id)).toEqual([910]);
    expect(g.players[2]!.hand.map((c) => c.id)).toContain(912);
  });
});
