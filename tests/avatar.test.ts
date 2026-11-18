import { describe, expect, it } from "vitest";
import { addBot, joinPlayer, newGame, publicView, setAvatar } from "../src/shared/engine";

describe("avatars", () => {
  it("players can pick a picture when joining, and change it later", () => {
    const s = newGame("X");
    joinPlayer(s, "a", "Ann", Math.random, "🦊");
    expect(publicView(s).players[0]!.avatar).toBe("🦊");
    setAvatar(s, "a", "🐢");
    expect(publicView(s).players[0]!.avatar).toBe("🐢");
  });

  it("only accepts pictures from the list", () => {
    const s = newGame("X");
    joinPlayer(s, "a", "Ann", Math.random, "<img src=x>");
    expect(publicView(s).players[0]!.avatar).toBeNull();
    expect(() => setAvatar(s, "a", "💩💩")).toThrow(/pictures/);
  });

  it("reconnecting keeps the picture unless a new one is sent", () => {
    const s = newGame("X");
    joinPlayer(s, "a", "Ann", Math.random, "🐼");
    joinPlayer(s, "a", "Ann", Math.random, "");
    expect(s.players[0]!.avatar).toBe("🐼");
    joinPlayer(s, "a", "Ann", Math.random, "🦉");
    expect(s.players[0]!.avatar).toBe("🦉");
  });

  it("bots are flagged so they show the robot", () => {
    const s = newGame("X");
    joinPlayer(s, "a", "Ann");
    addBot(s, "a");
    expect(publicView(s).players[1]).toMatchObject({ bot: true, avatar: null });
  });
});
