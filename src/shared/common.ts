// Things every game (and the room around them) shares.

export class GameError extends Error {}
export type Rng = () => number;

export const fail = (msg: string): never => {
  throw new GameError(msg);
};

export const MAX_PLAYERS = 10;
export const MAX_NAME = 14;

/** Quick table reactions players can send from their phone to pop over their TV seat. */
export interface CustomEmote {
  icon: string;
  label: string;
}

export const EMOTES = [
  { id: "clap", icon: "👏", label: "Nice!" },
  { id: "gasp", icon: "😱", label: "Whoa!" },
  { id: "laugh", icon: "😂", label: "Haha!" },
  { id: "fire", icon: "🔥", label: "On fire!" },
  { id: "oof", icon: "😬", label: "Oof" },
  { id: "gg", icon: "🎉", label: "GG!" },
] as const;
export type EmoteId = (typeof EMOTES)[number]["id"];
export type EmoteInput = EmoteId | CustomEmote;
export const isEmote = (x: unknown): x is EmoteId => EMOTES.some((e) => e.id === x);

/** Curated icon palette for customizing phone reaction slots (any emoji typed via keyboard works too). */
export const EMOTE_ICONS = [
  "👏", "😱", "😂", "🔥", "😬", "🎉", "😭", "😈",
  "👀", "💀", "🤯", "🫡", "🫶", "🍀", "🐢", "⚡",
  "🍿", "💅", "🤡", "👑", "😎", "🫣", "🙏", "😤",
  "🥳", "🤔", "🫠", "🚀", "💥", "🃏", "❤️", "👍",
] as const;

export const MAX_EMOTE_LABEL = 16;

/** Sanitize either a built-in emote id or a custom { icon, label } reaction. */
export function cleanEmote(raw: unknown): CustomEmote | null {
  if (typeof raw === "string") {
    const preset = EMOTES.find((e) => e.id === raw);
    return preset ? { icon: preset.icon, label: preset.label } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { icon?: unknown; label?: unknown };
  const cleanStr = (v: unknown) =>
    String(v ?? "")
      .replace(/[\u0000-\u001f\u007f<>]/g, "")
      .trim();
  // Cap icon length cleanly (handles multi-codepoint emoji / ZWJ sequences without letting paragraphs through).
  const icon = [...cleanStr(r.icon)].slice(0, 8).join("");
  const label = [...cleanStr(r.label)].slice(0, MAX_EMOTE_LABEL).join("");
  if (!icon && !label) return null;
  return { icon: icon || "💬", label };
}

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
  /** Game-night wins earned in this room across all games. */
  wins?: number;
}

/** Fields every game's public player list carries, so shared UI (avatars, names) works everywhere. */
export interface PublicMember {
  id: string;
  name: string;
  hue: number;
  avatar: string | null;
  bot: boolean;
  connected: boolean;
  wins: number;
}

export const publicMember = (m: Member): PublicMember => ({
  id: m.id,
  name: m.name,
  hue: m.hue,
  avatar: m.avatar ?? null,
  bot: !!m.bot,
  connected: m.connected,
  wins: m.wins ?? 0,
});
