// Up-north Euchre cards: birch-bark paper, cherry-red and pine-green suits, a buck on the
// Jacks, a lighthouse on the Queens, a black bear on the Kings, lake waves under the Aces,
// and both peninsulas on the back. Drawn as SVG so they stay crisp on a big TV.

import { RANK_LABEL, SUIT_NAMES, type ECard, type Suit } from "../../../shared/games/euchre/engine";

/** The how-to-play video (public/videos: .mp4, .jpg poster, .vtt captions), made with explainroo from videos/euchre-rules. */
export const HOWTO = "/videos/euchre-how-to-play";

const W = 120;
const H = 180;
export const CHERRY = "#b8322b";
export const PINE = "#1f3d33";
const LAKE = "#2f7da3";
const AMBER = "#f2b544";
const BIRCH = "#fbf5e8";
const FONT = `font-family="Fredoka, system-ui, sans-serif" font-weight="700"`;

const SUIT_PATH: Record<Suit, string> = {
  H: `<path d="M0 9C-11 1-12-6-6-9-2.5-10.5 0-7 0-5.5 0-7 2.5-10.5 6-9 12-6 11 1 0 9Z"/>`,
  D: `<path d="M0-10 7.5 0 0 10-7.5 0Z"/>`,
  S: `<path d="M0-10C-4-5-10-2-9 3-8 7-3.5 7-1.2 4.5-1.4 7-2.4 9-4 10H4C2.4 9 1.4 7 1.2 4.5 3.5 7 8 7 9 3 10-2 4-5 0-10Z"/>`,
  C: `<circle cx="0" cy="-4.6" r="4.3"/><circle cx="-4.9" cy="1.6" r="4.3"/><circle cx="4.9" cy="1.6" r="4.3"/><path d="M-1.1 1-2.8 10H2.8L1.1 1Z"/>`,
};
export const suitColor = (s: Suit) => (s === "H" || s === "D" ? CHERRY : PINE);
export const suitIcon = (s: Suit, size = 18, color = suitColor(s)) =>
  `<svg class="suit-ico" viewBox="-11 -11 22 22" width="${size}" height="${size}" fill="${color}" aria-hidden="true">${SUIT_PATH[s]}</svg>`;

const pine = (x: number, y: number, s: number, fill: string, op = 1) =>
  `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}" fill-opacity="${op}" d="M0-14 5-6H2.5L7 1H3.5L8 8H-8L-3.5 1H-7L-2.5-6H-5Z M-1.2 8H1.2V12H-1.2Z"/>`;
const waves = (y: number, col: string, op = 0.7) =>
  `<path d="M-30 ${y}q5-4 10 0t10 0 10 0 10 0 10 0 10 0" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="2.2" stroke-linecap="round"/>`;

/** A buck, head-on, antlers up. */
function buck(col: string) {
  const antler = `<path d="M-5-14C-9-24-12-30-20-36M-13-27-23-26M-16-31-15-42M-20-36-27-40" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `${antler}<g transform="scale(-1 1)">${antler}</g>
    <ellipse cx="-15" cy="-9" rx="7" ry="3.6" transform="rotate(-25 -15 -9)" fill="${col}"/>
    <ellipse cx="15" cy="-9" rx="7" ry="3.6" transform="rotate(25 15 -9)" fill="${col}"/>
    <path d="M-11-12Q-13 8-5 22Q0 27 5 22Q13 8 11-12Q0-18-11-12Z" fill="${col}"/>
    <path d="M-5 10Q0 6 5 10L4 20Q0 23-4 20Z" fill="${BIRCH}" fill-opacity=".3"/>
    <ellipse cx="0" cy="21" rx="3.6" ry="2.6" fill="#120d0b"/>
    <circle cx="-5" cy="-3" r="1.8" fill="${BIRCH}"/><circle cx="5" cy="-3" r="1.8" fill="${BIRCH}"/>`;
}

/** A striped lighthouse with its lamp lit, on the shore. */
function lighthouse(col: string) {
  return `<path d="M-10-27-40-36V-18Z M10-27 40-36V-18Z" fill="${AMBER}" fill-opacity=".35"/>
    <path d="M-9 30-6-20H6L9 30Z" fill="${col}"/>
    <path d="M-7.6 8H7.6L8.2 15H-8.2Z M-6.6-7H6.6L7.1 0H-7.1Z" fill="${BIRCH}"/>
    <rect x="-7" y="-32" width="14" height="11" rx="1.5" fill="${AMBER}" stroke="${col}" stroke-width="1.6"/>
    <path d="M-9-32 0-41 9-32Z" fill="${col}"/>
    <rect x="-10" y="-21.5" width="20" height="2.6" rx="1" fill="${col}"/>
    <path d="M-2 30V22Q0 20 2 22V30Z" fill="${BIRCH}" fill-opacity=".6"/>
    ${waves(34, LAKE, 0.8)}`;
}

/** A friendly black bear. */
function bear(col: string) {
  return `<circle cx="-14" cy="-14" r="7" fill="${col}"/><circle cx="14" cy="-14" r="7" fill="${col}"/>
    <circle cx="-14" cy="-14" r="3" fill="${BIRCH}" fill-opacity=".35"/><circle cx="14" cy="-14" r="3" fill="${BIRCH}" fill-opacity=".35"/>
    <ellipse cx="0" cy="2" rx="19" ry="18" fill="${col}"/>
    <ellipse cx="0" cy="10" rx="9" ry="7" fill="#d9b48a"/>
    <ellipse cx="0" cy="6.5" rx="3.8" ry="2.8" fill="#120d0b"/>
    <path d="M0 9.5V13M-3 14Q0 16 3 14" stroke="#120d0b" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="-7" cy="-3" r="2" fill="${BIRCH}"/><circle cx="7" cy="-3" r="2" fill="${BIRCH}"/>`;
}

const FACES: Record<number, { draw: (c: string) => string; label: string }> = {
  11: { draw: buck, label: "BUCK" },
  12: { draw: lighthouse, label: "LIGHTHOUSE" },
  13: { draw: bear, label: "BLACK BEAR" },
};

function corner(card: ECard, x: number, y: number, rot: number) {
  const col = suitColor(card.suit);
  const label = RANK_LABEL[card.rank]!;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <text text-anchor="middle" y="0" ${FONT} font-size="${label.length > 1 ? 19 : 22}" fill="${col}">${label}</text>
    <g transform="translate(0 15) scale(.62)" fill="${col}">${SUIT_PATH[card.suit]}</g>
  </g>`;
}

function center(card: ECard) {
  const col = suitColor(card.suit);
  const face = FACES[card.rank];
  if (face)
    return `<circle r="38" fill="${col}" fill-opacity=".07"/>
      ${pine(-33, 26, 0.9, col, 0.18)}${pine(33, 26, 0.9, col, 0.18)}
      <g transform="translate(0 -4)">${face.draw(col)}</g>
      <text text-anchor="middle" y="50" ${FONT} font-size="${face.label.length > 6 ? 8.5 : 10}" letter-spacing="1.6" fill="${col}" fill-opacity=".8">${face.label}</text>`;
  if (card.rank === 1)
    return `<g transform="translate(0 -6) scale(2.6)" fill="${col}">${SUIT_PATH[card.suit]}</g>${waves(34, LAKE)}${waves(41, LAKE, 0.45)}`;
  return `<text text-anchor="middle" y="-4" ${FONT} font-size="46" fill="${col}">${RANK_LABEL[card.rank]}</text>
    <g transform="translate(0 26) scale(1.3)" fill="${col}">${SUIT_PATH[card.suit]}</g>
    ${pine(-34, 46, 0.6, col, 0.25)}${pine(-25, 48, 0.45, col, 0.2)}${pine(34, 46, 0.6, col, 0.25)}${pine(25, 48, 0.45, col, 0.2)}`;
}

/** Faint birch-bark marks along the edge of the paper. */
const BARK = `<g stroke="#3a2e26" stroke-opacity=".13" stroke-width="1.6" stroke-linecap="round">
  <path d="M5 40h6M4 74h4M6 118h7M5 150h4M109 30h6M112 66h4M108 104h7M111 142h4"/></g>`;

export function ecardSvg(card: ECard): string {
  const col = suitColor(card.suit);
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${RANK_LABEL[card.rank]} of ${SUIT_NAMES[card.suit]}">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${BIRCH}" stroke="#d8c6a2" stroke-width="2"/>
    ${BARK}
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="none" stroke="${col}" stroke-opacity=".3" stroke-width="1.6" stroke-dasharray="4 3"/>
    <g transform="translate(${W / 2} ${H / 2})">${center(card)}</g>
    ${corner(card, 24, 34, 0)}
    ${corner(card, W - 24, H - 34, 180)}
  </svg>`;
}

/** Both peninsulas on deep lake blue, a pine tree line, and a star over the Mitten. */
export function ecardBackSvg(): string {
  const trees = Array.from({ length: 9 }, (_, i) => pine(16 + i * 11, 160 - (i % 2) * 3, 0.75 + (i % 3) * 0.12, "#123528")).join("");
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Card back">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${BIRCH}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="#1d4f6e"/>
    <rect x="6" y="6" width="${W - 12}" height="${(H - 12) * 0.55}" rx="10" fill="#2a6a8c" fill-opacity=".55"/>
    <g fill="${BIRCH}" fill-opacity=".9">
      <path d="M18 52C28 45 40 46 50 50C56 44 70 41 84 45L96 50L92 55C82 55 72 56 64 59C52 57 38 58 26 61L19 58Z"/>
      <path d="M48 146 45 112C40 100 41 86 49 78C51 70 58 65 64 67C70 63 77 68 77 76C80 82 80 90 78 96L83 91C89 89 93 95 90 102L82 114 81 146Z"/>
    </g>
    <path d="M66 104l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7Z" fill="${AMBER}"/>
    ${trees}
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${BIRCH}" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="4 3"/>
    <text x="${W / 2}" y="30" text-anchor="middle" ${FONT} font-size="12" letter-spacing="3" fill="${BIRCH}" fill-opacity=".85">EUCHRE</text>
  </svg>`;
}

export function ecardEl(card: ECard | null, extra = ""): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `pcard ecard ${card ? `s-${card.suit}` : "back"} ${extra}`.trim();
  if (card) el.dataset.id = String(card.id);
  el.innerHTML = card ? ecardSvg(card) : ecardBackSvg();
  return el;
}
export const ecardHtml = (card: ECard | null, extra = "") => ecardEl(card, extra).outerHTML;
