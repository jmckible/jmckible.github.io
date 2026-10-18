// swatch: wind the film under the playhead as the track scrolls past. One passive scroll
// listener sets the reel's transform in a rAF; everything else changes only when a new
// frame lands (a class, three colours, a name). Layout is read on resize only.
import { THEMES as ALL } from './themes.js';

// a dark theme, a light one, then home: enough to show the screen changing its clothes
const ROLL = ['tokyo-night', 'rose-pine', 'drivetrain'];
const THEMES = ROLL.map(n => ALL.find(t => t.theme === n));

const LINES = [
  "+ the candidate's wallpaper fills the screen, edge to edge",
  '+ the bar, menus and the picker itself retint as you scrub',
];
const STOCK = { accent: '#8a8a90', bgc: '#1d1d21', fg: '#a9a9ae' };

export function init(el, { reduced, base }) {
  const $ = s => el.querySelector(s);
  const stage = $('.sw-stage'), track = $('.sw-track'), gate = $('.sw-gate'), reel = $('.sw-reel'), film = $('.sw-film');
  const shots = $('.sw-shots'), final = $('.sw-final'), osd = $('.sw-osd .nm'), stripe = $('.sw-osd .stripe');
  const n = $('.sw-playhead .n'), subs = [...el.querySelectorAll('.sw-subs li')];
  const LAND = THEMES.findIndex(t => t.theme === 'drivetrain');
  const url = f => new URL(f, base).href;
  const pal = t => `linear-gradient(90deg, ${t.palette.map((c, i) => `${c} ${(i * 100 / 6).toFixed(2)}% ${((i + 1) * 100 / 6).toFixed(2)}%`).join(', ')})`;
  $('.sw-playhead .of').textContent = THEMES.length;

  // the film: leader, a frame per theme, the tail
  const leader = film.querySelector('.leader');
  leader.insertAdjacentHTML('beforeend', '<span class="ep">- a list of theme names; pick one and see what happens</span>');
  const frames = THEMES.map((t, i) => {
    const f = document.createElement('div');
    f.className = 'fr';
    f.style.cssText = `--c:${t.bgc};--pal:${pal(t)}`;
    const key = `▸ ${String(i + 1).padStart(2, '0')}  ${t.theme}${i === LAND ? ' ★' : ''}`;
    f.innerHTML = `<img alt="" decoding="async" src="${url(`img/${t.theme}-f.webp`)}"><span class="nm">${i === LAND ? '★ ' : ''}${t.theme}</span><i class="pal"></i><span class="kn">${key}</span>${i % 2 === 0 ? `<span class="ep">${LINES[(i / 2) % 2]}</span>` : ''}`;
    film.append(f);
    return f;
  });
  film.insertAdjacentHTML('beforeend', '<div class="tail">TAIL · END OF ROLL</div>');

  // the screen: one image per theme, loaded only near the playhead (at most five resident)
  shots.setAttribute('aria-hidden', 'true');
  const imgs = THEMES.map(t => { const im = document.createElement('img'); im.alt = ''; im.decoding = 'async'; shots.append(im); return im; });
  const want = i => { for (let k = i - 2; k <= i + 2; k++) if (imgs[k] && !imgs[k].src && k !== LAND) imgs[k].src = url(`img/${THEMES[k].theme}.webp`); };

  let at = null;
  function land(i) {
    if (i === at) return; at = i;
    const t = THEMES[i] || STOCK;
    el.style.setProperty('--sw-accent', t.accent);
    el.style.setProperty('--sw-bgc', t.bgc);
    el.style.setProperty('--sw-fg', t.fg);
    el.style.setProperty('--sw-tint', t.accent);   // unregistered: the big tissue changes at once, no per-frame repaint
    stage.dataset.at = i < 0 ? 'stock' : i === LAND ? 'final' : 'theme';
    if (i >= 0) { want(i); osd.textContent = t.theme; stripe.style.setProperty('--pal', pal(t)); }
    imgs.forEach((im, k) => im.classList.toggle('on', k === i));
    final.classList.toggle('on', i === LAND);
    frames.forEach((f, k) => f.classList.toggle('at', k === i));
    n.textContent = i < 0 ? '·' : i + 1;
    const lit = i < 0 ? [0] : i === LAND ? [1, 2] : i === 0 ? [1] : [2];
    subs.forEach((li, k) => li.classList.toggle('lit', lit.includes(k)));
  }

  // geometry, on resize only
  let top = 0, span = 1, cx = 0, centers = [];
  const stops = [leader, ...frames];
  function measure() {
    top = track.getBoundingClientRect().top + scrollY;
    span = Math.max(1, track.offsetHeight - stage.offsetHeight);
    cx = gate.clientWidth / 2;
    centers = stops.map(s => s.offsetLeft + s.offsetWidth / 2);
    frame();
  }
  const clamp = v => Math.min(1, Math.max(0, v));
  // a detent: the film settles on each frame for a moment, the way h/l steps
  const detent = f => { const t = clamp((f - .26) / .48); return t * t * (3 - 2 * t); };
  let raf = 0;
  function frame() {
    raf = 0;
    let q;
    if (reduced) q = LAND + 1;
    else q = clamp(((scrollY - top) / span - .04) / .86) * (LAND + 1);
    const s = Math.min(Math.floor(q), LAND), e = q >= LAND + 1 ? 1 : detent(q - s);
    const u = centers[s] + ((centers[s + 1] ?? centers[s]) - centers[s]) * e;
    reel.style.transform = `translate3d(${(cx - u).toFixed(1)}px,0,0)`;
    land(s + (e > .5 ? 1 : 0) - 1);
  }

  if (reduced) el.classList.add('sw-still');
  else {
    film.classList.add('run');
    addEventListener('scroll', () => { raf ||= requestAnimationFrame(frame); }, { passive: true });
  }
  const ro = new ResizeObserver(() => requestAnimationFrame(measure));
  ro.observe(track); ro.observe(document.body);
  addEventListener('resize', measure);
  measure();
}
