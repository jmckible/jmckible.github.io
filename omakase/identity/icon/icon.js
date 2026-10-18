// The Omarchy icon, redrawn as geometry from identity/hand/omarchy-icon.png (300 px, 20 px
// bars: a 15 × 15 grid of modules). Two concentric square rings, each with one gap, and
// three short tabs that tie the rings together across the channel between them.
//
// Everything here is in modules; a page multiplies by its own module size.

import { rng } from '../kit/kit.js';
export { rng };

export const N = 15;

// The icon as non-overlapping bars: it tiles the green cells of the PNG exactly.
export const BARS = [
  [0, 0, 15, 1], [0, 1, 1, 14], [14, 1, 1, 14], [1, 14, 7, 1], [9, 14, 5, 1],   // outer ring, gap at the bottom
  [2, 2, 6, 1], [11, 2, 2, 1], [2, 3, 1, 10], [12, 3, 1, 10], [3, 12, 9, 1],    // inner ring, gap at the top
  [7, 1, 1, 1], [1, 7, 1, 1], [7, 13, 1, 1],                                     // the three tabs
];

// The icon as strips someone would cut and lay: full-length bars that overlap where they
// meet (paper on paper, never a gap inside a bar), and tabs long enough to bridge the
// channel and lie on both rings. Order is the laying order.
export const STRIPS = [
  { r: [0, 0, 15, 1], name: 'outer top' },
  { r: [0, 0, 1, 15], name: 'outer left' },
  { r: [14, 0, 1, 15], name: 'outer right' },
  { r: [0, 14, 8, 1], name: 'outer bottom, left' },
  { r: [9, 14, 6, 1], name: 'outer bottom, right' },
  { r: [2, 2, 6, 1], name: 'inner top, left' },
  { r: [2, 2, 1, 11], name: 'inner left' },
  { r: [2, 12, 11, 1], name: 'inner bottom' },
  { r: [12, 2, 1, 11], name: 'inner right' },
  { r: [11, 2, 2, 1], name: 'inner top, right' },
  { r: [7, .12, 1, 2.76], name: 'top tab' },
  { r: [.12, 7, 2.76, 1], name: 'left tab' },
  { r: [7, 12.12, 1, 2.76], name: 'bottom tab' },
];

// Tape at the joins: [x, y, angle (deg), length (modules), after strip indices]
export const JOINS = [
  [.5, .5, -42, 1.9, [0, 1]], [14.5, .5, 40, 1.9, [0, 2]],
  [.5, 14.5, 44, 1.9, [1, 3]], [14.5, 14.5, -38, 1.9, [2, 4]],
  [2.5, 2.5, -40, 1.7, [5, 6]], [2.5, 12.5, 41, 1.7, [6, 7]],
  [12.5, 12.5, -44, 1.7, [7, 8]], [12.5, 2.5, 38, 1.7, [8, 9]],
  [7.5, 1.5, 86, 3.3, [10]], [1.5, 7.5, -3, 3.3, [11]], [7.5, 13.5, 93, 3.3, [12]],
];

// hand placement: a seeded nudge in position, length, width and angle. Small enough that
// no channel (one module) ever closes; big enough that nothing is square.
export function place([x, y, w, h], m, r, { slop = .045, tilt = .45, len = .06, wid = .035 } = {}) {
  const horiz = w >= h;
  const dw = horiz ? r.range(-len, len) : r.range(-wid, wid), dh = horiz ? r.range(-wid, wid) : r.range(-len, len);
  return {
    left: (x + r.range(-slop, slop) - dw / 2) * m, top: (y + r.range(-slop, slop) - dh / 2) * m,
    width: (w + dw) * m, height: (h + dh) * m, rot: r.range(-tilt, tilt) * (horiz ? 1 : 1) / Math.max(1, Math.max(w, h) / 6),
  };
}

// ------------------------------------------------------------------ outlines ---------
// The icon's cells, and the loops around them (clockwise, y down), in modules.
export function grid() {
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  for (const [x, y, w, h] of BARS) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = 1;
  return g;
}
export function loops() {
  const g = grid(), on = (i, j) => i >= 0 && j >= 0 && i < N && j < N && g[j][i];
  const edges = new Map(), key = p => p.join(',');
  const add = (a, b) => { (edges.get(key(a)) || edges.set(key(a), []).get(key(a))).push([a, b]); };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (g[j][i]) {
    if (!on(i, j - 1)) add([i, j], [i + 1, j]);
    if (!on(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);
    if (!on(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);
    if (!on(i - 1, j)) add([i, j + 1], [i, j]);
  }
  const out = [];
  for (;;) {
    const first = [...edges.values()].find(l => l.length); if (!first) break;
    let e = first.shift(); const loop = [e[0]];
    for (;;) {
      const nx = edges.get(key(e[1]));
      if (!nx || !nx.length) break;
      e = nx.shift(); loop.push(e[0]);
    }
    // drop points that lie on a straight run
    const n = loop.length, pts = loop.filter((p, i) => { const a = loop[(i - 1 + n) % n], b = loop[(i + 1) % n];
      return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) !== 0; });
    out.push(pts);
  }
  return out;
}

// scissor a corner-to-corner polygon (px): corners nudged a little, each side cut as short
// straight snips with a slow wander (after the kit's cutRun)
export function scissor(poly, r, { step = [14, 40], jit = .55, wander = 1.1, corner = .9 } = {}) {
  const P = poly.map(([x, y]) => [x + r.range(-corner, corner), y + r.range(-corner, corner)]), out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    out.push(a); let t = r.range(step[0], step[1]) * .6, w = 0;
    while (t < L - 5) {
      w = Math.max(-wander, Math.min(wander, w + r.range(-wander, wander) * .6));
      const j = w + r.range(-jit, jit) * .4, e = Math.min(t, L - t) < 10 ? Math.min(t, L - t) / 10 : 1;
      out.push([a[0] + ux * t - uy * j * e, a[1] + uy * t + ux * j * e]);
      t += r.range(step[0], step[1]);
    }
  }
  return out;
}
export const pathD = (pts, k = 1, dx = 0, dy = 0) => 'M' + pts.map(q => ((q[0] + dx) * k).toFixed(1) + ' ' + ((q[1] + dy) * k).toFixed(1)).join('L') + 'Z';

// a soft shadow, baked once into a small bitmap (the kit's way: never a live filter)
export function shadowURL(d, W, H, layers, { clip, q = .5, evenodd = true } = {}) {
  const c = document.createElement('canvas'); c.width = Math.ceil(W * q); c.height = Math.ceil(H * q);
  const x = c.getContext('2d'), P = new Path2D(d), FAR = 20000; x.scale(q, q);
  if (clip) x.clip(new Path2D(clip), 'evenodd');
  for (const [dx, dy, blur, a] of layers) {
    x.save(); x.shadowColor = `rgba(34,20,10,${a})`; x.shadowBlur = blur * q; x.shadowOffsetX = (FAR + dx) * q; x.shadowOffsetY = dy * q;
    x.translate(-FAR, 0); x.fillStyle = '#000'; x.fill(P, evenodd ? 'evenodd' : 'nonzero'); x.restore();
  }
  return c.toDataURL('image/png');
}

// the query string's ?t= (seconds), or null
export const frozen = () => { const t = new URLSearchParams(location.search).get('t'); return t == null || t === '' ? null : Math.max(0, parseFloat(t) || 0); };
