// Things every game (and the room around them) shares.

export class GameError extends Error {}
export type Rng = () => number;

export const fail = (msg: string): never => {
  throw new GameError(msg);
};

export const MAX_PLAYERS = 10;
export const MAX_NAME = 14;

/** Pictures players can pick for their seat. */
export const AVATARS = [
  "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵",
  "🐰", "🐱", "🐶", "🦉", "🐧", "🐢", "🦄", "🐙",
  "🦔", "🐝", "🐞", "🦋", "🐳", "🦖", "🌻", "🍄",
] as const;

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function cleanName(raw: unknown): string {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, MAX_NAME);
  return name || "Player";
}

/** Only accept pictures from our list (anything else is ignored). */
export function cleanAvatar(raw: unknown): string | undefined {
  return typeof raw === "string" && (AVATARS as readonly string[]).includes(raw) ? raw : undefined;
}

/** Someone sitting at the table, as every game sees them. */
export interface Member {
  id: string;
  name: string;
  /** Index into the seat colour palette, stable while they're in the room. */
  hue: number;
  avatar?: string;
  bot?: boolean;
  connected: boolean;
}

/** Fields every game's public player list carries, so shared UI (avatars, names) works everywhere. */
export interface PublicMember {
  id: string;
  name: string;
  hue: number;
  avatar: string | null;
  bot: boolean;
  connected: boolean;
}

export const publicMember = (m: Member): PublicMember => ({
  id: m.id,
  name: m.name,
  hue: m.hue,
  avatar: m.avatar ?? null,
  bot: !!m.bot,
  connected: m.connected,
});
