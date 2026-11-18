# Game hub: one room, switchable games

## Why
Family game night: everyone joins once (scan the QR code, pick a name and picture),
plays OhNo!, then the host picks another game and the same people keep playing,
without anyone rejoining.

## Decisions (from the owner)
- **One room that switches games** (not a room per game).
- Original games inspired by the genres in the brief, with our own names and art. No
  clones of trademarked games. Where a traditional public-domain ancestor exists
  (Spite & Malice, contract rummy, tile rummy), use it.
- Order: hub + OhNo! as a module + **Hush** (cooperative "rising numbers" game) first;
  then a bomb-deck game and Spite & Malice; rummy-style games and the five-in-a-row
  board later (they need a phone-side board view).

## Architecture
```
Room (Durable Object, one per code)
 ├─ members: who's here (name, picture, colour, bot?, online?)   ← shared by every game
 ├─ host, TV audio settings, chosen game + per-game settings
 └─ game: state of the running GameModule (or null in the lobby)

GameModule (src/shared/games/<id>/module.ts): pure TypeScript, unit-tested
  meta (name, tagline, players, music mood), settings definitions + defaults
  start(members, settings) / action(state, pid, action, ctx) / join / leave / sync
  publicView(state) / privateView(state, pid)
  nextBot(state) → who should act and after what pause;  botActions(state, pid)
  status(state) → playing | over | abort
```
- The room does membership, host rules, kicking, bots' timing, avatars, TV audio,
  game selection and start/end. Modules only know their own rules.
- Wire: `{t:"state", room, game:{id, pub, me}|null, events:{room, game}}`.
  Client → room: `selectGame / settings / audio / start / endGame / addBot / kick / avatar`;
  client → game: `{t:"game", action}`.
- Settings are declared as data (`SettingDef[]`), so the lobby renders and validates
  them generically.
- Client: a TV shell and a phone shell (header, lobby/game picker, host menu, sound,
  reconnect) mount one *game view* per game (`src/client/games/<id>/{tv,phone}.ts`).

## Hush (new, original)
Cooperative. Cards 1–100. Level N: everyone gets N cards. Without talking, the table
plays all cards in rising order: anyone may play their lowest card at any time.
Playing while someone holds a lower card costs a ❤️, and those lower cards are
discarded. ⭐ stars: if everyone taps the star, each player discards their lowest
card. Rewards: ⭐ after levels 3, 6, 9; ❤️ after levels 4 and 8. Goal level is
auto (2p: 10, 3p: 9, 4+: 8) or set by the host. Before each level everyone taps
**Ready**, then a short countdown starts. Bots wait in proportion to the gap
between the last card and their lowest card.

## Left to the builder
Visual details of the hub cards and Hush table, exact bot timings, and any extra
host controls a module wants (provided through the host menu).
