// The grand piano the music plays on: the Salamander Grand Piano by Alexander Holm (CC BY 3.0),
// one recorded note every three keys from A0 to C8, kept in public/piano/. Notes in between are
// the nearest recording, bent up or down a semitone.

const NAMES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const LOW = 21; // A0
const HIGH = 108; // C8
const STEP = 3;

const fileOf = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;

/** Every recording, low to high (what public/piano must contain). */
export const PIANO_FILES: string[] = [];
export const PIANO_NOTES: number[] = [];
for (let m = LOW; m <= HIGH; m += STEP) {
  PIANO_NOTES.push(m);
  PIANO_FILES.push(fileOf(m));
}

/** Which recording plays `midi`, and the playback rate that tunes it. */
export function pianoSample(midi: number): { sampleMidi: number; file: string; rate: number } {
  const m = Math.max(LOW, Math.min(HIGH, Math.round(midi)));
  const sampleMidi = LOW + Math.round((m - LOW) / STEP) * STEP;
  return { sampleMidi, file: fileOf(sampleMidi), rate: Math.pow(2, (m - sampleMidi) / 12) };
}
