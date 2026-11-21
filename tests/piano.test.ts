import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PIANO_FILES, pianoSample } from "../src/client/piano";
import { SONGS } from "../src/client/songs";

describe("grand piano samples", () => {
  it("every sample the game asks for is in public/piano", () => {
    const have = new Set(readdirSync("public/piano"));
    expect(PIANO_FILES).toHaveLength(30);
    for (const f of PIANO_FILES) expect(have.has(f)).toBe(true);
  });
  it("uses the recorded note itself when there is one", () => {
    expect(pianoSample(69)).toEqual({ sampleMidi: 69, file: "A4.mp3", rate: 1 });
    expect(pianoSample(60).file).toBe("C4.mp3");
    expect(pianoSample(63).file).toBe("Ds4.mp3");
  });
  it("bends the nearest recording for notes in between", () => {
    const s = pianoSample(70);
    expect(s.file).toBe("A4.mp3");
    expect(s.rate).toBeCloseTo(Math.pow(2, 1 / 12));
    expect(pianoSample(68).rate).toBeCloseTo(Math.pow(2, -1 / 12));
  });
  it("stays on the keyboard", () => {
    expect(pianoSample(10).file).toBe("A0.mp3");
    expect(pianoSample(120).file).toBe("C8.mp3");
  });
});

describe("new upbeat songs", () => {
  for (const name of ["The Liberty Bell", "Marche militaire", "Minute Waltz"]) {
    it(`${name} is in the game playlist and builds`, () => {
      const song = SONGS.find((s) => s.name.includes(name));
      expect(song?.mode).toBe("game");
      const { events, length } = song!.build();
      expect(events.length).toBeGreaterThan(500);
      expect(length).toBeGreaterThan(100);
      expect(events.some((e) => e.voice === "lead") && events.some((e) => e.voice === "bass")).toBe(true);
    });
  }
});
