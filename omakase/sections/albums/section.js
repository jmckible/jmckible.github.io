// The album grid. CSS does the work (the sheet slides out on the section's view timeline);
// this only makes the punched disc readable to assistive tech and covers browsers without
// scroll timelines.
export function init(el, { reduced }) {
  // the kit hides a hole's piece from assistive tech unless it has a piece-back attribute;
  // ours carries the stock line in markup, so let it be read
  el.querySelector('.albums-label .k-hole-piece')?.removeAttribute('aria-hidden');

  if (reduced || CSS.supports('animation-timeline: view()')) return;
  const sheet = el.querySelector('.albums-sheet');
  sheet.classList.add('albums-js');
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    sheet.classList.add('albums-go');
  }, { threshold: .35 });
  io.observe(el.querySelector('.albums-deck'));
}
