// The music: complete public-domain pieces, played on a synthesized music box.
//
// - Chopin's Nocturne Op. 9 No. 2, Grieg's "In the Hall of the Mountain King" (his own
//   piano version) and Petzold's Minuet in G come from the Mutopia Project's free MIDI
//   files, converted to note lists in ./music (see the credits at the top of each file).
// - Korobeiniki is a short Russian folk tune (the whole song is 8 bars), so it gets a
//   hand-written arrangement: four verses with harmony, an octave lift and the
//   traditional speed-up on every repeat.

import { MINUET } from "./music/minuet";
import { MOUNTAIN_KING } from "./music/mountainKing";
import { NOCTURNE } from "./music/nocturne";

export type Voice = "lead" | "harmony" | "bass" | "shaker";
export type MusicEvent = { beat: number; dur: number; midi: number; voice: Voice; vel: number };

export interface Song {
  name: string;
  /** "calm" plays in the lobby / between rounds, "game" during play. */
  mode: "calm" | "game";
  bpm: number;
  build(): { events: MusicEvent[]; length: number };
}

// ---------- scores converted from MIDI ----------

type Score = { bpm: number; unitsPerBeat: number; length: number; notes: number[] };
const VOICES: Voice[] = ["lead", "harmony", "bass"];

/** Turn a converted score into events, optionally replaying [from, to) beat sections (for repeats). */
function fromScore(score: Score, sections?: [number, number][]) {
  const all: MusicEvent[] = [];
  const u = score.unitsPerBeat;
  for (let i = 0; i < score.notes.length; i += 5) {
    const [start, dur, midi, voice, vel] = score.notes.slice(i, i + 5) as [number, number, number, number, number];
    all.push({ beat: start / u, dur: dur / u, midi, voice: VOICES[voice]!, vel: vel / 127 });
  }
  const parts = sections ?? [[0, score.length / u]];
  const events: MusicEvent[] = [];
  let offset = 0;
  for (const [from, to] of parts) {
    for (const e of all) if (e.beat >= from && e.beat < to) events.push({ ...e, beat: e.beat - from + offset });
    offset += to - from;
  }
  events.sort((a, b) => a.beat - b.beat);
  return { events, length: offset };
}

// ---------- hand-written melodies ----------

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midiOf(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`bad note ${note}`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]!]! + acc;
}

/** Korobeiniki, the complete folk melody (A minor, 4/4). One string per bar. */
export const KOROBEINIKI_BARS = [
  "E5/1 B4/.5 C5/.5 D5/1 C5/.5 B4/.5",
  "A4/1 A4/.5 C5/.5 E5/1 D5/.5 C5/.5",
  "B4/1.5 C5/.5 D5/1 E5/1",
  "C5/1 A4/1 A4/1 r/1",
  "r/.5 D5/1 F5/.5 A5/1 G5/.5 F5/.5",
  "E5/1.5 C5/.5 E5/1 D5/.5 C5/.5",
  "B4/1 B4/.5 C5/.5 D5/1 E5/1",
  "C5/1 A4/1 A4/1 r/1",
];
const KOROBEINIKI_CHORDS = ["Am", "Am", "E", "Am", "Dm", "C", "E", "Am"];
const CHORD_ROOTS: Record<string, number> = { Am: 45, E: 40, Dm: 38, C: 36 };

/** Diatonic third below in A minor (raised to G# over an E chord). */
function thirdBelow(midi: number, chord: string): number {
  const scale = [9, 11, 0, 2, 4, 5, 7];
  const pc = midi % 12;
  const i = scale.indexOf(pc);
  if (i < 0) return midi - 3;
  const target = scale[(i + 5) % 7]!;
  let h = midi - ((pc - target + 12) % 12);
  if (h === midi) h -= 12;
  if (chord === "E" && h % 12 === 7) h += 1;
  return h;
}

function korobeiniki() {
  const events: MusicEvent[] = [];
  let at = 0;
  // verse: [octave shift, speed, add harmony]
  const verses: [number, number, boolean][] = [
    [0, 1, false],
    [0, 1, true],
    [12, 1.12, false],
    [0, 1.25, true],
  ];
  for (const [shift, speed, harmony] of verses) {
    KOROBEINIKI_BARS.forEach((bar, b) => {
      const chord = KOROBEINIKI_CHORDS[b]!;
      const barStart = at + (b * 4) / speed;
      let beat = 0;
      for (const tok of bar.split(" ")) {
        const [n, d] = tok.split("/");
        const dur = Number(d);
        if (n !== "r") {
          const midi = midiOf(n!) + shift;
          events.push({ beat: barStart + beat / speed, dur: dur / speed, midi, voice: "lead", vel: 0.8 });
          if (harmony) events.push({ beat: barStart + beat / speed, dur: dur / speed, midi: thirdBelow(midi, chord), voice: "harmony", vel: 0.7 });
        }
        beat += dur;
      }
      const root = CHORD_ROOTS[chord]!;
      [root, root + 7, root + 12, root + 7].forEach((m, k) =>
        events.push({ beat: barStart + k / speed, dur: 0.9 / speed, midi: m, voice: "bass", vel: 0.8 }),
      );
      for (let k = 0; k < 4; k++) events.push({ beat: barStart + (k + 0.5) / speed, dur: 0.1, midi: 0, voice: "shaker", vel: 1 });
    });
    at += 32 / speed;
  }
  // Big finish: a held A minor chord.
  for (const m of [45, 57, 60, 64, 69]) events.push({ beat: at, dur: 3, midi: m, voice: m < 50 ? "bass" : "harmony", vel: 1 });
  events.sort((a, b) => a.beat - b.beat);
  return { events, length: at + 4 };
}

// ---------- the playlist ----------

export const SONGS: Song[] = [
  { name: "Korobeiniki", mode: "game", bpm: 144, build: korobeiniki },
  { name: "In the Hall of the Mountain King", mode: "game", bpm: MOUNTAIN_KING.bpm, build: () => fromScore(MOUNTAIN_KING) },
  {
    name: "Minuet in G",
    mode: "game",
    bpm: MINUET.bpm,
    // The score repeats each half: A A B B.
    build: () => fromScore(MINUET, [[0, 48], [0, 48], [48, 96], [48, 96]]),
  },
  { name: "Nocturne Op. 9 No. 2", mode: "calm", bpm: NOCTURNE.bpm, build: () => fromScore(NOCTURNE) },
];
