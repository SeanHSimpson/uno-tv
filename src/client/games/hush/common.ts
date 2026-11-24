// Hush: original celestial SVG number cards, glowing ruby hearts, golden stars, and moonlit emblem.

import { esc } from "../../ui";

const W = 120;
const H = 180;
const CREAM = "#fff6e6";
const FONT = `font-family="Fredoka, system-ui, sans-serif" font-weight="700"`;

/** A celestial number card whose hue warms smoothly as numbers rise (cool blue at 1, candlelight amber at 100). */
export function numCardSvg(n: number): string {
  const hue = Math.round(215 - (n - 1) * 1.75);
  const top = `hsl(${hue} 70% 76%)`;
  const bot = `hsl(${hue} 54% 55%)`;
  const ink = `hsl(${hue} 58% 17%)`;
  const fs = n >= 100 ? 48 : n >= 10 ? 58 : 66;
  const star = (x: number, y: number, r: number) =>
    `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z" fill="${CREAM}" fill-opacity=".8"/>`;
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${n}">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${CREAM}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="${bot}"/>
    <rect x="6" y="6" width="${W - 12}" height="${(H - 12) * 0.58}" rx="10" fill="${top}" fill-opacity=".85"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${CREAM}" stroke-opacity=".75" stroke-width="1.6" stroke-dasharray="4 3"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="38" fill="${CREAM}" fill-opacity=".22" stroke="${CREAM}" stroke-opacity=".4" stroke-width="1.2"/>
    ${star(W - 24, 28, 6)}${star(24, H - 28, 6)}
    <text x="${W / 2}" y="${H / 2 + fs * 0.35}" text-anchor="middle" ${FONT} font-size="${fs}" fill="${ink}">${n}</text>
    <text x="23" y="34" text-anchor="middle" ${FONT} font-size="${n >= 100 ? 15 : 18}" fill="${ink}">${n}</text>
    <g transform="translate(${W - 23} ${H - 34}) rotate(180)">
      <text x="0" y="0" text-anchor="middle" ${FONT} font-size="${n >= 100 ? 15 : 18}" fill="${ink}">${n}</text>
    </g>
  </svg>`;
}

export function numCard(n: number, cls = ""): string {
  const hue = Math.round(215 - (n - 1) * 1.75);
  return `<div class="num-card ${cls}" style="--h:${hue}" data-n="${n}" aria-label="${n}">${numCardSvg(n)}</div>`;
}

export function numCardEl(n: number, cls = ""): HTMLDivElement {
  const t = document.createElement("template");
  t.innerHTML = numCard(n, cls).trim();
  return t.content.firstElementChild as HTMLDivElement;
}

const heartSvg = `<svg class="hush-ico hush-heart" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 20.5C5.2 15.6 2.5 11.4 2.5 7.9A5.1 5.1 0 0 1 12 5.3a5.1 5.1 0 0 1 9.5 2.6c0 3.5-2.7 7.7-9.5 12.6Z" fill="#eb5c4d" stroke="#ffd8cf" stroke-width="1.3"/>
  <path d="M6.8 7.5A2.5 2.5 0 0 1 9.4 5.8" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

const starSvg = `<svg class="hush-ico hush-star" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2.4l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9Z" fill="#ffcf5c" stroke="#fff4cc" stroke-width="1.2" stroke-linejoin="round"/>
</svg>`;

export const hearts = (n: number) =>
  `<span class="hush-hearts" aria-label="${n} hearts">${n > 0 ? heartSvg.repeat(n) : `<span class="muted">—</span>`}</span>`;

export const stars = (n: number) =>
  `<span class="hush-stars" aria-label="${n} stars">${n > 0 ? starSvg.repeat(n) : `<span class="muted">—</span>`}</span>`;

/** Quiet crescent moon & drifting stars emblem for empty pile / waiting state. */
export const moonEmblem = (cls = "hush-moon-ico") =>
  `<svg class="${cls}" viewBox="0 0 80 80" aria-hidden="true">
    <path d="M46 14A26 26 0 1 0 66 52A20 20 0 1 1 46 14Z" fill="#fbe7b8" fill-opacity=".88"/>
    <path d="M58 18L60 23L65 25L60 27L58 32L56 27L51 25L56 23Z" fill="#ffcf5c"/>
    <circle cx="67" cy="37" r="2.2" fill="#fff6e6" fill-opacity=".75"/>
    <circle cx="24" cy="20" r="1.8" fill="#fff6e6" fill-opacity=".55"/>
  </svg>`;

/** Cards rise in pitch: a pentatonic scale across two and a half octaves. */
export function pitchFor(card: number): number {
  const scale = [0, 2, 4, 7, 9];
  const idx = Math.min(12, Math.floor(((card - 1) / 100) * 13));
  return 60 + 12 * Math.floor(idx / 5) + scale[idx % 5]!;
}

export const nameOf = (players: { id: string; name: string }[], pid: string) => esc(players.find((p) => p.id === pid)?.name ?? "Someone");
