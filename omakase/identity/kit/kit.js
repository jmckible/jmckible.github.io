// my omakase: the identity kit, as a plain ES module.
//
//   <link rel="stylesheet" href="identity/kit/kit.css">
//   <script type="module" src="identity/kit/kit.js"></script>
//
// On load it cuts every piece (.k-paper .k-felt .k-tissue .k-slip) to a
// scissored or torn outline, bakes its shadow and stitches once, adds tape, and defines
// <k-wordmark>, <k-hole>, <k-patch>. Pieces are baked lazily as they near
// the viewport and again only if their size changes. Nothing runs while the page scrolls.

const BASE = new URL('./', import.meta.url);
const asset = p => new URL(p, BASE).href;
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
root.classList.add('k-js');

// ------------------------------------------------------------------ random -----------
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  const r = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.range = (a, b) => a + r() * (b - a);
  r.pick = a => a[Math.floor(r() * a.length)];
  return r;
}
const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ colour -----------
const probeCtx = document.createElement('canvas').getContext('2d');
function rgb(str) {
  probeCtx.fillStyle = '#000'; probeCtx.fillStyle = String(str).trim() || '#000';
  const v = probeCtx.fillStyle;
  if (v[0] === '#') return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
  return v.match(/[\d.]+/g).slice(0, 3).map(Number);
}
const css = c => `rgb(${c.map(v => Math.round(v)).join(',')})`;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const shade = (c, k) => k >= 0 ? mix(c, [255, 250, 240], k) : mix(c, [14, 6, 8], -k);
const lum = c => (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255;
const prop = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

// ------------------------------------------------------------------ the hand ---------
// One hand: Beth Ellen. --k-hand in kit.css names it; these stay for scripts that ask.
export const HANDS = { 'beth-ellen': 'Beth Ellen' };
export const DEFAULT_HAND = 'beth-ellen';
export const hand = () => DEFAULT_HAND;

// ------------------------------------------------------------------ outlines ---------
// All outlines are arrays of [x, y] in the element's own box (0..w, 0..h), clockwise.
// Points may carry .t = 1 when they lie on a torn stretch.

// a scissor run from a to b: straight snips with a slow wander (b excluded)
function cutRun(a, b, r, o) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  const out = []; let t = 0, w = 0;
  while (t < len - 4) {
    const j = t === 0 ? r.range(-o.jit, o.jit) * .5 : w + r.range(-o.jit, o.jit);
    out.push([a[0] + ux * t - uy * j, a[1] + uy * t + ux * j]);
    w = clamp(w + r.range(-o.wander, o.wander) * .6, -o.wander, o.wander);
    t += r.range(o.step[0], o.step[1]);
  }
  return out;
}
// a tear from a to b: midpoint displacement, rough and fibrous (b excluded)
function tearRun(a, b, r, amp = 1, rough = .5) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
  let pts = [[0, 0], [1, 0]], d = Math.min(len * .045, 8) * amp;
  while (pts.length < len / 2.6) {
    const nxt = [pts[0]];
    for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i]; nxt.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + r.range(-d, d)], q); }
    pts = nxt; d *= rough + .12;
  }
  return pts.slice(0, -1).map(([t, o], i) => {
    const f = i === 0 ? 0 : r.range(-.45, .45) * amp, e = Math.min(t, 1 - t) < .02 ? 0 : 1;
    const q = [a[0] + (b[0] - a[0]) * t + nx * (o * e + f), a[1] + (b[1] - a[1]) * t + ny * (o * e + f)]; q.t = 1; return q;
  });
}
const CUT = {
  paper: { step: [16, 54], jit: .7, wander: 1.3, overcut: .3 },
  slip: { step: [14, 44], jit: .5, wander: .9, overcut: .2 },
  felt: { step: [7, 18], jit: .8, wander: 1.4, overcut: 0 },
};
// a rectangle cut by hand; torn sides listed in `torn` ("top right bottom left" or "all")
function rectOutline(w, h, r, { cut = CUT.paper, torn = '', amp = 1, round = 0 } = {}) {
  const T = torn === 'all' ? 'top right bottom left' : torn;
  const ins = round ? Math.min(round, w / 3, h / 3) : 0;
  const C = [[0, 0], [w, 0], [w, h], [0, h]], sides = ['top', 'right', 'bottom', 'left'], out = [];
  for (let i = 0; i < 4; i++) {
    const a = C[i], b = C[(i + 1) % 4], ux = Math.sign(b[0] - a[0]), uy = Math.sign(b[1] - a[1]);
    const a2 = [a[0] + ux * ins, a[1] + uy * ins], b2 = [b[0] - ux * ins, b[1] - uy * ins];
    if (T.includes(sides[i])) out.push(...tearRun(a2, b2, r, amp));
    else {
      const run = cutRun(a2, b2, r, cut);
      // the blades ran past the corner: a tiny spike
      if (!ins && run.length && r() < (cut.overcut || 0)) { const [px, py] = C[(i + 3) % 4]; const ex = a[0] - px, ey = a[1] - py, el = Math.hypot(ex, ey) || 1;
        out.push([a[0] + ex / el * r.range(2, 4), a[1] + ey / el * r.range(2, 4)]); }
      out.push(...run);
    }
    if (ins) { // a snipped-round corner
      const c = C[(i + 1) % 4], d = C[(i + 2) % 4], vx = Math.sign(d[0] - c[0]), vy = Math.sign(d[1] - c[1]);
      for (let k = 1; k < 4; k++) { const t = k / 4; const p0 = b2, p2 = [c[0] + vx * ins, c[1] + vy * ins];
        out.push([(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p2[0] + r.range(-.4, .4), (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p2[1] + r.range(-.4, .4)]); }
    }
  }
  return out;
}
// a smooth closed curve through k wobbly points, sampled densely
function blobDense(cx, cy, rx, ry, r, k = 8, v = .2) {
  const P = [], ph = r() * 6;
  for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2 + r.range(-.12, .12) + ph, m = 1 + v * Math.sin(a * 2 + ph) * .5 + r.range(-v, v) * .6;
    P.push([cx + Math.cos(a) * rx * m, cy + Math.sin(a) * ry * m]); }
  const out = [];
  for (let i = 0; i < k; i++) {
    const p0 = P[(i - 1 + k) % k], p1 = P[i], p2 = P[(i + 1) % k], p3 = P[(i + 2) % k];
    for (let j = 0; j < 16; j++) { const t = j / 16, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
  }
  // fit inside the box it was asked for
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; out.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const sx = rx * 2 / (x1 - x0), sy = ry * 2 / (y1 - y0);
  return out.map(([x, y]) => [cx + (x - (x0 + x1) / 2) * sx, cy + (y - (y0 + y1) / 2) * sy]);
}
function ellipseDense(cx, cy, rx, ry, n = 120) {
  const out = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return out;
}
// scissor any dense closed polyline: keep a point every snip, jitter along the normal
function cutPoly(dense, r, o = CUT.paper) {
  const n = dense.length, out = []; let acc = 0, next = 0, w = 0;
  for (let i = 0; i < n; i++) {
    const a = dense[i], b = dense[(i + 1) % n], p = dense[(i - 1 + n) % n];
    if (acc >= next) {
      let nx = -(b[1] - p[1]), ny = b[0] - p[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      const j = w + r.range(-o.jit, o.jit);
      out.push([a[0] - nx * j, a[1] - ny * j]);
      w = clamp(w + r.range(-o.wander, o.wander) * .6, -o.wander, o.wander);
      next = acc + r.range(o.step[0], o.step[1]);
    }
    acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return out;
}
function tearPoly(dense, r, amp = 1) {
  const n = dense.length, knots = []; let acc = 0, next = 0;
  for (let i = 0; i < n; i++) { const a = dense[i], b = dense[(i + 1) % n]; if (acc >= next) { knots.push(a); next = acc + r.range(26, 46); } acc += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const out = []; knots.forEach((a, i) => out.push(...tearRun(a, knots[(i + 1) % knots.length], r, amp)));
  return out;
}
// push torn stretches outward: the white core that shows where the top surface tore back
function coreOf(pts, r, by = [1.6, 4.4]) {
  const n = pts.length, ph = r() * 9; let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  return pts.map((q, i) => {
    if (!q.t) return q;
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n]; let nx = (b[1] - a[1]) * s, ny = -(b[0] - a[0]) * s; const m = Math.hypot(nx, ny) || 1;
    const d = by[0] + (by[1] - by[0]) * (.5 + .5 * Math.sin(i * .11 + ph)) + r.range(0, 1.2);
    return [q[0] + nx / m * d, q[1] + ny / m * d];
  });
}
function shrink(pts, by) { // pull a closed outline inward (for stitches), about its centre
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sx = Math.max(0, (x1 - x0) / 2 - by) / ((x1 - x0) / 2), sy = Math.max(0, (y1 - y0) / 2 - by) / ((y1 - y0) / 2);
  return pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
}
const pathD = (pts, dx = 0, dy = 0, k = 1) => 'M' + pts.map(q => ((q[0] + dx) * k).toFixed(1) + ' ' + ((q[1] + dy) * k).toFixed(1)).join('L') + 'Z';
const polygon = (pts, W, H, pad) => 'polygon(' + pts.map(q => ((q[0] + pad) / W * 100).toFixed(2) + '% ' + ((q[1] + pad) / H * 100).toFixed(2) + '%').join(',') + ')';
const svgURL = (W, H, inner) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W.toFixed(1)} ${H.toFixed(1)}' preserveAspectRatio='none'>${inner}</svg>`)}")`;

// ------------------------------------------------------------------ baking -----------
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const WEBP = canvas(1, 1).toDataURL('image/webp').startsWith('data:image/webp');
// A bitmap that never arrives is a failed bake, never a silent 'none': under GPU raster in
// the start-up rush, toBlob can hand back null or not call back at all.
const blobURL = (c, lossy) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('toBlob timed out')), 4000);
  c.toBlob(b => { clearTimeout(t); b ? res(URL.createObjectURL(b)) : rej(new Error('toBlob gave nothing')); }, lossy && WEBP ? 'image/webp' : 'image/png', .92);
});
const revoke = urls => urls.forEach(u => u && URL.revokeObjectURL(u));
// A failed bake is retried with backoff; a piece's size is recorded only once its bake has
// been applied, so nothing is ever skipped as "already cut" when it isn't.
function retry(el, st, e) {
  st.fails = (st.fails || 0) + 1;
  if (st.fails <= 6) setTimeout(() => { st.dirty = true; queue(el); }, 200 * 2 ** st.fails);
  else console.warn('kit: gave up cutting', el, e);
}
const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
let feltTile; const felt = () => feltTile ||= loadImage(asset('tex/felt.webp'));

// the shadow a piece throws, baked small: it is soft, so a low-resolution bitmap is enough
function shadowCanvas(pts, W, H, pad, layers) {
  const q = clamp(Math.sqrt(90000 / (W * H)), .1, .5), c = canvas(W * q, H * q), x = c.getContext('2d');
  const P = new Path2D(pathD(pts, pad, pad, q)), FAR = 20000;
  for (const [dx, dy, blur, a] of layers) {
    x.save(); x.shadowColor = `rgba(34,20,10,${a})`; x.shadowBlur = blur * q; x.shadowOffsetX = FAR + dx * q; x.shadowOffsetY = dy * q;
    x.translate(-FAR, 0); x.fillStyle = '#000'; x.fill(P); x.restore();
  }
  return c;
}
// running stitches along an outline, as SVG: shadow, floss, twist, needle holes
function stitchSVG(pts, dx, dy, colour, { len = 6, gap = 4.4, w = 2.2 } = {}) {
  const n = pts.length; let sh = '', th = '', tw = '', holes = '', acc = 0, on = true, start = null;
  const light = css(shade(rgb(colour), .5));
  const seg = (a, b) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    const A = [a[0] + dx, a[1] + dy], B = [b[0] + dx, b[1] + dy], f = v => v.toFixed(1);
    sh += `M${f(A[0] + .7)} ${f(A[1] + 1.2)}L${f(B[0] + .7)} ${f(B[1] + 1.2)}`;
    th += `M${f(A[0])} ${f(A[1])}L${f(B[0])} ${f(B[1])}`;
    for (let t = 1.6; t < L - 1; t += 2.4) { const px = A[0] + ux * t, py = A[1] + uy * t; tw += `M${f(px - uy * w * .32 - ux * .7)} ${f(py + ux * w * .32 - uy * .7)}L${f(px + uy * w * .32 + ux * .7)} ${f(py - ux * w * .32 + uy * .7)}`; }
    holes += `M${f(A[0] - ux * 1.2)} ${f(A[1] - uy * 1.2)}h.01M${f(B[0] + ux * 1.2)} ${f(B[1] + uy * 1.2)}h.01`;
  };
  // walk the outline at even spacing
  const walk = []; for (let i = 0; i <= n; i++) walk.push(pts[i % n]);
  let target = len;
  for (let i = 1; i < walk.length; i++) {
    let a = walk[i - 1]; const b = walk[i]; let L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!start) start = a;
    while (acc + L >= target) {
      const t = (target - acc) / L, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (on) seg(start, p);
      start = p; on = !on; L -= target - acc; a = p; acc = 0; target = on ? len : gap;
    }
    acc += L;
  }
  return `<path d='${sh}' stroke='rgba(24,10,12,.42)' stroke-width='${w + .9}' stroke-linecap='round' fill='none'/>` +
    `<path d='${th}' stroke='${colour}' stroke-width='${w}' stroke-linecap='round' fill='none'/>` +
    `<path d='${tw}' stroke='${light}' stroke-width='.6' opacity='.7' fill='none'/>` +
    `<path d='${holes}' stroke='rgba(20,8,10,.5)' stroke-width='1.9' stroke-linecap='round' fill='none'/>`;
}

// felt, drawn: thickness side, face with fibre tile, a rounded compressed edge, stray fibres
function drawFelt(x, pts, col, tile, r, { thick = 2.2, fuzz = 1, side, holes = [] } = {}) {
  const P = new Path2D(pathD(pts) + holes.map(h => pathD(h)).join('')), dark = lum(col) < .3;
  x.save(); x.translate(.4, thick); x.fillStyle = side || css(shade(col, -.42)); x.fill(P, 'evenodd'); x.restore();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([a, b]) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); });
  x.save(); x.clip(P, 'evenodd');
  x.fillStyle = css(col); x.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  if (tile) { const pat = x.createPattern(tile, 'repeat'); pat.setTransform(new DOMMatrix().translate(r.range(0, 320), r.range(0, 320)));
    x.globalAlpha = dark ? .7 : 1; x.fillStyle = pat; x.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4); x.globalAlpha = 1; }
  const inner = (c, dx, dy, blur) => { const m = x.getTransform(), k = Math.hypot(m.a, m.b); x.save(); x.shadowColor = c; x.shadowBlur = blur * k; x.shadowOffsetX = dx * k; x.shadowOffsetY = dy * k;
    const f = new Path2D(); f.rect(x0 - 300, y0 - 300, x1 - x0 + 600, y1 - y0 + 600); f.addPath(P); x.fillStyle = '#000'; x.fill(f, 'evenodd'); x.restore(); };
  // (with holes, the evenodd ring above shades the hole's rim the same way)
  inner(`rgba(10,4,6,${dark ? .5 : .3})`, -1.2, -1.8, 4);
  inner(`rgba(255,248,236,${dark ? .14 : .22})`, 1.2, 1.6, 3);
  x.restore();
  // stray fibres along the cut, mostly pointing out (into the hole, for a hole)
  x.lineCap = 'round';
  for (const [poly, inv] of [[pts, 1], ...holes.map(h => [h, -1])]) {
  let area = 0; const n = poly.length; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = (area > 0 ? 1 : -1) * inv;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!L) continue;
    const nx = (b[1] - a[1]) / L * s, ny = -(b[0] - a[0]) / L * s;
    for (let t = 0; t < L; t += 1.15 / fuzz) {
      if (r() > .55) continue;
      const px = a[0] + (b[0] - a[0]) * t / L, py = a[1] + (b[1] - a[1]) * t / L, sg = r() < .72 ? 1 : -1;
      const ang = Math.atan2(ny * sg, nx * sg) + r.range(-1.2, 1.2), long = r() < .04 * fuzz, l = long ? r.range(5, 12) : r.range(1.2, 4 * Math.sqrt(fuzz));
      const sx = px - Math.cos(ang) * r.range(0, 2), sy = py - Math.sin(ang) * r.range(0, 2), ex = sx + Math.cos(ang) * l, ey = sy + Math.sin(ang) * l, bend = r.range(-.8, .8) * l * .4;
      x.strokeStyle = css(shade(col, r.range(-.2, dark ? .28 : .16))); x.globalAlpha = long ? r.range(.35, .6) : r.range(.35, .8); x.lineWidth = r.range(.4, .9);
      x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo((sx + ex) / 2 - Math.sin(ang) * bend, (sy + ey) / 2 + Math.cos(ang) * bend, ex, ey); x.stroke();
    }
  }
  }
  x.globalAlpha = 1;
}
// floss: separate stitches laid through felt, in canvas
function floss(x, segs, col, w = 3) {
  const c = rgb(col); x.save(); x.lineCap = 'round';
  for (const [x0, y0, x1, y1] of segs) {
    x.save(); x.shadowColor = 'rgba(20,8,10,.5)'; const k = Math.hypot(x.getTransform().a, x.getTransform().b); x.shadowBlur = 1.6 * k; x.shadowOffsetX = .8 * k; x.shadowOffsetY = 1.4 * k;
    x.strokeStyle = css(shade(c, -.3)); x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.restore();
    x.strokeStyle = css(c); x.lineWidth = w * .62; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    x.strokeStyle = css(shade(c, .5)); x.lineWidth = .7;
    for (let t = 2; t < L - 1; t += 3.2) { const px = x0 + ux * t, py = y0 + uy * t; x.beginPath(); x.moveTo(px - uy * w * .3 - ux, py + ux * w * .3 - uy); x.lineTo(px + uy * w * .3 + ux, py - ux * w * .3 + uy); x.stroke(); }
    x.fillStyle = 'rgba(20,8,10,.45)'; [[x0, y0], [x1, y1]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, .9, 0, 7); x.fill(); });
  }
  x.restore();
}
function runningFloss(pts, len = 7, gap = 5) {
  const segs = [], n = pts.length; let acc = 0, on = true, start = pts[0], target = len;
  for (let i = 1; i <= n; i++) {
    let a = pts[i - 1]; const b = pts[i % n]; let L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc + L >= target) { const t = (target - acc) / L, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (on) segs.push([...start, ...p]); start = p; on = !on; L -= target - acc; a = p; acc = 0; target = on ? len : gap; }
    acc += L;
  }
  return segs;
}

// ------------------------------------------------------------------ pieces -----------
const PIECES = '.k-paper, .k-felt, .k-tissue, .k-slip';
const state = new WeakMap();
let order = 0;

function seedOf(el) {
  if (el.dataset.seed) return hash(el.dataset.seed);
  const s = state.get(el); if (s?.seed) return s.seed;
  return hash((el.id || '') + '|' + (el.className || '') + '|' + (el.textContent || '').slice(0, 40) + '|' + (order++));
}
function kindOf(el) {
  const c = el.classList;
  return c.contains('k-felt') ? 'felt' : c.contains('k-tissue') ? 'tissue' : c.contains('k-slip') ? 'slip' : 'paper';
}
function outlineFor(el, kind, w, h, r) {
  const shape = el.dataset.shape, torn = el.dataset.torn != null ? (el.dataset.torn || 'all') : (kind === 'tissue' ? 'all' : '');
  if (shape === 'blob' || shape === 'round') {
    const dense = shape === 'round' ? ellipseDense(w / 2, h / 2, w / 2, h / 2) : blobDense(w / 2, h / 2, w / 2, h / 2, r, 8, .16);
    if (torn) { const t = tearPoly(dense, r, .8); t.forEach(q => q.t = 1); return t; }
    return cutPoly(dense, r, kind === 'felt' ? CUT.felt : CUT.paper);
  }
  return rectOutline(w, h, r, { cut: CUT[kind] || CUT.paper, torn, amp: kind === 'tissue' ? 1.1 : .9, round: kind === 'felt' ? Math.min(8, h / 5) : 0 });
}

async function bake(el) {
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const st = state.get(el) || {}; state.set(el, st);
  if (st.w === w && st.h === h && !st.dirty) return;
  if (st.job && st.job.w === w && st.job.h === h && !st.dirty) return;   // this very bake is under way
  const job = st.job = { w, h }; st.dirty = false; st.seed ||= seedOf(el);
  const urls = [];
  try {
  if (getComputedStyle(el).position === 'static') console.warn('kit: a piece needs a position other than static (its layers are absolutely positioned)', el);
  const kind = kindOf(el), r = rng(st.seed), pad = parseFloat(getComputedStyle(el).getPropertyValue('--k-p')) || 24;
  const W = w + pad * 2, H = h + pad * 2;
  const pts = outlineFor(el, kind, w, h, r);
  const torn = pts.some(q => q.t);
  const colour = rgb(prop(el, '--k-c') || '#e2d3ab');
  const thread = prop(el, '--k-thread') || '#d8367f';
  const stitched = el.classList.contains('k-stitch');
  const set = {};
  // texture offset, so neighbouring pieces don't share a tile phase
  set['--k-tx'] = Math.round(r() * 400) + 'px'; set['--k-ty'] = Math.round(r() * 400) + 'px';
  set['--k-fade'] = Math.round(r.range(100, 160)) + 'deg';

  if (kind === 'felt') {
    const area = W * H, S = area > 900000 ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const tile = await felt().catch(() => null);
    const c = canvas(W * S, H * S), x = c.getContext('2d'); x.scale(S, S); x.translate(pad, pad);
    drawFelt(x, pts, colour, tile, r, { fuzz: 1 });
    if (stitched) floss(x, runningFloss(shrink(pts, Math.min(9, h / 4))), thread, 2.6);
    const sh = shadowCanvas(pts, W, H, pad, [[1, 2.5, 3, .38], [3, 7, 11, .26]]);
    const [a, b] = await Promise.all([blobURL(c, true), blobURL(sh)]); urls.push(a, b);
    set['--k-sprite'] = `url(${a})`; set['--k-under'] = `url(${b})`; set['--k-clip'] = 'none';
  } else if (kind === 'tissue') {
    const fringe = pts.map(q => q); const grown = coreOf(fringe.map(q => { const p = [q[0], q[1]]; p.t = 1; return p; }), r, [1.5, 3.2]);
    set['--k-clip'] = polygon(pts, W, H, pad);
    set['--k-under'] = svgURL(W, H, `<path d='${pathD(grown, pad, pad)}' fill='${css(colour)}' opacity='.4'/>`);
  } else {
    const core = torn ? coreOf(pts, r) : pts;
    const small = kind === 'slip';
    const sh = shadowCanvas(core, W, H, pad, small ? [[1, 2, 2.5, .3]] : [[1.5, 3, 4, .26], [4, 9, 16, .2]]);
    const b = await blobURL(sh); urls.push(b);
    let svg = `<path d='${pathD(core, pad + .5, pad + 1.1)}' fill='rgba(40,24,10,.3)'/>`;
    if (torn) svg += `<path d='${pathD(core, pad, pad)}' fill='${prop(el, '--k-core') || '#fbf8f0'}'/>`;
    set['--k-clip'] = polygon(pts, W, H, pad);
    set['--k-under'] = `${svgURL(W, H, svg)}, url(${b})`;
    if (stitched) set['--k-over'] = svgURL(W, H, stitchSVG(shrink(pts, Math.min(10, h / 4, w / 4)), pad, pad, thread));
  }
  if (st.job !== job) { revoke(urls); return; }            // a newer bake took over
  for (const k in set) el.style.setProperty(k, set[k]);
  el.classList.add('k-cut');
  // let the old bitmaps go once the new ones are painted
  const old = st.urls || []; st.urls = urls; if (old.length) setTimeout(() => revoke(old), 1000);
  st.w = w; st.h = h; st.fails = 0; st.job = null;
  if (el.offsetWidth !== w || el.offsetHeight !== h) queue(el);   // it moved on while we worked
  } catch (e) { revoke(urls); if (st.job === job) st.job = null; retry(el, st, e); }
}

// tape across edges: data-tape="top" | "tl br" | "left right" ...; data-tape-kind="masking"
function tape(el) {
  if (el.querySelector(':scope > .k-tape[data-auto]')) return;
  const r = rng(hash('tape' + seedOf(el))), w = el.offsetWidth || 200, h = el.offsetHeight || 100;
  const kind = el.dataset.tapeKind === 'masking' ? 'masking' : 'scotch';
  for (const where of el.dataset.tape.split(/\s+/).filter(Boolean)) {
    const t = document.createElement('i'); t.className = 'k-tape' + (kind === 'masking' ? ' k-masking' : ''); t.dataset.auto = ''; t.setAttribute('aria-hidden', 'true');
    const len = clamp(Math.min(w, h) * .5, 54, 118) * r.range(.9, 1.1);
    const P = { top: [r.range(35, 65) + '%', '0px', r.range(-7, 7)], bottom: [r.range(35, 65) + '%', '100%', r.range(-7, 7)],
      left: ['0px', r.range(30, 60) + '%', 90 + r.range(-8, 8)], right: ['100%', r.range(30, 60) + '%', 90 + r.range(-8, 8)],
      tl: ['6px', '6px', -38 + r.range(-8, 8)], tr: ['calc(100% - 6px)', '6px', 38 + r.range(-8, 8)],
      bl: ['6px', 'calc(100% - 6px)', 38 + r.range(-8, 8)], br: ['calc(100% - 6px)', 'calc(100% - 6px)', -38 + r.range(-8, 8)] }[where];
    if (!P) continue;
    t.style.cssText = `--k-x:${P[0]};--k-y:${P[1]};--k-r:${P[2].toFixed(1)}deg;--k-w:${Math.round(len)}px;--k-tx:${Math.round(r() * 160)}px`;
    teeth(t, r, kind);
    if (r() < .35) t.dataset.lift = r() < .5 ? 'bl' : 'none';
    el.appendChild(t);
  }
}
// serrated (Scotch, from the dispenser) or torn (masking, by hand) ends
function teeth(t, r, kind) {
  const H = kind === 'masking' ? 30 : 26, R = [], L = [];
  for (let y = 0; y <= H; y += kind === 'masking' ? r.range(2.5, 5) : r.range(2.4, 3.4)) {
    const z = kind === 'masking' ? r.range(0, 4) : (R.length % 2 ? r.range(2, 3.2) : r.range(0, .6));
    R.push(`calc(100% - ${z.toFixed(1)}px) ${Math.min(y, H).toFixed(1)}px`);
    const z2 = kind === 'masking' ? r.range(0, 4) : (L.length % 2 ? r.range(2, 3.2) : r.range(0, .6));
    L.push(`${z2.toFixed(1)}px ${Math.min(y, H).toFixed(1)}px`);
  }
  R.push(`100% 100%`); L.push(`0 100%`);
  t.style.setProperty('--k-teeth', `polygon(${[...R, ...L.reverse()].join(',')})`);
}

// a stitched seam, one stitch per tile
function seam(el) {
  const c = prop(el, '--k-thread') || '#d8367f';
  el.style.setProperty('--k-seam-img', svgURL(22, 12, stitchSVG([[3, 6], [15, 6.4], [15, 6.4], [3, 6]], 0, 0, c, { len: 12, gap: 30 })));
}

// ------------------------------------------------------------------ scheduling -------
const pending = new Set(); let scheduled = false;
function queue(el) { pending.add(el); if (!scheduled) { scheduled = true; requestAnimationFrame(run); } }
function run() {
  scheduled = false; const t0 = performance.now();
  for (const el of pending) {
    pending.delete(el);
    if (el.matches(PIECES)) bake(el); else if (el.localName === 'k-hole') el.cut?.();
    if (performance.now() - t0 > 10 && pending.size) { scheduled = true; requestAnimationFrame(run); return; }
  }
}
const near = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { near.unobserve(e.target); queue(e.target); } }), { rootMargin: '150% 0px' });
let resizeT; const resized = new Set();
const sizes = new ResizeObserver(es => {
  for (const e of es) { const st = state.get(e.target), at = st?.job || (st?.w != null ? st : null);
    if (at && (Math.abs(at.w - e.target.offsetWidth) > .5 || Math.abs(at.h - e.target.offsetHeight) > .5)) resized.add(e.target);
    else if (!at && st?.tried && e.target.offsetWidth) resized.add(e.target); }   // was empty when the idle pass reached it
  if (resized.size) { clearTimeout(resizeT); resizeT = setTimeout(() => { resized.forEach(queue); resized.clear(); }, 140); }
});
const lay = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { lay.unobserve(e.target); const el = e.target;
  el.classList.add('k-in'); const done = () => el.classList.add('k-done'); el.addEventListener('transitionend', done, { once: true }); setTimeout(done, 1500); } }), { threshold: .12 });

function register(node) {
  if (node.nodeType !== 1) return;
  const all = [...(node.matches(PIECES) ? [node] : []), ...node.querySelectorAll(PIECES)];
  for (const el of all) { if (state.has(el)) continue; state.set(el, {}); near.observe(el); sizes.observe(el); }
  for (const el of [...(node.matches('[data-tape]') ? [node] : []), ...node.querySelectorAll('[data-tape]')]) tape(el);
  for (const el of [...(node.matches('[data-tilt]') ? [node] : []), ...node.querySelectorAll('[data-tilt]')]) {
    if (el.style.getPropertyValue('--k-r')) continue;
    const v = el.dataset.tilt; el.style.setProperty('--k-r', (v && !isNaN(v) ? +v : rng(hash('tilt' + seedOf(el))).range(-1.6, 1.6)).toFixed(2) + 'deg');
  }
  for (const el of [...(node.matches('.k-seam') ? [node] : []), ...node.querySelectorAll('.k-seam')]) seam(el);
  for (const el of [...(node.matches('.k-lay') ? [node] : []), ...node.querySelectorAll('.k-lay')]) if (!el.classList.contains('k-in')) lay.observe(el);
}
/** Cut and bake everything under `node` (the document by default). Safe to call again. */
export function cut(node = document.body) { register(node); }
/** Re-bake one piece now, e.g. after changing its colour class. */
export function rebake(el) { const st = state.get(el); if (st) st.dirty = true; else register(el); queue(el); }

// ------------------------------------------------------------------ the desk ---------
let WP, AL;
export const wallpapers = () => WP ||= fetch(asset('wallpapers.json')).then(r => r.json());
export const albums = () => AL ||= fetch(asset('albums.json')).then(r => r.json());
export const PERIODS = ['morning', 'afternoon', 'dusk', 'night'];
export function periodOf(d = new Date()) { const h = d.getHours() + d.getMinutes() / 60; return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'dusk' : 'night'; }
const humanize = n => n.replace(/^\d+-/, '').replace(/^(pexels|annie-spratt|andras-kovacs|nga|ran-ding)-?/, '').replace(/[-_]+/g, ' ').replace(/\b\d{5,}\b/g, '').trim();
/** What a hole's slip says about what it shows, honestly: "wallpaper 36 · green hills",
 *  "Snail Mail · Lush · 2018". A wallpaper whose file name is only a stock-photo id gets
 *  its number alone. Slips set it in capitals. */
export function captionOf(item) {
  if (!item) return '';
  if (item.caption != null) return item.caption;
  // the dot stays with the word before it, so a wrapped slip never starts or ends on one
  if (item.artist) return [item.artist, item.title, item.year].filter(Boolean).join('\u00a0· ');
  if (item.name) { const n = parseInt(item.name, 10), words = humanize(item.name);
    return isNaN(n) ? words : !words || /\d/.test(words) ? `wallpaper\u00a0${n}` : `wallpaper\u00a0${n}\u00a0· ${words}`; }
  return '';
}
/** Resolve a wallpaper spec to a list and a starting index.
 *  "63" (by number) | "now" (this hour's period) | "morning" "afternoon" "dusk" "night" "clear" "cloudy" | "all" | a file name */
export async function wallpaperList(spec = 'now', salt = 0) {
  const idx = await wallpapers(); let list, i = 0;
  const day = Math.floor(Date.now() / 864e5);
  if (/^\d+$/.test(spec)) { list = idx.all; i = Math.max(0, list.findIndex(n => n.startsWith(String(spec).padStart(2, '0') + '-'))); }
  else if (spec === 'now') { list = idx[periodOf()]; i = (day * 7 + new Date().getHours() + salt) % list.length; }
  else if (idx[spec]) { list = idx[spec]; i = (day + salt * 5) % list.length; }
  else { list = idx.all; i = Math.max(0, list.indexOf(spec)); }
  return { i, items: list.map(n => { const it = { src: asset(`wallpapers/${n}.webp`), small: asset(`wallpapers-640/${n}.webp`), alt: humanize(n), name: n, n: parseInt(n, 10) }; it.caption = captionOf(it); return it; }) };
}
/** "all" | "random" | a slug ("snail-mail-lush") | an index */
export async function albumList(spec = 'all', salt = 0) {
  const list = await albums(); let i = 0;
  if (/^\d+$/.test(spec)) i = +spec % list.length;
  else if (spec === 'random') i = Math.floor(Math.random() * list.length);
  else if (spec !== 'all') i = Math.max(0, list.findIndex(a => a.file.includes(spec)));
  else i = (salt * 5) % list.length;
  return { i, items: list.map(a => { const it = { src: asset(a.file), alt: `${a.artist}, ${a.title} (${a.year})`, ...a }; it.caption = captionOf(it); return it; }) };
}

// ------------------------------------------------------------------ <k-hole> ---------
let holeCount = 0;
const mirror = (pts, w) => pts.map(q => { const p = [w - q[0], q[1]]; p.t = q.t; return p; }).reverse();
class KHole extends HTMLElement {
  connectedCallback() {
    if (this.win) return;
    this.n = holeCount++;
    this.win = document.createElement('span'); this.win.className = 'k-hole-win';
    this.imgs = [new Image(), new Image()];
    this.imgs.forEach(im => { im.decoding = 'async'; im.alt = ''; this.win.appendChild(im); });
    this.prepend(this.win);
    if (this.hasAttribute('reveal') || this.hasAttribute('piece')) this.makePiece();
    if (this.hasAttribute('caption')) {
      this.cap = document.createElement('span'); this.cap.className = 'k-slip k-hole-cap'; this.cap.hidden = true;
      this.cap.dataset.seed = 'cap' + (this.getAttribute('seed') || this.n);
      this.append(this.cap);
    }
    if (this.getAttribute('href')) { this.tabIndex = 0; this.setAttribute('role', 'link');
      const go = () => location.assign(this.getAttribute('href'));
      this.addEventListener('click', go); this.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
    state.set(this, {}); near.observe(this); sizes.observe(this);
    this.load();
  }
  // The piece that came out: two faces on a card. The front is the sheet the hole was cut
  // from; the back is the paper's other side, and either can carry a line in the pen.
  makePiece() {
    const face = (cls, text) => { const f = document.createElement('b'); f.className = 'k-piece-face ' + cls;
      if (text) { const t = document.createElement('span'); t.className = 'k-pen'; t.textContent = text; f.append(t); } return f; };
    const front = this.getAttribute('piece-front'), back = this.getAttribute('piece-back');
    this.piece = document.createElement('i'); this.piece.className = 'k-hole-piece';
    if (!front && !back) this.piece.setAttribute('aria-hidden', 'true');
    const shadow = document.createElement('i'); shadow.className = 'k-piece-shadow';
    const card = document.createElement('i'); card.className = 'k-piece-card';
    card.append(face('k-piece-front', front), face('k-piece-back', back));
    // markup can supply richer faces: <span data-face="back">…</span> inside the hole
    this.querySelectorAll(':scope > [data-face]').forEach(el => card.querySelector(el.dataset.face === 'front' ? '.k-piece-front' : '.k-piece-back').append(el));
    this.piece.append(shadow, card); this.append(this.piece);
  }
  disconnectedCallback() { clearTimeout(this.timer); this.vis?.disconnect(); }
  static get observedAttributes() { return ['wallpaper', 'album', 'src', 'caption']; }
  attributeChangedCallback(name) { if (!this.win) return; name === 'caption' ? this.caption(this.current) : this.load(); }
  async load() {
    const salt = +(this.getAttribute('salt') ?? this.n);
    let res;
    if (this.hasAttribute('src')) res = { i: 0, items: [{ src: this.getAttribute('src'), alt: this.getAttribute('alt') || '' }] };
    else if (this.hasAttribute('album')) res = await albumList(this.getAttribute('album') || 'all', salt);
    else res = await wallpaperList(this.getAttribute('wallpaper') || 'now', salt);
    this.items = res.items; this.i = res.i; this.front = 0; this.shown = false;
    if (this.near) this.first();
    const cyc = parseFloat(this.getAttribute('cycle'));
    if (cyc > 0 && this.items.length > 1 && !reduced.matches) {
      this.vis?.disconnect();
      this.vis = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible && !this.timer) this.tick(cyc); });
      this.vis.observe(this);
    }
  }
  // the first image loads only when the hole comes near the viewport (kit.js's own lazy load)
  first() { if (this.shown || !this.items) return; this.shown = true; this.show(this.items[this.i], true); }
  tick(cyc) {
    this.timer = setTimeout(() => { this.timer = null; if (!this.visible || reduced.matches) return;
      this.i = (this.i + 1) % this.items.length; this.show(this.items[this.i]).then(() => this.tick(cyc)); }, cyc * 1000 + (this.n % 5) * 700);
  }
  async show(item, first) {
    const im = first ? this.imgs[0] : this.imgs[1 - this.front];
    im.alt = this.getAttribute('alt') ?? item.alt ?? '';
    // a hole no wider than 640 device pixels gets the small copy of a wallpaper
    const src = item.small && this.offsetWidth * Math.min(2, devicePixelRatio || 1) <= 640 ? item.small : item.src;
    await new Promise(res => { im.onload = im.onerror = res; im.src = src; if (im.complete && im.naturalWidth) res(); });
    this.imgs.forEach(x => x.classList.toggle('k-on', x === im)); this.imgs.forEach(x => x.setAttribute('aria-hidden', x === im ? 'false' : 'true'));
    this.front = this.imgs.indexOf(im); this.current = item;
    this.caption(item);
    this.dispatchEvent(new CustomEvent('k-hole-change', { detail: item, bubbles: true }));
  }
  // caption: the hole names what it shows on a typed slip. caption="…" says it in your words.
  caption(item) {
    if (!this.cap) return;
    const own = this.getAttribute('caption'), text = own || captionOf(item);
    this.cap.hidden = !text; if (this.cap.textContent !== text) this.cap.textContent = text;
  }
  /** Hold the reveal at `t` seconds in (null lets it run on). For recording and ?t= pages. */
  seekReveal(t) {
    if (!this.piece) return;
    this.classList.add('k-revealed');
    this.piece.getAnimations({ subtree: true }).forEach(a => { if (t == null) a.play(); else { a.pause(); a.currentTime = t * 1000; } });
  }
  async cut() {
    this.near = true; this.first();
    const w = this.offsetWidth, h = this.offsetHeight; if (!w || !h) return;
    const st = state.get(this); if (st.w === w && st.h === h && !st.dirty) return;
    if (st.job && st.job.w === w && st.job.h === h && !st.dirty) return;
    const job = st.job = { w, h }; st.dirty = false;
    st.seed ||= hash('hole' + (this.getAttribute('seed') || this.n));
    const urls = [];
    try {
      const r = rng(st.seed), m = parseFloat(getComputedStyle(this).getPropertyValue('--k-hole-m')) || 12, shape = this.getAttribute('shape') || 'blob';
      const edge = this.getAttribute('edge') || 'cut';
      const dense = shape === 'rect' ? null : shape === 'round' ? ellipseDense(w / 2, h / 2, w / 2 - m, h / 2 - m, 160) : blobDense(w / 2, h / 2, w / 2 - m, h / 2 - m, r, 7, .2);
      let pts;
      if (edge === 'torn') { pts = dense ? tearPoly(dense, r, .9) : rectOutline(w - 2 * m, h - 2 * m, r, { torn: 'all', amp: .8 }).map(q => { const p = [q[0] + m, q[1] + m]; p.t = 1; return p; }); pts.forEach(q => q.t = 1); }
      else pts = dense ? cutPoly(dense, r, { step: [10, 26], jit: 1, wander: 2.2 }) : rectOutline(w - 2 * m, h - 2 * m, r, { cut: CUT.paper }).map(q => [q[0] + m, q[1] + m]);
      const set = { '--k-clip': polygon(pts, w, h, 0) };
      // the sheet's own edge throws a shadow into the hole
      const q = clamp(Math.sqrt(60000 / (w * h)), .15, .5), c = canvas(w * q, h * q), x = c.getContext('2d');
      const P = new Path2D(pathD(pts, 0, 0, q)); x.clip(P);
      const f = new Path2D(); f.rect(-4000, -4000, 9000, 9000); f.addPath(P);
      x.shadowColor = 'rgba(20,8,10,.55)'; x.shadowBlur = 10 * q; x.shadowOffsetX = 20000 + 3 * q; x.shadowOffsetY = 7 * q; x.translate(-20000, 0); x.fillStyle = '#000'; x.fill(f, 'evenodd');
      const url = await blobURL(c); urls.push(url);
      // torn: a band of white core where the top surface tore back further than the core
      let svg = '', outer = pts;
      if (edge === 'torn') {
        outer = coreOf(pts, r, [3, 7]);
        svg = `<path d='${pathD(outer)}${pathD([...pts].reverse())}' fill='#fbf8f0' fill-rule='evenodd'/><path d='${pathD(outer)}' fill='none' stroke='rgba(60,40,20,.18)' stroke-width='.8'/>`;
      } else svg = `<path d='${pathD(pts, -.6, -1)}' fill='none' stroke='rgba(30,18,8,.35)' stroke-width='1.3'/>`;
      set['--k-rim'] = `${svgURL(w, h, svg)}, url(${url})`;
      if (this.piece) {
        // it lands face down, so its back is the mirror of the hole, and so is its shadow
        const back = mirror(pts, w), pad = parseFloat(getComputedStyle(this).getPropertyValue('--k-pad')) || 24;
        set['--k-clip-back'] = polygon(back, w, h, 0);
        set['--k-cutline'] = svgURL(w, h, `<path d='${pathD(pts)}' fill='none' stroke='rgba(30,18,8,.28)' stroke-width='1.1'/>`);
        const su = await blobURL(shadowCanvas(back, w + pad * 2, h + pad * 2, pad, [[1.5, 3, 4, .3], [4, 10, 16, .22]])); urls.push(su);
        set['--k-piece-shadow'] = `url(${su})`;
        // the front is whatever sheet the hole was cut through
        if (!prop(this, '--k-piece-front')) { const sheet = this.parentElement?.closest('.k-paper, .k-felt, .k-slip, .k-ground');
          set['--k-piece-sheet'] = sheet ? prop(sheet, '--k-c') || getComputedStyle(sheet).backgroundColor : prop(document.body, '--k-c') || '#e2d3ab'; }
      }
      if (st.job !== job) { revoke(urls); return; }
      for (const k in set) this.style.setProperty(k, set[k]);
      const old = st.urls || []; st.urls = urls; if (old.length) setTimeout(() => revoke(old), 1000);
      st.w = w; st.h = h; st.fails = 0; st.job = null;
      if (this.hasAttribute('reveal') && !this.revealer) {
        if (reduced.matches) this.classList.add('k-revealed');
        else { this.revealer = new IntersectionObserver(([e]) => { if (e.isIntersecting) { this.revealer.disconnect(); this.classList.add('k-revealed'); } }, { threshold: .5 });
          this.revealer.observe(this); }
      }
      if (this.offsetWidth !== w || this.offsetHeight !== h) queue(this);
    } catch (e) { revoke(urls); if (st.job === job) st.job = null; retry(this, st, e); }
  }
}

// ------------------------------------------------------------------ <k-wordmark> -----
// "omakase" cut from pieces of one dark sheet; "my" in the pen hand. Pieces inside a
// letter overlap by design (never a gap), and the cut is seeded: the same mark everywhere.
function arcRing(cx, cy, rx, ry, t, a0, a1) {
  const n = Math.max(10, Math.round(Math.abs(a1 - a0) / 4)), o = [], i = [];
  for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180;
    o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); i.push([cx + (rx - t) * Math.cos(a), cy + (ry - t) * Math.sin(a)]); }
  return o.concat(i.reverse());
}
const rectP = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function archP(x0, x1, t, base = 100) {
  const rx = (x1 - x0) / 2, ry = 44, cx = x0 + rx, cy = ry, Q = [], I = [];
  for (let k = 0; k <= 18; k++) { const a = Math.PI + Math.PI * k / 18; Q.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  for (let k = 18; k >= 0; k--) { const a = Math.PI + Math.PI * k / 18; I.push([cx + (rx - t) * Math.cos(a), cy + (ry - t * .9) * Math.sin(a)]); }
  return [[x0, base], ...Q, [x1, base], [x1 - t, base], ...I, [x0 + t, base]];
}
// The s is one cut: a single strip along an s-shaped spine, thickest through the middle
// stroke, its two ends snipped square. Every other letter keeps its overlapping pieces.
function sPiece() {
  const t = 21, P = [[83, 21], [71, 12], [50, 10.5], [29, 12], [17, 22], [20, 35], [36, 45], [56, 52], [72, 60], [80, 74], [71, 87], [48, 90], [25, 88], [10, 79]];
  const spine = [];   // a Catmull-Rom curve through the spine points
  for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let j = 0; j < 8; j++) { const u = j / 8, u2 = u * u, u3 = u2 * u;
      spine.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3))); } }
  spine.push(P[P.length - 1]);
  const L = [], R = [], n = spine.length;
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)], m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / m, ny = (b[0] - a[0]) / m;
    const k = i / (n - 1), bump = (c, s) => Math.exp(-(((k - c) / s) ** 2)), w = t / 2 * (1 + .1 * bump(.47, .12)) * (1 - .08 * bump(.02, .06) - .06 * bump(.98, .06));
    L.push([spine[i][0] + nx * w, spine[i][1] + ny * w]); R.push([spine[i][0] - nx * w, spine[i][1] - ny * w]);
  }
  return L.concat(R.reverse());
}
// glyphs on a 100-unit x-height, baseline at 100. Each piece is a polygon (or [outer, hole]).
const GLYPHS = {
  o: { w: 100, p: [arcRing(50, 50, 50, 52, 24, 78, 282), arcRing(50, 50, 50, 52, 24, -102, 102)], seams: [[50, 12, 0], [50, 88, 0]] },
  m: { w: 140, p: [rectP(0, 0, 25, 100), archP(0, 76, 25), archP(62, 140, 25)], seams: [[13, 22, 1], [70, 16, 0]] },
  a: { w: 98, p: [[ellipseDense(44, 52, 43, 50, 64), ellipseDense(44, 52, 21, 28, 48)], rectP(72, -2, 26, 102)], seams: [[80, 30, 0], [80, 74, 0]] },
  k: { w: 98, p: [rectP(0, -62, 26, 162), [[16, 56], [64, 0], [97, 0], [34, 76]], [[36, 44], [98, 100], [64, 100], [20, 64]]], seams: [[22, 50, 1], [40, 60, 0]] },
  s: { w: 92, p: [sPiece()], seams: [], was: [arcRing(48, 27, 43, 28, 21, 68, 330), arcRing(45, 73, 45, 28, 21, -114, 152)] },
  e: { w: 98, p: [arcRing(49, 50, 49, 52, 23, 4, -318), rectP(3, 40, 92, 20)], seams: [[12, 50, 1], [86, 50, 1]] },
};
function densify(poly, step = 1.2) {
  const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / step)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return out;
}
// keep corners crisp while scissoring glyph pieces
function cutGlyph(poly, r) {
  const d = densify(poly), n = d.length, ang = i => { const a = d[(i - 2 + n) % n], b = d[i], c = d[(i + 2) % n];
    let t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])); if (t > Math.PI) t = 2 * Math.PI - t; return t; };
  const out = []; let acc = 0, next = 0, w = 0;
  for (let i = 0; i < n; i++) {
    const corner = ang(i) > .5 && ang(i) >= ang((i + 1) % n) && ang(i) >= ang((i - 1 + n) % n);
    const a = d[i], b = d[(i + 1) % n];
    if (corner || acc >= next) {
      const p = d[(i - 1 + n) % n]; let nx = -(b[1] - p[1]), ny = b[0] - p[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      const j = corner ? r.range(-.35, .35) : w + r.range(-.7, .7);
      out.push([a[0] + nx * j, a[1] + ny * j]);
      w = clamp(w + r.range(-1.1, 1.1) * .6, -1.1, 1.1); next = acc + r.range(4, 12);
    }
    acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return out;
}
let wmDefs = false;
function wordmarkDefs() {
  if (wmDefs) return; wmDefs = true;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('aria-hidden', 'true'); s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML = `<defs><pattern id="k-wm-paper" patternUnits="userSpaceOnUse" width="420" height="420" patternTransform="scale(.42)"><image href="${asset('tex/paper.webp')}" width="420" height="420"/></pattern></defs>`;
  document.body.prepend(s);
}
function wordmarkSVG({ my = true, stitched = false, seed = 3 } = {}) {
  const r = rng(seed), base = rgb(getComputedStyle(root).getPropertyValue('--k-name') || '#2e2927');
  let x = 0, body = '', stitches = '';
  for (const ch of 'omakase') {
    const g = GLYPHS[ch], lr = r.range(-4, 4), ly = r.range(-4, 4);
    let letter = '';
    // the s was two pieces until round 5. Its one piece is cut from a seed of its own, and its
    // old cuts are still drawn off the mark's seed and dropped, so the e after it is unchanged.
    const rp = g.was ? rng(hash('s' + seed)) : r;
    if (g.was) { g.was.forEach(p => { cutGlyph(p, r); r(); r(); r(); r(); }); if (stitched) r(); }
    g.p.forEach((poly, j) => {
      const polys = Array.isArray(poly[0][0]) ? poly : [poly];
      const d = polys.map(p => pathD(cutGlyph(p, rp))).join('');
      const tone = css(shade(base, rp.range(-.04, .07))), tf = `translate(${rp.range(-2.2, 2.2).toFixed(2)} ${rp.range(-2.2, 2.2).toFixed(2)}) rotate(${rp.range(-3, 3).toFixed(2)} ${g.w / 2} 50)`;
      letter += `<g transform="${tf}"><path d="${d}" fill="rgba(24,14,8,.34)" fill-rule="evenodd" transform="translate(1.1 2)"/><path d="${d}" fill="rgba(24,14,8,.1)" fill-rule="evenodd" transform="translate(2.8 4.8)"/>` +
        `<path d="${d}" fill="${tone}" fill-rule="evenodd"/><path d="${d}" fill="url(#k-wm-paper)" fill-rule="evenodd" opacity=".62"/>` +
        (j === 0 ? `<path d="${d}" fill="url(#k-wm-fade)" fill-rule="evenodd"/>` : '') + `</g>`;
    });
    if (stitched) for (const [sx, sy, vert] of g.seams) {
      // two stitches across the seam, tacking the pieces together
      { const tl = r.range(-.35, .35), L = 10, c = Math.cos(tl), s = Math.sin(tl);
        const a = vert ? [sx - L * c, sy - L * s] : [sx + L * s, sy - L * c], b = vert ? [sx + L * c, sy + L * s] : [sx - L * s, sy + L * c];
        stitches += `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}" transform="translate(${x} 0)"/>`; }
    }
    body += `<g transform="translate(${x.toFixed(1)} ${ly.toFixed(2)}) rotate(${lr.toFixed(2)} ${g.w / 2} 50)">${letter}</g>`;
    x += g.w + 9;
  }
  const W = x - 9;
  const st = stitched ? `<g fill="none" stroke-linecap="round"><g stroke="rgba(20,8,10,.5)" stroke-width="4.4" transform="translate(.8 1.4)">${stitches}</g><g style="stroke:var(--k-thread)" stroke-width="3.2">${stitches}</g><g stroke="rgba(255,250,240,.5)" stroke-width=".9" stroke-dasharray="1.2 2.2">${stitches}</g></g>` : '';
  const top = my ? -118 : -72;
  return `<svg viewBox="-14 ${top} ${W + 30} ${100 - top + 12}" role="img" aria-label="${my ? 'my omakase' : 'omakase'}">` +
    `<defs><linearGradient id="k-wm-fade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
    (my ? `<text class="k-wm-my" x="-4" y="-24" transform="rotate(-6 -4 -24)">my</text>` : '') + body + st + `</svg>`;
}
class KWordmark extends HTMLElement {
  connectedCallback() { wordmarkDefs(); this.render(); }
  static get observedAttributes() { return ['my', 'stitched', 'seed']; }
  attributeChangedCallback() { if (this.isConnected) this.render(); }
  render() {
    this.innerHTML = wordmarkSVG({ my: this.getAttribute('my') !== 'off', stitched: this.hasAttribute('stitched'), seed: +(this.getAttribute('seed') || 3) });
  }
}

// ------------------------------------------------------------------ <k-patch> --------
// The mark: grey stock felt, blanket-stitched, a hole showing the desk; the piece that
// came out is flipped (magenta side up) and tacked to the rim; "my" sewn above.
function threadPattern(x, col) {
  const T = 48, c = canvas(T, T), t = c.getContext('2d'), base = rgb(col), r = rng(hash(col));
  t.fillStyle = css(shade(base, -.3)); t.fillRect(0, 0, T, T); t.lineCap = 'round';
  for (let o = -T; o < T * 2; o += 3 * r.range(.85, 1.15)) {
    t.strokeStyle = css(shade(base, r.range(-.1, .16))); t.lineWidth = r.range(2.2, 2.8); t.beginPath(); t.moveTo(o, T + 2); t.lineTo(o + T + 2, -2); t.stroke();
    t.strokeStyle = css(shade(base, .45)); t.globalAlpha = r.range(.35, .7); t.lineWidth = .7; t.beginPath(); t.moveTo(o - .6, T + 2); t.lineTo(o + T + 1.4, -2); t.stroke(); t.globalAlpha = 1;
  }
  return x.createPattern(c, 'repeat');
}
class KPatch extends HTMLElement {
  connectedCallback() {
    if (!this.hasAttribute('role')) { this.setAttribute('role', 'img'); this.setAttribute('aria-label', 'my omakase'); }
    this.ro = new ResizeObserver(() => { clearTimeout(this.t); this.t = setTimeout(() => this.draw(), 120); }); this.ro.observe(this);
  }
  disconnectedCallback() { this.ro?.disconnect(); }
  async draw() {
    const size = this.offsetWidth; if (!size || size === this.drawn || size === this.drawing) return;
    this.drawing = size;
    try {
    const res = this.hasAttribute('album') ? await albumList(this.getAttribute('album') || 'all') : await wallpaperList(this.getAttribute('wallpaper') || 'now');
    const item = this.hasAttribute('src') ? { src: this.getAttribute('src') } : res.items[res.i];
    const [img, tile] = await Promise.all([loadImage(item.small || item.src).catch(() => null), felt().catch(() => null), document.fonts.load('40px "Beth Ellen"')]);
    const S = Math.min(2, window.devicePixelRatio || 1), c = canvas(size * S, size * S), x = c.getContext('2d');
    const k = size / 760; x.scale(S * k, S * k); x.translate(380, 380);
    const r = rng(77), R = 300, rim = rgb(prop(this, '--k-thread') || '#d8367f'), stock = rgb('#d6d0c3'), mag = rgb('#d8367f');
    const hole = cutPoly(blobDense(10, 50, 150, 118, r, 7, .28), r, { step: [8, 22], jit: .9, wander: 2 });
    const disc = cutPoly(ellipseDense(0, 0, R, R, 240), r, { step: [10, 26], jit: .7, wander: 1.4 });
    // under the hole: the desk
    x.save(); x.clip(new Path2D(pathD(hole)));
    if (img) { const iw = img.width, ih = img.height, s = Math.max(330 / iw, 270 / ih); x.drawImage(img, 10 - iw * s / 2, 50 - ih * s / 2, iw * s, ih * s); }
    else { x.fillStyle = '#2a2320'; x.fillRect(-200, -200, 400, 400); }
    x.restore();
    // the disc, with the hole cut out of it, and its shadow
    const ghost = (pts, dx, dy, blur, a) => { x.save(); const m = x.getTransform(); x.shadowColor = `rgba(30,12,14,${a})`; x.shadowBlur = blur * m.a; x.shadowOffsetX = 30000 + dx * m.a; x.shadowOffsetY = dy * m.a;
      x.setTransform(1, 0, 0, 1, -30000, 0); x.transform(m.a, m.b, m.c, m.d, m.e, m.f); x.fillStyle = '#000'; x.fill(new Path2D(pts), 'evenodd'); x.restore(); };
    const discD = pathD(disc) + pathD([...hole].reverse());
    ghost(discD, 4, 10, 18, .32); ghost(discD, 1, 2, 3, .35);
    x.save(); x.clip(new Path2D(pathD(hole))); ghost(pathD(disc) + pathD(hole), 3, 7, 10, .55); x.restore();
    drawFelt(x, disc, stock, tile, r, { thick: 3, fuzz: 1.2, holes: [hole] });
    // blanket stitch round the rim
    const segs = [], n = Math.round(R * 2 * Math.PI / 15);
    for (let i = 0; i < n; i++) { const a = (i + r.range(-.12, .12)) / n * Math.PI * 2, a2 = (i + 1 + r.range(-.12, .12)) / n * Math.PI * 2, ro = R - 12 + r.range(-1, 1), ri = R - 28 + r.range(-2.5, 2.5);
      segs.push([Math.cos(a) * ri, Math.sin(a) * ri, Math.cos(a) * ro, Math.sin(a) * ro], [Math.cos(a) * ro, Math.sin(a) * ro, Math.cos(a2) * ro, Math.sin(a2) * ro]); }
    floss(x, segs, css(rim), 3.6);
    // "my", sewn in the hand
    x.save(); x.translate(-190, -120); x.rotate(-8 * Math.PI / 180); x.font = '118px "Beth Ellen"'; x.lineJoin = 'round';
    const wgt = 5.4; x.save(); x.shadowColor = 'rgba(20,8,10,.6)'; x.shadowBlur = 2.5 * x.getTransform().a; x.shadowOffsetX = 1.2 * x.getTransform().a; x.shadowOffsetY = 2 * x.getTransform().a;
    x.fillStyle = x.strokeStyle = css(shade(rgb('#2c1a1f'), -.3)); x.lineWidth = wgt; x.fillText('my', 0, 0); x.strokeText('my', 0, 0); x.restore();
    x.fillStyle = x.strokeStyle = threadPattern(x, '#3a2429'); x.lineWidth = wgt; x.fillText('my', 0, 0); x.strokeText('my', 0, 0); x.restore();
    // the piece that came out, flipped, tacked over the rim
    x.save(); x.translate(222, 218); x.rotate(-.12); x.scale(-.62, .62); x.translate(-10, -50);
    const pc = hole.map(([a, b]) => [a, b]);
    ghost(pathD(pc), 5, 12, 16, .3);
    drawFelt(x, pc, mag, tile, r, { thick: 6, side: css(shade(stock, -.35)), fuzz: 1.2 });
    x.restore();
    floss(x, [[222 - 60, 218 - 42, 222 - 44, 218 - 26], [222 - 44, 218 - 42, 222 - 60, 218 - 26]], '#f3ead8', 3);
    floss(x, [[222 + 28, 218 + 22, 222 + 44, 218 + 38], [222 + 44, 218 + 22, 222 + 28, 218 + 38]], '#f3ead8', 3);
    const url = await blobURL(c, true);
    if (this.drawing !== size) return URL.revokeObjectURL(url);
    if (this.url) URL.revokeObjectURL(this.url); this.url = url; this.drawn = size;
    this.style.setProperty('--k-sprite', `url(${url})`);
    } catch (e) { this.fails = (this.fails || 0) + 1; if (this.fails <= 6) setTimeout(() => this.draw(), 200 * 2 ** this.fails); }
    finally { if (this.drawing === size) this.drawing = null; }
  }
}

customElements.define('k-hole', KHole);
customElements.define('k-wordmark', KWordmark);
customElements.define('k-patch', KPatch);

// ------------------------------------------------------------------ start ------------
function start() {
  const go = () => {
    register(document.body);
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && !n.classList?.contains('k-tape')) register(n); }))).observe(document.body, { childList: true, subtree: true });
  };
  // cut after the fonts settle, so pieces aren't cut twice; never wait long
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]).then(go);
  // once the page has loaded and gone quiet, finish the rest a few at a time, so nothing
  // pops in later and a full-page capture shows everything
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 8 }), 200));
  const rest = () => idle(d => {
    const todo = [...document.querySelectorAll(PIECES + ', k-hole')].filter(el => state.has(el) && state.get(el).w == null && !state.get(el).tried);
    for (const el of todo) { if (d.timeRemaining() < 3) break; state.get(el).tried = true; near.unobserve(el); el.matches(PIECES) ? bake(el) : el.cut?.(); }
    if (todo.length) setTimeout(rest, 60);
  });
  document.readyState === 'complete' ? rest() : addEventListener('load', rest, { once: true });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();

export default { HANDS, hand, cut, rebake, wallpapers, albums, wallpaperList, albumList, periodOf, rng };
