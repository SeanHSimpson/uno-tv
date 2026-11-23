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
    const dy = b.h * 0.33;
    const dx = b.w * 0.3;
    const seat = (label, x, y, color, id, at) => s.box(label, { id, x, y, size: u * 6, color, minW: u * 44, at });
    seat('You', b.cx, b.cy + dy, DEER, 'you', '#teams');
    seat('Partner', b.cx, b.cy - dy, DEER, 'partner', '#partner');
    seat('Opponent', b.cx - dx, b.cy, LAKE, 'opp1', '#teams');
    seat('Opponent', b.cx + dx, b.cy, LAKE, 'opp2', '#teams');
    s.arrow('you', 'partner', { head: 'both', dashed: true, label: 'partners', at: '#partner', color: DEER });
    s.text('Deer Camp', { x: b.cx + dx * 0.9, y: b.cy - dy, size: u * 6.5, font: 'display', color: DEER, at: '#deer' });
    s.text('Lake Effect', { x: b.cx + dx, y: b.cy + dy * 0.62, size: u * 6.5, font: 'display', color: LAKE, at: '#lake' });
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
    const h = b.h * 0.6;
    const cx = b.x + b.w * 0.25;
    card(s, '12D', { x: cx, y: b.cy - u * 3, h, at: -1 });
    s.text('trump beats every other suit', { x: cx, y: b.cy + h / 2 + u * 4, size: u * 5, color: 'muted', maxWidth: b.w * 0.4, at: '#trump' });
    const rx = b.x + b.w * 0.68;
    s.text('starts left of the dealer, one at a time', { x: rx, y: b.y + u * 6, size: u * 5, color: 'muted', maxWidth: b.w * 0.55, at: '#left' });
    s.box('Order it up', { id: 'order', x: rx - b.w * 0.13, y: b.cy - u * 4, size: u * 6.5, color: 'orange', minW: u * 50, at: '#order' });
    s.box('Pass', { id: 'pass', x: rx + b.w * 0.15, y: b.cy - u * 4, size: u * 6.5, color: 'gray', minW: u * 36, at: '#pass' });
    s.text('Dealer picks the card up\nand throws one away', { x: rx, y: b.cy + u * 22, size: u * 5.5, maxWidth: b.w * 0.55, at: '#pickup' });
  },

  round2(s) {
    const u = unit(s);
    heading(s, 'Round 2: name another suit', { at: 0 });
    const b = body(s);
    const h = b.h * 0.52;
    const cx = b.x + b.w * 0.16;
    card(s, 'back', { x: cx, y: b.cy - u * 6, h, at: '#down' });
    s.text('turned down', { x: cx, y: b.cy - u * 6 + h / 2 + u * 4, size: u * 5, color: 'muted', at: '#down' });
    const xs = s.row(3, { width: b.w * 0.5, x: b.x + b.w * 0.6 });
    ['Hearts', 'Spades', 'Clubs'].forEach((suit, i) => s.box(suit, { x: xs[i], y: b.y + b.h * 0.2, size: u * 5.5, color: suit === 'Hearts' ? 'red' : 'teal', minW: u * 30, at: '#name' }));
    s.box('Dealer has to pick', { x: b.x + b.w * 0.6, y: b.y + b.h * 0.5, size: u * 5.5, color: 'accent', at: '#stick' });
    s.box('Go alone: partner sits out', { x: b.x + b.w * 0.6, y: b.y + b.h * 0.8, size: u * 5.5, color: 'purple', at: '#alone' });
  },

  bowers(s) {
    const u = unit(s);
    heading(s, 'If *hearts* are trump, highest to lowest', { at: 0 });
    const b = body(s);
    const h = b.h * 0.44;
    const xs = s.row(7, { width: b.w * 0.88 });
    const y = b.cy - u * 4;
    const names = ['11H', '11D', '1H', '13H', '12H', '10H', '9H'];
    const ats = ['#right', '#left', '#rest', '#rest', '#rest', '#rest', '#rest'];
    names.forEach((n, i) => card(s, n, { id: `c${i}`, x: xs[i], y, h, at: ats[i] }));
    const ly = y + h / 2 + u * 5;
    s.text('Right bower', { x: xs[0], y: ly, size: u * 4.6, color: 'accent', font: 'display', at: '#right' });
    s.text('Left bower', { x: xs[1], y: ly, size: u * 4.6, color: 'accent', font: 'display', at: '#left' });
    s.text('a diamond, but\ncounts as trump', { x: xs[1], y: ly + u * 9, size: u * 3.6, color: 'muted', at: '#counts' });
  },

  tricks(s) {
    const u = unit(s);
    heading(s, 'A trick, with *hearts* as trump', { at: 0 });
    const b = body(s);
    const h = b.h * 0.42;
    const dy = b.h * 0.27;
    const dx = b.w * 0.14;
    card(s, '13S', { id: 'lead', x: b.cx, y: b.cy + dy, h, at: '#lead' });
    s.text('led', { x: b.cx - h * 0.55, y: b.cy + dy, size: u * 4.6, color: 'muted', at: '#lead' });
    card(s, '9S', { x: b.cx - dx, y: b.cy, h, at: '#follow' });
    card(s, '1S', { x: b.cx, y: b.cy - dy, h, at: '#follow' });
    card(s, '9H', { id: 'win', x: b.cx + dx, y: b.cy, h, at: '#trumpwins' });
    s.annotate({ x: b.cx + dx, y: b.cy, w: (h * 2) / 3 + u * 4, h: h + u * 4 }, { type: 'box', color: 'green', at: '#trumpwins' });
    s.text('trump wins', { x: b.cx + dx + h * 0.62, y: b.cy, size: u * 5, color: 'green', font: 'display', align: 'left', at: '#trumpwins' });
    s.text('no trump? the Ace of spades would win', { x: b.x + b.w * 0.2, y: b.cy - dy, size: u * 4.2, color: 'muted', maxWidth: b.w * 0.3, at: '#highest' });
    s.text('winner leads next', { x: b.x + b.w * 0.2, y: b.cy + dy, size: u * 4.6, maxWidth: b.w * 0.3, at: '#next' });
  },

  scoring(s) {
    const u = unit(s);
    heading(s, 'Callers need *3* of 5 tricks', { at: 0 });
    const b = body(s);
    const width = Math.min(b.w * 0.8, u * 150);
    s.list([
      { text: '3 or 4 tricks: *1* point', at: '#one' },
      { text: 'All 5: *2* points', at: '#five' },
      { text: 'All 5 alone: *4* points', at: '#alone' },
      { text: 'Under 3: euchred, the others get *2*', at: '#euchred' },
      { text: 'First team to *10* wins', at: '#ten' },
    ], { x: b.cx - width / 2, y: b.y + u * 4, width, size: u * 5.8, gap: u * 3.2, bullet: 'dot' });
  },

  app(s) {
    const u = unit(s);
    const b = { ...s.safe };
    const tvW = b.w * 0.66;
    const tvX = b.left + tvW / 2;
    s.image('assets/tv.png', { id: 'tv', x: tvX, y: s.cy - u * 4, w: tvW, frame: 'window', at: 0 });
    s.text('the TV', { x: tvX, y: s.cy + (tvW * 9) / 32 + u * 4, size: u * 5, color: 'muted', at: 0 });
    const ph = b.h * 0.92;
    const phX = b.right - (ph * 824) / 1830 / 2 - u * 4;
    s.image('assets/phone.png', { id: 'phone', x: phX, y: s.cy, h: ph, frame: 'phone', at: '#phone' });
    s.focus('phone', { at: '#buttons' });
  },

  summary(s) {
    takeaways(s, 'Euchre in one breath', [
      { text: 'Pick *trump*', at: '#s1' },
      { text: 'Follow *suit*', at: '#s2' },
      { text: 'Take *3 tricks* with your partner', at: '#s3' },
    ], { at: 0 });
  },
};
