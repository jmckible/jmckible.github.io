// The hands. W reads the focused window: on the browser it takes a tab off, on workspace 1
// it tucks the focused card back into its pocket and focus falls back to the browser.
// S brings Slack out (or focuses it), H and L move focus left and right, J and K have
// nowhere to go. Motion runs on requestAnimationFrame and performance.now, so bin/loop
// records it frame for frame.
import { rng, rebake } from '../../identity/kit/kit.js';

const TABS = [
  { t: 'drivetrain', title: 'drivetrain', url: 'github.com/jmckible/drivetrain' },
  { t: 'keyd(1)', title: 'keyd(1)', url: 'man.archlinux.org/man/keyd.1' },
  { t: 'binds', title: 'binds, in Lua', url: 'wiki.hypr.land/Configuring/Binds' },
  { t: 'omakase', title: 'my omakase', url: '127.0.0.1:8765' },
];

export function init(el, { reduced }) {
  const $ = s => el.querySelector(s);
  const stage = $('.hands-stage'), browser = $('.hands-browser'), ws = $('.hands-ws');
  const strip = $('.hands-tabs'), page = $('.hands-page'), url = $('.hands-url'), title = $('.hands-title'), left = $('.hands-left');
  const parkedNote = $('.hands-parked'), superKey = $('.hands-super');
  const slots = Object.fromEntries([...el.querySelectorAll('.hands-slot')].map(s => [s.dataset.app, s]));
  const r = rng(71);
  let open = [], active = 0, seq = 0, current = 'mail', lastParked = null, touched = false, refilling = false;

  // ---- one clock for everything that moves: later(fn, ms) and tween(ms, fn(p))
  const jobs = new Set();
  let raf = 0;
  const tick = () => {
    raf = 0; const now = performance.now();
    for (const j of [...jobs]) {
      if (j.at != null) { if (now >= j.at) { jobs.delete(j); j.fn(); } continue; }
      j.t0 ??= now;
      const p = Math.min(1, (now - j.t0) / j.ms);
      j.fn(p); if (p >= 1) { jobs.delete(j); j.done?.(); }
    }
    if (jobs.size) raf = requestAnimationFrame(tick);
  };
  const run = () => { raf ||= requestAnimationFrame(tick); };
  const later = (fn, ms) => { if (reduced) return fn(); jobs.add({ at: performance.now() + ms, fn }); run(); };
  const tween = (ms, fn, done) => { if (reduced) { fn(1); return done?.(); } jobs.add({ ms, fn, done }); run(); };
  const ease = p => p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  const mix = (a, b, p) => a + (b - a) * p;

  // ---- the browser
  function tabEl(tab, i, fresh) {
    const s = document.createElement('span');
    s.className = 'hands-tab k-paper k-grey';
    s.dataset.seed = `hands-tab-${tab.t}-${seq++}`;
    s.innerHTML = `${tab.t}<span class="x">×</span>`;
    if (fresh) { s.style.opacity = 0; later(() => tween(380, p => { s.style.opacity = p; s.style.translate = `0 ${mix(-16, 0, ease(p))}px`; }), i * 90); }
    return s;
  }
  const live = () => [...strip.children].filter(s => !s.classList.contains('off'));
  function show() {
    live().forEach((s, i) => {
      const on = i === active;
      if (s.classList.contains('on') !== on) {
        s.classList.toggle('on', on); s.classList.toggle('k-cream', on); s.classList.toggle('k-grey', !on);
        rebake(s);
      }
    });
    const tab = open[active];
    page.classList.toggle('blank', !tab);
    url.textContent = tab ? tab.url : '';
    title.textContent = tab ? tab.title : 'no tabs left';
    left.textContent = tab ? `${open.length} tab${open.length > 1 ? 's' : ''}` : '';
  }
  function fill(fresh) {
    strip.replaceChildren(...TABS.map((t, i) => tabEl(t, i, fresh)));
    open = [...TABS]; active = 2; show();
  }
  function closeTab() {
    const node = live()[active];
    if (!node) return;
    open.splice(active, 1);
    if (active >= open.length) active = open.length - 1;
    node.classList.add('off');
    const dx = r.range(20, 60), rot = r.range(14, 30);
    // lifted off the strip, then it drops away past the page
    tween(800, p => {
      const a = Math.min(1, p / .22), b = Math.max(0, (p - .22) / .78);
      const x = mix(0, 6, a) + mix(0, dx, b), y = mix(0, -34, ease(a)) + mix(0, 250, b * b);
      node.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      node.style.rotate = `${(mix(0, -8, a) + mix(0, rot + 8, b)).toFixed(1)}deg`;
      node.style.opacity = b > .6 ? 1 - (b - .6) / .4 : 1;
    }, () => node.remove());
    show();
    if (!open.length) { refilling = true; later(() => { fill(true); refilling = false; }, 1400); }
  }

  // ---- workspace 1
  function focus(which) {
    stage.dataset.focus = which;
    browser.setAttribute('aria-pressed', String(which === 'browser'));
    ws.setAttribute('aria-pressed', String(which === 'ws'));
    for (const [app, s] of Object.entries(slots)) s.classList.toggle('current', which === 'ws' && app === current);
  }
  const isOut = app => slots[app].dataset.state === 'out';
  const card = app => slots[app].querySelector('.hands-card');

  function park(app) {
    const s = slots[app], c = card(app);
    s.dataset.state = 'parking';
    tween(700, p => c.style.setProperty('--y', (1 - ease(p)).toFixed(3)), () => {
      s.dataset.state = 'parked'; c.style.removeProperty('--y');
    });
    parkedNote.textContent = 'dismissed with SUPER+W, never quit by accident';
    lastParked = app;
    if (app === 'mail') later(() => { s.classList.add('landed'); s.querySelectorAll('em').forEach(e => e.textContent = 'archived'); }, 650);
    const next = Object.keys(slots).find(a => a !== app && isOut(a));
    later(() => { if (next) current = next; focus(next ? 'ws' : 'browser'); }, 900);
  }
  function summon(app) {
    const s = slots[app], c = card(app);
    current = app;
    if (!isOut(app) && s.dataset.state !== 'rising') {
      s.dataset.state = 'rising';
      if (app === 'mail') { s.classList.remove('landed'); s.querySelectorAll('em').forEach(e => e.textContent = 'archiving…'); }
      tween(560, p => c.style.setProperty('--y', ease(p).toFixed(3)), () => {
        s.dataset.state = 'out'; c.style.removeProperty('--y');
      });
      if (app === lastParked) parkedNote.textContent = '';
    }
    focus('ws');
  }

  // ---- the keys
  function press(key) {
    for (const k of [key, superKey]) k.setAttribute('aria-pressed', 'true');
    later(() => { key.removeAttribute('aria-pressed'); superKey.removeAttribute('aria-pressed'); }, 170);
    const which = stage.dataset.focus;
    switch (key.dataset.key) {
      case 'w':
        if (which === 'ws') { if (isOut(current)) park(current); }
        else if (!refilling) closeTab();
        break;
      case 's': summon('slack'); break;
      case 'h': focus('browser'); break;
      case 'l': if (Object.keys(slots).some(isOut)) { if (!isOut(current)) current = Object.keys(slots).find(isOut); focus('ws'); } break;
      // j and k: nothing above or below
    }
  }

  fill(false);
  focus('browser');

  // once the reader has a hand on it, the demonstration stops
  el.addEventListener('pointerdown', e => { if (e.isTrusted) touched = true; }, true);
  el.addEventListener('keydown', e => { if (e.isTrusted) touched = true; }, true);
  for (const k of el.querySelectorAll('.hands-key[data-key]')) k.addEventListener('click', () => press(k));
  browser.addEventListener('click', () => focus('browser'));
  ws.addEventListener('click', e => {
    const slot = e.target.closest('.hands-slot');
    if (slot && isOut(slot.dataset.app)) current = slot.dataset.app;
    if (Object.keys(slots).some(isOut)) focus('ws');
  });
  for (const w of [browser, ws]) w.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); w.click(); }
  });

  const K = k => el.querySelector(`.hands-key[data-key="${k}"]`);
  const script = [[700, 'w'], [1300, 'l'], [1000, 'w'], [1500, 's']];

  // reduced motion: the story already told. One tab gone, the mail parked, Slack out.
  if (reduced) { for (const [, k] of script) press(K(k)); return; }

  // the demonstration plays once: W on the browser when the keys come into view, then,
  // once the pockets are in view too (on a phone they come later), L, W on the mail, S
  const seen = (node, threshold) => new Promise(res => {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); res(); } }, { threshold });
    io.observe(node);
  });
  const wait = ms => new Promise(res => later(res, ms));
  (async () => {
    await seen($('.hands-keys-l'), .6);
    await wait(700); if (touched) return; press(K('w'));
    await seen($('.hands-rack'), .5);
    for (const [ms, k] of script.slice(1)) { await wait(ms); if (touched) return; press(K(k)); }
  })();
}
