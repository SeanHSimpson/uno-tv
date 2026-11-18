// Pure game engine. No I/O — the Durable Object owns persistence and sockets.
// Every mutating function returns the events it produced (for client animation)
// or throws a GameError with a friendly message.

import {
  COLORS,
  DEFAULT_SETTINGS,
  HAND_SIZE,
  MAX_NAME,
  MAX_PLAYERS,
  type Card,
  type Color,
  type GameEvent,
  type GameState,
  type PlayerState,
  type PrivateState,
  type PublicState,
  type Settings,
} from "./types";

export class GameError extends Error {}

export type Rng = () => number;

const fail = (msg: string): never => {
  throw new GameError(msg);
};

// ---------- deck ----------

export function createDeck(rng: Rng = Math.random): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    deck.push({ id: id++, color, value: "0" });
    for (let n = 1; n <= 9; n++) {
      for (let k = 0; k < 2; k++) deck.push({ id: id++, color, value: String(n) as Card["value"] });
    }
    for (const value of ["skip", "reverse", "draw2"] as const) {
      for (let k = 0; k < 2; k++) deck.push({ id: id++, color, value });
    }
  }
  for (let k = 0; k < 4; k++) {
    deck.push({ id: id++, color: "wild", value: "wild" });
    deck.push({ id: id++, color: "wild", value: "wild4" });
  }
  return shuffle(deck, rng);
}

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function cardPoints(card: Card): number {
  if (card.color === "wild") return 50;
  if (card.value === "skip" || card.value === "reverse" || card.value === "draw2") return 20;
  return Number(card.value);
}

// ---------- state ----------

export function newGame(code: string): GameState {
  return {
    code,
    phase: "lobby",
    settings: { ...DEFAULT_SETTINGS },
    hostId: null,
    players: [],
    drawPile: [],
    discard: [],
    color: null,
    turn: 0,
    direction: 1,
    pendingDraw: 0,
    pendingType: null,
    drawnCardId: null,
    vulnerable: null,
    round: 0,
    roundWinner: null,
    roundPoints: 0,
    gameWinner: null,
    seq: 0,
  };
}

export function cleanName(raw: unknown): string {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, MAX_NAME);
  return name || "Player";
}

const top = (s: GameState): Card | undefined => s.discard[s.discard.length - 1];
const current = (s: GameState): PlayerState | undefined => s.players[s.turn];
const indexOf = (s: GameState, pid: string) => s.players.findIndex((p) => p.id === pid);
const player = (s: GameState, pid: string): PlayerState =>
  s.players.find((p) => p.id === pid) ?? fail("You're not in this game.");
const step = (s: GameState, from: number, by = 1) => {
  const n = s.players.length;
  return (((from + s.direction * by) % n) + n) % n;
};

export function updateSettings(s: GameState, by: string, patch: Partial<Settings>) {
  requireHost(s, by);
  const next = { ...s.settings };
  if (typeof patch.stacking === "boolean") next.stacking = patch.stacking;
  if (typeof patch.drawUntilPlayable === "boolean") next.drawUntilPlayable = patch.drawUntilPlayable;
  if (typeof patch.targetScore === "number" && [0, 100, 200, 300, 500].includes(patch.targetScore))
    next.targetScore = patch.targetScore;
  if (typeof patch.catchPenalty === "number" && patch.catchPenalty >= 1 && patch.catchPenalty <= 4)
    next.catchPenalty = Math.floor(patch.catchPenalty);
  if (typeof patch.tvMusic === "boolean") next.tvMusic = patch.tvMusic;
  if (typeof patch.tvSounds === "boolean") next.tvSounds = patch.tvSounds;
  s.settings = next;
}

function requireHost(s: GameState, pid: string) {
  if (s.hostId !== pid) fail("Only the host can do that.");
}

/** Add a new player or mark a returning one as connected. Joining mid-round deals a fresh hand. */
export function joinPlayer(s: GameState, pid: string, rawName: unknown, rng: Rng = Math.random): GameEvent[] {
  const events: GameEvent[] = [];
  const existing = s.players.find((p) => p.id === pid);
  if (existing) {
    existing.connected = true;
    if (rawName) existing.name = cleanName(rawName);
    return events;
  }
  if (s.players.length >= MAX_PLAYERS) fail(`This table is full (${MAX_PLAYERS} players max).`);
  const usedHues = new Set(s.players.map((p) => p.hue));
  let hue = 0;
  while (usedHues.has(hue) && hue < MAX_PLAYERS) hue++;
  const p: PlayerState = {
    id: pid,
    name: cleanName(rawName),
    hand: [],
    connected: true,
    score: 0,
    calledOhNo: false,
    lastPlayed: null,
    hue,
  };
  s.players.push(p);
  if (!s.hostId) s.hostId = pid;
  events.push({ type: "joined", pid });
  if (s.phase === "playing") {
    drawInto(s, p, HAND_SIZE, rng, events);
    events.push({ type: "draw", pid, count: p.hand.length, reason: "join" });
  }
  return events;
}

export function setConnected(s: GameState, pid: string, connected: boolean): GameEvent[] {
  const p = s.players.find((x) => x.id === pid);
  if (!p) return [];
  // Empty seats in the lobby just disappear; during a game we keep the hand for when they come back.
  if (!connected && s.phase === "lobby") return removePlayer(s, pid, false);
  p.connected = connected;
  return [];
}

export function kick(s: GameState, by: string, pid: string, rng: Rng = Math.random): GameEvent[] {
  requireHost(s, by);
  if (pid === by) fail("You can't kick yourself.");
  return removePlayer(s, pid, true, rng);
}

export function removePlayer(s: GameState, pid: string, kicked: boolean, rng: Rng = Math.random): GameEvent[] {
  const idx = indexOf(s, pid);
  if (idx < 0) return [];
  const [p] = s.players.splice(idx, 1);
  const events: GameEvent[] = [{ type: "left", pid, kicked }];
  if (s.vulnerable === pid) s.vulnerable = null;
  if (s.hostId === pid) s.hostId = s.players.find((x) => x.connected)?.id ?? s.players[0]?.id ?? null;
  if (s.phase !== "playing") return events;

  // Return their cards to the deck.
  s.drawPile.unshift(...shuffle(p!.hand, rng));
  if (s.players.length < 2) {
    // Not enough people left to keep playing.
    s.phase = "lobby";
    resetTable(s);
    return events;
  }
  if (idx < s.turn) s.turn--;
  else if (idx === s.turn) {
    // The next player in the current direction inherits the turn.
    s.turn = s.direction === 1 ? idx % s.players.length : (idx - 1 + s.players.length) % s.players.length;
    s.drawnCardId = null;
    beginTurn(s, rng, events);
  }
  return events;
}

function resetTable(s: GameState) {
  s.drawPile = [];
  s.discard = [];
  s.color = null;
  s.pendingDraw = 0;
  s.pendingType = null;
  s.drawnCardId = null;
  s.vulnerable = null;
  for (const p of s.players) {
    p.hand = [];
    p.calledOhNo = false;
    p.lastPlayed = null;
  }
}

// ---------- rounds ----------

export function startGame(s: GameState, by: string, rng: Rng = Math.random): GameEvent[] {
  requireHost(s, by);
  if (s.phase === "playing") fail("A round is already in progress.");
  if (s.players.length < 2) fail("You need at least 2 players.");
  for (const p of s.players) p.score = 0;
  s.round = 0;
  s.gameWinner = null;
  return dealRound(s, rng);
}

export function nextRound(s: GameState, by: string, rng: Rng = Math.random): GameEvent[] {
  requireHost(s, by);
  if (s.phase !== "roundOver") fail("The round isn't over yet.");
  if (s.gameWinner) return startGame(s, by, rng);
  if (s.players.length < 2) fail("You need at least 2 players.");
  return dealRound(s, rng);
}

export function backToLobby(s: GameState, by: string): GameEvent[] {
  requireHost(s, by);
  s.phase = "lobby";
  resetTable(s);
  s.roundWinner = null;
  s.gameWinner = null;
  s.round = 0;
  for (const p of s.players) p.score = 0;
  // Drop anyone who left while we were playing.
  const gone = s.players.filter((p) => !p.connected).map((p) => p.id);
  return gone.flatMap((pid) => removePlayer(s, pid, false));
}

function dealRound(s: GameState, rng: Rng): GameEvent[] {
  resetTable(s);
  s.phase = "playing";
  s.round++;
  s.roundWinner = null;
  s.roundPoints = 0;
  s.direction = 1;
  s.drawPile = createDeck(rng);
  for (let k = 0; k < HAND_SIZE; k++) for (const p of s.players) p.hand.push(s.drawPile.pop()!);

  // Flip a starting card; wilds go back in the deck.
  let start = s.drawPile.pop()!;
  while (start.color === "wild") {
    s.drawPile.unshift(start);
    shuffle(s.drawPile, rng);
    start = s.drawPile.pop()!;
  }
  s.discard.push(start);
  s.color = start.color as Color;
  s.turn = Math.floor(rng() * s.players.length);

  const events: GameEvent[] = [{ type: "deal", round: s.round, first: s.players[s.turn]!.id }];
  if (start.value === "skip") {
    events.push({ type: "skip", pid: s.players[s.turn]!.id });
    s.turn = step(s, s.turn);
  } else if (start.value === "reverse") {
    s.direction = -1;
    events.push({ type: "reverse", direction: -1 });
  } else if (start.value === "draw2") {
    s.pendingDraw = 2;
    s.pendingType = "draw2";
  }
  beginTurn(s, rng, events);
  return events;
}

function endRound(s: GameState, winner: PlayerState, events: GameEvent[]) {
  const points = s.players.reduce((sum, p) => sum + p.hand.reduce((a, c) => a + cardPoints(c), 0), 0);
  winner.score += points;
  s.roundWinner = winner.id;
  s.roundPoints = points;
  s.phase = "roundOver";
  s.vulnerable = null;
  s.drawnCardId = null;
  s.pendingDraw = 0;
  s.pendingType = null;
  const target = s.settings.targetScore;
  const gameOver = target === 0 || winner.score >= target;
  if (gameOver) s.gameWinner = winner.id;
  events.push({ type: "roundOver", winner: winner.id, points, gameOver });
}

// ---------- drawing ----------

function refill(s: GameState, events: GameEvent[], rng: Rng): boolean {
  if (s.drawPile.length > 0) return true;
  if (s.discard.length <= 1) return false;
  const t = s.discard.pop()!;
  s.drawPile = shuffle(s.discard, rng);
  s.discard = [t];
  events.push({ type: "reshuffle" });
  return true;
}

function drawInto(s: GameState, p: PlayerState, n: number, rng: Rng, events: GameEvent[]): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (!refill(s, events, rng)) break;
    const c = s.drawPile.pop()!;
    p.hand.push(c);
    drawn.push(c);
  }
  if (p.hand.length > 1) p.calledOhNo = false;
  if (s.vulnerable === p.id && p.hand.length !== 1) s.vulnerable = null;
  return drawn;
}

/** Draw one card, or keep drawing until a playable one shows up (house rule). Returns the last card drawn. */
function drawForTurn(s: GameState, p: PlayerState, reason: "auto" | "manual", rng: Rng, events: GameEvent[]) {
  let count = 0;
  let last: Card | undefined;
  do {
    const got = drawInto(s, p, 1, rng, events);
    if (got.length === 0) break;
    last = got[0];
    count++;
  } while (s.settings.drawUntilPlayable && last && !matches(s, last));
  if (count > 0) events.push({ type: "draw", pid: p.id, count, reason });
  return last;
}

// ---------- playability ----------

function matches(s: GameState, card: Card): boolean {
  const t = top(s);
  if (card.color === "wild") return true;
  return card.color === s.color || (!!t && card.value === t.value);
}

function canStack(s: GameState, card: Card): boolean {
  if (!s.settings.stacking || s.pendingDraw === 0) return false;
  if (s.pendingType === "wild4") return card.value === "wild4";
  return card.value === "draw2" || card.value === "wild4";
}

export function isPlayable(s: GameState, card: Card): boolean {
  if (s.pendingDraw > 0) return canStack(s, card);
  if (s.drawnCardId !== null) return card.id === s.drawnCardId && matches(s, card);
  return matches(s, card);
}

/**
 * Called whenever the turn lands on someone. Applies anything automatic:
 * unstackable penalties, and the auto-draw when a player has nothing playable.
 * Loops until it reaches a player who actually has a decision to make.
 */
function beginTurn(s: GameState, rng: Rng, events: GameEvent[]) {
  let guard = s.players.length * 3 + 5;
  while (s.phase === "playing" && guard-- > 0) {
    const p = current(s)!;
    s.drawnCardId = null;

    if (s.pendingDraw > 0) {
      if (p.hand.some((c) => canStack(s, c))) return; // they get to choose: stack or take it
      applyPenalty(s, p, rng, events);
      continue;
    }

    if (p.hand.some((c) => matches(s, c))) return; // has a move

    // Nothing playable: draw automatically.
    const drawn = drawForTurn(s, p, "auto", rng, events);
    if (drawn && matches(s, drawn)) {
      s.drawnCardId = drawn.id; // may play it or keep it
      return;
    }
    if (!drawn && s.drawPile.length === 0) {
      // Deck and discard are exhausted; nothing to do but pass.
    }
    events.push({ type: "pass", pid: p.id });
    s.turn = step(s, s.turn);
  }
}

function applyPenalty(s: GameState, p: PlayerState, rng: Rng, events: GameEvent[]) {
  const n = s.pendingDraw;
  s.pendingDraw = 0;
  s.pendingType = null;
  const got = drawInto(s, p, n, rng, events);
  events.push({ type: "draw", pid: p.id, count: got.length, reason: "penalty" });
  events.push({ type: "skip", pid: p.id });
  s.turn = step(s, s.turn);
}

function requireTurn(s: GameState, pid: string): PlayerState {
  if (s.phase !== "playing") fail("There's no round in progress.");
  const p = player(s, pid);
  if (current(s)?.id !== pid) fail("Hang on — it's not your turn.");
  return p;
}

// ---------- actions ----------

export function play(s: GameState, pid: string, cardId: number, chosen?: Color, rng: Rng = Math.random): GameEvent[] {
  const p = requireTurn(s, pid);
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) fail("That card isn't in your hand.");
  const card = p.hand[idx]!;
  if (!isPlayable(s, card)) {
    if (s.pendingDraw > 0) fail(`Stack a ${s.pendingType === "wild4" ? "+4" : "+2 or +4"}, or take the ${s.pendingDraw} cards.`);
    if (s.drawnCardId !== null) fail("You can only play the card you just drew (or keep it).");
    fail("That card doesn't match the color or symbol.");
  }
  if (card.color === "wild" && (!chosen || !COLORS.includes(chosen))) fail("Pick a color for your wild.");

  const events: GameEvent[] = [];
  // A new card hitting the pile closes the window to catch someone else.
  if (s.vulnerable && s.vulnerable !== pid) s.vulnerable = null;

  p.hand.splice(idx, 1);
  s.discard.push(card);
  s.color = card.color === "wild" ? chosen! : (card.color as Color);
  p.lastPlayed = card;
  s.drawnCardId = null;
  events.push({ type: "play", pid, card, color: s.color });

  if (p.hand.length === 1 && !p.calledOhNo) s.vulnerable = pid;
  if (p.hand.length !== 1 && p.hand.length !== 0) p.calledOhNo = false;

  let advance = 1;
  if (card.value === "skip") {
    advance = 2;
    events.push({ type: "skip", pid: s.players[step(s, s.turn)]!.id });
  } else if (card.value === "reverse") {
    s.direction = s.direction === 1 ? -1 : 1;
    events.push({ type: "reverse", direction: s.direction });
    if (s.players.length === 2) advance = 2;
  } else if (card.value === "draw2" || card.value === "wild4") {
    s.pendingDraw += card.value === "draw2" ? 2 : 4;
    s.pendingType = card.value;
  }

  if (p.hand.length === 0) {
    // Last card was a draw card? The next player still has to pick them up (they count for points).
    if (s.pendingDraw > 0) {
      const victim = s.players[step(s, s.turn)]!;
      const got = drawInto(s, victim, s.pendingDraw, rng, events);
      events.push({ type: "draw", pid: victim.id, count: got.length, reason: "penalty" });
    }
    endRound(s, p, events);
    return events;
  }

  s.turn = step(s, s.turn, advance);
  beginTurn(s, rng, events);
  return events;
}

export function draw(s: GameState, pid: string, rng: Rng = Math.random): GameEvent[] {
  const p = requireTurn(s, pid);
  const events: GameEvent[] = [];
  if (s.pendingDraw > 0) return take(s, pid, rng);
  if (s.drawnCardId !== null) fail("You already drew — play that card or keep it.");
  const drawn = drawForTurn(s, p, "manual", rng, events);
  if (drawn && matches(s, drawn)) {
    s.drawnCardId = drawn.id;
    return events;
  }
  events.push({ type: "pass", pid });
  s.turn = step(s, s.turn);
  beginTurn(s, rng, events);
  return events;
}

/** Keep the card you just drew and end your turn. */
export function pass(s: GameState, pid: string, rng: Rng = Math.random): GameEvent[] {
  requireTurn(s, pid);
  if (s.drawnCardId === null && s.drawPile.length + s.discard.length > 1) fail("Draw a card first.");
  const events: GameEvent[] = [{ type: "pass", pid }];
  s.drawnCardId = null;
  s.turn = step(s, s.turn);
  beginTurn(s, rng, events);
  return events;
}

/** Accept a stacked penalty instead of passing it on. */
export function take(s: GameState, pid: string, rng: Rng = Math.random): GameEvent[] {
  const p = requireTurn(s, pid);
  if (s.pendingDraw === 0) fail("There's nothing to take.");
  const events: GameEvent[] = [];
  applyPenalty(s, p, rng, events);
  beginTurn(s, rng, events);
  return events;
}

export function callOhNo(s: GameState, pid: string): GameEvent[] {
  if (s.phase !== "playing") fail("There's no round in progress.");
  const p = player(s, pid);
  if (p.hand.length > 2) fail("Save it — call OhNo! when you're down to your last card.");
  if (p.hand.length === 2 && current(s)?.id !== pid) fail("Call OhNo! as you play your second-to-last card.");
  if (p.calledOhNo) return [];
  p.calledOhNo = true;
  if (s.vulnerable === pid) s.vulnerable = null;
  return [{ type: "ohno", pid }];
}

export function catchPlayer(s: GameState, by: string, target: string, rng: Rng = Math.random): GameEvent[] {
  if (s.phase !== "playing") fail("There's no round in progress.");
  player(s, by);
  if (by === target) fail("You can't catch yourself!");
  if (s.vulnerable !== target) fail("Too late — they're safe.");
  const victim = player(s, target);
  const events: GameEvent[] = [];
  s.vulnerable = null;
  const got = drawInto(s, victim, s.settings.catchPenalty, rng, events);
  events.push({ type: "caught", pid: target, by, count: got.length });
  return events;
}

/**
 * Move past a player who's wandered off. The host can always do this; anyone at
 * the table can do it when the current player's phone has disconnected.
 */
export function skipCurrent(s: GameState, by: string, rng: Rng = Math.random): GameEvent[] {
  if (s.phase !== "playing") fail("There's no round in progress.");
  const p = current(s)!;
  if (p.id === by) fail("It's your turn — just play or draw!");
  if (s.hostId !== by && p.connected) fail("Only the host can skip someone who's still connected.");
  const events: GameEvent[] = [{ type: "skip", pid: p.id }];
  if (s.pendingDraw > 0) {
    applyPenalty(s, p, rng, events);
  } else {
    s.turn = step(s, s.turn);
  }
  s.drawnCardId = null;
  beginTurn(s, rng, events);
  return events;
}

// ---------- views ----------

export function publicView(s: GameState): PublicState {
  return {
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    hostId: s.hostId,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      count: p.hand.length,
      connected: p.connected,
      score: p.score,
      calledOhNo: p.calledOhNo,
      lastPlayed: p.lastPlayed,
      hue: p.hue,
    })),
    discard: s.discard.slice(-6),
    color: s.color,
    turnId: s.phase === "playing" ? (current(s)?.id ?? null) : null,
    direction: s.direction,
    pendingDraw: s.pendingDraw,
    drawPileCount: s.drawPile.length,
    vulnerable: s.vulnerable,
    round: s.round,
    roundWinner: s.roundWinner,
    roundPoints: s.roundPoints,
    gameWinner: s.gameWinner,
    reveal: s.phase === "roundOver" ? Object.fromEntries(s.players.map((p) => [p.id, p.hand])) : null,
    seq: s.seq,
  };
}

export function privateView(s: GameState, pid: string): PrivateState | null {
  const p = s.players.find((x) => x.id === pid);
  if (!p) return null;
  const myTurn = s.phase === "playing" && current(s)?.id === pid;
  return {
    pid,
    hand: p.hand,
    playable: myTurn ? p.hand.filter((c) => isPlayable(s, c)).map((c) => c.id) : [],
    canDraw: myTurn && s.pendingDraw === 0 && s.drawnCardId === null,
    canPass: myTurn && s.drawnCardId !== null,
    canTake: myTurn && s.pendingDraw > 0,
    drawnCardId: myTurn ? s.drawnCardId : null,
  };
}
