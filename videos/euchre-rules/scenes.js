// How to play Euchre, the way the OhNo! app plays it. The cards are the app's own
// up-north Euchre cards (assets/cards, rendered from src/client/games/euchre/cards.ts),
// and the closing shots are screenshots of the real TV and phone.
import { body, heading, takeaways, unit } from './format.js';

const DEER = '#f0812f'; // blaze orange, as in the app
const LAKE = '#4fb3e3'; // lake blue

// One of the app's cards. h is the card's height; cards are 2:3.
function card(s, name, { x, y, h, at, out, id, enter, overlap } = {}) {
  return s.image(`assets/cards/${name}.png`, { id, x, y, h, w: (h * 2) / 3, frame: 'none', shadow: true, at, out, enter, overlap });
}

export default {
  teams(s) {
    const u = unit(s);
    heading(s, 'How to play *Euchre*', { at: -1 });
    const b = body(s);
    const dy = b.h * 0.28;
    const dx = b.w * 0.3;
    const seat = (label, x, y, color, id, at) => s.box(label, { id, x, y, size: u * 6, color, minW: u * 44, at });
    seat('You', b.cx, b.cy + dy, DEER, 'you', '#teams');
    seat('Partner', b.cx, b.cy - dy, DEER, 'partner', '#partner');
    seat('Opponent', b.cx - dx, b.cy, LAKE, 'opp1', '#teams');
    seat('Opponent', b.cx + dx, b.cy, LAKE, 'opp2', '#teams');
    s.arrow('you', 'partner', { head: 'both', dashed: true, label: 'partners', at: '#partner', color: DEER });
    s.text('your tricks count together', { x: b.cx, y: b.cy + dy + u * 14, size: u * 5, color: 'muted', at: '#share' });
    s.text('Deer Camp', { x: b.cx + dx * 0.9, y: b.cy - dy, size: u * 6.5, font: 'display', color: DEER, at: '#deer' });
    s.text('Lake Effect', { x: b.cx + dx, y: b.cy + dy * 0.55, size: u * 6.5, font: 'display', color: LAKE, at: '#lake' });
  },

  deck(s) {
    const u = unit(s);
    heading(s, '*24* cards: 9, 10, J, Q, K, A', { at: '#deck' });
    const b = body(s);
    const h = b.h * 0.54;
    const xs = s.row(6, { width: b.w * 0.94 });
    ['9H', '10H', '11H', '12H', '13H', '1H'].forEach((n, i) => card(s, n, { x: xs[i], y: b.cy, h, at: '#deck', out: '#deal' }));
    // Five backs for your hand, and the turned-up card.
    const hx = b.x + b.w * 0.32;
    for (let i = 0; i < 5; i++) card(s, 'back', { x: hx + (i - 2) * h * 0.3, y: b.cy - u * 2, h, at: '#deal', overlap: true });
    s.text('5 cards each', { x: hx, y: b.cy + h / 2 + u * 5, size: u * 5.5, color: 'muted', at: '#deal' });
    card(s, '12D', { id: 'up', x: b.x + b.w * 0.78, y: b.cy - u * 2, h, at: '#up' });
    s.text('turned up', { x: b.x + b.w * 0.78, y: b.cy + h / 2 + u * 5, size: u * 5.5, color: 'muted', at: '#up' });
  },

  round1(s) {
    const u = unit(s);
    heading(s, 'Picking *trump*: round 1', { at: 0 });
    const b = body(s);
    const h = b.h * 0.48;
    const cx = b.x + b.w * 0.24;
    card(s, '12D', { x: cx, y: b.cy - u * 8, h, at: -1 });
    s.text('trump beats every other suit', { x: cx, y: b.cy + h / 2 + u * 1, size: u * 4.6, color: 'muted', maxWidth: b.w * 0.36, at: '#trump' });
    s.text("order it up:\nthis suit is trump", { x: cx, y: b.cy + h / 2 + u * 12, size: u * 4.6, maxWidth: b.w * 0.36, at: '#means' });
    const rx = b.x + b.w * 0.68;
    s.text('starts left of the dealer', { x: rx, y: b.y + u * 4, size: u * 4.8, color: 'muted', maxWidth: b.w * 0.5, at: '#left' });
    s.box('Order it up', { id: 'order', x: rx - b.w * 0.12, y: b.cy - u * 10, size: u * 5.8, color: 'orange', minW: u * 46, at: '#order' });
    s.box('Pass', { id: 'pass', x: rx + b.w * 0.14, y: b.cy - u * 10, size: u * 5.8, color: 'gray', minW: u * 32, at: '#pass' });
    s.text('Dealer picks the card up\nand throws one away', { x: rx, y: b.cy + u * 10, size: u * 5.2, maxWidth: b.w * 0.5, at: '#pickup' });
    s.text('even if an opponent ordered it', { x: rx, y: b.cy + u * 24, size: u * 4.6, color: 'accent', maxWidth: b.w * 0.5, at: '#whose' });
  },

  round2(s) {
    const u = unit(s);
    heading(s, 'Round 2: name another suit', { at: 0 });
    const b = body(s);
    const h = b.h * 0.4;
    const cx = b.x + b.w * 0.16;
    card(s, '12D', { x: cx, y: b.cy - u * 8, h, at: '#down' });
    s.text('turned down', { x: cx, y: b.cy - u * 8 + h / 2 + u * 4, size: u * 5, color: 'muted', at: '#down' });
    const xs = s.row(3, { width: b.w * 0.52, x: b.x + b.w * 0.62 });
    ['Hearts', 'Spades', 'Clubs'].forEach((suit, i) => s.box(suit, { x: xs[i], y: b.y + b.h * 0.16, size: u * 5.2, color: suit === 'Hearts' ? 'red' : 'teal', minW: u * 28, at: '#name' }));
    s.text('not diamonds, the suit turned down', { x: b.x + b.w * 0.62, y: b.y + b.h * 0.4, size: u * 4.6, color: 'muted', at: '#except' });
    s.text('nobody picks up a card', { x: b.x + b.w * 0.62, y: b.y + b.h * 0.56, size: u * 5, at: '#nocard' });
    s.box('Dealer must name a suit', { x: b.x + b.w * 0.62, y: b.y + b.h * 0.78, size: u * 5.2, color: 'accent', at: '#stick' });
  },

  alone(s) {
    const u = unit(s);
    heading(s, 'Going *alone*', { at: 0 });
    const b = body(s);
    const y = b.y + u * 8;
    s.box('You play alone', { x: b.cx - b.w * 0.22, y, size: u * 5.2, color: DEER, minW: u * 46, at: '#who' });
    s.text('say it as you call trump, before anyone plays', { x: b.cx, y: y + u * 14, size: u * 4.4, color: 'muted', at: '#when', out: '#three' });
    s.box('Partner sits out', { x: b.cx + b.w * 0.22, y, size: u * 5.2, color: 'gray', minW: u * 48, at: '#out' });
    s.text('you against both opponents, three cards a trick', { x: b.cx, y: y + u * 14, size: u * 4.4, color: 'muted', at: '#three' });
    const width = Math.min(b.w * 0.88, u * 168);
    s.list([
      { text: 'Still need *3* tricks. 3 or 4 is still *1* point', at: '#need' },
      { text: 'All 5 tricks: *4* points, instead of 2', at: '#four' },
      { text: 'Under 3: the others get *2*', at: '#risk' },
      { text: 'Same *2* as when your partner plays', at: '#same' },
      { text: "Dealer's partner alone: the dealer sits out", at: '#dealerout' },
      { text: 'The turned card is not picked up', at: '#stay' },
    ], { x: b.cx - width / 2, y: b.y + b.h * 0.38, width, size: u * 4.6, gap: u * 1.6, bullet: 'dot' });
  },

  bowers(s) {
    const u = unit(s);
    heading(s, 'If *hearts* are trump, highest to lowest', { at: 0 });
    const b = body(s);
    const h = b.h * 0.38;
    const xs = s.row(7, { width: b.w * 0.9 });
    const y = b.y + h / 2 + u * 2;
    const names = ['11H', '11D', '1H', '13H', '12H', '10H', '9H'];
    const ats = ['#right', '#left', '#rest', '#rest', '#rest', '#rest', '#rest'];
    names.forEach((n, i) => card(s, n, { id: `c${i}`, x: xs[i], y, h, at: ats[i] }));
    const ly = y + h / 2 + u * 4;
    s.text('Right bower', { x: xs[0], y: ly, size: u * 4.2, color: 'accent', font: 'display', at: '#right' });
    s.text('Left bower', { x: xs[1], y: ly, size: u * 4.2, color: 'accent', font: 'display', at: '#left' });
    s.text('printed diamond,\nplayed as a heart', { x: xs[1], y: ly + u * 8, size: u * 3.4, color: 'muted', at: '#counts' });
    const foot = b.y + b.h - u * 5;
    s.text('hearts with diamonds, spades with clubs', { x: b.cx, y: foot, size: u * 4.4, color: 'muted', at: '#color', out: '#not' });
    s.text('this jack is a heart now. It is not a diamond.', { x: b.cx, y: foot, size: u * 4.4, color: 'accent', at: '#not', out: '#off' });
    card(s, '11S', { x: b.x + u * 16, y: foot - u * 2, h: h * 0.45, at: '#off' });
    s.text('the jack of spades stays a spade. Other suits rank ace high.', { x: b.cx + u * 8, y: foot, size: u * 4.2, maxWidth: b.w * 0.72, at: '#off' });
  },

  tricks(s) {
    const u = unit(s);
    heading(s, 'A trick, with *hearts* as trump', { at: 0 });
    const b = body(s);
    const h = b.h * 0.36;
    const dy = b.h * 0.22;
    const dx = b.w * 0.18;
    const foot = b.y + b.h - u * 3;
    card(s, '13S', { id: 'lead', x: b.cx, y: b.cy + dy * 0.7, h, at: '#lead' });
    s.text('led', { x: b.cx + h * 0.72, y: b.cy + dy * 0.7 + h * 0.48, size: u * 4, color: 'muted', at: '#lead' });
    card(s, '9S', { x: b.cx - dx, y: b.cy - u * 2, h, at: '#follow' });
    card(s, '1S', { x: b.cx, y: b.cy - dy - u * 2, h, at: '#follow' });
    card(s, '9H', { id: 'win', x: b.cx + dx, y: b.cy - u * 2, h, at: '#trumpwins' });
    s.annotate({ x: b.cx + dx, y: b.cy - u * 2, w: (h * 2) / 3 + u * 4, h: h + u * 4 }, { type: 'box', color: 'green', at: '#trumpwins' });
    s.text('trump wins', { x: b.cx + dx + h * 0.7, y: b.cy - u * 8, size: u * 4.6, color: 'green', font: 'display', align: 'left', at: '#trumpwins' });
    s.text('this nine beats the ace', { x: b.cx + dx + h * 0.7, y: b.cy + u * 2, size: u * 4, color: 'green', align: 'left', maxWidth: b.w * 0.22, at: '#low' });
    s.text('one card from each player still in', { x: b.cx, y: foot, size: u * 4.2, color: 'muted', at: '#what', out: '#skip' });
    s.text('skip anyone who is sitting out', { x: b.cx, y: foot, size: u * 4.2, color: 'muted', at: '#skip', out: '#leftsuit' });
    s.text('the left bower follows hearts, not diamonds', { x: b.cx, y: foot, size: u * 4.2, color: 'muted', at: '#leftsuit', out: '#void' });
    s.text('no spades? any card. You may trump, and you may decline.', { x: b.cx, y: foot, size: u * 4.2, color: 'muted', maxWidth: b.w * 0.86, at: '#void' });
    s.text('no trump played? the ace of spades wins', { x: b.x + b.w * 0.16, y: b.cy - dy, size: u * 4, color: 'muted', maxWidth: b.w * 0.24, at: '#highest' });
    s.text('that team keeps it. winner leads next', { x: b.x + b.w * 0.16, y: b.cy + dy * 0.15, size: u * 4, maxWidth: b.w * 0.24, at: '#next' });
    s.text('five tricks, one for each card', { x: b.cx + dx + h * 0.7, y: b.cy + dy, size: u * 4, align: 'left', maxWidth: b.w * 0.22, at: '#five' });
  },

  scoring(s) {
    const u = unit(s);
    heading(s, 'Callers need *3* of 5 tricks', { at: '#makers' });
    const b = body(s);
    const width = Math.min(b.w * 0.86, u * 160);
    s.list([
      { text: '3 or 4 tricks: *1* point', at: '#one' },
      { text: 'All 5: *2* points', at: '#five' },
      { text: 'All 5 alone: *4* points', at: '#alone' },
      { text: '3 or 4 alone: still *1* point', at: '#still' },
      { text: 'Under 3: euchred, the others get *2*', at: '#euchred' },
      { text: 'First team to *10* wins', at: '#ten' },
    ], { x: b.cx - width / 2, y: b.y + u * 2, width, size: u * 5.2, gap: u * 2.2, bullet: 'dot' });
  },

  app(s) {
    const u = unit(s);
    const b = { ...s.safe };
    const tvW = b.w * 0.66;
    const tvX = b.left + tvW / 2;
    s.image('assets/tv.png', { id: 'tv', x: tvX, y: s.cy - u * 4, w: tvW, frame: 'window', at: '#tv' });
    s.text('the TV', { x: tvX, y: s.cy + (tvW * 9) / 32 + u * 4, size: u * 5, color: 'muted', at: '#tv' });
    const ph = b.h * 0.92;
    const phX = b.right - (ph * 824) / 1830 / 2 - u * 4;
    s.image('assets/phone.png', { id: 'phone', x: phX, y: s.cy, h: ph, frame: 'phone', at: '#phone' });
    s.focus('phone', { at: '#buttons' });
    s.text('order up, or pick it up · pass · go alone', { x: tvX, y: s.cy + (tvW * 9) / 32 + u * 12, size: u * 4.4, at: '#buttons' });
  },

  summary(s) {
    takeaways(s, 'Euchre in one breath', [
      { text: 'Name *trump*, or pass', at: '#s1' },
      { text: 'Follow *suit*. The left bower is trump', at: '#s2' },
      { text: '*3 tricks* to score. All 5 alone is *4*', at: '#s3' },
    ], { at: 0 });
  },
};
