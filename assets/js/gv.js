// Golden Visa page: benefits (immersive tabs, gallery panels), step-by-step guide (timeline, story), FAQ (index, pane).
import { canHover, reducedMotion } from './core.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* benefits: immersive film tabs */
$$('.gvb-immersive').forEach(box => {
  const tabs = $$('.gvb-tab', box), films = $$('.gvb-film', box);
  function select(key) {
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.key === key ? 'true' : 'false'));
    films.forEach(f => {
      const on = f.dataset.key === key;
      f.classList.toggle('is-on', on);
      if (on && !reducedMotion()) { f.preload = 'auto'; f.muted = true; f.play().catch(() => {}); }
      else f.pause();
    });
  }
  tabs.forEach(t => {
    t.addEventListener('click', () => select(t.dataset.key));
    t.addEventListener('mouseenter', () => { if (canHover()) select(t.dataset.key); });
    t.addEventListener('focus', () => select(t.dataset.key));
  });
});

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

/* steps: scrolling story */
$$('.gvs-story').forEach(box => {
  const items = $$('.gvs-story-item', box), num = $('[data-story-n]', box);
  if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('is-on')); return; }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    items.forEach(i => i.classList.toggle('is-on', i === en.target));
    if (num) num.textContent = String(Number(en.target.dataset.story) + 1).padStart(2, '0');
  }), { rootMargin: '-45% 0px -45% 0px' });
  items.forEach(i => io.observe(i));
  items[0].classList.add('is-on');
});

/* FAQ: index (topics + search) */
$$('.gvf-index').forEach(box => {
  const qs = $$('.gvf-q', box), cats = $$('[data-faq-cat]', box), search = $('[data-faq-search]', box), empty = $('.gvf-empty', box);
  let cat = '';
  function apply() {
    const words = (search.value || '').toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    qs.forEach(q => {
      const text = q.textContent.toLowerCase();
      const ok = (!cat || q.dataset.cat === cat) && words.every(w => text.includes(w));
      q.hidden = !ok;
      if (ok) shown++;
      if (ok && words.length) q.open = true;
    });
    empty.hidden = shown > 0;
  }
  cats.forEach(b => b.addEventListener('click', () => {
    cat = b.dataset.faqCat;
    cats.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    apply();
  }));
  search.addEventListener('input', apply);
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
