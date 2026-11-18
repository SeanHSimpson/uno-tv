// Fizzle! card faces, shared by the TV and phone.

import { CARD_INFO, type FCard, type FizzleKind } from "../../../shared/games/fizzle/engine";
import { esc } from "../../ui";

export function fcardHtml(card: FCard | { kind: FizzleKind; id?: number } | null, cls = ""): string {
  if (!card) return `<div class="fcard back ${cls}"><span class="fc-emoji">🧨</span><span class="fc-name">Fizzle!</span></div>`;
  const info = CARD_INFO[card.kind];
  return `<div class="fcard k-${card.kind} ${cls}" ${card.id !== undefined ? `data-id="${card.id}"` : ""} role="button" aria-label="${esc(info.name)}: ${esc(info.text)}">
    <span class="fc-emoji">${info.emoji}</span>
    <span class="fc-name">${esc(info.name)}</span>
    <span class="fc-text">${esc(info.text)}</span>
  </div>`;
}

/** Lit firecrackers with their fuses (● = one turn left). */
export function litHtml(fuses: number[]): string {
  return fuses
    .map((f) => `<span class="lit ${f <= 1 ? "danger" : ""}" title="Fuse: ${f}"><span class="lit-emoji">🧨</span><span class="fuse">${"●".repeat(Math.max(0, f))}</span></span>`)
    .join("");
}
