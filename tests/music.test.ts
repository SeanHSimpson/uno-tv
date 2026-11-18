import { describe, expect, it } from "vitest";
import { SONGS } from "../src/client/audio";
import { newGame, updateSettings, joinPlayer } from "../src/shared/engine";

describe("music", () => {
  for (const song of SONGS) {
    it(`${song.name}: every bar has the right number of beats`, () => {
      const bars = song.melody
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);
      bars.forEach((bar, i) => {
        const beats = bar.split(/\s+/).reduce((sum, tok) => sum + Number(tok.split("/")[1]), 0);
        expect(beats, `bar ${i + 1}: ${bar}`).toBe(song.beatsPerBar);
      });
      const span = song.chordBeats ?? song.beatsPerBar;
      expect(song.chords.length * span).toBe(bars.length * song.beatsPerBar);
    });
  }

  it("has calm music for the lobby and lively music for play", () => {
    expect(SONGS.some((s) => s.mode === "calm")).toBe(true);
    expect(SONGS.filter((s) => s.mode === "game").length).toBeGreaterThanOrEqual(2);
  });
});

describe("TV audio settings", () => {
  it("host can toggle TV music and sounds", () => {
    const s = newGame("X");
    joinPlayer(s, "a", "Ann");
    expect(s.settings.tvMusic).toBe(true);
    updateSettings(s, "a", { tvMusic: false, tvSounds: false });
    expect(s.settings).toMatchObject({ tvMusic: false, tvSounds: false });
  });
});
