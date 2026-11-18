// Every game the hub can host. Add new games here (and their views in src/client/games).

import { euchre } from "./euchre/module";
import { fizzle } from "./fizzle/module";
import { hush } from "./hush/module";
import { ohno } from "./ohno/module";
import { rummy } from "./rummy/module";
import type { GameId, GameModule } from "./types";

export const GAMES: Record<GameId, GameModule> = { ohno, hush, rummy, fizzle, euchre };
export const GAME_ORDER: GameId[] = ["ohno", "euchre", "rummy", "fizzle", "hush"];
export const isGameId = (x: unknown): x is GameId => typeof x === "string" && x in GAMES;
