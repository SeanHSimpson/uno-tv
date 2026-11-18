# OhNo!

A cozy shed-your-hand card game for family game night. **The TV is the table; everyone's phone is their hand.**

- Open the site on the TV → **Host on this screen** → a room code and QR code appear.
- Everyone scans the QR code (or types the 4-letter code) on their phone and picks a name.
- The first person to join is the **host** and deals from their phone (or press **Start / Enter** on the TV).

Runs entirely on Cloudflare: one Worker serves the frontend, and every room is a Durable Object that owns the game state and all of the room's WebSockets.

## How to play

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

### Host controls (⚙︎ on the host's phone)

- House rules: game length, stacking, draw-one vs. draw-until-playable, and the forgot-OhNo! penalty.
- Remove a player (their cards are shuffled back into the deck).
- Skip the current player's turn. If someone's phone disconnects on their turn, *anyone* can skip them.
- End the game and return to the lobby, start the next round, or start a new game.

People can join in the middle of a round; they're dealt 7 cards. Refreshing a phone, or locking it and coming back, reconnects you to the same seat with the same hand.

## Project layout

```
index.html               Vite entry (single page; routes by query string)
public/                  favicon + web manifest
src/
  shared/
    types.ts             Card / state / wire-protocol types (shared by client + server)
    engine.ts            Pure rules engine: deal, play, draw, stacking, OhNo!, scoring, host actions
  server/
    index.ts             Worker entry + `Room` Durable Object (PartyServer, hibernating WebSockets)
  client/
    main.ts              Home / join screens and routing
    tv.ts                TV table: seats, piles, direction ring, animations, lobby, results
    phone.ts             Phone hand: auto-fitting card grid, color picker, OhNo!/Catch, host sheet
    cards.ts             Original SVG card art (faces + backs)
    net.ts               PartySocket connection, room API, player id
    ui.ts, fx.ts         Helpers: avatars, toasts, fly animation, confetti, wake lock
    styles.css           Theme
tests/engine.test.ts     Rules tests, plus 200 simulated full games
wrangler.jsonc           Worker + Durable Object + static assets config
```

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

- **Sound:** a soft card "thwip", a shuffle, an OhNo! chime, and a turn ding on phones. Use Web Audio synthesis or tiny OGG files, with a mute toggle on the TV.
- **More house rules:** 7-0 (a 7 swaps hands, a 0 rotates everyone's hands), jump-in (play an identical card out of turn), challenging a Wild +4 (only legal when you have no card of the current color), and draw-until-playable with forced play.
- **Turn timer:** an optional countdown ring on the TV seat, with auto-draw when it runs out. It's a good fit for a Durable Object alarm.
- **Spectators:** a third connection role that sees the table but has no hand, for a second TV or someone following along remotely.
- **Remote play:** since rooms are on the internet now, a "no TV" mode where each phone also shows a small table view lets relatives play from other houses (add a video call and you're set).
- **Sorting and quick-play options:** let players choose to sort by color or by number, and turn on single-tap play for experienced players.
- **Stats:** keep lifetime wins per name in the Durable Object, or in D1, for bragging rights.
- **TV remote navigation:** arrow-key focus for the Start / Next buttons on TV browsers that don't have a mouse.
- **PWA install / offline shell:** the manifest is already there; a small service worker would make "Add to Home Screen" open instantly.
