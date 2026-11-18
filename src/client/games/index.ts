// The screens for each game. Add a new game's TV + phone views here.

import type { GameId } from "../../shared/games/types";
import { hushPhone } from "./hush/phone";
import { hushTv } from "./hush/tv";
import { ohnoPhone } from "./ohno/phone";
import { ohnoTv } from "./ohno/tv";
import { rummyPhone } from "./rummy/phone";
import { rummyTv } from "./rummy/tv";
import type { GameScreens } from "./types";

export const SCREENS: Record<GameId, GameScreens> = {
  ohno: { tv: ohnoTv, phone: ohnoPhone },
  hush: { tv: hushTv, phone: hushPhone },
  rummy: { tv: rummyTv, phone: rummyPhone },
};
