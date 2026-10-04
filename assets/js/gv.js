// Golden Visa page: benefit gallery panels, step-by-step timeline, FAQ reading pane.
import { canHover } from './core.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* benefits: gallery panels */
$$('.gvb-panels').forEach(box => {
  const panels = $$('.gvb-panel', box);
  const open = p => panels.forEach(x => { const on = x === p; x.classList.toggle('is-open', on); x.setAttribute('aria-expanded', on ? 'true' : 'false'); });
  panels.forEach(p => {
    p.addEventListener('click', () => open(p));
    p.addEventListener('focus', () => open(p));
    p.addEventListener('mouseenter', () => { if (canHover()) open(p); });
  });
});

/* steps: timeline */
$$('.gvs-timeline').forEach(box => {
  const dots = $$('.gvs-dot', box), cards = $$('.gvs-card', box), line = $('.gvs-line', box);
  function select(i, focus) {
    dots.forEach((d, k) => { d.setAttribute('aria-selected', k === i ? 'true' : 'false'); d.tabIndex = k === i ? 0 : -1; if (k === i && focus) d.focus(); });
    cards.forEach((c, k) => { c.hidden = k !== i; });
    line.style.setProperty('--p', ((i + 1) / dots.length * 100) + '%');
  }
  dots.forEach((d, i) => {
    d.addEventListener('click', () => select(i));
    d.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select((i + 1) % dots.length, true); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select((i - 1 + dots.length) % dots.length, true); }
    });
  });
  select(0);
});

/* FAQ: reading pane */
$$('.gvf-pane').forEach(box => {
  const qs = $$('.gvf-pane-q', box), as = $$('.gvf-pane-a', box);
  function select(i, focus) {
    qs.forEach(q => { const on = Number(q.dataset.q) === i; q.setAttribute('aria-selected', on ? 'true' : 'false'); q.tabIndex = on ? 0 : -1; if (on && focus) q.focus(); });
    as.forEach(a => { a.hidden = Number(a.dataset.a) !== i; });
  }
  qs.forEach((q, k) => {
    q.addEventListener('click', () => select(Number(q.dataset.q)));
    q.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const n = qs[(k + (e.key === 'ArrowDown' ? 1 : qs.length - 1)) % qs.length];
      select(Number(n.dataset.q), true);
    });
  });
  $$('[data-next]', box).forEach(b => b.addEventListener('click', () => select(Number(b.dataset.next), true)));
  select(0);
});
