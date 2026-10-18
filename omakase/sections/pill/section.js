// The pill bar: a full-width strip of dark paper across the top of a monitor, trimmed to
// a capsule. The scissors cut two arcs, the offcuts fall below the monitor and stay
// there, and a tap on the capsule (or a double-click, like the real clock) brings the
// full strip back. Every piece's outline is cut once per size, with a baked shadow.
import { rng } from '../../identity/kit/kit.js';
import { shadowURL } from '../../identity/icon/icon.js';

const PAPER = new URL('../../identity/kit/tex/paper.webp', import.meta.url).href;
const INK = '#262830';   // the strip's paper: a slate near the pill's deepened ground

// wallpaper numbers, darkest to lightest by the mean luminance of the patch under the
// pill (top-left 12% × 3% of each image). The same order as under.webp, 10 to a row.
const ORDER = [84, 38, 83, 6, 22, 34, 75, 49, 57, 74, 77, 79, 4, 11, 13, 91, 81, 10, 55, 3, 45, 27, 18, 60, 89, 9, 5, 8, 72, 12, 71, 44, 15, 24, 35, 94, 76, 80, 2, 87, 62, 19, 48, 43, 21, 46, 37, 56, 1, 33, 54, 39, 67, 90, 16, 73, 28, 59, 93, 65, 42, 82, 85, 29, 26, 31, 52, 47, 69, 20, 23, 32, 86, 92, 63, 17, 53, 40, 68, 14, 41, 30, 25, 64, 70, 7, 50, 78, 51, 36, 58, 66, 88, 61];

const f = v => v.toFixed(1);
const D = (pts, dx = 0, dy = 0) => 'M' + pts.map(([x, y]) => f(x + dx) + ' ' + f(y + dy)).join('L') + 'Z';
const wait = ms => new Promise(r => setTimeout(r, ms));
let uid = 0;

// the scissors, drawn: red card handles, grey card blades, one half mirrored for the other.
// The box is 150 × 70; the blades cross at (78, 35), the rivet is at (70, 35).
const HALF = `<path class="blade" d="M62 35.5 146 34.2 136 29.6 110 27.4 84 26.6 66 29.5Z"/>` +
  `<path class="arm" d="M66 33.5 75 38 46 51.5 40 45Z"/>` +
  `<path class="ring" fill-rule="evenodd" d="M7 52a19 12 -12 1 0 38 -8a19 12 -12 1 0 -38 8Z M14 50.6a12 6.6 -12 1 0 24 -5a12 6.6 -12 1 0 -24 5Z"/>`;
const SCISSORS = `<svg viewBox="0 0 150 70" width="150" height="70">` +
  `<g class="sh"><g class="half a">${HALF}</g><g class="half b"><g transform="matrix(1 0 0 -1 0 70)">${HALF}</g></g></g>` +
  `<g class="half a">${HALF}</g><g class="half b"><g transform="matrix(1 0 0 -1 0 70)">${HALF}</g></g>` +
  `<circle class="pivot" cx="70" cy="35" r="3"/></svg>`;

// ------------------------------------------------------------------ the swatch card
function chips(el) {
  const box = el.querySelector('.pl-chips');
  box.innerHTML = ORDER.map((n, k) => `<i style="--c:${k % 10};--r:${Math.floor(k / 10)}" title="wallpaper ${String(n).padStart(2, '0')}"></i>`).join('') +
    `<svg class="pl-ring" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M104 6C58 3 10 9 6 30c-4 20 44 27 96 26 50-1 94-8 92-28C192 9 150 2 92 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  box.append(el.querySelector('.pl-worst'));
}

// ------------------------------------------------------------------ geometry
// a hand-cut straight edge: knots every ~28px, each nudged off the line
function edge(x0, x1, y, r, amp = .7) {
  const k = [[x0, y + r.range(-amp, amp)]];
  for (let x = x0 + r.range(14, 30); x < x1 - 8; x += r.range(18, 34)) k.push([x, y + r.range(-amp, amp)]);
  k.push([x1, y + r.range(-amp, amp)]);
  const at = x => { for (let i = 1; i < k.length; i++) if (x <= k[i][0]) { const [a, b] = [k[i - 1], k[i]], t = (x - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * t; } return k[k.length - 1][1]; };
  // the edge between x1 and x2, in either direction
  return (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b), mid = k.filter(([x]) => x > lo + 3 && x < hi - 3);
    const out = [[lo, at(lo)], ...mid, [hi, at(hi)]]; return a <= b ? out : out.reverse(); };
}
// a scissored arc: short straight snips, the way a curve really gets cut
function arc(cx, cy, rad, from, to, r, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = from + (to - from) * (i / n) + (i && i < n ? r.range(-.05, .05) : 0), d = rad + (i && i < n ? r.range(-.6, .6) : 0);
    pts.push([cx + Math.cos(t) * d, cy + Math.sin(t) * d]);
  }
  return pts;
}

// one piece of the strip: an absolutely placed box holding its baked shadow(s), the
// paper as SVG (texture aligned to the strip, so the pieces read as one sheet) and content
function piece(strip, pts, cls, lifts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const bx = Math.floor(Math.min(...xs)), by = Math.floor(Math.min(...ys));
  const w = Math.ceil(Math.max(...xs)) - bx, h = Math.ceil(Math.max(...ys)) - by, p = 26, id = `pl${++uid}`;
  const local = D(pts, p - bx, p - by), W = w + p * 2, H = h + p * 2;
  const div = document.createElement('div');
  div.className = `pl-piece ${cls}`;
  Object.assign(div.style, { left: bx + 'px', top: by + 'px', width: w + 'px', height: h + 'px' });
  const sh = (layers, c) => `<div class="pl-shadow ${c}" style="left:${-p}px;top:${-p}px;width:${W}px;height:${H}px;background-image:url(${shadowURL(local, W, H, layers, { q: .5 })})"></div>`;
  div.innerHTML = sh([[1, 2, 3, .55], [3, 7, 12, .4]], 'rest') + (lifts ? sh([[5, 11, 12, .55], [9, 20, 26, .45]], 'lift') : '') +
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="left:${-p}px;top:${-p}px">
      <defs><pattern id="${id}p" patternUnits="userSpaceOnUse" width="210" height="210" patternTransform="translate(${p - bx} ${p - by})"><image href="${PAPER}" width="210" height="210"/></pattern>
      <linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${p - bx}" y1="${p - by}" x2="${p - bx + 700}" y2="${p - by + 200}"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset=".5" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity=".06"/></linearGradient></defs>
      <path d="${local}" fill="${INK}"/>
      <path d="${local}" fill="url(#${id}p)" opacity=".7"/>
      <path d="${local}" fill="url(#${id}g)"/>
      <path d="${local}" fill="none" stroke="rgba(255,250,240,.2)" stroke-width=".9" transform="translate(-.3 -.5)"/>
    </svg>`;
  strip.append(div);
  return div;
}

// ------------------------------------------------------------------ the bench
export function init(el, { reduced }) {
  chips(el);
  const bench = el.querySelector('.pl-bench'), screen = el.querySelector('.pl-screen'), strip = el.querySelector('.pl-strip');
  const face = el.querySelector('.pl-face'), minus = el.querySelector('.pl-minus'), pile = el.querySelector('.pl-pile');
  const sc = el.querySelector('.pl-scissors'), hint = el.querySelector('.pl-hint');
  sc.innerHTML = SCISSORS;
  let g = null, cut = false, ever = false, busy = false, lastW = 0, lastH = 0;

  function build() {
    const sw = screen.offsetWidth, shh = screen.offsetHeight; if (!sw) return;
    lastW = sw; lastH = shh;
    const small = sw < 640, b = 6;
    const H = Math.round(small ? 32 : Math.min(50, Math.max(38, sw * .04))), top = small ? 8 : 12;
    bench.style.setProperty('--pl-h', H + 'px');
    bench.style.setProperty('--pl-st', top + 'px');
    bench.style.setProperty('--pl-sh', shh + 'px');
    bench.style.setProperty('--pl-fs', (H * (small ? .3 : .31)).toFixed(1) + 'px');
    // the capsule is as long as what it holds
    strip.append(face, minus);
    strip.querySelectorAll('.pl-piece, .pl-seams').forEach(n => n.remove());
    const fw = face.scrollWidth, SW = sw + b * 2, a = b + H * .3, rad = H / 2;
    const L = a + rad, R = a + fw + H * .95 - rad, r = rng(9133);
    const T = edge(0, SW, 0, r), B = edge(0, SW, H, r);
    const left = arc(L, rad, rad, -Math.PI / 2, -Math.PI * 1.5, r, 9);     // top, round the left, to the bottom
    const right = arc(R, rad, rad, -Math.PI / 2, Math.PI / 2, r, 9);       // top, round the right, to the bottom
    left[0][1] = T(L, L)[0][1]; left[9][1] = B(L, L)[0][1]; right[0][1] = T(R, R)[0][1]; right[9][1] = B(R, R)[0][1];
    const pL = [...T(0, L), ...left.slice(1, -1), ...B(L, 0)];
    const pC = [...T(L, R), ...right.slice(1, -1), ...B(R, L), ...left.slice(1, -1).reverse()];
    const pR = [...T(R, SW), ...B(SW, R), ...right.slice(1, -1).reverse()];
    const offL = piece(strip, pL, 'pl-off l'), cap = piece(strip, pC, 'pl-cap', true), offR = piece(strip, pR, 'pl-off r');
    cap.append(face);
    face.style.left = (H * .47) + 'px';
    // the stock line rides on the long offcut when it fits; on a narrow screen it lies in the pile
    offR.append(minus);
    const room = offR.offsetWidth - rad - 30, long = minus.scrollWidth <= room;
    minus.style.left = (rad + 16) + 'px';
    bench.classList.toggle('long', long);
    minus.toggleAttribute('aria-hidden', !long); pile.toggleAttribute('aria-hidden', long);
    // the seams the scissors leave, drawn while they cut
    const seam = pts => `<path d="M${pts.map(([x, y]) => f(x) + ' ' + f(y)).join('L')}" pathLength="1"/>`;
    strip.insertAdjacentHTML('beforeend', `<svg class="pl-seams" width="${SW}" height="${H}">${seam(left)}${seam(right)}</svg>`);
    // where the offcuts land: below the monitor, left lying about
    const drop = shh - top;
    offL.style.cssText += `;--dx:${small ? 10 : 34}px;--dy:${drop + (small ? 22 : 36)}px;--dr:${small ? 71 : 64}deg`;
    offR.style.cssText += `;--dx:${-Math.round(R * (small ? .15 : .42))}px;--dy:${drop + (small ? 18 : 30)}px;--dr:${small ? -2.8 : -2.2}deg`;
    // the pen note's arrow lands on the clock
    const time = face.querySelector('.time'), tx = cap.offsetLeft - b + face.offsetLeft + time.offsetLeft + time.offsetWidth / 2;
    bench.style.setProperty('--pl-hint-x', Math.round(tx - hint.offsetWidth - 34) + 'px');
    // the scissors' stations, in bench px: waiting on the wallpaper, cutting, at rest in the pile
    const at = ([x, y]) => [x - b, y + top];
    g = { left: left.map(at), right: right.map(at),
      wait: [sw * (small ? .76 : .84), small ? -34 : -46, -12], rest: [sw * (small ? .72 : .84), shh + (small ? 150 : 116), small ? 196 : 202], small };
    if (!busy) place(cut || ever ? g.rest : g.wait);
  }

  // the scissors: a box whose cutting point sits at (78, 35)
  const pose = ([x, y, deg]) => `translate(${f(x - 78)}px, ${f(y - 35)}px) rotate(${f(deg)}deg) scale(${g?.small ? .78 : 1})`;
  const place = p => { sc.getAnimations().forEach(a => a.cancel()); sc.style.transform = pose(p); };
  const go = async (frames, duration, easing = 'linear') => {
    const an = sc.animate(frames.map(p => ({ transform: pose(p) })), { duration, easing, fill: 'forwards' });
    try { await an.finished; } catch {} sc.style.transform = pose(frames[frames.length - 1]); an.cancel();
  };
  // along an arc, blades pointed the way they're going; `dir` is +1 (right arc) or -1 (left)
  const along = (pts, dir) => pts.map(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)], [nx, ny] = pts[Math.min(pts.length - 1, i + 1)];
    return [x, y, Math.atan2(ny - py, nx - px) * 180 / Math.PI];
  });
  const snip = async (pts, which, dir) => {
    const path = along(pts, dir), [x0, y0, a0] = path[0], k = g.small ? 14 : 22;
    const lead = [x0 - Math.cos(a0 * Math.PI / 180) * k, y0 - Math.sin(a0 * Math.PI / 180) * k, a0];
    await go([readPose(), lead], 420, 'cubic-bezier(.4,0,.2,1)');
    sc.classList.add('snip');
    const seam = strip.querySelectorAll('.pl-seams path')[which];
    seam.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 640, fill: 'forwards' });
    await go([lead, ...path], 700);
    sc.classList.remove('snip');
  };
  // scale rides at the end of the pose, so the matrix's e/f stay the true position
  const readPose = () => { const m = new DOMMatrix(getComputedStyle(sc).transform); return [m.e + 78, m.f + 35, Math.atan2(m.b, m.a) * 180 / Math.PI]; };

  async function sequence() {
    if (busy || !g) return; busy = true; ever = true;
    bench.classList.add('cutting');
    await snip(g.left, 0, -1);
    bench.classList.add('cut-l');
    await snip(g.right, 1, 1);
    bench.classList.add('cut-r'); cut = true; state();
    bench.classList.remove('cutting');
    await wait(380);
    await go([readPose(), g.rest], 700, 'cubic-bezier(.3,0,.2,1)');
    busy = false;
  }
  function settle() {        // straight to the finished, cut state, with nothing moving
    ever = true; cut = true;
    bench.classList.add('still', 'cut-l', 'cut-r'); state(); if (g) place(g.rest);
    requestAnimationFrame(() => requestAnimationFrame(() => bench.classList.remove('still')));
  }
  function state() {
    face.setAttribute('aria-pressed', String(!cut));
    face.setAttribute('aria-label', cut ? 'The pill bar, cut from the full-width strip. Press to bring the full bar back.' : 'The full-width bar, whole again. Press to trim it back to the pill.');
  }
  function toggle() {
    if (busy) return;
    if (!ever) return reduced ? settle() : sequence();
    cut = !cut; bench.classList.toggle('cut-l', cut); bench.classList.toggle('cut-r', cut); state();
  }
  // a tap toggles; a double-click toggles once (its second click is ignored), as on the desk
  face.addEventListener('click', e => { if (e.detail < 2) toggle(); });
  face.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

  build(); state();
  new ResizeObserver(() => { if (screen.offsetWidth !== lastW || screen.offsetHeight !== lastH) build(); }).observe(screen);
  // the fonts change the capsule's length
  document.fonts?.ready.then(() => build());

  if (reduced) { settle(); return; }
  // cut when the bench is well in view; arriving from below it (a link, a jump), it is already cut
  const io = new IntersectionObserver(() => {
    if (ever) return io.disconnect();
    const r = bench.getBoundingClientRect(), vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    if (r.bottom < 0) { io.disconnect(); return settle(); }
    if (vis > Math.min(r.height * .55, innerHeight * .6)) { io.disconnect(); sequence(); }
  }, { threshold: [0, .2, .4, .55, .7, .9, 1] });
  io.observe(bench); io.observe(el.querySelector('.pl-desk'));
}
