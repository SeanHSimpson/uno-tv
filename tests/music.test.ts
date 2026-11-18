import { describe, expect, it } from "vitest";
import { KOROBEINIKI_BARS, SONGS } from "../src/client/songs";

describe("music", () => {
  it("Korobeiniki: every bar of the folk melody has 4 beats", () => {
    KOROBEINIKI_BARS.forEach((bar, i) => {
      const beats = bar.split(" ").reduce((sum, tok) => sum + Number(tok.split("/")[1]), 0);
      expect(beats, `bar ${i + 1}: ${bar}`).toBe(4);
    });
  });

  for (const song of SONGS) {
    it(`${song.name}: builds a complete, well-formed piece`, () => {
      const { events, length } = song.build();
      const seconds = (length * 60) / song.bpm;
      expect(seconds).toBeGreaterThan(40); // full pieces, not excerpts
      expect(events.length).toBeGreaterThan(150);
      let last = -1;
      for (const e of events) {
        expect(e.beat).toBeGreaterThanOrEqual(last); // sorted for the scheduler
        last = e.beat;
        expect(e.beat).toBeLessThan(length);
        expect(e.dur).toBeGreaterThan(0);
        expect(e.vel).toBeGreaterThan(0);
        expect(e.vel).toBeLessThanOrEqual(1);
        if (e.voice !== "shaker") {
          expect(e.midi).toBeGreaterThanOrEqual(21);
          expect(e.midi).toBeLessThanOrEqual(108);
        }
      }
      expect(events.some((e) => e.voice === "lead")).toBe(true);
    });
  }

  it("Minuet plays with its repeats (A A B B)", () => {
    const minuet = SONGS.find((s) => s.name === "Minuet in G")!.build();
    expect(minuet.length).toBe(192);
    const leadsAt = (b: number) => minuet.events.find((e) => e.voice === "lead" && e.beat === b)?.midi;
    expect(leadsAt(0)).toBe(74); // D5 opens A
    expect(leadsAt(48)).toBe(74); // A again
    expect(leadsAt(96)).toBe(83); // B5 opens B
    expect(leadsAt(144)).toBe(83); // B again
  });

  it("has calm music for the lobby and lively music for play", () => {
    expect(SONGS.some((s) => s.mode === "calm")).toBe(true);
    expect(SONGS.filter((s) => s.mode === "game").length).toBeGreaterThanOrEqual(3);
  });
});
