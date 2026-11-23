# How to play Euchre

> Every rule here comes from src/shared/games/euchre/engine.ts (EUCHRE_DEFAULTS: first to 10, stick the dealer on).
> Checked against North American euchre at https://www.pagat.com/euchre/euchre.html (24 cards, no joker, game to 10).
> Not in this app, so not said here: a defender going alone, a joker as best bower, and the rule that the dealer's partner must go alone to order the card up.
> Here that partner may order it up and still play, unless they choose to go alone. If they do, the dealer sits out and the turned card is not picked up (order()).

## teams {chapter="Teams and cards"}
Euchre is [#teams] four players, in two teams of two. [#partner] Your partner sits across from you. [#share] Tricks you win count for both of you. These teams are [#deer] Deer Camp and [#lake] Lake Effect.

## deck
The deck has [#deck] {24|twenty-four} cards, [#ranks] nine through ace in each suit. [#deal] Each player gets five cards. [#up] One card is turned face up.

## round1 {chapter="Picking trump" transition=push}
[#trump] Trump is the suit that beats every other suit. [#left] Bidding starts left of the dealer. [#order] A player may order up the turned card, or [#pass] pass. [#means] Order it up, and that suit becomes trump. [#pickup] The dealer picks the card up and throws one away. [#whose] The dealer does that even when an opponent ordered it.

## round2 {transition=push}
[#down] If everyone passes, the card is turned down. [#name] A player may name a different suit. [#except] Any suit except the one turned down. [#nocard] Nobody picks up a card in this round. [#stick] If the other three pass, the dealer must name a suit. That is stick the dealer.

## alone {chapter="Going alone" transition=push}
[#who] Going alone means you play without your partner. [#when] Only the player who just made trump can do it, and they say so as they call. [#out] Your partner lays their cards down and sits the whole hand out. [#three] You take on both opponents by yourself. Each trick has three cards. [#need] You still need three tricks. Three or four is still one point. [#four] Win all five, and your team scores four points instead of two. [#risk] Win fewer than three, and the other team scores two. [#same] Same score as when you play with your partner. [#dealerout] If the dealer's partner goes alone, the dealer sits out. [#stay] The turned card is not picked up.

## bowers {chapter="The trump order" transition=push}
[#right] The jack of trump is the highest card: the right bower. Bower rhymes with flower. [#left] Next is the left bower, the other jack of the same color. [#color] Hearts pair with diamonds. Spades pair with clubs. [#counts] With hearts as trump, the jack of diamonds counts as a heart. [#not] It is not a diamond anymore. [#rest] After that come ace, king, queen, ten, and nine. [#off] The jack of the other color stays in its own suit. Suits that are not trump rank ace high.

## tricks {chapter="Playing tricks" transition=push}
[#what] A trick is one card from each player still in the hand. [#lead] Left of the dealer leads the first trick. [#skip] Skip anyone who is sitting out. [#follow] Follow the suit that was led, if you have it. [#leftsuit] The left bower follows trump, not the suit printed on it. [#void] If you have none of that suit, play any card you like. [#may] You may trump. You do not have to. [#trumpwins] The highest trump wins the trick. [#low] A nine of trump beats an ace of another suit. [#highest] If no trump is played, the highest card of the led suit wins. [#next] That team keeps the trick, and the winner leads next. [#five] You play five tricks, one for each card.

## scoring {chapter="Scoring" transition=push}
[#makers] The team that named trump has to take three tricks. [#one] Three or four tricks score one point. [#five] All five score two points. [#alone] All five while going alone score four. [#still] Three or four while alone still score one. [#euchred] Fewer than three, and they are euchred. The other team scores two, alone or not. [#ten] The first team to ten points wins the game.

## app {chapter="Playing on the TV"}
[#tv] The table is on the TV. [#phone] Your cards are on your phone. [#buttons] Order it up, or pick it up when you are the dealer. Pass and go alone are there too.

## summary {transition=push}
[#s1] Name trump, or pass. [#s2] Follow suit, and the left bower is trump. [#s3] Three tricks to score. All five alone is four points.
