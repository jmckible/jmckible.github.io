// The web: one number drives the stage. --u is 0 when the scissors start at the top of
// the printout and 1 when they reach the bottom; the scissors ride low on the screen while
// they cut, so the cut starts as soon as the sheet is up and follows your reading. The fall
// and the retint run on past 1 (see section.css), quicker than the cut, so they finish while
// the sheet is still on screen. One passive scroll listener, only while the stage is near
// the screen, writing one custom property in a rAF.
//
// ?webu=1.2 holds the stage at that point, for captures.

export function init(el, { reduced }) {
  const stage = el.querySelector('.web-stage');
  const sheet = el.querySelector('.web-col');
  if (!stage || !sheet) return;

  const hold = new URLSearchParams(location.search).get('webu');
  if (hold !== null) { stage.style.setProperty('--u', String(+hold)); return; }
  if (reduced) return;                          // CSS default: cut, fallen, retinted

  const ANCHOR = .86;                           // where the scissors ride, as a share of the screen
  const AFTER = 1.6;                            // the fall and the retint run this much faster than the cut
  let queued = false, on = false;
  const frame = () => {
    queued = false;
    const r = sheet.getBoundingClientRect();   // the kept column spans the sheet's height
    let u = (innerHeight * ANCHOR - r.top) / r.height;
    if (u > 1) u = 1 + (u - 1) * AFTER;
    stage.style.setProperty('--u', Math.max(-.1, Math.min(2, u)).toFixed(4));
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };

  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !on) { on = true; addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); }
    else if (!e.isIntersecting && on) { on = false; removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); }
    frame();
  }, { rootMargin: '50% 0px' }).observe(stage);
  frame();
}
