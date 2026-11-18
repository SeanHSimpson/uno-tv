// Cozy playing cards (for Contract Rummy): cream paper, stitched border, warm red and
// ink suits, drawn as SVG so they stay crisp at any size.

import type { PCard, Suit } from "../shared/games/rummy/cards";
import { RANK_NAMES, cardName } from "../shared/games/rummy/cards";

const W = 120;
const H = 180;
const CREAM = "#fff6e6";
const RED = "#c8432f";
const INK = "#2b2a3a";

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
    <text text-anchor="middle" y="0" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="${RANK_NAMES[card.rank]!.length > 1 ? 19 : 22}" fill="${col}">${RANK_NAMES[card.rank]}</text>
    <g transform="translate(0 15) scale(.62)" fill="${col}">${SUIT_PATH[card.suit!]}</g>
  </g>`;
}

const FACE_MARK: Record<number, string> = { 11: "♞", 12: "♛", 13: "♚" };

function center(card: PCard) {
  const col = suitColor(card.suit);
  if (card.rank >= 11) {
    // Faces: a big letter over a soft medallion, with a little piece symbol.
    return `<circle r="34" fill="${col}" fill-opacity=".1"/>
      <text text-anchor="middle" y="16" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="54" fill="${col}">${RANK_NAMES[card.rank]}</text>
      <text text-anchor="middle" y="-22" font-size="18" fill="${col}" fill-opacity=".85">${FACE_MARK[card.rank]}</text>
      <g transform="translate(0 32) scale(.7)" fill="${col}">${SUIT_PATH[card.suit!]}</g>`;
  }
  if (card.rank === 1) return `<g transform="scale(2.6)" fill="${col}">${SUIT_PATH[card.suit!]}</g>`;
  // Number cards: a big number and a big suit.
  return `<text text-anchor="middle" y="-2" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="46" fill="${col}">${RANK_NAMES[card.rank]}</text>
    <g transform="translate(0 28) scale(1.3)" fill="${col}">${SUIT_PATH[card.suit!]}</g>`;
}

function jokerSvg() {
  const petal = (rot: number, color: string) => `<ellipse cx="0" cy="-12" rx="9" ry="13" fill="${color}" stroke="${CREAM}" stroke-width="2" transform="rotate(${rot})"/>`;
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Joker">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${CREAM}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="#3b2f48"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${CREAM}" stroke-opacity=".6" stroke-width="1.6" stroke-dasharray="4 3"/>
    <g transform="translate(${W / 2} ${H / 2 - 6})">${petal(-45, "#ef6a4f")}${petal(45, "#f8c14a")}${petal(135, "#62b36e")}${petal(225, "#5a98dd")}<circle r="6" fill="${CREAM}"/></g>
    <text x="${W / 2}" y="${H - 26}" text-anchor="middle" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="17" letter-spacing="2" fill="${CREAM}">JOKER</text>
    <text x="22" y="34" text-anchor="middle" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="18" fill="${CREAM}">★</text>
  </svg>`;
}

export function pcardSvg(card: PCard): string {
  if (card.rank === 0) return jokerSvg();
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cardName(card)}">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="#fbf1de" stroke="#e0cba6" stroke-width="2"/>
    <rect x="1" y="1" width="${W - 2}" height="${(H - 2) / 2}" rx="14" fill="#fff" fill-opacity=".35"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="none" stroke="${suitColor(card.suit)}" stroke-opacity=".35" stroke-width="1.6" stroke-dasharray="4 3"/>
    <g transform="translate(${W / 2} ${H / 2})">${center(card)}</g>
    ${corner(card, 24, 34, 0)}
    ${corner(card, W - 24, H - 34, 180)}
  </svg>`;
}

export function pcardBackSvg(): string {
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Card back">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${CREAM}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="#2f5d50"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="url(#p-dots)"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${CREAM}" stroke-opacity=".6" stroke-width="1.6" stroke-dasharray="4 3"/>
    <g transform="translate(${W / 2} ${H / 2}) scale(2.2)" fill="${CREAM}" fill-opacity=".85">${SUIT_PATH.S}</g>
  </svg>`;
}

export function pcardEl(card: PCard | null, extra = ""): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `pcard ${card ? (card.rank === 0 ? "joker" : `s-${card.suit}`) : "back"} ${extra}`.trim();
  if (card) el.dataset.id = String(card.id);
  el.innerHTML = card ? pcardSvg(card) : pcardBackSvg();
  return el;
}

export const pcardHtml = (card: PCard | null, extra = "") => pcardEl(card, extra).outerHTML;

/** Short label like "Q♠" for text. */
export function shortCard(card: PCard): string {
  if (card.rank === 0) return "Joker";
  return `${RANK_NAMES[card.rank]}${{ S: "♠", H: "♥", D: "♦", C: "♣" }[card.suit!]}`;
}
