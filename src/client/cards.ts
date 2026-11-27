// Original "OhNo!" card art: quilted, stitched-edge cards in warm colours,
// drawn as inline SVG so they stay crisp from a phone up to a 4K TV.
// Each colour also carries a little shape (heart / sun / leaf / drop) so it's
// readable for colour-blind players.

import type { Card, CardColor, Color } from "../shared/games/ohno/types";

export const COLOR_NAMES: Record<Color, string> = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" };

const W = 120;
const H = 180;

/** One shared <defs> block for every card on the page. */
export function installCardDefs() {
  if (document.getElementById("ohno-defs")) return;
  const grad = (id: string, a: string, b: string) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "ohno-defs";
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  svg.innerHTML = `<defs>
    ${grad("g-red", "#ef6a4f", "#b8392c")}
    ${grad("g-yellow", "#f8c14a", "#dc8a18")}
    ${grad("g-green", "#62b36e", "#2f7a45")}
    ${grad("g-blue", "#5a98dd", "#2c5fa6")}
    ${grad("g-wild", "#43384d", "#1f1a26")}
    ${grad("g-back", "#9a3148", "#5c1a2b")}
    <radialGradient id="g-shine" cx="0.3" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <pattern id="p-dots" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.3" fill="#fff" fill-opacity=".09"/><circle cx="9" cy="9" r="1.3" fill="#fff" fill-opacity=".09"/>
    </pattern>
    <filter id="f-ink" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="0" flood-color="#000" flood-opacity=".28"/>
    </filter>
  </defs>`;
  document.body.prepend(svg);
}

// Little colour badges (heart, sun, leaf, drop), centred at 0,0 with ~radius 6.
const SHAPES: Record<Color, string> = {
  red: `<path d="M0 5.5C-6-.5-6.5-4.6-3.6-6.1-1.8-7 0-5.6 0-4.2 0-5.6 1.8-7 3.6-6.1 6.5-4.6 6-.5 0 5.5Z"/>`,
  yellow: `<circle r="3.4"/><g stroke-width="1.8" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => `<line x1="0" y1="-5" x2="0" y2="-6.8" transform="rotate(${a})"/>`)
    .join("")}</g>`,
  green: `<path d="M-5 5C-6-2-1-6 6-6 6 1 2 6-5 5Z"/><path d="M-5 5 2-1" stroke-width="1.2" fill="none"/>`,
  blue: `<path d="M0-6.5C3 -2 5 0.5 5 2.4A5 5 0 0 1-5 2.4C-5 .5-3-2 0-6.5Z"/>`,
};

const CREAM = "#fff6e6";

function glyph(card: Card, size: "big" | "small"): string {
  const big = size === "big";
  const ink = card.color === "wild" ? CREAM : CREAM;
  const fs = big ? 64 : 22;
  const text = (t: string, s = fs) =>
    `<text x="0" y="0" dy="${s * 0.35}" text-anchor="middle" font-family="Fredoka, 'Baloo 2', system-ui, sans-serif" font-weight="700" font-size="${s}" fill="${ink}">${t}</text>`;
  switch (card.value) {
    case "skip": {
      const r = big ? 24 : 8;
      const sw = big ? 8 : 3;
      return `<g fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"><circle r="${r}"/><line x1="${-r * 0.7}" y1="${r * 0.7}" x2="${r * 0.7}" y2="${-r * 0.7}"/></g>`;
    }
    case "reverse": {
      const s = big ? 1 : 0.36;
      return `<g transform="scale(${s})" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-20 -6A20 20 0 0 1 16 -14"/><path d="M8 -24 18 -13 6 -5"/>
        <path d="M20 6A20 20 0 0 1 -16 14"/><path d="M-8 24 -18 13 -6 5"/></g>`;
    }
    case "draw2":
      return text("+2", big ? 52 : 18);
    case "wild":
      return big ? flower(26) : flower(9);
    case "wild4":
      return big
        ? `${flower(26)}<g transform="translate(0 42)">${text("+4", 24)}</g>`
        : text("+4", 18);
    default:
      return text(card.value, big ? 70 : 22);
  }
}

/** A four-petal flower in all four colours: the wild symbol. */
function flower(r: number): string {
  const petal = (rot: number, c: Color) =>
    `<ellipse cx="0" cy="${-r * 0.55}" rx="${r * 0.42}" ry="${r * 0.6}" fill="url(#g-${c})" stroke="${CREAM}" stroke-width="${r * 0.08}" transform="rotate(${rot})"/>`;
  return `<g>${petal(-45, "red")}${petal(45, "yellow")}${petal(135, "green")}${petal(225, "blue")}<circle r="${r * 0.22}" fill="${CREAM}"/></g>`;
}

function corner(card: Card, x: number, y: number, rot: number): string {
  const shape = card.color !== "wild" ? `<g transform="translate(0 15) scale(.85)" fill="${CREAM}" stroke="${CREAM}">${SHAPES[card.color]}</g>` : "";
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${glyph(card, "small")}${shape}</g>`;
}

export function cardSvg(card: Card): string {
  const fill = `url(#g-${card.color})`;
  const label = cardLabel(card);
  // An unlabelled number is a little hard to orient (6 vs 9), so underline them.
  const underline = card.value === "6" || card.value === "9" ? `<rect x="-14" y="30" width="28" height="5" rx="2.5" fill="${CREAM}"/>` : "";
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${CREAM}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="${fill}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="url(#p-dots)"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${CREAM}" stroke-opacity=".7" stroke-width="1.6" stroke-dasharray="4 3"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="40" fill="#000" fill-opacity=".12"/>
    <g transform="translate(${W / 2} ${H / 2})" filter="url(#f-ink)">${glyph(card, "big")}${underline}</g>
    ${corner(card, 24, 30, 0)}
    ${corner(card, W - 24, H - 30, 180)}
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="url(#g-shine)"/>
  </svg>`;
}

export function cardBackSvg(): string {
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="OhNo! card">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${CREAM}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="url(#g-back)"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="url(#p-dots)"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${CREAM}" stroke-opacity=".6" stroke-width="1.6" stroke-dasharray="4 3"/>
    <g transform="translate(${W / 2} ${H / 2}) rotate(-24)" filter="url(#f-ink)">
      <text text-anchor="middle" dy="10" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="33" fill="${CREAM}">OhNo!</text>
    </g>
    <g transform="translate(${W / 2} 34) scale(.9)" opacity=".85">${flower(10)}</g>
    <g transform="translate(${W / 2} ${H - 34}) scale(.9)" opacity=".85">${flower(10)}</g>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="url(#g-shine)"/>
  </svg>`;
}

export function cardLabel(card: Card): string {
  const v: Record<string, string> = { skip: "Skip", reverse: "Reverse", draw2: "Draw Two", wild: "Wild", wild4: "Wild Draw Four" };
  const name = v[card.value] ?? card.value;
  return card.color === "wild" ? name : `${COLOR_NAMES[card.color as Color]} ${name}`;
}

export function shortLabel(card: Card): string {
  const v: Record<string, string> = { skip: "Skip", reverse: "Reverse", draw2: "+2", wild: "Wild", wild4: "+4 Wild" };
  const name = v[card.value] ?? card.value;
  return card.color === "wild" ? name : `${COLOR_NAMES[card.color as Color]} ${name}`;
}

export function shapeSvg(color: Color, size = 18): string {
  return `<svg viewBox="-8 -8 16 16" width="${size}" height="${size}" fill="currentColor" stroke="currentColor" aria-hidden="true">${SHAPES[color]}</svg>`;
}

/** A positioned card element (face or back). */
export function cardEl(card: Card | null, extraClass = ""): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `card ${card ? `c-${card.color}` : "back"} ${extraClass}`.trim();
  if (card) el.dataset.id = String(card.id);
  el.innerHTML = (card ? cardSvg(card) : cardBackSvg()) + (card?.color === "wild" ? `<span class="foil-sheen" aria-hidden="true"></span>` : "");
  return el;
}

const COLOR_ORDER: CardColor[] = ["red", "yellow", "green", "blue", "wild"];
const VALUE_ORDER = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2", "wild", "wild4"];
/** OhNo! "Color": by color, then number. */
export const byColor = (a: Card, b: Card) =>
  COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) || VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) || a.id - b.id;
/** OhNo! "Number": matching numbers (or skips, reverses…) together, then by color. */
export const byNumber = (a: Card, b: Card) =>
  VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) || COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) || a.id - b.id;

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort(byColor);
}
