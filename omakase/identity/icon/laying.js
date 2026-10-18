// The signature animation: strips of construction paper laid one at a time, each brought in
// too long, snipped to length and pressed down; tape goes on at each join once both sides
// are down. One clock (performance.now), one render(t). ?t=4.2 freezes at 4.2 s.
import { STRIPS, JOINS, place, rng, frozen } from './icon.js';

const M = 34, box = document.getElementById('icon');
const px = v => v.toFixed(1) + 'px';
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = v => 1 - (1 - v) ** 3;
const inout = v => v < .5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2;

// where each strip comes in from: the side the hand holds it by (tail end), per strip
const FROM = ['left', 'top', 'bottom', 'left', 'right', 'left', 'bottom', 'right', 'top', 'right', 'top', 'left', 'bottom'];
const START = .4, STEP = .42, DUR = .78, TAIL = 2.3;   // seconds, seconds, seconds, modules
const T_ENTER = .42, T_SNIP = .47, T_PRESS = .72;      // fractions of DUR

const strips = STRIPS.map((s, i) => {
  const p = place(s.r, M, rng(11 * 97 + i * 13 + 1)), horiz = s.r[2] >= s.r[3], side = FROM[i];
  const ax = side === 'left' ? -1 : side === 'right' ? 1 : 0, ay = side === 'top' ? -1 : side === 'bottom' ? 1 : 0;
  const tl = TAIL * M * rng(i + 5).range(.8, 1.2);
  // the carrier holds the strip, its tail (the offcut) and a lift shadow, at the strip's place
  const c = document.createElement('div'); c.className = 'carrier';
  Object.assign(c.style, { left: px(p.left), top: px(p.top), width: px(p.width), height: px(p.height), rotate: p.rot.toFixed(2) + 'deg' });
  const piece = (w, h, l, t, seed) => { const e = document.createElement('div'); e.className = 'k-paper k-green'; e.dataset.seed = seed;
    Object.assign(e.style, { left: px(l), top: px(t), width: px(w), height: px(h) }); return e; };
  // the tail overlaps the strip's end by a hair, so before the snip they read as one length
  const tw = horiz ? tl : p.width, th = horiz ? p.height : tl;
  const tlft = ax < 0 ? -tl + 1 : ax > 0 ? p.width - 1 : 0, ttop = ay < 0 ? -tl + 1 : ay > 0 ? p.height - 1 : 0;
  const tail = piece(tw, th, tlft, ttop, `tail-${i}`), body = piece(p.width, p.height, 0, 0, `11-${i}`);
  const liftS = document.createElement('div'); liftS.className = 'lift'; Object.assign(liftS.style, { left: 0, top: 0, width: px(p.width), height: px(p.height) });
  const liftT = document.createElement('div'); liftT.className = 'lift'; Object.assign(liftT.style, { left: px(tlft), top: px(ttop), width: px(tw), height: px(th) });
  c.append(liftT, tail, liftS, body); box.append(c);
  // the offcut is tossed aside onto a small heap beside the icon, on whichever side is nearer
  const cx = p.left + tlft + tw / 2, cy = p.top + ttop + th / 2, rp = rng(i + 120), left = cx < 255;
  const heap = left ? [-200 + rp.range(-60, 60), 330 + rp.range(-70, 80)] : [700 + rp.range(-50, 60), 130 + rp.range(-60, 80)];
  const toss = [heap[0] - cx, heap[1] - cy, rp.range(-70, 70) + (horiz ? 0 : 90 * (rp() < .5 ? 1 : -1))];
  return { c, tail, liftS, liftT, ax, ay, toss, t0: START + i * STEP, swing: rng(i + 40).range(-4, 4), drift: rng(i + 80).range(-1, 1) };
});
const done = i => strips[i].t0 + DUR * T_PRESS;

const tapes = JOINS.map(([x, y, a, len, after], j) => {
  const r = rng(11 * 31 + j), t = document.createElement('i');
  t.className = 'k-tape lay';
  t.style.cssText = `--k-x:${px(x * M + r.range(-2, 2))};--k-y:${px(y * M + r.range(-2, 2))};--k-r:${(a + r.range(-5, 5)).toFixed(1)}deg;--k-w:${px(len * M * r.range(.94, 1.08))};--k-tx:${Math.round(r() * 160)}px`;
  if (r() < .4) t.dataset.lift = r() < .5 ? 'bl' : 'none';
  box.append(t);
  return { t, at: Math.max(...after.map(done)) + .12 + (j % 3) * .05 };
});
const said = document.getElementById('said');
const END = Math.max(...tapes.map(t => t.at)) + .3;
const SAY = END + .15;

function render(t) {
  for (const s of strips) {
    const u = (t - s.t0) / DUR;
    if (u <= 0) { s.c.style.visibility = 'hidden'; continue; }
    s.c.style.visibility = 'visible';
    // in: from off the sheet along its own axis, a little swing, held up off the paper
    const kin = ease(clamp01(u / T_ENTER)), far = 820 * (1 - kin);
    const arc = Math.sin(kin * Math.PI) * 26 * s.drift;
    const dx = s.ax * far + (s.ay ? arc : 0), dy = s.ay * far + (s.ax ? arc : 0);
    // pressed: lifted until the press, a slight overshoot as the palm comes down
    const kp = clamp01((u - T_SNIP) / (T_PRESS - T_SNIP)), lift = 1 - inout(kp);
    const squash = kp > 0 && kp < 1 ? Math.sin(kp * Math.PI) * -.006 : 0;
    const sc = 1 + .045 * lift + squash, rot = s.swing * (1 - kin) + s.swing * .12 * lift;
    s.c.style.transform = `translate(${(dx - 6 * lift).toFixed(1)}px, ${(dy - 10 * lift).toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
    s.liftS.style.opacity = (lift * .9).toFixed(3);
    s.liftS.style.transform = `translate(${(14 * lift).toFixed(1)}px, ${(20 * lift).toFixed(1)}px)`;
    // snipped: the offcut comes away and is tossed onto the heap, where it stays
    const ks = clamp01((u - T_SNIP) / .75), ko = inout(ks), hop = Math.sin(ks * Math.PI);
    const tx = ks > 0 ? s.toss[0] * ko + s.ax * 14 * hop : 0, ty = ks > 0 ? s.toss[1] * ko + s.ay * 14 * hop - 40 * hop : 0;
    const tr = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) rotate(${(s.toss[2] * ko).toFixed(2)}deg) scale(${(1 + .05 * hop).toFixed(4)})`;
    s.tail.style.transform = tr;
    // while in the air it throws a lifted shadow; it lands flat
    const air = ks > 0 ? hop : lift;
    s.liftT.style.transform = `translate(${(tx + 14 * air).toFixed(1)}px, ${(ty + 20 * air).toFixed(1)}px) rotate(${(s.toss[2] * ko).toFixed(2)}deg)`;
    s.liftT.style.opacity = (air * .85).toFixed(3);
  }
  for (const { t: el, at } of tapes) {
    const k = clamp01((t - at) / .28), e = ease(k);
    el.style.opacity = k > 0 ? Math.min(1, k * 2.2).toFixed(3) : 0;
    el.style.scale = (1.18 - .18 * e).toFixed(4);
  }
  const w = clamp01((t - SAY) / .9);
  said.style.clipPath = `inset(-20% ${((1 - w) * 100).toFixed(1)}% -20% -5%)`;
}

const hold = frozen(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (hold != null || reduced) render(reduced && hold == null ? 99 : hold);
else {
  const t0 = performance.now();
  const loop = now => { const t = (now - t0) / 1000; render(t); if (t < SAY + 1.2) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
window.laying = { render, END, SAY };
