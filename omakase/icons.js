// The Omarchy icon made in the kit's materials, one treatment per call, at any module
// size. Lifted from identity/icon/board.js (which draws its board on import, so it can't
// be imported). Each function fills an empty, positioned box of 15 × m px.
import { STRIPS, BARS, JOINS, N, place, loops, scissor, pathD, shadowURL, rng } from './identity/icon/icon.js';
import { wallpaperList, captionOf } from './identity/kit/kit.js';

const PAPER = new URL('./identity/kit/tex/paper.webp', import.meta.url).href;
const el = (tag, cls, css = {}, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; Object.assign(e.style, css); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const px = v => v.toFixed(1) + 'px';
const horiz = r => r[2] >= r[3];
let uid = 0;

// strips of a kit material, placed by hand, laid in order (later on top)
export function strips(box, m, { kind = 'k-paper', colour, seed, torn, stitch, thread } = {}) {
  STRIPS.forEach((s, i) => {
    const p = place(s.r, m, rng(seed * 97 + i * 13 + 1));
    const e = el('div', `${kind} ${typeof colour === 'function' ? colour(s, i) : colour}`, {
      position: 'absolute', left: px(p.left), top: px(p.top), width: px(p.width), height: px(p.height), rotate: p.rot.toFixed(2) + 'deg' });
    e.dataset.seed = `${seed}-${i}`;
    if (torn) e.dataset.torn = horiz(s.r) ? 'top bottom' : 'left right';
    else if (kind === 'k-tissue') e.dataset.torn = horiz(s.r) ? 'left right' : 'top bottom';
    if (stitch && stitch(i)) { e.classList.add('k-stitch'); if (thread) e.dataset.thread = thread; }
    box.append(e);
  });
}
export function tapes(box, m, seed, which = () => true, kind) {
  JOINS.forEach(([x, y, a, len], i) => {
    if (!which(i)) return;
    const r = rng(seed * 31 + i), t = el('i', 'k-tape' + (kind === 'masking' ? ' k-masking' : ''));
    t.style.cssText = `--k-x:${px(x * m + r.range(-2, 2) * m / 26)};--k-y:${px(y * m + r.range(-2, 2) * m / 26)};--k-r:${(a + r.range(-5, 5)).toFixed(1)}deg;--k-w:${px(len * m * r.range(.94, 1.08))};--k-tx:${Math.round(r() * 160)}px;--k-tape-h:${px(Math.min(26, Math.max(10, m * 1.05)))}`;
    if (r() < .4) t.dataset.lift = r() < .5 ? 'bl' : 'none';
    box.append(t);
  });
}

// satin stitch: floss laid side by side across each bar
function satin(m, seed) {
  const r = rng(seed), f = v => v.toFixed(1), k = m / 26;
  let sh = '', hi = '', holes = ''; const th = ['', '', ''];
  for (const [x, y, w, h] of BARS) {
    const H = w >= h || (w === 1 && h === 1 && y === 7);
    const L = (H ? w : h) * m, W = (H ? h : w) * m, x0 = x * m, y0 = y * m, gap = 3.3 * Math.max(.7, k), slant = W * .16;
    for (let t = 1.6 * k; t < L - 1.2 * k; t += gap * r.range(.93, 1.07)) {
      const a = r.range(-.8, .8) * k, b = r.range(-.8, .8) * k, s0 = Math.max(.6, t - slant / 2), s1 = Math.min(L - .6, t + slant / 2);
      const A = H ? [x0 + s0, y0 + a + .8 * k] : [x0 + a + .8 * k, y0 + s1], B = H ? [x0 + s1, y0 + W + b - .8 * k] : [x0 + W + b - .8 * k, y0 + s0];
      th[Math.floor(r() * 3)] += `M${f(A[0])} ${f(A[1])}L${f(B[0])} ${f(B[1])}`;
      sh += `M${f(A[0] + .5 * k)} ${f(A[1] + .9 * k)}L${f(B[0] + .5 * k)} ${f(B[1] + .9 * k)}`;
      const ox = H ? -.55 * k : 0, oy = H ? 0 : -.55 * k;
      hi += `M${f(A[0] + (B[0] - A[0]) * .2 + ox)} ${f(A[1] + (B[1] - A[1]) * .2 + oy)}L${f(A[0] + (B[0] - A[0]) * .8 + ox)} ${f(A[1] + (B[1] - A[1]) * .8 + oy)}`;
      holes += `M${f(A[0])} ${f(A[1])}h.01M${f(B[0])} ${f(B[1])}h.01`;
    }
  }
  const S = N * m + 20, tones = ['#3a8544', '#448f4d', '#33793c'], sw = Math.max(1.6, 2.5 * k);
  return `<svg viewBox="-10 -10 ${S} ${S}" width="${S}" height="${S}" style="position:absolute;left:-10px;top:-10px;overflow:visible">` +
    `<path d="${holes}" stroke="rgba(20,8,10,.5)" stroke-width="${sw + .1}" stroke-linecap="round" fill="none"/>` +
    `<path d="${sh}" stroke="rgba(24,10,12,.42)" stroke-width="${sw + .5}" stroke-linecap="round" fill="none"/>` +
    th.map((d, i) => `<path d="${d}" stroke="${tones[i]}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`).join('') +
    `<path d="${hi}" stroke="rgba(236,250,225,.42)" stroke-width="${Math.max(.5, .8 * k)}" stroke-linecap="round" fill="none"/></svg>`;
}

const LOOPS = loops();
const iconD = (m, r, cut, dx = 0, dy = 0) => LOOPS.map(l => pathD(cut ? scissor(l.map(([x, y]) => [x * m, y * m]), r, cut) : l.map(([x, y]) => [x * m, y * m]), 1, dx, dy)).join('');

// die-cut from black card, with the die's nicks
function dieCut(box, m) {
  const d = iconD(m), S = N * m, pad = 30, id = `dc${++uid}`;
  const shadow = shadowURL(iconD(m, null, null, pad, pad), S + pad * 2, S + pad * 2, [[1.2, 2.2, 2.5, .38], [4, 10, 16, .24]], { q: .5 });
  const nicks = [[4.2, 0, 0], [15, 9.4, 1], [11.5, 15, 0], [0, 3.3, 1]].map(([x, y, v]) =>
    v ? `M${x * m - .2} ${y * m - 1.4}h${x === 0 ? -1.6 : 1.6}v2.8h${x === 0 ? 1.6 : -1.6}Z` : `M${x * m - 1.4} ${y * m + .2}v${y === 0 ? -1.6 : 1.6}h2.8v${y === 0 ? 1.6 : -1.6}Z`).join('');
  box.innerHTML = `<svg viewBox="${-pad} ${-pad} ${S + pad * 2} ${S + pad * 2}" width="${S + pad * 2}" height="${S + pad * 2}" style="position:absolute;left:${-pad}px;top:${-pad}px">
    <defs><pattern id="${id}-p" patternUnits="userSpaceOnUse" width="420" height="420" patternTransform="scale(.5)"><image href="${PAPER}" width="420" height="420"/></pattern>
    <linearGradient id="${id}-f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <image href="${shadow}" x="${-pad}" y="${-pad}" width="${S + pad * 2}" height="${S + pad * 2}"/>
    <path d="${d}" transform="translate(.7 1.4)" fill="#6e665f" fill-rule="evenodd"/>
    <path d="${d}${nicks}" fill="#2f2c2a" fill-rule="evenodd"/>
    <path d="${d}" fill="url(#${id}-p)" opacity=".55" fill-rule="evenodd"/>
    <path d="${d}" fill="url(#${id}-f)" fill-rule="evenodd"/>
    <path d="${d}" fill="none" stroke="rgba(255,250,240,.16)" stroke-width=".8" transform="translate(-.3 -.4)"/></svg>`;
}

// the icon cut through a yellow sheet onto a wallpaper; the islands taped back in
async function hole(box, m, wp, salt) {
  const S = Math.round(N * m * 1.16), r = rng(51), off = (S - N * m) / 2;
  Object.assign(box.style, { width: px(S), height: px(S) });
  const outerPts = scissor([[0, 0], [S, 0], [S, S], [0, S]], r, { step: [18, 54], jit: .7, wander: 1.3, corner: 1.5 });
  const holes = iconD(m, r, { step: [10, 30], jit: .6, wander: 1, corner: 1.1 }, off, off);
  const outer = pathD(outerPts), pad = 30;
  const { i, items } = await wallpaperList(wp, salt), item = items[i];
  const under = shadowURL(pathD(outerPts, 1, pad, pad), S + pad * 2, S + pad * 2, [[1.5, 3, 4, .26], [4, 9, 16, .2]]);
  const inner = shadowURL(outer + holes, S, S, [[3, 7, 10, .6]], { clip: holes, q: 1 });
  box.append(
    el('div', '', { position: 'absolute', inset: `-${pad}px`, background: `url(${under}) 0 0 / 100% 100%` }),
    el('div', '', { position: 'absolute', left: px(off - 6), top: px(off - 6), width: px(N * m + 12), height: px(N * m + 12), background: `#2a2320 url(${S < 320 ? item.small : item.src}) 50% 60% / cover` }, { role: 'img', 'aria-label': item.alt }),
    el('div', 'r6-hole-sheet k-yellow', { position: 'absolute', inset: 0, clipPath: `path(evenodd, "${outer}${holes}")` }),
    el('div', '', { position: 'absolute', inset: 0, background: `url(${inner}) 0 0 / 100% 100%`, clipPath: `path(evenodd, "${holes}")` }),
  );
  box.insertAdjacentHTML('beforeend', `<svg width="${S}" height="${S}" style="position:absolute;inset:0;pointer-events:none"><path d="${holes}" transform="translate(-.5 -.9)" fill="none" stroke="rgba(30,18,8,.35)" stroke-width="1.2"/></svg>`);
  for (const [x, y, a, w] of [[.5, 4.1, 4, 3.1], [4.3, .5, 93, 3.1], [.5, 10.8, -5, 3.1], [4.6, 14.5, 88, 3.1]]) {
    const t = el('i', 'k-tape');
    t.style.cssText = `--k-x:${px(off + x * m)};--k-y:${px(off + y * m)};--k-r:${a}deg;--k-w:${px(w * m)};--k-tape-h:${px(Math.min(26, Math.max(10, m * 1.05)))}`;
    box.append(t);
  }
  return captionOf(item);
}

// One treatment into a box. Returns a caption when the treatment shows the desk.
export async function draw(kind, box, m, opts = {}) {
  const S = N * m;
  Object.assign(box.style, { width: px(S), height: px(S) });
  switch (kind) {
    case 'paper': strips(box, m, { colour: opts.colour || 'k-green', seed: opts.seed ?? 11 }); tapes(box, m, opts.seed ?? 11); break;
    case 'felt': strips(box, m, { kind: 'k-felt', seed: 21, colour: (s, i) => i >= 10 ? 'k-magenta' : i >= 5 ? 'k-blue' : 'k-yellow', stitch: i => i >= 10, thread: 'cream' }); break;
    case 'stitched': {
      const card = el('div', 'k-paper k-cream', { position: 'absolute', left: px(-S * .09), top: px(-S * .09), width: px(S * 1.18), height: px(S * 1.18), rotate: '.8deg' });
      card.dataset.seed = 'r6-linen'; box.append(card);
      box.insertAdjacentHTML('beforeend', satin(m, 7)); break;
    }
    case 'torn': strips(box, m, { colour: 'k-red', seed: 41, torn: true }); tapes(box, m, 41, i => i >= 8, 'masking'); break;
    case 'tissue': strips(box, m, { kind: 'k-tissue', seed: 81, colour: s => horiz(s.r) ? 'k-yellow' : 'k-blue' }); break;
    case 'die': dieCut(box, m); break;
    case 'patch': {
      const D = S * 1.46, disc = el('div', 'k-felt k-grey k-stitch', { position: 'absolute', left: px((S - D) / 2), top: px((S - D) / 2), width: px(D), height: px(D) });
      Object.assign(disc.dataset, { shape: 'round', thread: 'magenta', seed: 'r6-patch' }); box.append(disc);
      const inner = el('div', '', { position: 'absolute', inset: 0, rotate: '-2deg' }); box.append(inner);
      strips(inner, m, { kind: 'k-felt', colour: 'k-magenta', seed: 71, stitch: i => i >= 10, thread: 'cream' }); break;
    }
    case 'hole': return hole(box, m, opts.wallpaper || 'dusk', opts.salt || 0);
  }
  return null;
}
