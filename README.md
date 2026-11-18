# OhNo! game night

Cozy party games for one TV and a room full of phones. **The TV is the table; everyone's phone is their hand.**

- Open the site on the TV → **Host on this screen** → a room code and QR code appear.
- Everyone scans the QR code (or types the 4-letter code) on their phone and picks a name and a picture.
- The first person to join is the **host**. They pick a game on their phone and start it (or press **Start / Enter** on the TV).
- When a game ends, the host picks the next one. **Everyone stays in the same room**, so nobody has to rejoin.

| Game | Players | In one line |
| --- | --- | --- |
| 🃏 **OhNo!** | 2–10 | Match colors or symbols and empty your hand first. |
| 🤫 **Hush** (co-op) | 2–6 | Play every number in rising order, together, without saying a word. |

Runs entirely on Cloudflare: one Worker serves the frontend, and every room is a Durable Object that owns the room, the running game and all of its WebSockets.

## OhNo!

Match the top card by **color** or **symbol**, or play a **Wild**. The first person to empty their hand wins.

| Card | Effect |
| --- | --- |
| Skip ⊘ | The next player loses their turn |
| Reverse ⇄ | Changes direction (with 2 players it acts like Skip) |
| +2 | The next player draws 2 and loses their turn |
| Wild (flower) | You pick the next color |
| Wild +4 | You pick the color; the next player draws 4 and loses their turn |

- **Who goes first** is chosen at random each round.
- **Auto-draw:** if you have nothing playable, the game draws for you. If the card you draw can be played, you choose to play it or keep it. Otherwise your turn passes. You can also draw on purpose with **Draw**.
- **Penalties apply automatically.** With stacking turned on, you can answer a +2 with a +2 or +4, or a +4 with a +4, to pass the growing pile along. If you can't, it's drawn for you.
- **OhNo!** Tap the big button when you're about to play your second-to-last card, or right after. If you forget, everyone else gets a **Catch!** button until the next card is played, and you draw 2 (or 4).
- **Scoring:** the winner of a round scores the cards left in everyone else's hands (number cards are worth their number, actions 20, wilds 50). Play a single round, or first to 200 or 500.
- Each color also has its own little shape (♥ red, ☀ yellow, 🍃 green, 💧 blue), so color-blind players can tell them apart.

### Playing cards on your phone

- **Swipe a card up** toward the TV to play it. The card glows once you've swiped far enough, and snaps back if you let go early.
- Or **tap a card** to raise it, then **tap it again** to play.
- On Android your phone vibrates when it's your turn. iPhones don't let websites vibrate, so you get a chime and a big "Your turn!" flash instead.

### Music & sound

The TV plays the music; phones play small sounds for their own player (the turn chime, your card hitting the table, the OhNo! sting, getting caught). All of it is synthesized in the browser, so there are no audio files.

| When | Music |
| --- | --- |
| Lobby & between rounds | Chopin, *Nocturne in E-flat, Op. 9 No. 2*: the complete piece (about 3½ min) |
| During play (rotates) | Grieg's *In the Hall of the Mountain King* (complete, with its slow build to a frantic finish, about 2½ min); Petzold/Bach's *Minuet in G* (complete, with repeats); *Korobeiniki* (the Russian folk song that the classic falling-blocks game made famous). The whole folk tune is only 8 bars, so it's arranged as four verses with harmony, an octave lift, and the traditional speed-up on each repeat |

- The music **speeds up** when anyone is down to their last card.
- Pressing **OhNo!** sets off a suspense sting on the TV: a rumble and rising tremolo, then *dun… dun… DUNNN*.
- **TV:** 🔊 button in the top bar, or press **M** to mute. The host can also turn the TV's music and sound effects on or off from ⚙︎ on their phone, even mid-game. Browsers only allow sound after a click, so if the TV page was refreshed, it shows "Click anywhere for music & sound".
- **Phones:** 🔊 button in the top corner. On iPhone, the silent switch also mutes web sounds.

All four pieces are public domain, played on a synthesized music box. The Chopin, Grieg and Petzold scores were converted from the [Mutopia Project](https://www.mutopiaproject.org)'s free MIDI files into note lists in `src/client/music/`:

- Chopin, Nocturne Op. 9 No. 2: [Mutopia #1590](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590), from the G. Schirmer 1881 edition, typeset by Renato Biolcati Rinaldi. CC BY-SA 3.0.
- Grieg, *In the Hall of the Mountain King* (Grieg's own piano arrangement): [Mutopia #1888](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1888), from The University Society 1918 edition. Public domain.
- Petzold, Minuet in G, BWV Anh. 114: [Mutopia, Notebook for Anna Magdalena Bach No. 4](https://www.mutopiaproject.org/ftp/BachJS/BWVAnh114/anna-magdalena-04/).

Very low notes are lifted an octave or two so a music box can sound them.

### Host controls (⚙︎ on the host's phone)

- House rules: game length, stacking, draw-one vs. draw-until-playable, and the forgot-OhNo! penalty.
- Remove a player (their cards are shuffled back into the deck).
- Skip the current player's turn. If someone's phone disconnects on their turn, *anyone* can skip them.
- End the game and return to the lobby, start the next round, or start a new game.

People can join in the middle of a round; they're dealt 7 cards. Refreshing a phone, or locking it and coming back, reconnects you to the same seat with the same hand.

### Bot players (great for testing on your own)

The host can tap **🤖 Add a bot player** in the lobby, or in ⚙︎ during a game (a bot added mid-round is dealt in). One person plus a bot is enough to start. Bots take their turns after a short pause, stack and play action cards sensibly, save wilds for later, usually remember to call OhNo! (sometimes they forget, so catch them!), and now and then catch *you*. Remove a bot with its **×** in the lobby, or **Remove** in ⚙︎. Bots run inside the room on the server, so they keep playing even if a phone locks.

### Connection tips

- Phones keep their screens awake during a game, so they don't lock and drop off.
- If a phone does drop (screen locked, Wi-Fi switching to mobile data), it reconnects by itself as soon as it's back, with the same hand. Short blips go unnoticed: "Reconnecting…" only shows if the connection stays down for a few seconds, and the TV waits 8 seconds before greying out a seat.
- A quiet heartbeat every 15 seconds keeps routers and mobile carriers from closing idle connections. The room answers it without waking up, so it costs nothing.
- If someone's phone is gone on their turn, anyone can tap "skip their turn".

## Hush

A cooperative game for 2–6 players, played in silence.

- Cards go from **1 to 100**. On **level N** everyone gets **N** cards.
- There are no turns and no talking. When it feels like your moment, play your **lowest** card: tap the big **Play** button, or swipe up on your cards. The whole table has to put every card down in rising order.
- If you play while someone still holds a lower card, the team loses a ❤️ and those lower cards are thrown away.
- ⭐ **Stars:** anyone can propose using one. When everyone holding cards agrees, each of them throws away their lowest card. Handy when the table is stuck.
- Before each level everyone taps **Ready**, then there's a hushed "Shh…" and play begins.
- **Rewards:** +⭐ after levels 3, 6 and 9; +❤️ after levels 4 and 8.
- Clear the goal level to win. Auto means 10 levels with 2 players, 9 with 3, and 8 with 4 or more. The host can choose 6, 8, 10 or 12 instead.
- On the TV, each card plays a music-box note pitched by its number, so a perfect level sounds like a rising melody. Cards also warm in color as the numbers rise.
- Bots make good teammates. They wait longer the bigger the gap between the last card and their own lowest, like quietly counting up in your head. They never peek at anyone's cards.

## Project layout

```
index.html                 Vite entry (single page; routes by query string)
public/                    favicon + web manifest
src/
  shared/                  Pure TypeScript, used by both server and browser, fully unit-tested
    common.ts              Members, avatars, names, errors, shuffle
    room.ts                The room: members, host, bots, game picking, settings, start/end, wire protocol
    games/
      types.ts             The GameModule contract every game implements
      index.ts             The list of games
      ohno/                OhNo! rules (engine.ts), bot (bot.ts), types, module.ts adapter
      hush/                Hush rules + bot timing (engine.ts), module.ts adapter
  server/
    index.ts               Worker entry + `Room` Durable Object (sockets, storage, bot timers)
  client/
    main.ts                Home / join screens and routing
    shell/tv.ts            TV shell: header, hub lobby (game picker + QR), music, mounts the running game
    shell/phone.ts         Phone shell: lobby/game picker, host menu, picture picker, sound, mounts the game
    games/<id>/tv.ts       Each game's TV view
    games/<id>/phone.ts    Each game's phone view
    games/index.ts         Which views belong to which game
    audio.ts             Synthesizer, music scheduler, sound effects, haptics
    songs.ts             The playlist (complete public-domain pieces + Korobeiniki arrangement)
    music/*.ts           Note lists converted from Mutopia Project MIDI files (credits inside)
    cards.ts             Original SVG card art (faces + backs)
    net.ts               PartySocket connection, room API, player id
    ui.ts, fx.ts         Helpers: avatars, toasts, fly animation, confetti, wake lock
    styles.css           Theme
tests/                     Rules tests per game, room tests, and bot-only full games for every game
wrangler.jsonc           Worker + Durable Object + static assets config
```

## Adding a game

1. **Rules:** create `src/shared/games/<id>/module.ts` exporting a `GameModule` (see `src/shared/games/types.ts`):
   - `meta`: name, tagline, how to play, emoji, player count, music mood
   - `settings` and `defaultSettings`: the lobby shows these as buttons and validates them for you
   - `start`, `action`, `join`, `leave`, `sync`
   - `publicView` (what the TV and everyone sees) and `privateView` (one player's secrets)
   - `nextBot` and `botActions`, so people can play with bots
   - `status`: playing, over, or abort
   Keep it pure (no I/O) so it's easy to test.
2. **Register it:** add it to `GAMES`/`GAME_ORDER` in `src/shared/games/index.ts` and add its id to `GameId`.
3. **Screens:** create `src/client/games/<id>/tv.ts` and `phone.ts`. Each returns a `GameView` with `update` and `destroy`, plus optional `hostMenu`, `onEnter` and `onError`. Register them in `src/client/games/index.ts`. The shells already handle the lobby, host menu, avatars, sound, reconnecting and bots.
4. **Tests:** rule tests, plus a "bots play it to the end" test through the room (see `tests/room.test.ts`).

**How it fits together**

```
Phone / TV  ──WebSocket──►  Worker  /parties/room/ABCD  ──►  Room Durable Object "ABCD"
                         ◄─ state ─                                 │ game state (DO storage)
TV "Host" ──POST /api/rooms──► Worker picks a free code, initialises the DO
```

- The engine (`src/shared/engine.ts`) is pure TypeScript with no I/O, so it's fully unit-tested. The Durable Object just validates who's asking, calls the engine, saves the state and sends updates.
- After every action, each connection gets the public state plus **only its own hand**. The TV never receives anyone's cards.
- Each update carries the list of events (`play`, `draw`, `skip`, `caught`, …) so the TV can animate cards flying from seats to the pile.
- Rooms use WebSocket **hibernation** (an idle room costs nothing) and save their state to Durable Object storage, so nothing is lost when a room is evicted from memory. Rooms delete themselves after 6 idle hours.

## Local development

Requires Node 20+.

```bash
npm install
npm run dev        # Vite + the Worker/Durable Object running in workerd, on http://localhost:5173
```

Open `http://localhost:5173` on your computer and click **Host on this screen**. The QR code automatically uses your computer's Wi-Fi address (for example `http://192.168.1.20:5173`), so phones on the same Wi-Fi can scan and join straight away. If your firewall asks, allow Node on private networks.

Other scripts:

```bash
npm test           # rules engine tests (vitest)
npm run typecheck  # browser + worker TypeScript projects
npm run build      # typecheck + production build into dist/
npm run preview    # build, then serve the production bundle locally (also on your LAN)
npx wrangler dev   # after `npm run build`: run the built Worker with wrangler directly
npm run types      # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

## Deploying to Cloudflare

You need a free Cloudflare account. Durable Objects with SQLite storage are included in the Workers Free plan.

```bash
npx wrangler login     # once, opens the browser
npm run deploy         # = build + wrangler deploy
```

Wrangler prints your URL, for example `https://ohno.<your-subdomain>.workers.dev`. Open it on the TV and you're playing; the QR code points at the same address.

- **Custom domain:** in the Cloudflare dashboard go to *Workers & Pages → ohno → Settings → Domains & Routes → Add → Custom domain*. Or add `"routes": [{ "pattern": "ohno.example.com", "custom_domain": true }]` to `wrangler.jsonc`.
- **Logs:** `npx wrangler tail`. Observability is enabled in `wrangler.jsonc`.
- **Deploy from GitHub:** in the dashboard use *Workers & Pages → Create → Import a repository*, with build command `npm run build` and deploy command `npx wrangler deploy`.

> **Why not Cloudflare Pages?** Cloudflare now recommends serving static assets from Workers. One Worker serves the site *and* hosts the rooms, so there's one config, one deploy, and the frontend and backend are always the same version.

## Ideas for what's next

- **More music:** add public-domain pieces to `SONGS` in `src/client/songs.ts`. Mutopia's MIDI files can be converted into the same note-list format as the files in `src/client/music/`.
- **More house rules:** 7-0 (a 7 swaps hands, a 0 rotates everyone's hands), jump-in (play an identical card out of turn), challenging a Wild +4 (only legal when you have no card of the current color), and draw-until-playable with forced play.
- **Turn timer:** an optional countdown ring on the TV seat, with auto-draw when it runs out. It's a good fit for a Durable Object alarm.
- **Spectators:** a third connection role that sees the table but has no hand, for a second TV or someone following along remotely.
- **Remote play:** since rooms are on the internet now, a "no TV" mode where each phone also shows a small table view lets relatives play from other houses (add a video call and you're set).
- **Sorting and quick-play options:** let players choose to sort by color or by number, and turn on single-tap play for experienced players.
- **Stats:** keep lifetime wins per name in the Durable Object, or in D1, for bragging rights.
- **TV remote navigation:** arrow-key focus for the Start / Next buttons on TV browsers that don't have a mouse.
- **PWA install / offline shell:** the manifest is already there; a small service worker would make "Add to Home Screen" open instantly.
