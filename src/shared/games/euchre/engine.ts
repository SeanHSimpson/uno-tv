// Euchre: four players in two partnerships, a 24-card deck (9 through Ace).
//
// Each hand: deal 5 each, turn one card up. Round 1: starting left of the dealer, each
// player can "order up" that suit as trump (the dealer picks the card up and discards)
// or pass. Round 2: name any other suit, or pass. "Stick the dealer": the dealer can't
// pass in round 2. Whoever names trump may go alone (their partner sits out).
//
// Trump ranks: Right bower (Jack of trump), Left bower (the other Jack of the same
// colour, which counts as trump), then A K Q 10 9. Follow the suit that was led if you can.
// Makers take 3-4 tricks: 1 point. All 5: 2 points (4 if alone). Fewer than 3: euchred,
// the defenders score 2. First team to 10 wins.

import { fail, shuffle, type Member, type Rng } from "../../common";

export type Suit = "S" | "H" | "D" | "C";
export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const SUIT_NAMES: Record<Suit, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
/** rank: 9, 10, 11 (J), 12 (Q), 13 (K), 1 (A), the same numbering as the rummy cards. */
export interface ECard {
  id: number;
  suit: Suit;
  rank: number;
}
export const RANK_LABEL: Record<number, string> = { 1: "A", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K" };
export const shortCard = (c: ECard) => `${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit]}`;

export const TEAM_NAMES = ["Deer Camp", "Lake Effect"] as const;
export const TEAM_EMOJI = ["🦌", "🌊"] as const;

export interface EuchreSettings extends Record<string, unknown> {
  target: number;
  stick: boolean;
  /** "pick": everyone chooses a side before the deal. "random": partners are drawn by lot. */
  teams: "pick" | "random";
  /** How big the trick cards are on the TV (1 = normal). */
  table: number;
}
export const EUCHRE_DEFAULTS: EuchreSettings = { target: 10, stick: true, teams: "pick", table: 1.3 };
export const TABLE_SIZES = [1, 1.3, 1.55];

export interface EPlayer {
  id: string;
  name: string;
  hue: number;
  avatar?: string;
  bot?: boolean;
  connected: boolean;
  /** A bot took over this seat after the person left. */
  standIn?: boolean;
  hand: ECard[];
  tricks: number;
}

export interface Play {
  seat: number;
  card: ECard;
}

export interface HandResult {
  makers: 0 | 1;
  team: 0 | 1; // who scored
  points: number;
  tricks: number; // makers' tricks
  alone: boolean;
  euchred: boolean;
}

export interface EuchreState {
  /** "teams": choosing sides before the first deal (seats aren't fixed yet). */
  phase: "teams" | "bid1" | "discard" | "bid2" | "play" | "handOver" | "gameOver";
  players: EPlayer[]; // seats 0..3; teams are seat % 2
  /** While choosing sides: who has picked which team. */
  picks: Record<string, 0 | 1>;
  /** The last finished trick, so phones can look back at it. */
  lastTrick: { trick: Play[]; winner: number } | null;
  dealer: number;
  turn: number;
  upcard: ECard | null;
  kitty: ECard[];
  turnedDown: Suit | null;
  trump: Suit | null;
  maker: number | null;
  alone: boolean;
  trick: Play[];
  /** The trick is complete and is showing on the table for a moment. */
  trickDone: { winner: number } | null;
  teamTricks: [number, number];
  score: [number, number];
  /** What each seat said this bidding round (shown as bubbles). */
  bids: (string | null)[];
  hand: number;
  lastResult: HandResult | null;
  winnerTeam: 0 | 1 | null;
  settings: EuchreSettings;
  hostId: string | null;
}

export type EuchreEvent =
  | { type: "deal"; dealer: string; upcard: ECard; hand: number }
  | { type: "pass"; pid: string; round: 1 | 2 }
  | { type: "trump"; pid: string; suit: Suit; alone: boolean; round: 1 | 2 }
  | { type: "pickup"; pid: string; card: ECard }
  | { type: "discarded"; pid: string }
  | { type: "redeal" }
  | { type: "play"; pid: string; card: ECard }
  | { type: "trick"; winner: string; team: 0 | 1 }
  | { type: "hand"; result: HandResult }
  | { type: "gameOver"; team: 0 | 1 }
  | { type: "standIn"; pid: string }
  | { type: "teams" }
  | { type: "picked"; pid: string; team: 0 | 1 | null };

export type EuchreAction =
  | { t: "order"; alone?: boolean }
  | { t: "call"; suit: Suit; alone?: boolean }
  | { t: "pass" }
  | { t: "discard"; cardId: number }
  | { t: "play"; cardId: number }
  | { t: "collect" }
  | { t: "nextHand" }
  | { t: "restart" }
  | { t: "autoplay" }
  | { t: "team"; team: 0 | 1 | null; pid?: string }
  | { t: "shuffleTeams" }
  | { t: "deal" }
  | { t: "table"; size: number };

// ---------- card logic ----------

const RED = (s: Suit) => s === "H" || s === "D";
export const sameColor = (a: Suit, b: Suit) => RED(a) === RED(b);
export const isRight = (c: ECard, trump: Suit | null) => !!trump && c.rank === 11 && c.suit === trump;
export const isLeft = (c: ECard, trump: Suit | null) => !!trump && c.rank === 11 && c.suit !== trump && sameColor(c.suit, trump);
/** The suit a card belongs to once trump is known (the left bower becomes trump). */
export const effSuit = (c: ECard, trump: Suit | null): Suit => (isLeft(c, trump) ? trump! : c.suit);
const ORDER: Record<number, number> = { 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 1: 6 };

/** How strong a card is in this trick (0 = can't win it). */
export function power(c: ECard, trump: Suit | null, led: Suit | null): number {
  if (isRight(c, trump)) return 100;
  if (isLeft(c, trump)) return 99;
  if (trump && c.suit === trump) return 50 + ORDER[c.rank]!;
  if (led && c.suit === led) return 10 + ORDER[c.rank]!;
  return 0;
}

export function trickWinner(trick: Play[], trump: Suit | null): number {
  const led = effSuit(trick[0]!.card, trump);
  let best = trick[0]!;
  for (const p of trick) if (power(p.card, trump, led) > power(best.card, trump, led)) best = p;
  return best.seat;
}

export function legalCards(hand: ECard[], trick: Play[], trump: Suit | null): ECard[] {
  if (!trick.length) return hand;
  const led = effSuit(trick[0]!.card, trump);
  const follow = hand.filter((c) => effSuit(c, trump) === led);
  return follow.length ? follow : hand;
}

export function makeDeck(rng: Rng): ECard[] {
  const cards: ECard[] = [];
  let id = 1;
  for (const suit of SUITS) for (const rank of [9, 10, 11, 12, 13, 1]) cards.push({ id: id++, suit, rank });
  return shuffle(cards, rng);
}

/** Group by suit (trump first), strongest first, alternating colours so suits are easy to tell apart. */
export function sortHand(hand: ECard[], trump: Suit | null): ECard[] {
  const order: Suit[] = trump ? [trump, ...(["S", "H", "C", "D"] as Suit[]).filter((s) => s !== trump)] : ["S", "H", "C", "D"];
  if (trump) {
    // keep colours alternating after trump
    const rest = order.slice(1);
    const other = rest.filter((s) => !sameColor(s, trump));
    const same = rest.filter((s) => sameColor(s, trump));
    order.splice(1, 3, other[0]!, same[0]!, other[1]!);
  }
  return [...hand].sort((a, b) => {
    const sa = order.indexOf(effSuit(a, trump));
    const sb = order.indexOf(effSuit(b, trump));
    return sa - sb || power(b, trump, effSuit(b, trump)) - power(a, trump, effSuit(a, trump));
  });
}

// ---------- seats ----------

export const teamOf = (seat: number) => (seat % 2) as 0 | 1;
export const partnerOf = (seat: number) => (seat + 2) % 4;
export const sittingOut = (s: EuchreState) => (s.alone && s.maker !== null ? partnerOf(s.maker) : -1);
const activeCount = (s: EuchreState) => (sittingOut(s) >= 0 ? 3 : 4);
export function nextSeat(s: EuchreState, seat: number): number {
  let n = (seat + 1) % 4;
  if (n === sittingOut(s)) n = (n + 1) % 4;
  return n;
}
const seatOf = (s: EuchreState, pid: string) => {
  const i = s.players.findIndex((p) => p.id === pid);
  if (i < 0) fail("You're watching this game. You'll get a seat next game.");
  return i;
};
function requireTurn(s: EuchreState, pid: string): number {
  const seat = seatOf(s, pid);
  if (s.turn !== seat) fail("It's not your turn.");
  if (s.trickDone) fail("Hang on, the trick is being collected.");
  return seat;
}

// ---------- setup ----------

export function newEuchre(members: Member[], settings: EuchreSettings, hostId: string | null, rng: Rng): { state: EuchreState; events: EuchreEvent[] } {
  if (members.length !== 4) fail("Euchre needs exactly 4 players (add bots to fill seats).");
  const merged = { ...EUCHRE_DEFAULTS, ...settings };
  // Random partners: shuffle the seats. Picking: keep join order until everyone has chosen.
  const seated = merged.teams === "random" ? shuffle([...members], rng) : [...members];
  const s: EuchreState = {
    phase: merged.teams === "random" ? "bid1" : "teams",
    picks: {},
    lastTrick: null,
    players: seated.map((m) => ({ id: m.id, name: m.name, hue: m.hue, avatar: m.avatar, bot: m.bot, connected: m.connected, hand: [], tricks: 0 })),
    dealer: Math.floor(rng() * 4),
    turn: 0,
    upcard: null,
    kitty: [],
    turnedDown: null,
    trump: null,
    maker: null,
    alone: false,
    trick: [],
    trickDone: null,
    teamTricks: [0, 0],
    score: [0, 0],
    bids: [null, null, null, null],
    hand: 0,
    lastResult: null,
    winnerTeam: null,
    settings: merged,
    hostId,
  };
  if (s.phase === "teams") return { state: s, events: [{ type: "teams" }] };
  return { state: s, events: deal(s, rng) };
}

// ---------- choosing sides ----------

const teamSize = (s: EuchreState, t: 0 | 1) => Object.values(s.picks).filter((x) => x === t).length;

/** Pick a side (or, as the host, put someone else on one). `team: null` takes them off. */
export function pickTeam(s: EuchreState, by: string, isHost: boolean, team: unknown, who?: unknown): EuchreEvent[] {
  if (s.phase !== "teams") fail("Teams are already set for this game.");
  const pid = typeof who === "string" && who ? who : by;
  if (pid !== by && !isHost) fail("Only the host can move other players.");
  if (!s.players.some((p) => p.id === pid)) fail("They're not at the table.");
  const t = team === 0 || team === 1 ? team : null;
  if (t === null) delete s.picks[pid];
  else {
    if (s.picks[pid] === t) return [];
    if (teamSize(s, t) >= 2) fail(`${TEAM_NAMES[t]} is full. Someone has to switch first.`);
    s.picks[pid] = t;
  }
  return [{ type: "picked", pid, team: t }];
}

/** The host deals random teams (handy with bots). */
export function shuffleTeams(s: EuchreState, isHost: boolean, rng: Rng): EuchreEvent[] {
  if (s.phase !== "teams") fail("Teams are already set for this game.");
  if (!isHost) fail("Only the host can do that.");
  const order = shuffle(s.players.map((p) => p.id), rng);
  s.picks = Object.fromEntries(order.map((id, i) => [id, (i % 2) as 0 | 1]));
  return [{ type: "picked", pid: "", team: null }];
}

/** Lock in the teams and deal. Anyone who hasn't picked fills the open spots. */
export function dealTeams(s: EuchreState, isHost: boolean, rng: Rng): EuchreEvent[] {
  if (s.phase !== "teams") fail("Teams are already set for this game.");
  if (!isHost) fail("Only the host can start the deal.");
  for (const p of s.players) {
    if (s.picks[p.id] !== undefined) continue;
    s.picks[p.id] = teamSize(s, 0) < 2 ? 0 : 1;
  }
  const team0 = s.players.filter((p) => s.picks[p.id] === 0);
  const team1 = s.players.filter((p) => s.picks[p.id] === 1);
  if (team0.length !== 2 || team1.length !== 2) fail("Each team needs exactly 2 players.");
  // Partners sit across from each other: seats 0 & 2, and 1 & 3.
  s.players = [team0[0]!, team1[0]!, team0[1]!, team1[1]!];
  s.dealer = Math.floor(rng() * 4);
  return deal(s, rng);
}

/** The host changes how big the trick cards look on the TV. */
export function setTable(s: EuchreState, isHost: boolean, size: number): EuchreEvent[] {
  if (!isHost) fail("Only the host can change that.");
  if (!TABLE_SIZES.includes(size)) fail("That size isn't available.");
  s.settings.table = size;
  return [];
}

function deal(s: EuchreState, rng: Rng): EuchreEvent[] {
  s.hand++;
  const deck = makeDeck(rng);
  s.trump = null;
  s.maker = null;
  s.alone = false;
  s.turnedDown = null;
  s.trick = [];
  s.trickDone = null;
  s.teamTricks = [0, 0];
  s.bids = [null, null, null, null];
  s.lastTrick = null;
  for (const p of s.players) {
    p.hand = sortHand(deck.splice(0, 5), null);
    p.tricks = 0;
  }
  s.upcard = deck.shift()!;
  s.kitty = deck;
  s.phase = "bid1";
  s.turn = (s.dealer + 1) % 4;
  return [{ type: "deal", dealer: s.players[s.dealer]!.id, upcard: s.upcard, hand: s.hand }];
}

// ---------- bidding ----------

export function order(s: EuchreState, pid: string, alone: boolean): EuchreEvent[] {
  if (s.phase !== "bid1") fail("You can't order it up right now.");
  const seat = requireTurn(s, pid);
  const up = s.upcard!;
  s.trump = up.suit;
  s.maker = seat;
  s.alone = alone;
  s.bids[seat] = alone ? "Alone!" : seat === s.dealer ? "Picking it up" : "Order it up!";
  const events: EuchreEvent[] = [{ type: "trump", pid, suit: up.suit, alone, round: 1 }];
  const dealer = s.players[s.dealer]!;
  for (const p of s.players) p.hand = sortHand(p.hand, s.trump);
  if (sittingOut(s) === s.dealer) {
    // The dealer's partner went alone: the dealer sits out and the card stays put.
    s.kitty.push(up);
    s.upcard = null;
    return [...events, ...startPlay(s)];
  }
  dealer.hand = sortHand([...dealer.hand, up], s.trump);
  s.upcard = null;
  s.phase = "discard";
  s.turn = s.dealer;
  events.push({ type: "pickup", pid: dealer.id, card: up });
  return events;
}

export function discard(s: EuchreState, pid: string, cardId: number): EuchreEvent[] {
  if (s.phase !== "discard") fail("No discard needed right now.");
  const seat = requireTurn(s, pid);
  const p = s.players[seat]!;
  const i = p.hand.findIndex((c) => c.id === cardId);
  if (i < 0) fail("That card isn't in your hand.");
  s.kitty.push(...p.hand.splice(i, 1));
  return [{ type: "discarded", pid }, ...startPlay(s)];
}

export function call(s: EuchreState, pid: string, suit: Suit, alone: boolean): EuchreEvent[] {
  if (s.phase !== "bid2") fail("You can't name trump right now.");
  const seat = requireTurn(s, pid);
  if (!SUITS.includes(suit)) fail("Pick a suit.");
  if (suit === s.turnedDown) fail(`${SUIT_NAMES[suit]} was turned down. Pick another suit.`);
  s.trump = suit;
  s.maker = seat;
  s.alone = alone;
  s.bids[seat] = `${SUIT_SYMBOL[suit]} ${SUIT_NAMES[suit]}${alone ? ", alone!" : "!"}`;
  for (const p of s.players) p.hand = sortHand(p.hand, s.trump);
  return [{ type: "trump", pid, suit, alone, round: 2 }, ...startPlay(s)];
}

export function pass(s: EuchreState, pid: string, rng: Rng): EuchreEvent[] {
  if (s.phase !== "bid1" && s.phase !== "bid2") fail("There's nothing to pass on right now.");
  const seat = requireTurn(s, pid);
  const round = s.phase === "bid1" ? 1 : 2;
  if (round === 2 && seat === s.dealer && s.settings.stick) fail("Stick the dealer: you have to name trump.");
  s.bids[seat] = "Pass";
  const events: EuchreEvent[] = [{ type: "pass", pid, round }];
  if (seat !== s.dealer) {
    s.turn = (seat + 1) % 4;
    return events;
  }
  if (round === 1) {
    s.turnedDown = s.upcard!.suit;
    s.kitty.push(s.upcard!);
    s.upcard = null;
    s.phase = "bid2";
    s.bids = [null, null, null, null];
    s.turn = (s.dealer + 1) % 4;
    return events;
  }
  // Everyone passed twice: throw them in and the deal moves on.
  s.dealer = (s.dealer + 1) % 4;
  return [...events, { type: "redeal" }, ...deal(s, rng)];
}

function startPlay(s: EuchreState): EuchreEvent[] {
  s.phase = "play";
  s.trick = [];
  s.turn = nextSeat(s, s.dealer);
  return [];
}

// ---------- tricks ----------

export function play(s: EuchreState, pid: string, cardId: number): EuchreEvent[] {
  if (s.phase !== "play") fail("Wait for trump to be named.");
  const seat = requireTurn(s, pid);
  const p = s.players[seat]!;
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) return fail("That card isn't in your hand.");
  if (!legalCards(p.hand, s.trick, s.trump).includes(card)) {
    const led = effSuit(s.trick[0]!.card, s.trump);
    fail(`You have to follow suit: play ${led === s.trump ? "trump" : SUIT_NAMES[led]} (${SUIT_SYMBOL[led]}).`);
  }
  p.hand = p.hand.filter((c) => c !== card);
  s.trick.push({ seat, card });
  const events: EuchreEvent[] = [{ type: "play", pid, card }];
  if (s.trick.length < activeCount(s)) {
    s.turn = nextSeat(s, seat);
    return events;
  }
  const w = trickWinner(s.trick, s.trump);
  s.trickDone = { winner: w };
  s.turn = w;
  s.players[w]!.tricks++;
  s.teamTricks[teamOf(w)]++;
  events.push({ type: "trick", winner: s.players[w]!.id, team: teamOf(w) });
  return events;
}

/** Sweep the finished trick off the table (sent automatically after a short pause). */
export function collect(s: EuchreState): EuchreEvent[] {
  if (!s.trickDone) return [];
  const w = s.trickDone.winner;
  s.trickDone = null;
  s.lastTrick = { trick: s.trick, winner: w };
  s.trick = [];
  s.turn = w;
  if (s.teamTricks[0] + s.teamTricks[1] < 5) return [];
  return scoreHand(s);
}

function scoreHand(s: EuchreState): EuchreEvent[] {
  const makers = teamOf(s.maker!);
  const tricks = s.teamTricks[makers];
  const euchred = tricks < 3;
  const team = (euchred ? 1 - makers : makers) as 0 | 1;
  const points = euchred ? 2 : tricks === 5 ? (s.alone ? 4 : 2) : 1;
  s.score[team] += points;
  s.lastResult = { makers, team, points, tricks, alone: s.alone, euchred };
  const events: EuchreEvent[] = [{ type: "hand", result: s.lastResult }];
  if (s.score[team] >= s.settings.target) {
    s.phase = "gameOver";
    s.winnerTeam = team;
    events.push({ type: "gameOver", team });
  } else s.phase = "handOver";
  return events;
}

export function nextHand(s: EuchreState, rng: Rng): EuchreEvent[] {
  if (s.phase !== "handOver") return [];
  s.dealer = (s.dealer + 1) % 4;
  return deal(s, rng);
}

export function restart(s: EuchreState, isHost: boolean, rng: Rng): EuchreEvent[] {
  if (!isHost) fail("Only the host can start a new game.");
  if (s.phase !== "gameOver") fail("The game isn't over yet.");
  s.score = [0, 0];
  s.lastResult = null;
  s.winnerTeam = null;
  s.hand = 0;
  s.dealer = (s.dealer + 1) % 4;
  if (s.settings.teams === "pick") {
    // Back to choosing sides, with the same teams ready to go.
    s.phase = "teams";
    s.picks = Object.fromEntries(s.players.map((p, i) => [p.id, teamOf(i)]));
    for (const p of s.players) p.hand = [];
    s.trump = null;
    s.upcard = null;
    s.trick = [];
    s.lastTrick = null;
    return [{ type: "teams" }];
  }
  return deal(s, rng);
}

// ---------- people coming and going ----------

/** Someone left mid-game: a bot keeps their seat warm so the other three can finish. */
export function standIn(s: EuchreState, pid: string): EuchreEvent[] {
  const p = s.players.find((x) => x.id === pid);
  if (!p || p.bot) return [];
  p.bot = true;
  p.standIn = true;
  p.connected = true;
  return [{ type: "standIn", pid }];
}

// ---------- views ----------

export interface EuchrePublic {
  phase: EuchreState["phase"];
  players: { id: string; name: string; hue: number; avatar?: string; bot?: boolean; connected: boolean; count: number; tricks: number; team: 0 | 1; bid: string | null }[];
  dealerId: string;
  turnId: string | null;
  upcard: ECard | null;
  turnedDown: Suit | null;
  trump: Suit | null;
  makerId: string | null;
  alone: boolean;
  outId: string | null;
  trick: { pid: string; card: ECard }[];
  trickWinner: string | null;
  teamTricks: [number, number];
  score: [number, number];
  target: number;
  stick: boolean;
  hand: number;
  lastResult: HandResult | null;
  winnerTeam: 0 | 1 | null;
  hostId: string | null;
  /** While choosing sides: who picked which team. */
  picks: Record<string, 0 | 1>;
  lastTrick: { pid: string; card: ECard }[];
  lastTrickWinner: string | null;
  table: number;
  teamsMode: "pick" | "random";
}

export function publicView(s: EuchreState): EuchrePublic {
  const out = sittingOut(s);
  const bidding = s.phase === "bid1" || s.phase === "bid2" || s.phase === "discard";
  return {
    phase: s.phase,
    players: s.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      hue: p.hue,
      avatar: p.avatar,
      bot: p.bot,
      connected: p.connected,
      count: p.hand.length,
      tricks: p.tricks,
      team: teamOf(i),
      bid: s.bids[i] ?? null,
    })),
    dealerId: s.players[s.dealer]!.id,
    turnId: bidding || s.phase === "play" ? s.players[s.turn]!.id : null,
    upcard: s.upcard,
    turnedDown: s.turnedDown,
    trump: s.trump,
    makerId: s.maker !== null ? s.players[s.maker]!.id : null,
    alone: s.alone,
    outId: out >= 0 ? s.players[out]!.id : null,
    trick: s.trick.map((t) => ({ pid: s.players[t.seat]!.id, card: t.card })),
    trickWinner: s.trickDone ? s.players[s.trickDone.winner]!.id : null,
    teamTricks: s.teamTricks,
    score: s.score,
    target: s.settings.target,
    stick: s.settings.stick,
    hand: s.hand,
    lastResult: s.lastResult,
    winnerTeam: s.winnerTeam,
    hostId: s.hostId,
    picks: s.picks ?? {},
    lastTrick: (s.lastTrick?.trick ?? []).map((t) => ({ pid: s.players[t.seat]!.id, card: t.card })),
    lastTrickWinner: s.lastTrick ? s.players[s.lastTrick.winner]!.id : null,
    table: s.settings.table ?? 1,
    teamsMode: s.settings.teams ?? "random",
  };
}

export interface EuchrePrivate {
  seated: boolean;
  team: 0 | 1 | null;
  partnerId: string | null;
  hand: ECard[];
  myTurn: boolean;
  /** Cards you're allowed to play right now. */
  legal: number[];
  canOrder: boolean;
  canCall: Suit[];
  canPass: boolean;
  canDiscard: boolean;
  dealer: boolean;
  sittingOut: boolean;
}

export function privateView(s: EuchreState, pid: string): EuchrePrivate {
  const seat = s.players.findIndex((p) => p.id === pid);
  if (seat < 0)
    return { seated: false, team: null, partnerId: null, hand: [], myTurn: false, legal: [], canOrder: false, canCall: [], canPass: false, canDiscard: false, dealer: false, sittingOut: false };
  const p = s.players[seat]!;
  const myTurn = s.turn === seat && !s.trickDone && ["bid1", "bid2", "discard", "play"].includes(s.phase);
  return {
    seated: true,
    team: teamOf(seat),
    partnerId: s.players[partnerOf(seat)]!.id,
    hand: p.hand,
    myTurn,
    legal: myTurn && s.phase === "play" ? legalCards(p.hand, s.trick, s.trump).map((c) => c.id) : [],
    canOrder: myTurn && s.phase === "bid1",
    canCall: myTurn && s.phase === "bid2" ? SUITS.filter((x) => x !== s.turnedDown) : [],
    canPass: myTurn && (s.phase === "bid1" || (s.phase === "bid2" && !(seat === s.dealer && s.settings.stick))),
    canDiscard: myTurn && s.phase === "discard",
    dealer: seat === s.dealer,
    sittingOut: sittingOut(s) === seat,
  };
}
