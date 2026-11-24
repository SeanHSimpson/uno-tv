// Concise visual quick-reference rules sheets for every game in the hub.

import { GAMES } from "../shared/games";
import type { GameId } from "../shared/games/types";
import { HOWTO } from "./games/euchre/cards";
import { gameEmblem, icoPlay } from "./icons";
import { esc } from "./ui";

export function rulesBodyHtml(id: GameId, settings: Record<string, unknown> = {}): string {
  const m = GAMES[id].meta;
  const head = `<div class="rules-head">${gameEmblem(id, "rules-emblem")}<div><h3>${esc(m.name)}</h3><small>${esc(m.tagline)}</small></div></div>`;
  switch (id) {
    case "ohno":
      return `${head}
        <div class="rules-list">
          <div><b>Play:</b> Match the top card's <b>color</b> or <b>symbol</b>, or play a <b>Wild</b>. Swipe up (or tap twice — turn on <b>1-tap</b> in the toolbar to play faster).</div>
          <div><b>Actions:</b> <b>⊘ Skip</b> skips next · <b>⇄ Reverse</b> flips order · <b>+2</b> / <b>Wild +4</b> makes next player draw.</div>
          <div><b>OhNo!:</b> Tap the big red button when dropping to 1 card — otherwise anyone can <b>Catch!</b> you for +${settings.catchPenalty ?? 2} cards.</div>
          ${settings.stacking ? `<div><b>Stacking is ON:</b> Answer +2 with +2 or +4, and +4 with +4.</div>` : ""}
          ${settings.sevenZero ? `<div><b>7–0 is ON:</b> Playing a <b>7</b> swaps hands with the next player; playing a <b>0</b> rotates every hand!</div>` : ""}
          <div><b>Scoring:</b> Winner scores leftover hands (numbers = face value, actions = 20, wilds = 50).</div>
        </div>`;
    case "euchre":
      return `${head}
        <div class="rules-list">
          <div><b>Trump order (high → low):</b> <b>Right Bower</b> (Jack of trump) → <b>Left Bower</b> (other Jack of the same color) → A, K, Q, 10, 9.</div>
          <div><b>Bidding:</b> Round 1: order up the turned card (dealer picks it up &amp; discards) or pass. Round 2: name any other suit${settings.stick !== false ? " (dealer must pick if all pass)" : ""}.</div>
          <div><b>Playing:</b> You must follow the suit led if you can (the Left Bower counts as trump).</div>
          <div><b>Scoring:</b> Makers take 3–4 tricks = <b>+1</b> · all 5 = <b>+2</b> (<b>+4</b> going alone) · fewer than 3 = <b>Euchred!</b> Defenders get <b>+2</b>. First to <b>${settings.target ?? 10}</b> wins.</div>
          <a class="btn btn-ghost wide" href="${HOWTO}.mp4" target="_blank" rel="noopener">${icoPlay(15)} Watch 3-minute rules video</a>
        </div>`;
    case "rummy":
      return `${head}
        <div class="rules-list">
          <div><b>Turn:</b> 1) Draw from deck or discard · 2) Lay down your contract · 3) Once down, add cards to <i>anyone's</i> groups · 4) Discard 1 card.</div>
          <div><b>Groups:</b> <b>Set</b> = 3+ same rank · <b>Run</b> = 4+ in a row of one suit (A low or high). Jokers are wild (max half of any group).</div>
          <div class="rules-contracts">
            <b>Contracts (${settings.rounds === 4 ? "Short 4" : "Classic 7"}):</b>
            ${
              settings.rounds === 4
                ? `<span>1: 2 sets of 3</span><span>2: 1 set + 1 run</span><span>3: 2 runs of 4</span><span>4: 3 runs of 4</span>`
                : `<span>1: 2 sets (3)</span><span>2: 1 set + 1 run</span><span>3: 2 runs (4)</span><span>4: 3 sets (3)</span><span>5: 2 sets + 1 run</span><span>6: 1 set + 2 runs</span><span>7: 3 runs (4)</span>`
            }
          </div>
          ${settings.mayI !== false ? `<div><b>“May I?”:</b> Out of turn, tap the discard twice to buy it (+1 penalty card from deck) if the active player draws from the deck. 3 per round.</div>` : ""}
          <div><b>Scoring (lowest wins):</b> 2–9 = <b>5</b> · 10–K = <b>10</b> · Ace = <b>15</b> · Joker = <b>50</b>.</div>
        </div>`;
    case "fizzle":
      return `${head}
        <div class="rules-list">
          <div><b>Turn:</b> Play any action cards you want, then <b>Draw</b> 1 card. Last player standing wins.</div>
          <div><b>Firecrackers:</b> Draw one and its 2-turn fuse lights in front of you. By your next turn you must <b>Water</b> or <b>Toss</b> it — or 💥 you're out!</div>
          <div><b>Cards:</b> <b>Water</b> douses your firecracker · <b>Toss</b> passes it to another player · <b>Peek</b> sees top 3 cards · <b>Shuffle</b> mixes the deck · <b>Nap</b> ends turn without drawing · <b>Fish</b> draws from the bottom.</div>
        </div>`;
    case "hush":
      return `${head}
        <div class="rules-list">
          <div><b>Co-op silence:</b> Everyone gets N cards (1–100) on Level N. No turns and no talking!</div>
          <div><b>Play:</b> Swipe up or tap <b>Play</b> to drop your lowest card when the timing feels right. Every card must land in rising order.</div>
          <div><b>Mistakes:</b> If anyone still held a lower card, those cards are discarded and the team loses <b>1 Heart</b>.</div>
          <div><b>Stars:</b> When everyone holding cards agrees, a Star lets everyone discard their lowest card at once. Bonus Stars after levels 3, 6, 9; bonus Hearts after 4, 8.</div>
        </div>`;
  }
}
