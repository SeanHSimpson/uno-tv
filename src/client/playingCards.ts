// Cozy parlor playing cards (for Contract Rummy): cream paper, stitched border, warm red
// and deep ink suits, illustrated court crests, ornate Aces, midnight-gold Jokers, and a
// filigree emerald card back — drawn as self-contained inline SVG so they stay crisp at any size.

import type { PCard, Suit } from "../shared/games/rummy/cards";
import { RANK_NAMES, cardName } from "../shared/games/rummy/cards";

const W = 120;
const H = 180;
const CREAM = "#fff6e6";
const PAPER = "#fbf1de";
const RED = "#c8432f";
const INK = "#2b2a3a";
const GOLD = "#e3a438";
const GOLD_LIGHT = "#f5d78e";
const NAVY = "#1e2a4a";
const FONT = `font-family="Fredoka, system-ui, sans-serif" font-weight="700"`;

/** Suit shapes centred on 0,0, about 20 units tall. */
const SUIT_PATH: Record<Suit, string> = {
  H: `<path d="M0 9C-11 1-12-6-6-9-2.5-10.5 0-7 0-5.5 0-7 2.5-10.5 6-9 12-6 11 1 0 9Z"/>`,
  D: `<path d="M0-10 7.5 0 0 10-7.5 0Z"/>`,
  S: `<path d="M0-10C-4-5-10-2-9 3-8 7-3.5 7-1.2 4.5-1.4 7-2.4 9-4 10H4C2.4 9 1.4 7 1.2 4.5 3.5 7 8 7 9 3 10-2 4-5 0-10Z"/>`,
  C: `<circle cx="0" cy="-4.6" r="4.3"/><circle cx="-4.9" cy="1.6" r="4.3"/><circle cx="4.9" cy="1.6" r="4.3"/><path d="M-1.1 1-2.8 10H2.8L1.1 1Z"/>`,
};
export const suitColor = (s: Suit | null) => (s === "H" || s === "D" ? RED : INK);
export const suitSvg = (s: Suit, size = 16) =>
  `<svg viewBox="-11 -11 22 22" width="${size}" height="${size}" fill="${suitColor(s)}" aria-hidden="true">${SUIT_PATH[s]}</svg>`;

function corner(card: PCard, x: number, y: number, rot: number) {
  const col = suitColor(card.suit);
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <text text-anchor="middle" y="0" ${FONT} font-size="${RANK_NAMES[card.rank]!.length > 1 ? 19 : 22}" fill="${col}">${RANK_NAMES[card.rank]}</text>
    <g transform="translate(0 15) scale(.62)" fill="${col}">${SUIT_PATH[card.suit!]}</g>
  </g>`;
}

/** Jack: plumed page's cap & heraldic shield crest. */
function jackCrest(col: string) {
  return `
    <path d="M-22 2C-18-16-2-26 16-28 10-16 8-8 14-2Z" fill="${col}"/>
    <path d="M12-27C22-34 30-30 28-20 23-24 17-23 11-18Z" fill="${GOLD}"/>
    <path d="M10-22C18-26 24-22 22-14 18-18 14-18 9-14Z" fill="${GOLD_LIGHT}"/>
    <path d="M-24 2C-10-4 10-4 24 2L20 11C8 7-8 7-20 11Z" fill="${GOLD}" stroke="${col}" stroke-width="1.4"/>
    <circle cx="-12" cy="5.5" r="2.1" fill="${PAPER}"/>
    <circle cx="0" cy="4.2" r="2.4" fill="${PAPER}"/>
    <circle cx="12" cy="5.5" r="2.1" fill="${PAPER}"/>`;
}

/** Queen: delicate jeweled coronet & rose-petal flourish. */
function queenCrest(col: string) {
  return `
    <path d="M-24 8-28-14-12-3 0-22 12-3 28-14 24 8Z" fill="${col}"/>
    <path d="M-19 5-21-9-10-1 0-16 10-1 21-9 19 5Z" fill="${GOLD}" fill-opacity=".35"/>
    <rect x="-24" y="5" width="48" height="8" rx="4" fill="${GOLD}" stroke="${col}" stroke-width="1.4"/>
    <circle cx="-28" cy="-16" r="3.4" fill="${GOLD}"/>
    <circle cx="0" cy="-24" r="4.2" fill="${GOLD}"/>
    <circle cx="28" cy="-16" r="3.4" fill="${GOLD}"/>
    <circle cx="0" cy="-6" r="3.2" fill="${PAPER}"/>
    <circle cx="-13" cy="9" r="2" fill="${PAPER}"/>
    <circle cx="0" cy="9" r="2.3" fill="${col}"/>
    <circle cx="13" cy="9" r="2" fill="${PAPER}"/>`;
}

/** King: bold imperial crown with arched orb & cross. */
function kingCrest(col: string) {
  return `
    <path d="M0-32V-22M-5-27H5" stroke="${GOLD}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M-24 8C-30-8-18-22 0-22 18-22 30-8 24 8Z" fill="${col}"/>
    <path d="M-24 8-28-11-12 0 0-18 12 0 28-11 24 8Z" fill="${GOLD}"/>
    <path d="M-18 6-19-4-10 3 0-11 10 3 19-4 18 6Z" fill="${col}"/>
    <rect x="-25" y="6" width="50" height="9" rx="4.2" fill="${GOLD}" stroke="${col}" stroke-width="1.5"/>
    <circle cx="-15" cy="10.5" r="2.2" fill="${col}"/>
    <circle cx="0" cy="10.5" r="2.6" fill="${PAPER}"/>
    <circle cx="15" cy="10.5" r="2.2" fill="${col}"/>`;
}

const COURT: Record<number, { draw: (col: string) => string; label: string }> = {
  11: { draw: jackCrest, label: "JACK" },
  12: { draw: queenCrest, label: "QUEEN" },
  13: { draw: kingCrest, label: "KING" },
};

function center(card: PCard) {
  const col = suitColor(card.suit);
  const court = COURT[card.rank];
  if (court) {
    return `
      <circle r="38" fill="${col}" fill-opacity=".07" stroke="${GOLD}" stroke-opacity=".45" stroke-width="1.4"/>
      <circle r="33" fill="none" stroke="${col}" stroke-opacity=".16" stroke-width="1" stroke-dasharray="3 2.5"/>
      <g transform="translate(0 -12) scale(.86)">${court.draw(col)}</g>
      <g transform="translate(0 18) scale(.92)" fill="${col}">${SUIT_PATH[card.suit!]}</g>
      <text text-anchor="middle" y="45" ${FONT} font-size="9.5" letter-spacing="2" fill="${col}" fill-opacity=".75">${court.label}</text>`;
  }
  if (card.rank === 1) {
    return `
      <path d="M0-42 32 0 0 42-32 0Z" fill="${col}" fill-opacity=".06" stroke="${GOLD}" stroke-opacity=".55" stroke-width="1.4"/>
      <circle r="24" fill="none" stroke="${col}" stroke-opacity=".15" stroke-width="1.2"/>
      <g transform="scale(2.55)" fill="${col}">${SUIT_PATH[card.suit!]}</g>
      <circle cx="0" cy="-35" r="2.2" fill="${GOLD}"/><circle cx="0" cy="35" r="2.2" fill="${GOLD}"/>
      <circle cx="-25" cy="0" r="2.2" fill="${GOLD}"/><circle cx="25" cy="0" r="2.2" fill="${GOLD}"/>`;
  }
  // Number cards: big crisp rank + suit over a subtle warm medallion so TV melds stay effortless to read.
  return `
    <circle r="34" fill="${col}" fill-opacity=".05"/>
    <text text-anchor="middle" y="-2" ${FONT} font-size="46" fill="${col}">${RANK_NAMES[card.rank]}</text>
    <g transform="translate(0 28) scale(1.3)" fill="${col}">${SUIT_PATH[card.suit!]}</g>`;
}

/** JOKER stacked down the corner like a real deck's index, so it reads even when squeezed into a pile. */
const jokerIndex = (x: number, y: number, rot: number) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})">${[..."JOKER"]
    .map((ch, i) => `<text text-anchor="middle" y="${i * 14}" ${FONT} font-size="13" fill="${GOLD}">${ch}</text>`)
    .join("")}</g>`;

/** Midnight gold: deep navy with a gold stitched border and a gold jester's cap. */
function jokerSvg() {
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Joker">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${NAVY}" stroke="#c9952f" stroke-width="2"/>
    <rect x="1" y="1" width="${W - 2}" height="${(H - 2) / 2}" rx="14" fill="#fff" fill-opacity=".06"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="none" stroke="${GOLD}" stroke-opacity=".8" stroke-width="1.6" stroke-dasharray="4 3"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="36" fill="${GOLD}" fill-opacity=".08" stroke="${GOLD}" stroke-opacity=".35" stroke-width="1.2"/>
    <g transform="translate(${W / 2} ${H / 2 + 10}) scale(.72)">
      <path d="M-26 10C-28-8-38-20-44-30-30-27-17-17-8 8Z" fill="${GOLD}"/>
      <path d="M-11 8C-10-14-5-30 0-44 5-30 10-14 11 8Z" fill="${GOLD_LIGHT}"/>
      <path d="M26 10C28-8 38-20 44-30 30-27 17-17 8 8Z" fill="${GOLD}"/>
      <rect x="-30" y="6" width="60" height="14" rx="7" fill="${GOLD}"/>
      <g fill="${CREAM}" stroke="${CREAM}" stroke-width="1.5"><circle cx="-44" cy="-31" r="5"/><circle cx="0" cy="-45" r="5"/><circle cx="44" cy="-31" r="5"/></g>
      <g fill="${NAVY}" fill-opacity=".9"><circle cx="-18" cy="13" r="2.4"/><circle cx="0" cy="13" r="2.4"/><circle cx="18" cy="13" r="2.4"/></g>
    </g>
    ${jokerIndex(20, 28, 0)}${jokerIndex(W - 20, H - 28, 180)}
  </svg>`;
}

export function pcardSvg(card: PCard): string {
  if (card.rank === 0) return jokerSvg();
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cardName(card)}">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${PAPER}" stroke="#e0cba6" stroke-width="2"/>
    <rect x="1" y="1" width="${W - 2}" height="${(H - 2) / 2}" rx="14" fill="#fff" fill-opacity=".35"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="none" stroke="${suitColor(card.suit)}" stroke-opacity=".32" stroke-width="1.5" stroke-dasharray="4 3"/>
    <g transform="translate(${W / 2} ${H / 2})">${center(card)}</g>
    ${corner(card, 24, 34, 0)}
    ${corner(card, W - 24, H - 34, 180)}
  </svg>`;
}

/** Ornate emerald-and-gold parlor deck back. */
export function pcardBackSvg(): string {
  const filigree = `
    <path d="M60 22L98 90 60 158 22 90Z M60 36L88 90 60 144 32 90Z" fill="none" stroke="${GOLD_LIGHT}" stroke-opacity=".22" stroke-width="1.2"/>
    <path d="M20 50L100 130M100 50L20 130M20 90L60 22L100 90L60 158Z" fill="none" stroke="${GOLD_LIGHT}" stroke-opacity=".14" stroke-width="1.1"/>`;
  const cornerPip = (x: number, y: number, s: Suit) =>
    `<g transform="translate(${x} ${y}) scale(.55)" fill="${GOLD_LIGHT}" fill-opacity=".65">${SUIT_PATH[s]}</g>`;
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Card back">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${CREAM}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="#1e4a3d"/>
    <rect x="6" y="6" width="${W - 12}" height="${(H - 12) * 0.52}" rx="10" fill="#2f6b59" fill-opacity=".55"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${GOLD_LIGHT}" stroke-opacity=".65" stroke-width="1.6"/>
    <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="5" fill="none" stroke="${CREAM}" stroke-opacity=".35" stroke-width="1.1" stroke-dasharray="3 3"/>
    ${filigree}
    ${cornerPip(26, 28, "S")}${cornerPip(W - 26, 28, "H")}${cornerPip(26, H - 28, "D")}${cornerPip(W - 26, H - 28, "C")}
    <g transform="translate(${W / 2} ${H / 2})">
      <path d="M0-38 28 0 0 38-28 0Z" fill="#16382e" stroke="${GOLD}" stroke-width="2"/>
      <path d="M0-29 20 0 0 29-20 0Z" fill="none" stroke="${GOLD_LIGHT}" stroke-opacity=".6" stroke-width="1.1"/>
      <g transform="scale(1.25)" fill="${CREAM}" fill-opacity=".92">${SUIT_PATH.S}</g>
      <circle cx="0" cy="-44" r="2.6" fill="${GOLD}"/><circle cx="0" cy="44" r="2.6" fill="${GOLD}"/>
    </g>
  </svg>`;
}

export function pcardEl(card: PCard | null, extra = ""): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `pcard ${card ? (card.rank === 0 ? "joker" : `s-${card.suit}`) : "back"} ${extra}`.trim();
  if (card) el.dataset.id = String(card.id);
  el.innerHTML = (card ? pcardSvg(card) : pcardBackSvg()) + (card?.rank === 0 ? `<span class="foil-sheen" aria-hidden="true"></span>` : "");
  return el;
}

export const pcardHtml = (card: PCard | null, extra = "") => pcardEl(card, extra).outerHTML;

/** Short label like "Q♠" for text. */
export function shortCard(card: PCard): string {
  if (card.rank === 0) return "Joker";
  return `${RANK_NAMES[card.rank]}${{ S: "♠", H: "♥", D: "♦", C: "♣" }[card.suit!]}`;
}
