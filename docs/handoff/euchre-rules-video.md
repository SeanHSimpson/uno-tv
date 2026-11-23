# Handoff: a "How to play Euchre" video with explainroo

Paste everything under **Prompt** into Claude Code, opened in this repo on your own computer.
It needs Node.js 20.11 or newer, ffmpeg and Chrome. The first run downloads about 860 MB of
voice and speech models, once.

---

## Prompt

Make a short explainer video that teaches the rules of Euchre the way this app plays it.
Use explainroo for it: run `npx --yes explainroo docs` and follow what it prints.
Run `npx --yes explainroo doctor --fetch` first and fix anything it reports missing.

**Audience and tone.** Family and friends about to play on the TV for the first time, some
who have never played Euchre. Warm and plain, like someone at the cabin explaining it over
the table. No jargon without saying what it means.

**Length and shape.** About 90 seconds, 16:9 for the TV and YouTube. Start from the
`narrated-explainer` format (`explainroo init videos/euchre-rules --format narrated-explainer`),
look `paper` or `midnight` (the app's Euchre table is a night lake scene, so midnight fits).
Set `"watermark": false` in `video.json`. Name YouTube chapters in the script.

**Facts.** Take every rule from the code, not from memory. House rules differ a lot, and the
video has to match this app. The rules engine is `src/shared/games/euchre/engine.ts` (its
header comment is a summary); bidding and scoring are in `order`, `call`, `startPlay` and
`scoreHand`. Defaults are in `EUCHRE_DEFAULTS`. In short, as of this handoff:

- 4 players in 2 teams of 2, partners sit across from each other. The teams are
  🦌 Deer Camp and 🌊 Lake Effect. Players pick sides on their phones before the deal, or
  partners are drawn at random (a setting).
- A 24-card deck: 9, 10, J, Q, K, A in each suit. 5 cards each, then one card is turned up.
- **Bidding, round 1:** starting left of the dealer, each player can "order up" the turned-up
  card's suit as trump, or pass. If someone orders it up, the dealer picks that card up and
  discards one.
- **Bidding, round 2:** if everyone passed, the card is turned down, and each player can name
  any *other* suit as trump, or pass. **Stick the dealer** is on by default: the dealer can't
  pass in round 2 and has to name trump. (If it's turned off and everyone passes again, the
  cards are thrown in and the next player deals.)
- **Going alone:** whoever names trump can go alone. Their partner sits out the hand.
- **Trump order:** the right bower (the Jack of trump) is highest, then the left bower (the
  other Jack of the same colour, which counts as trump for that hand), then A, K, Q, 10, 9 of
  trump. Show this one with a picture: it's the part new players find strangest.
- **Play:** the player left of the dealer leads the first trick. Follow the suit that was led
  if you can (the left bower counts as trump, not as its printed suit). Highest trump wins,
  otherwise the highest card of the led suit. The winner leads the next trick.
- **Scoring:** the team that named trump (the makers) takes 3 or 4 tricks: 1 point. All 5
  tricks: 2 points, or 4 if they went alone. Fewer than 3: they're **euchred**, and the other
  team scores 2. First team to 10 wins (the target is a setting).

**Show the real app too.** The game is played with one TV and everyone's phone. Close on a
few seconds of the real thing so people know what to expect: the TV table, then a phone with
the **Order it up / Pass / Go alone?** buttons and the hand sorted by suit. Run the app with
`npm run dev`, host a table at the printed local address, add 3 bot players from the phone
lobby, pick Euchre and deal. Use `explainroo record` or screenshots in a scene
(`explainroo docs` explains both). The deal now goes one card at a time from the deck to each
seat on the TV, and each phone shows its card as it lands; that makes a nice shot.

**Checks before you call it done.** Run explainroo's checks (`explainroo check videos/euchre-rules`)
and look at the stills it saves. Every rule in the narration must match the engine. If the
engine and this handoff disagree, the engine wins: tell me what differed.

**Output.** Don't commit the MP4 or other large render output: add `videos/*/out/` (or wherever
explainroo writes renders) to `.gitignore`. Commit only the project's source files
(`script.md`, `scenes.js`, `video.json`) on a new branch, so the video can be rebuilt. Tell me
the path of the finished MP4 and its length. Later we can make vertical versions for Shorts
and Reels and one video per game (OhNo!, Contract Rummy, Fizzle, Hush) the same way.
