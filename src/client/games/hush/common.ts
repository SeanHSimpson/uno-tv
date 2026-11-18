// Bits shared by Hush's TV and phone screens.

import { esc } from "../../ui";

/** A number card. The colour warms as numbers rise (cool blue at 1, amber at 100). */
export function numCard(n: number, cls = ""): string {
  const hue = Math.round(215 - (n - 1) * 1.75);
  return `<div class="num-card ${cls}" style="--h:${hue}" data-n="${n}" aria-label="${n}">
    <span class="nc-corner">${n}</span><span class="nc-num">${n}</span><span class="nc-corner nc-br">${n}</span>
  </div>`;
}

export const hearts = (n: number) => `<span class="hush-hearts" aria-label="${n} hearts">${"❤️".repeat(Math.max(0, n)) || "—"}</span>`;
export const stars = (n: number) => `<span class="hush-stars" aria-label="${n} stars">${"⭐".repeat(Math.max(0, n)) || "—"}</span>`;

/** Cards rise in pitch: a pentatonic scale across two and a half octaves. */
export function pitchFor(card: number): number {
  const scale = [0, 2, 4, 7, 9];
  const idx = Math.min(12, Math.floor(((card - 1) / 100) * 13));
  return 60 + 12 * Math.floor(idx / 5) + scale[idx % 5]!;
}

export const nameOf = (players: { id: string; name: string }[], pid: string) => esc(players.find((p) => p.id === pid)?.name ?? "Someone");
