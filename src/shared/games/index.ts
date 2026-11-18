// Every game the hub can host. Add new games here (and their views in src/client/games).

import { hush } from "./hush/module";
import { ohno } from "./ohno/module";
import { rummy } from "./rummy/module";
import type { GameId, GameModule } from "./types";

export const GAMES: Record<GameId, GameModule> = { ohno, hush, rummy };
export const GAME_ORDER: GameId[] = ["ohno", "rummy", "hush"];
export const isGameId = (x: unknown): x is GameId => typeof x === "string" && x in GAMES;
