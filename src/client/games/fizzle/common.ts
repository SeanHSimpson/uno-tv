// Fizzle! original inline SVG cards & glowing firecracker fuses, shared by TV and phone.

import { CARD_INFO, type FCard, type FizzleKind } from "../../../shared/games/fizzle/engine";
import { esc } from "../../ui";

const W = 120;
const H = 180;
const CREAM = "#fff6e6";
const GOLD = "#ffcf5c";
const FONT = `font-family="Fredoka, system-ui, sans-serif" font-weight="700"`;

const PALETTE: Record<FizzleKind, { top: string; bot: string; accent: string }> = {
  cracker: { top: "#df533b", bot: "#9c2619", accent: "#ffd266" },
  water: { top: "#4f94e2", bot: "#24579b", accent: "#c7ecff" },
  toss: { top: "#f09b38", bot: "#ba5b16", accent: "#ffe8a3" },
  peek: { top: "#9e73cc", bot: "#5c3988", accent: "#ebd8ff" },
  shuffle: { top: "#5ab36f", bot: "#2c7341", accent: "#ccf5d4" },
  nap: { top: "#6f80a3", bot: "#3d4a68", accent: "#dce6ff" },
  fish: { top: "#38b0aa", bot: "#1c6b6a", accent: "#c4faf6" },
};

function art(kind: FizzleKind): string {
  switch (kind) {
    case "cracker":
      return `
        <g transform="rotate(-18)">
          <rect x="-13" y="-12" width="26" height="44" rx="7" fill="#b82519" stroke="${CREAM}" stroke-width="2.4"/>
          <path d="M-12 2L12-7M-12 15L12 6M-12 27L12 18" stroke="${GOLD}" stroke-width="4.2"/>
          <path d="M0-12C0-24 10-30 20-26" fill="none" stroke="#e9cfa2" stroke-width="3.2" stroke-linecap="round"/>
          <g transform="translate(22 -26)">
            <path d="M0-13L3-4L12-7L6 1L13 8L3 5L0 14L-3 5L-13 8L-6 1L-12-7L-3-4Z" fill="${GOLD}"/>
            <circle r="4.5" fill="${CREAM}"/>
          </g>
        </g>`;
    case "water":
      return `
        <path d="M0-30C16-8 24 4 24 14A24 24 0 0 1-24 14C-24 4-16-8 0-30Z" fill="#c7ecff" stroke="${CREAM}" stroke-width="2.2"/>
        <path d="M-8 14A11 11 0 0 1-4-4" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>
        <circle cx="-26" cy="-6" r="4" fill="#c7ecff" fill-opacity=".85"/>
        <circle cx="27" cy="-12" r="3.2" fill="#c7ecff" fill-opacity=".85"/>
        <circle cx="25" cy="30" r="2.8" fill="${CREAM}" fill-opacity=".7"/>`;
    case "toss":
      return `
        <path d="M-30 18C-22-18 6-28 24-12" fill="none" stroke="${CREAM}" stroke-width="4.5" stroke-dasharray="6 6" stroke-linecap="round"/>
        <path d="M12-18L26-11L17 3" fill="none" stroke="${CREAM}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <g transform="translate(-22 18) rotate(-25) scale(.62)">
          <rect x="-11" y="-16" width="22" height="32" rx="6" fill="#d83f2a" stroke="${CREAM}" stroke-width="2.6"/>
          <path d="M-10-2L10-9M-10 9L10 2" stroke="${GOLD}" stroke-width="3.8"/>
          <circle cx="0" cy="-24" r="6" fill="${GOLD}"/>
        </g>
        <path d="M26-26L28-20L34-18L28-16L26-10L24-16L18-18L24-20Z" fill="${GOLD}"/>`;
    case "peek":
      return `
        <g transform="translate(-6 4)">
          <rect x="-22" y="-14" width="18" height="26" rx="3.5" transform="rotate(-14 -13 -1)" fill="${CREAM}" fill-opacity=".88"/>
          <rect x="-6" y="-18" width="18" height="26" rx="3.5" fill="${CREAM}"/>
          <rect x="10" y="-14" width="18" height="26" rx="3.5" transform="rotate(14 19 -1)" fill="${CREAM}" fill-opacity=".88"/>
          <path d="M3-10L6-5L3 0L0-5Z" fill="#8a62b8"/>
        </g>
        <g transform="translate(8 8)">
          <circle r="17" fill="#3a205c" fill-opacity=".35" stroke="${GOLD}" stroke-width="4"/>
          <path d="M12 12L24 24" stroke="${GOLD}" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M-8-6A10 10 0 0 1 4-10" fill="none" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round"/>
        </g>`;
    case "shuffle":
      return `
        <g fill="none" stroke="${CREAM}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-30-14H-12C-2-14 2 14 14 14H28"/>
          <path d="M20 6L29 14L20 22"/>
          <path d="M-30 14H-12C-2 14 2-14 14-14H28"/>
          <path d="M20-22L29-14L20-6"/>
        </g>
        <circle cx="0" cy="0" r="6" fill="${GOLD}"/>`;
    case "nap":
      return `
        <path d="M6-24A24 24 0 1 0 22 14A18 18 0 1 1 6-24Z" fill="${GOLD}" stroke="${CREAM}" stroke-width="1.8"/>
        <text x="14" y="-14" ${FONT} font-size="18" fill="${CREAM}">Z</text>
        <text x="26" y="-26" ${FONT} font-size="13" fill="${CREAM}" fill-opacity=".85">z</text>
        <circle cx="-24" cy="-18" r="2.2" fill="${CREAM}" fill-opacity=".8"/>
        <circle cx="-18" cy="24" r="1.8" fill="${CREAM}" fill-opacity=".7"/>`;
    case "fish":
      return `
        <path d="M8-32V6A14 14 0 0 1-20 6C-20 0-16-4-12-4" fill="none" stroke="${CREAM}" stroke-width="3.8" stroke-linecap="round"/>
        <path d="M-12-4L-17 1" stroke="${CREAM}" stroke-width="3.2" stroke-linecap="round"/>
        <rect x="-12" y="-2" width="22" height="28" rx="4" transform="rotate(-12)" fill="${CREAM}" stroke="${GOLD}" stroke-width="2"/>
        <path d="M-32 26q8-5 16 0t16 0 16 0 16 0" fill="none" stroke="#c4faf6" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M-24 34q8-4 16 0t16 0 16 0" fill="none" stroke="#c4faf6" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round"/>`;
  }
}

export function fcardSvg(card: FCard | { kind: FizzleKind; id?: number } | null): string {
  if (!card) {
    return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fizzle! card back">
      <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${CREAM}"/>
      <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="#5e1b29"/>
      <rect x="6" y="6" width="${W - 12}" height="${(H - 12) * 0.5}" rx="10" fill="#8b2838" fill-opacity=".5"/>
      <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${GOLD}" stroke-opacity=".65" stroke-width="1.6" stroke-dasharray="4 3"/>
      <circle cx="${W / 2}" cy="76" r="34" fill="#000" fill-opacity=".18"/>
      <g transform="translate(${W / 2} 76) scale(.86)">${art("cracker")}</g>
      <text x="${W / 2}" y="142" text-anchor="middle" ${FONT} font-size="25" fill="${CREAM}">Fizzle!</text>
    </svg>`;
  }
  const p = PALETTE[card.kind];
  const info = CARD_INFO[card.kind];
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(info.name)}: ${esc(info.text)}">
    <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${CREAM}"/>
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="${p.bot}"/>
    <rect x="6" y="6" width="${W - 12}" height="${(H - 12) * 0.6}" rx="10" fill="${p.top}" fill-opacity=".85"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="7" fill="none" stroke="${CREAM}" stroke-opacity=".68" stroke-width="1.6" stroke-dasharray="4 3"/>
    <circle cx="${W / 2}" cy="64" r="36" fill="#000" fill-opacity=".14"/>
    <g transform="translate(${W / 2} 64) scale(.86)">${art(card.kind)}</g>
    <text x="${W / 2}" y="122" text-anchor="middle" ${FONT} font-size="21" fill="${CREAM}">${esc(info.name)}</text>
  </svg>`;
}

export function fcardHtml(card: FCard | { kind: FizzleKind; id?: number } | null, cls = ""): string {
  if (!card) return `<div class="fcard back ${cls}">${fcardSvg(null)}</div>`;
  const info = CARD_INFO[card.kind];
  return `<div class="fcard k-${card.kind} ${cls}" ${card.id !== undefined ? `data-id="${card.id}"` : ""} role="button" aria-label="${esc(info.name)}: ${esc(info.text)}">
    ${fcardSvg(card)}
    <span class="fc-text">${esc(info.text)}</span>
  </div>`;
}

export function fcardEl(card: FCard | { kind: FizzleKind; id?: number } | null, cls = ""): HTMLDivElement {
  const t = document.createElement("template");
  t.innerHTML = fcardHtml(card, cls).trim();
  return t.content.firstElementChild as HTMLDivElement;
}

/** Mini SVG lit firecracker icon with glowing spark. */
export const litCrackerSvg = (size = 24) =>
  `<svg class="lit-ico" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">
    <g transform="translate(14 18) rotate(-24)">
      <rect x="-6" y="-8" width="12" height="20" rx="3.5" fill="#d93f2b" stroke="${CREAM}" stroke-width="1.6"/>
      <path d="M-5-1L5-5M-5 5L5 1" stroke="${GOLD}" stroke-width="2.2"/>
      <path d="M0-8C0-13 5-16 10-14" fill="none" stroke="#ebd3a6" stroke-width="1.8" stroke-linecap="round"/>
      <g class="lit-spark" transform="translate(11 -14)">
        <path d="M0-6L1.6-2L6-3L2.8 0.5L6 4L1.6 2.5L0 6.5L-1.6 2.5L-6 4L-2.8 0.5L-6-3L-1.6-2Z" fill="${GOLD}"/>
        <circle r="2.2" fill="${CREAM}"/>
      </g>
    </g>
  </svg>`;

/** Lit firecrackers with glowing ember fuse pips (each bead = one turn left). */
export function litHtml(fuses: number[]): string {
  return fuses
    .map(
      (f) =>
        `<span class="lit ${f <= 1 ? "danger" : ""}" title="Fuse: ${f}">${litCrackerSvg(24)}<span class="fuse">${Array.from(
          { length: Math.max(0, f) },
          () => `<i class="fuse-dot"></i>`,
        ).join("")}</span></span>`,
    )
    .join("");
}
