// Static playlist used by unit tests (tests/music.test.ts).
// At runtime, audio.ts uses songCatalog.ts so each piece is lazy-loaded on demand.

import { ALLA_TURCA } from "./music/allaTurca";
import { CANON } from "./music/canon";
import { CLAIR_DE_LUNE } from "./music/clairDeLune";
import { ENTERTAINER } from "./music/entertainer";
import { FUR_ELISE } from "./music/furElise";
import { GYMNOPEDIE } from "./music/gymnopedie";
import { LIBERTY_BELL } from "./music/libertyBell";
import { MAPLE_LEAF } from "./music/mapleLeaf";
import { MARCHE_MILITAIRE } from "./music/marcheMilitaire";
import { MINUET } from "./music/minuet";
import { MINUTE_WALTZ } from "./music/minuteWaltz";
import { MOUNTAIN_KING } from "./music/mountainKing";
import { NACHTMUSIK } from "./music/nachtmusik";
import { NOCTURNE } from "./music/nocturne";
import { STARS_STRIPES } from "./music/starsStripes";
import { buildCanon, fromScore, korobeiniki, KOROBEINIKI_BARS, midiOf, type MusicEvent, type Song, type Voice } from "./songBuilder";

export { KOROBEINIKI_BARS, midiOf, type MusicEvent, type Song, type Voice };

export const SONGS: Song[] = [
  { name: "Korobeiniki", composer: "Russian Folk", mode: "game", bpm: 144, build: korobeiniki },
  { name: "In the Hall of the Mountain King", composer: "Edvard Grieg", mode: "game", bpm: MOUNTAIN_KING.bpm, build: () => fromScore(MOUNTAIN_KING) },
  {
    name: "Minuet in G",
    composer: "Christian Petzold",
    mode: "game",
    bpm: MINUET.bpm,
    build: () => fromScore(MINUET, [[0, 48], [0, 48], [48, 96], [48, 96]]),
  },
  { name: "The Entertainer", composer: "Scott Joplin", mode: "game", bpm: ENTERTAINER.bpm, build: () => fromScore(ENTERTAINER) },
  { name: "Maple Leaf Rag", composer: "Scott Joplin", mode: "game", bpm: MAPLE_LEAF.bpm, build: () => fromScore(MAPLE_LEAF) },
  { name: "Rondo alla Turca", composer: "W. A. Mozart", mode: "game", bpm: ALLA_TURCA.bpm, build: () => fromScore(ALLA_TURCA) },
  { name: "Eine kleine Nachtmusik", composer: "W. A. Mozart", mode: "game", bpm: NACHTMUSIK.bpm, build: () => fromScore(NACHTMUSIK) },
  { name: "The Stars and Stripes Forever", composer: "John Philip Sousa", mode: "game", bpm: STARS_STRIPES.bpm, build: () => fromScore(STARS_STRIPES) },
  { name: "The Liberty Bell March", composer: "John Philip Sousa", mode: "game", bpm: LIBERTY_BELL.bpm, build: () => fromScore(LIBERTY_BELL) },
  { name: "Marche militaire No. 1", composer: "Franz Schubert", mode: "game", bpm: MARCHE_MILITAIRE.bpm, build: () => fromScore(MARCHE_MILITAIRE) },
  { name: "Minute Waltz", composer: "Frédéric Chopin", mode: "game", bpm: MINUTE_WALTZ.bpm, build: () => fromScore(MINUTE_WALTZ) },
  { name: "Nocturne Op. 9 No. 2", composer: "Frédéric Chopin", mode: "calm", bpm: NOCTURNE.bpm, build: () => fromScore(NOCTURNE) },
  { name: "Clair de Lune", composer: "Claude Debussy", mode: "calm", bpm: CLAIR_DE_LUNE.bpm, build: () => fromScore(CLAIR_DE_LUNE, undefined, 1.6) },
  { name: "Für Elise", composer: "Ludwig van Beethoven", mode: "calm", bpm: FUR_ELISE.bpm, build: () => fromScore(FUR_ELISE) },
  { name: "Gymnopédie No. 1", composer: "Erik Satie", mode: "calm", bpm: GYMNOPEDIE.bpm, build: () => fromScore(GYMNOPEDIE, undefined, 1.35) },
  { name: "Canon in D", composer: "Johann Pachelbel", mode: "calm", bpm: CANON.bpm, build: () => buildCanon(CANON) },
];
