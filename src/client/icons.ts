// Crisp inline SVG UI chrome icons, game emblems, and celebratory medallions
// so everything looks consistent across TV, Android, iOS, and desktop.

import type { GameId } from "../shared/games/types";

const svg = (body: string, size = 20, cls = "") =>
  `<svg class="ui-ico ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icoSound = (on: boolean, size = 20) =>
  on
    ? svg(`<path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.8 5.8a9 9 0 0 1 0 12.4"/>`, size)
    : svg(`<path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" opacity=".75"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/>`, size);

export const icoSettings = (size = 20) =>
  svg(
    `<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
    size,
  );

export const icoCrown = (title = "Host") =>
  `<i class="crown" title="${title}" aria-label="${title}"><svg class="ui-ico" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 18h18l-1.5-9.5-4.3 3.4L12 5.5l-3.2 6.4-4.3-3.4L3 18zm1 2.2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-.8H4v.8z"/></svg></i>`;

export const icoEye = (size = 16) =>
  svg(`<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none"/>`, size);

export const icoFan = (size = 16) =>
  svg(
    `<rect x="4" y="6" width="8" height="12" rx="1.6" transform="rotate(-14 8 12)"/><rect x="8.5" y="5" width="8" height="12" rx="1.6" fill="currentColor" fill-opacity=".18"/><rect x="12.5" y="6.5" width="8" height="12" rx="1.6" transform="rotate(14 16 12)"/>`,
    size,
  );

export const icoGrid = (size = 16) =>
  svg(`<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>`, size);

export const icoPlay = (size = 16) =>
  svg(`<path d="M6.5 4.8L19 12 6.5 19.2V4.8z" fill="currentColor" stroke="currentColor" stroke-width="1.6"/>`, size);

export const icoClose = (size = 16) => svg(`<path d="M6 6l12 12"/><path d="M18 6L6 18"/>`, size);

export const icoDice = (size = 16) =>
  svg(
    `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>`,
    size,
  );

export const icoBot = (size = 17) =>
  svg(
    `<path d="M12 3v3"/><circle cx="12" cy="2.5" r="1" fill="currentColor" stroke="none"/><rect x="4" y="6.5" width="16" height="12.5" rx="4"/><circle cx="9.2" cy="12.2" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.8" cy="12.2" r="1.3" fill="currentColor" stroke="none"/><path d="M9.5 15.8h5"/>`,
    size,
  );

/** Handcrafted 36×36 emblem for each game in the hub picker. */
export function gameEmblem(id: GameId, cls = "game-emblem"): string {
  switch (id) {
    case "ohno":
      return `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true">
        <g transform="translate(18 18)">
          <ellipse cx="0" cy="-7" rx="5" ry="7.4" fill="#ef6a4f" stroke="#fff6e6" stroke-width="1.3" transform="rotate(-45)"/>
          <ellipse cx="0" cy="-7" rx="5" ry="7.4" fill="#f8c14a" stroke="#fff6e6" stroke-width="1.3" transform="rotate(45)"/>
          <ellipse cx="0" cy="-7" rx="5" ry="7.4" fill="#62b36e" stroke="#fff6e6" stroke-width="1.3" transform="rotate(135)"/>
          <ellipse cx="0" cy="-7" rx="5" ry="7.4" fill="#5a98dd" stroke="#fff6e6" stroke-width="1.3" transform="rotate(225)"/>
          <circle r="3.4" fill="#fff6e6"/>
        </g>
      </svg>`;
    case "euchre":
      return `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true">
        <g transform="translate(18 20)" fill="#fbf5e8" stroke="#fbf5e8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-3-6C-5-11-7-14-12-17M-8-13-13-12M-9-15-9-19" fill="none" stroke-width="2.1"/>
          <path d="M3-6C5-11 7-14 12-17M8-13 13-12M9-15 9-19" fill="none" stroke-width="2.1"/>
          <path d="M-6-6Q-7 4-2.8 10Q0 12.5 2.8 10Q7 4 6-6Q0-9-6-6Z" stroke="none"/>
          <circle cx="-2.6" cy="-1.5" r="1" fill="#1b4b60" stroke="none"/>
          <circle cx="2.6" cy="-1.5" r="1" fill="#1b4b60" stroke="none"/>
          <ellipse cx="0" cy="9.2" rx="1.8" ry="1.3" fill="#1b4b60" stroke="none"/>
        </g>
        <path d="M5 31q4.5-2.6 9 0t9 0 8 0" fill="none" stroke="#4fb3e3" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    case "rummy":
      return `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true">
        <path d="M12 10L10.5 5.5L15 8L18 4L21 8L25.5 5.5L24 10Z" fill="#ffcf5c"/>
        <path d="M18 11.5C13.5 16.8 7.5 20.2 8.5 25.5C9.5 29.5 14.2 29.5 16.6 26.8C16.4 29.4 15.2 31.4 13.5 32.5H22.5C20.8 31.4 19.6 29.4 19.4 26.8C21.8 29.5 26.5 29.5 27.5 25.5C28.5 20.2 22.5 16.8 18 11.5Z" fill="#fff6e6" stroke="#6cc17a" stroke-width="1.2"/>
      </svg>`;
    case "fizzle":
      return `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true">
        <g transform="translate(16 21) rotate(-22)">
          <rect x="-6.5" y="-9" width="13" height="22" rx="3.8" fill="#d9422b" stroke="#fff6e6" stroke-width="1.6"/>
          <path d="M-5.5-1.5L5.5-5.5M-5.5 5.5L5.5 1.5" stroke="#ffcf5c" stroke-width="2.4"/>
          <path d="M0-9C0-14 5-17 10.5-15" fill="none" stroke="#ebd3a6" stroke-width="2" stroke-linecap="round"/>
          <g transform="translate(11.5 -15)">
            <path d="M0-6.5L1.8-2L6.5-3.2L3 0.5L6.5 4.2L1.8 2.6L0 7L-1.8 2.6L-6.5 4.2L-3 0.5L-6.5-3.2L-1.8-2Z" fill="#ffcf5c"/>
            <circle r="2.2" fill="#fff6e6"/>
          </g>
        </g>
      </svg>`;
    case "hush":
      return `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true">
        <path d="M21 6.5A11.5 11.5 0 1 0 30 23.5A9 9 0 1 1 21 6.5Z" fill="#fbe7b8"/>
        <path d="M26 8L27.2 11L30.2 12.2L27.2 13.4L26 16.4L24.8 13.4L21.8 12.2L24.8 11Z" fill="#ffcf5c"/>
        <circle cx="29.5" cy="18.5" r="1.4" fill="#fff6e6" fill-opacity=".8"/>
      </svg>`;
  }
}

/** Celebratory golden trophy medallion for win screens. */
export const icoTrophy = (cls = "medallion-ico") =>
  `<svg class="${cls}" viewBox="0 0 80 80" aria-hidden="true">
    <path d="M24 18H12c0 14 5 22 14 23M56 18h12c0 14-5 22-14 23" fill="none" stroke="#e8a436" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M22 14h36v17c0 12-7.5 21-18 21S22 43 22 31V14Z" fill="#ffcf5c" stroke="#fff4cc" stroke-width="2"/>
    <path d="M28 19v11c0 6 3 11 7 13" fill="none" stroke="#fff6e6" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
    <rect x="35" y="51" width="10" height="11" fill="#e8a436"/>
    <rect x="24" y="61" width="32" height="8" rx="4" fill="#ffcf5c" stroke="#fff4cc" stroke-width="1.6"/>
    <path d="M40 22l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7Z" fill="#fff6e6"/>
  </svg>`;

/** Softly cracked ruby heart for co-op defeat screens. */
export const icoBrokenHeart = (cls = "medallion-ico") =>
  `<svg class="${cls}" viewBox="0 0 80 80" aria-hidden="true">
    <path d="M40 66C18 51 10 38 10 27A16.5 16.5 0 0 1 40 18.5A16.5 16.5 0 0 1 70 27C70 38 62 51 40 66Z" fill="#d94e3f" stroke="#ffd8cf" stroke-width="2.2"/>
    <path d="M41 19L35 31L44 39L36 51L41 64" fill="none" stroke="#1e1518" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

/** Starburst boom medallion for Fizzle! defeat screen. */
export const icoBoom = (cls = "medallion-ico") =>
  `<svg class="${cls}" viewBox="0 0 80 80" aria-hidden="true">
    <path d="M40 6L48 24L68 16L58 34L74 44L56 50L64 68L45 58L40 74L35 58L16 68L24 50L6 44L22 34L12 16L32 24Z" fill="#ef6a4f" stroke="#ffd285" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M40 20L45 32L57 28L51 39L60 46L48 48L51 58L40 52L29 58L32 48L20 46L29 39L23 28L35 32Z" fill="#ffcf5c"/>
    <circle cx="40" cy="41" r="8" fill="#fff6e6"/>
  </svg>`;
