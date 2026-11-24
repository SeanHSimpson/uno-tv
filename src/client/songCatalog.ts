// Per-song lazy catalog: Vite splits each piece into its own tiny chunk so the TV only
// fetches the single piece it is about to play (and phones download none of them).

import { buildCanon, fromScore, korobeiniki, type Score, type Song } from "./songBuilder";

export interface SongEntry {
  name: string;
  composer: string;
  mode: "calm" | "game";
  load(): Promise<Song>;
}

const scoreSong = (
  name: string,
  composer: string,
  mode: "calm" | "game",
  importer: () => Promise<Score>,
  opts?: { sections?: [number, number][]; gain?: number },
): SongEntry => ({
  name,
  composer,
  mode,
  async load() {
    const s = await importer();
    return { name, composer, mode, bpm: s.bpm, build: () => fromScore(s, opts?.sections, opts?.gain) };
  },
});

export const SONG_CATALOG: SongEntry[] = [
  {
    name: "Korobeiniki",
    composer: "Russian Folk",
    mode: "game",
    load: async () => ({ name: "Korobeiniki", composer: "Russian Folk", mode: "game", bpm: 144, build: korobeiniki }),
  },
  scoreSong("In the Hall of the Mountain King", "Edvard Grieg", "game", () => import("./music/mountainKing").then((m) => m.MOUNTAIN_KING)),
  scoreSong("Minuet in G", "Christian Petzold", "game", () => import("./music/minuet").then((m) => m.MINUET), {
    sections: [[0, 48], [0, 48], [48, 96], [48, 96]],
  }),
  scoreSong("The Entertainer", "Scott Joplin", "game", () => import("./music/entertainer").then((m) => m.ENTERTAINER)),
  scoreSong("Maple Leaf Rag", "Scott Joplin", "game", () => import("./music/mapleLeaf").then((m) => m.MAPLE_LEAF)),
  scoreSong("Rondo alla Turca", "W. A. Mozart", "game", () => import("./music/allaTurca").then((m) => m.ALLA_TURCA)),
  scoreSong("Eine kleine Nachtmusik", "W. A. Mozart", "game", () => import("./music/nachtmusik").then((m) => m.NACHTMUSIK)),
  scoreSong("The Stars and Stripes Forever", "John Philip Sousa", "game", () => import("./music/starsStripes").then((m) => m.STARS_STRIPES)),
  scoreSong("The Liberty Bell March", "John Philip Sousa", "game", () => import("./music/libertyBell").then((m) => m.LIBERTY_BELL)),
  scoreSong("Marche militaire No. 1", "Franz Schubert", "game", () => import("./music/marcheMilitaire").then((m) => m.MARCHE_MILITAIRE)),
  scoreSong("Minute Waltz", "Frédéric Chopin", "game", () => import("./music/minuteWaltz").then((m) => m.MINUTE_WALTZ)),
  scoreSong("Nocturne Op. 9 No. 2", "Frédéric Chopin", "calm", () => import("./music/nocturne").then((m) => m.NOCTURNE)),
  scoreSong("Clair de Lune", "Claude Debussy", "calm", () => import("./music/clairDeLune").then((m) => m.CLAIR_DE_LUNE), { gain: 1.6 }),
  scoreSong("Für Elise", "Ludwig van Beethoven", "calm", () => import("./music/furElise").then((m) => m.FUR_ELISE)),
  scoreSong("Gymnopédie No. 1", "Erik Satie", "calm", () => import("./music/gymnopedie").then((m) => m.GYMNOPEDIE), { gain: 1.35 }),
  {
    name: "Canon in D",
    composer: "Johann Pachelbel",
    mode: "calm",
    async load() {
      const s = await import("./music/canon").then((m) => m.CANON);
      return { name: "Canon in D", composer: "Johann Pachelbel", mode: "calm", bpm: s.bpm, build: () => buildCanon(s) };
    },
  },
];
