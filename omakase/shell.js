// The shell: loads each section, draws the dividers and the footer mark, lays the day
// down the page, and docks the laid icon in the corner. See CONTRACT.md.
import { draw } from './icons.js';

// order, time of day, and the ground's colour at each section's top and bottom
const SECTIONS = [
  // the desk: what was mine to begin with
  { slug: 'start',  period: 'morning',   hour: .06, light: ['#ede6cf', '#e9e0c4'] },
  { slug: 'swatch', period: 'morning',   hour: .18, light: ['#e6dbb8', '#e3d4ac'] },
  { slug: 'pill',   period: 'morning',   hour: .30, light: ['#e0cfa6', '#dbc59c'] },
  { slug: 'hands',  period: 'afternoon', hour: .44, light: ['#d8bb92', '#d2b08a'] },
  // what comes in: the web is the hinge, where the page turns outward
  { slug: 'web',    period: 'afternoon', hour: .60, light: ['#cea284', '#c8967f'] },
  { slug: 'albums', period: 'night',     hour: .86, light: ['#2c2b38', '#282833'] },
];
const OPENING = '#ede6cf', FOOT = ['#1e1f28', '#1b1c24'];
// the divider after each section, a different treatment each time. Paper strips open the
// page (laying.js) and close it (the footer).
const DIVIDERS = [
  { kind: 'tissue',   x: .22, r: -3 },
  { kind: 'stitched', x: .74, r: 2 },
  { kind: 'torn',     x: .8,  r: 3.5 },
  { kind: 'hole',     x: .16, r: -2, wallpaper: '58' },   // the hinge: a window onto outside
  { kind: 'felt',     x: .34, r: 1.2, mid: '#6e5468' },   // dusk turns to night across this one
];

const q = new URLSearchParams(location.search), only = q.get('only');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const main = document.getElementById('r6-main'), foot = document.getElementById('r6-foot');
const small = innerWidth < 640, M = small ? 9 : 13;

// -------------------------------------------------------------------- sections
function root(sec) {
  const el = document.createElement('section');
  el.id = `s-${sec.slug}`; el.className = 'r6-section'; el.dataset.slug = sec.slug; el.dataset.period = sec.period;
  const night = sec.period === 'night';
  if (night) el.classList.add('night');
  el.style.cssText = `--light:${sec.light[0]};--light-end:${sec.light[1]};--hour:${sec.hour};--ink:${night ? 'var(--k-cream)' : 'var(--k-ink)'}`;
  el.dataset.light = sec.light[0]; el.dataset.lightEnd = sec.light[1];
  return el;
}

// paths in section.html are relative to the section's folder, like its css and js
const ABS = /^(?:[a-z][a-z0-9+.-]*:|\/|#|$)/i;
function rebase(frag, base) {
  for (const a of ['src', 'href', 'poster']) for (const n of frag.querySelectorAll(`[${a}]`)) {
    const v = n.getAttribute(a).trim(); if (!ABS.test(v)) n.setAttribute(a, new URL(v, base).href);
  }
  for (const n of frag.querySelectorAll('[srcset]')) n.setAttribute('srcset', n.getAttribute('srcset').split(',').map(part => {
    const [u, ...d] = part.trim().split(/\s+/); return [ABS.test(u) ? u : new URL(u, base).href, ...d].join(' ');
  }).join(', '));
}

const bust = `?v=${Date.now()}`;
const exists = async url => { try { return (await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok; } catch { return false; } };

async function load(sec, el) {
  const base = new URL(sec.slug === 'example' ? 'example/' : `sections/${sec.slug}/`, location.href);
  let html = null;
  try { const r = await fetch(new URL('section.html', base), { cache: 'no-store' }); if (r.ok) html = await r.text(); } catch {}
  if (html == null) {
    el.classList.add('r6-empty');
    el.innerHTML = `<div class="r6-pending"><span class="k-slip" data-tilt="-1">${sec.slug.toUpperCase()} · TO COME</span></div>`;
    return;
  }
  const [css, js] = await Promise.all([exists(new URL('section.css', base)), exists(new URL('section.js', base))]);
  if (css) await new Promise(done => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('section.css' + bust, base).href;
    l.onload = l.onerror = done; document.head.append(l);
  });
  const t = document.createElement('template'); t.innerHTML = html;
  rebase(t.content, base);
  el.append(t.content);
  if (js) try {
    const mod = await import(new URL('section.js' + bust, base).href);
    await mod.init?.(el, { slug: sec.slug, period: sec.period, hour: sec.hour, light: sec.light, night: sec.period === 'night', reduced, only: !!only, base: base.href });
  } catch (e) { console.error(`section ${sec.slug}:`, e); }
}

// -------------------------------------------------------------------- dividers
async function divider(d, i) {
  const el = document.createElement('div');
  el.className = 'r6-div'; el.setAttribute('aria-hidden', 'true'); el.dataset.kind = d.kind;
  if (d.mid) el.dataset.mid = d.mid;
  const w = d.kind === 'hole' ? Math.round(15 * M * 1.16) : 15 * M;
  el.innerHTML = `<div class="row" style="--x:${d.x};--r:${d.r}deg;--w:${w}px"><div class="ic"></div></div>`;
  const cap = await draw(d.kind, el.querySelector('.ic'), M, d);
  if (cap) el.querySelector('.row').insertAdjacentHTML('beforeend', `<span class="cap k-slip" data-tilt="1.5">${cap.toUpperCase()}</span>`);
  return el;
}

// -------------------------------------------------------------------- the day
function paintDay() {
  const H = document.body.scrollHeight; if (!H) return;
  const top = el => el.getBoundingClientRect().top + scrollY, bottom = el => el.getBoundingClientRect().bottom + scrollY;
  const stops = [[OPENING, 0], [OPENING, bottom(document.querySelector('.r6-opening')) * .8]];
  for (const el of main.children) {
    if (el.dataset.light) stops.push([el.dataset.light, top(el)], [el.dataset.lightEnd, bottom(el)]);
    else if (el.dataset.mid) stops.push([el.dataset.mid, (top(el) + bottom(el)) / 2]);
  }
  if (!foot.hidden) stops.push([FOOT[0], top(foot)], [FOOT[1], H]);
  const v = `linear-gradient(${stops.map(([c, y]) => `${c} ${Math.round(Math.min(y, H))}px`).join(', ')})`;
  if (v !== paintDay.last) document.body.style.setProperty('--day', paintDay.last = v);
}

// -------------------------------------------------------------------- the laid icon
const lay = document.querySelector('.r6-lay'), spot = document.querySelector('.r6-spot');
let geo = null, raf = 0;
function measure() {
  const r = spot.getBoundingClientRect(), c = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--r-corner')) || 60;
  const inset = innerWidth < 760 ? 12 : 18;
  geo = { x: r.left, y: r.top + scrollY, s0: r.width / 510, s1: c / 510, cx: inset, cy: inset, D: Math.max(160, (r.top + scrollY + r.height) * .82) };
  frame();
}
const ease = v => v < .5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2;
function frame() {
  raf = 0; if (!geo) return;
  const p = Math.min(1, Math.max(0, scrollY / geo.D)), e = reduced ? (p > .5 ? 1 : 0) : ease(p);
  const x = geo.x + (geo.cx - geo.x) * e, y = (geo.y - scrollY) + (geo.cy - (geo.y - scrollY)) * e, s = geo.s0 + (geo.s1 - geo.s0) * e;
  lay.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
  lay.classList.toggle('docked', p > .03);
  document.body.classList.toggle('r6-docked', p > .03);
  lay.classList.toggle('home', e >= 1);
  lay.tabIndex = e >= 1 ? 0 : -1;
  lay.classList.add('ready');
}
addEventListener('scroll', () => { raf ||= requestAnimationFrame(frame); }, { passive: true });
new ResizeObserver(measure).observe(spot);
addEventListener('resize', measure);
// the mark comes home: it steps aside while the footer's own mark is in view
new IntersectionObserver(([e]) => lay.classList.toggle('rest', e.isIntersecting), { threshold: .35 }).observe(foot);

// -------------------------------------------------------------------- assemble
const list = only ? [SECTIONS.find(s => s.slug === only) || { slug: only, period: 'morning', hour: .1, light: SECTIONS[0].light }] : SECTIONS;
if (only) { foot.hidden = true; const t = document.createElement('div'); t.className = 'r6-turn'; t.setAttribute('aria-hidden', 'true'); main.append(t); }
const roots = list.map(root);
roots.forEach(el => main.append(el));
const loading = Promise.all(list.map((s, i) => load(s, roots[i])));
if (!only) {
  (await Promise.all(DIVIDERS.map(divider))).forEach((d, i) => roots[i].after(d));
  draw('paper', document.querySelector('.r6-foot-mark'), small ? 9 : 10, { colour: 'k-green', seed: 11 });
}
new ResizeObserver(() => requestAnimationFrame(paintDay)).observe(document.body);
paintDay();
measure();

await loading;
document.documentElement.dataset.sections = 'ready';
// a fragment link (#s-web) lands once everything above it has arrived
if (location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); }
requestAnimationFrame(() => { paintDay(); measure(); });
