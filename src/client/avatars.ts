// Illustrated storybook SVG character badges for all 24 player avatars + bot.
// Keeps full compatibility with the stored emoji avatar IDs ("🦊", "🐻", etc.)
// while rendering crisp, unified hand-crafted vector art across every phone & TV.

const EYES = (y = 33, dx = 8.5, r = 2.6) =>
  `<circle cx="${32 - dx}" cy="${y}" r="${r}" fill="#241916"/><circle cx="${32 + dx}" cy="${y}" r="${r}" fill="#241916"/>
   <circle cx="${32 - dx - 0.8}" cy="${y - 0.8}" r="${r * 0.36}" fill="#fff"/><circle cx="${32 + dx - 0.8}" cy="${y - 0.8}" r="${r * 0.36}" fill="#fff"/>`;

const CHEEKS = (y = 39, dx = 13) =>
  `<ellipse cx="${32 - dx}" cy="${y}" rx="3.4" ry="2.1" fill="#f48b82" fill-opacity=".48"/><ellipse cx="${32 + dx}" cy="${y}" rx="3.4" ry="2.1" fill="#f48b82" fill-opacity=".48"/>`;

const SMILE = (y = 40.5) =>
  `<path d="M27.5 ${y}Q32 ${y + 4.2} 36.5 ${y}" fill="none" stroke="#241916" stroke-width="2" stroke-linecap="round"/>`;

const ART: Record<string, string> = {
  "🦊": `
    <path d="M13 24 17 8 28 19Z M51 24 47 8 36 19Z" fill="#e56b32" stroke="#2b1d1a" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M16 20 18.5 12 24 18Z M48 20 45.5 12 40 18Z" fill="#ffd9b3"/>
    <path d="M12 32C12 19 21 15 32 15 43 15 52 19 52 32 52 44 41 51 32 51 23 51 12 44 12 32Z" fill="#ef7b3d" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M14 35C18 33 25 38 32 45 39 38 46 33 50 35 48 45 40 51 32 51 24 51 16 45 14 35Z" fill="#fff6e6"/>
    ${EYES(32, 8.5, 2.5)}<ellipse cx="32" cy="40" rx="3.3" ry="2.3" fill="#2b1d1a"/>${SMILE(43)}`,

  "🐻": `
    <circle cx="17" cy="18" r="7.5" fill="#9a613a" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="17" cy="18" r="3.8" fill="#d9a87e"/>
    <circle cx="47" cy="18" r="7.5" fill="#9a613a" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="47" cy="18" r="3.8" fill="#d9a87e"/>
    <circle cx="32" cy="34" r="19" fill="#ab6e44" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="32" cy="40" rx="9.5" ry="7.5" fill="#efd0ad"/>
    ${EYES(31, 8, 2.6)}${CHEEKS(38, 13)}<ellipse cx="32" cy="37" rx="3.8" ry="2.7" fill="#2b1d1a"/>${SMILE(41)}`,

  "🐼": `
    <circle cx="17" cy="18" r="7.5" fill="#2b2628"/><circle cx="47" cy="18" r="7.5" fill="#2b2628"/>
    <circle cx="32" cy="34" r="19" fill="#fff9ef" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="23" cy="32" rx="6" ry="7.2" transform="rotate(-16 23 32)" fill="#2b2628"/>
    <ellipse cx="41" cy="32" rx="6" ry="7.2" transform="rotate(16 41 32)" fill="#2b2628"/>
    <circle cx="24" cy="31" r="2.2" fill="#fff"/><circle cx="40" cy="31" r="2.2" fill="#fff"/>
    <circle cx="24.5" cy="31.5" r="1" fill="#2b2628"/><circle cx="39.5" cy="31.5" r="1" fill="#2b2628"/>
    ${CHEEKS(40, 12.5)}<ellipse cx="32" cy="38.5" rx="3.4" ry="2.3" fill="#2b2628"/>${SMILE(42)}`,

  "🐨": `
    <circle cx="14" cy="28" r="9.5" fill="#98a2ab" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="14" cy="28" r="5" fill="#f3e5dc"/>
    <circle cx="50" cy="28" r="9.5" fill="#98a2ab" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="50" cy="28" r="5" fill="#f3e5dc"/>
    <circle cx="32" cy="34" r="17.5" fill="#aeb7bf" stroke="#2b1d1a" stroke-width="1.8"/>
    ${EYES(32, 9.5, 2.5)}${CHEEKS(39, 12)}<ellipse cx="32" cy="36" rx="4.2" ry="6.2" fill="#3a3b42"/>${SMILE(44)}`,

  "🐯": `
    <circle cx="17" cy="18" r="7" fill="#f29b38" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="17" cy="18" r="3.4" fill="#ffe2b5"/>
    <circle cx="47" cy="18" r="7" fill="#f29b38" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="47" cy="18" r="3.4" fill="#ffe2b5"/>
    <circle cx="32" cy="34" r="19" fill="#f6a23e" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M28 16 32 23 36 16 M14 29 21 30 M13 35 20 35 M50 29 43 30 M51 35 44 35" stroke="#2b1d1a" stroke-width="2.3" stroke-linecap="round"/>
    <ellipse cx="32" cy="41" rx="9" ry="6.5" fill="#fff6e6"/>
    ${EYES(32, 8.2, 2.5)}<path d="M29 38h6l-3 3.4Z" fill="#d96767"/>${SMILE(42.5)}`,

  "🦁": `
    <circle cx="32" cy="34" r="24" fill="#b75c24" stroke="#2b1d1a" stroke-width="1.6" stroke-dasharray="7 3"/>
    <circle cx="32" cy="34" r="21" fill="#c76829"/>
    <circle cx="19" cy="20" r="5" fill="#f3b64b" stroke="#2b1d1a" stroke-width="1.5"/><circle cx="45" cy="20" r="5" fill="#f3b64b" stroke="#2b1d1a" stroke-width="1.5"/>
    <circle cx="32" cy="35" r="15.5" fill="#f7c15c" stroke="#2b1d1a" stroke-width="1.7"/>
    <ellipse cx="32" cy="41" rx="7.5" ry="5.5" fill="#fff3d6"/>
    ${EYES(32, 7, 2.3)}<path d="M29 38h6l-3 3.2Z" fill="#7a3b1a"/>${SMILE(42.5)}`,

  "🐸": `
    <circle cx="21" cy="20" r="8" fill="#63b55a" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="43" cy="20" r="8" fill="#63b55a" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="32" cy="37" rx="20" ry="15" fill="#6ec264" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="32" cy="43" rx="13" ry="7" fill="#d7f0b6"/>
    <circle cx="21" cy="20" r="4.5" fill="#fff"/><circle cx="43" cy="20" r="4.5" fill="#fff"/>
    <circle cx="21.5" cy="20" r="2.3" fill="#241916"/><circle cx="42.5" cy="20" r="2.3" fill="#241916"/>
    ${CHEEKS(37, 13.5)}<path d="M23 39Q32 45.5 41 39" fill="none" stroke="#2b1d1a" stroke-width="2.1" stroke-linecap="round"/>`,

  "🐵": `
    <circle cx="13" cy="33" r="7" fill="#a8683a" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="13" cy="33" r="3.6" fill="#f3cca6"/>
    <circle cx="51" cy="33" r="7" fill="#a8683a" stroke="#2b1d1a" stroke-width="1.8"/><circle cx="51" cy="33" r="3.6" fill="#f3cca6"/>
    <circle cx="32" cy="34" r="18.5" fill="#9a5c32" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M18 33C18 24 26 23 32 28 38 23 46 24 46 33 46 43 40 49 32 49 24 49 18 43 18 33Z" fill="#f4cea8"/>
    ${EYES(32, 7.2, 2.5)}${CHEEKS(38.5, 10.5)}${SMILE(40.5)}`,

  "🐰": `
    <ellipse cx="23" cy="16" rx="5.5" ry="13" transform="rotate(-10 23 16)" fill="#fff7ec" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="23" cy="17" rx="2.7" ry="8.5" transform="rotate(-10 23 17)" fill="#f6b2be"/>
    <ellipse cx="41" cy="16" rx="5.5" ry="13" transform="rotate(10 41 16)" fill="#fff7ec" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="41" cy="17" rx="2.7" ry="8.5" transform="rotate(10 41 17)" fill="#f6b2be"/>
    <circle cx="32" cy="38" r="16.5" fill="#fff7ec" stroke="#2b1d1a" stroke-width="1.8"/>
    ${EYES(36, 7.5, 2.4)}${CHEEKS(42, 11)}<ellipse cx="32" cy="40.5" rx="2.5" ry="1.8" fill="#eb8096"/>${SMILE(43.5)}`,

  "🐱": `
    <path d="M14 27 16 10 29 19Z M50 27 48 10 35 19Z" fill="#f4b357" stroke="#2b1d1a" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M17 22 18.5 14 25 19Z M47 22 45.5 14 39 19Z" fill="#f7b5b8"/>
    <circle cx="32" cy="35" r="18" fill="#f7be69" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M12 35h7M13 39h6M45 35h7M45 39h6" stroke="#2b1d1a" stroke-width="1.6" stroke-linecap="round"/>
    ${EYES(33, 8, 2.5)}${CHEEKS(39, 11)}<path d="M29.5 38h5L32 41Z" fill="#e57a89"/>${SMILE(41.5)}`,

  "🐶": `
    <ellipse cx="14" cy="31" rx="7" ry="13" transform="rotate(14 14 31)" fill="#7d4f32" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="50" cy="31" rx="7" ry="13" transform="rotate(-14 50 31)" fill="#7d4f32" stroke="#2b1d1a" stroke-width="1.8"/>
    <circle cx="32" cy="34" r="17.5" fill="#d9a56c" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="24" cy="32" rx="6" ry="6.5" fill="#9a643d" fill-opacity=".45"/>
    <ellipse cx="32" cy="41" rx="8.5" ry="6.2" fill="#fff4e0"/>
    ${EYES(32, 7.5, 2.5)}<ellipse cx="32" cy="38.5" rx="3.8" ry="2.6" fill="#2b1d1a"/>
    <path d="M29 44Q32 48.5 35 44Z" fill="#ee7b87"/>${SMILE(41.5)}`,

  "🦉": `
    <path d="M15 22 19 11 27 18Z M49 22 45 11 37 18Z" fill="#8b6248" stroke="#2b1d1a" stroke-width="1.8" stroke-linejoin="round"/>
    <ellipse cx="32" cy="35" rx="19" ry="18" fill="#9e7153" stroke="#2b1d1a" stroke-width="1.8"/>
    <circle cx="24" cy="31" r="7.5" fill="#fff6e6" stroke="#2b1d1a" stroke-width="1.5"/>
    <circle cx="40" cy="31" r="7.5" fill="#fff6e6" stroke="#2b1d1a" stroke-width="1.5"/>
    <circle cx="24" cy="31" r="3.4" fill="#2b1d1a"/><circle cx="40" cy="31" r="3.4" fill="#2b1d1a"/>
    <circle cx="22.8" cy="29.8" r="1.2" fill="#fff"/><circle cx="38.8" cy="29.8" r="1.2" fill="#fff"/>
    <path d="M28.5 37 32 43 35.5 37Z" fill="#f3a83b" stroke="#2b1d1a" stroke-width="1.4" stroke-linejoin="round"/>`,

  "🐧": `
    <circle cx="32" cy="35" r="19" fill="#2d3848" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M17 37C17 24 25 22 32 28 39 22 47 24 47 37 47 47 40 53 32 53 24 53 17 47 17 37Z" fill="#fffaf0"/>
    ${EYES(32, 7.2, 2.5)}${CHEEKS(38.5, 11)}<path d="M27.5 37Q32 34.5 36.5 37L32 43Z" fill="#f59a38" stroke="#2b1d1a" stroke-width="1.4" stroke-linejoin="round"/>`,

  "🐢": `
    <ellipse cx="32" cy="36" rx="20" ry="16" fill="#5da65d" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M15 38Q32 49 49 38" fill="none" stroke="#386e3b" stroke-width="2"/>
    <circle cx="32" cy="34" r="17" fill="#77bf6a" stroke="#2b1d1a" stroke-width="1.8"/>
    ${EYES(31, 8, 2.5)}${CHEEKS(37.5, 12.5)}${SMILE(39)}`,

  "🦄": `
    <path d="M28 19 32 4 36 19Z" fill="#ffd166" stroke="#2b1d1a" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M17 25 19 13 26 20Z M47 25 45 13 38 20Z" fill="#fff9f4" stroke="#2b1d1a" stroke-width="1.6"/>
    <path d="M16 25C19 16 26 15 32 18 39 14 48 18 49 27" fill="#d97be3" stroke="#2b1d1a" stroke-width="1.5"/>
    <circle cx="32" cy="37" r="16.5" fill="#fffaf5" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="32" cy="44" rx="9" ry="5.5" fill="#f7c8dc"/>
    ${EYES(34, 7.5, 2.4)}${SMILE(43.5)}`,

  "🐙": `
    <circle cx="32" cy="30" r="17" fill="#de607c" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M16 42Q13 51 20 51 M24 44Q23 53 29 52 M40 44Q41 53 35 52 M48 42Q51 51 44 51" fill="none" stroke="#de607c" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M16 42Q13 51 20 51 M24 44Q23 53 29 52 M40 44Q41 53 35 52 M48 42Q51 51 44 51" fill="none" stroke="#2b1d1a" stroke-width="1.6" stroke-linecap="round"/>
    ${EYES(29, 7.5, 2.6)}${CHEEKS(35, 11.5)}${SMILE(36.5)}`,

  "🦔": `
    <circle cx="32" cy="33" r="22" fill="#6f4e37" stroke="#2b1d1a" stroke-width="1.8" stroke-dasharray="6 3"/>
    <circle cx="19" cy="23" r="4.5" fill="#d9b28a" stroke="#2b1d1a" stroke-width="1.5"/><circle cx="45" cy="23" r="4.5" fill="#d9b28a" stroke="#2b1d1a" stroke-width="1.5"/>
    <ellipse cx="32" cy="37" rx="16" ry="14" fill="#efd0ad" stroke="#2b1d1a" stroke-width="1.7"/>
    ${EYES(34, 7.5, 2.4)}${CHEEKS(40, 11)}<ellipse cx="32" cy="39" rx="3" ry="2.2" fill="#2b1d1a"/>${SMILE(42.5)}`,

  "🐝": `
    <ellipse cx="22" cy="18" rx="9" ry="6" transform="rotate(-24 22 18)" fill="#dff4ff" stroke="#2b1d1a" stroke-width="1.5"/>
    <ellipse cx="42" cy="18" rx="9" ry="6" transform="rotate(24 42 18)" fill="#dff4ff" stroke="#2b1d1a" stroke-width="1.5"/>
    <circle cx="32" cy="36" r="17" fill="#ffd147" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M17 31h30M17 41h30" stroke="#2b1d1a" stroke-width="4.5"/>
    <circle cx="32" cy="36" r="12.5" fill="#ffd147"/>
    ${EYES(34, 6.5, 2.4)}${CHEEKS(39.5, 9.5)}${SMILE(40.5)}`,

  "🐞": `
    <circle cx="32" cy="36" r="18" fill="#e24a3b" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M16 27C21 17 43 17 48 27Z" fill="#2b2426"/>
    <line x1="32" y1="27" x2="32" y2="54" stroke="#2b1d1a" stroke-width="2"/>
    <circle cx="23" cy="36" r="3" fill="#2b1d1a"/><circle cx="41" cy="36" r="3" fill="#2b1d1a"/>
    <circle cx="25" cy="46" r="2.5" fill="#2b1d1a"/><circle cx="39" cy="46" r="2.5" fill="#2b1d1a"/>
    <circle cx="27" cy="23" r="1.8" fill="#fff"/><circle cx="37" cy="23" r="1.8" fill="#fff"/>`,

  "🦋": `
    <ellipse cx="20" cy="28" rx="12" ry="10" transform="rotate(-18 20 28)" fill="#6cb4ee" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="44" cy="28" rx="12" ry="10" transform="rotate(18 44 28)" fill="#6cb4ee" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="22" cy="42" rx="9" ry="8" fill="#a27be8" stroke="#2b1d1a" stroke-width="1.8"/>
    <ellipse cx="42" cy="42" rx="9" ry="8" fill="#a27be8" stroke="#2b1d1a" stroke-width="1.8"/>
    <circle cx="20" cy="27" r="3.2" fill="#ffe17d"/><circle cx="44" cy="27" r="3.2" fill="#ffe17d"/>
    <rect x="29" y="21" width="6" height="26" rx="3" fill="#3a2a28"/>
    <path d="M30 22Q26 14 23 15 M34 22Q38 14 41 15" fill="none" stroke="#2b1d1a" stroke-width="1.8" stroke-linecap="round"/>`,

  "🐳": `
    <path d="M32 17V10M32 12Q27 7 24 10M32 12Q37 7 40 10" fill="none" stroke="#bce8ff" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="32" cy="36" rx="20" ry="15" fill="#4f9cd6" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M16 42C22 48 42 48 48 42 43 49 21 49 16 42Z" fill="#e6f5ff"/>
    ${EYES(34, 9, 2.5)}${CHEEKS(39.5, 13)}${SMILE(41)}`,

  "🦖": `
    <path d="M18 19 22 12 27 17 32 11 37 17 42 12 46 19" fill="#f3b64b" stroke="#2b1d1a" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="14" y="19" width="36" height="30" rx="14" fill="#63b567" stroke="#2b1d1a" stroke-width="1.8"/>
    <rect x="19" y="37" width="26" height="12" rx="6" fill="#cce89e"/>
    ${EYES(30, 8.5, 2.6)}${CHEEKS(36.5, 12.5)}<path d="M23 41h18" stroke="#2b1d1a" stroke-width="2" stroke-linecap="round"/>
    <path d="M26 41l2 3.5 2-3.5M34 41l2 3.5 2-3.5" fill="#fff"/>`,

  "🌻": `
    ${Array.from({ length: 12 }, (_, i) => `<ellipse cx="32" cy="12" rx="5.2" ry="9.5" fill="#f8c13b" stroke="#2b1d1a" stroke-width="1.3" transform="rotate(${i * 30} 32 32)"/>`).join("")}
    <circle cx="32" cy="32" r="14" fill="#5e3a24" stroke="#2b1d1a" stroke-width="1.8"/>
    <circle cx="27" cy="30" r="2.2" fill="#fff6e6"/><circle cx="37" cy="30" r="2.2" fill="#fff6e6"/>
    <path d="M27.5 36.5Q32 40.5 36.5 36.5" fill="none" stroke="#ffcf5c" stroke-width="2" stroke-linecap="round"/>`,

  "🍄": `
    <rect x="23" y="34" width="18" height="18" rx="7" fill="#fff3dc" stroke="#2b1d1a" stroke-width="1.8"/>
    <path d="M10 36C10 17 20 12 32 12 44 12 54 17 54 36Z" fill="#df513e" stroke="#2b1d1a" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="22" cy="24" r="4.2" fill="#fff6e6"/><circle cx="36" cy="20" r="4.8" fill="#fff6e6"/><circle cx="44" cy="29" r="3.4" fill="#fff6e6"/>
    <circle cx="28" cy="42" r="2" fill="#2b1d1a"/><circle cx="36" cy="42" r="2" fill="#2b1d1a"/>
    <path d="M29.5 46.5Q32 49 34.5 46.5" fill="none" stroke="#2b1d1a" stroke-width="1.7" stroke-linecap="round"/>`,

  "🤖": `
    <line x1="32" y1="16" x2="32" y2="9" stroke="#2b1d1a" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="32" cy="8.5" r="3.6" fill="#ffbf5e" stroke="#2b1d1a" stroke-width="1.6"/>
    <rect x="14" y="17" width="36" height="32" rx="10" fill="#89a8be" stroke="#2b1d1a" stroke-width="1.8"/>
    <rect x="19" y="23" width="26" height="12" rx="5" fill="#1e2a38"/>
    <circle cx="26.5" cy="29" r="3.2" fill="#6ee7b7"/><circle cx="37.5" cy="29" r="3.2" fill="#6ee7b7"/>
    <rect x="23" y="39" width="18" height="4.5" rx="2.2" fill="#2b3a4a"/>
    <path d="M27 39v4.5M32 39v4.5M37 39v4.5" stroke="#cfe2ef" stroke-width="1.5"/>`,
};

/** Render a cohesive storybook SVG badge for a known avatar id, or null if unknown. */
export function avatarSvg(id: string): string | null {
  const inner = ART[id];
  if (!inner) return null;
  return `<svg class="av-svg" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
}
