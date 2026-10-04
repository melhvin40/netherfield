// Home: featured-listings "estate line" and its grid; the residency planner (not on the page yet).
import { pageData, canHover, reducedMotion } from './core.js';
import { formatMoney } from '../../src/lib/util.mjs';

const data = pageData() || {};

/* ---------------------------------------------------------------------------
   Estate line. One sine function drives the SVG path and every node, drawn at the
   cards' real height and panned with scroll, so each node sits beside its card.
   Highlighting follows the pointer only: an item lights up while the pointer is
   actually over it and goes dark the moment it leaves. Scrolling never changes the
   highlight (content sliding under a resting cursor is not a hover), and nothing
   is highlighted at rest.
   --------------------------------------------------------------------------- */
const es = document.getElementById('estateLine');
if (es) {
  const graphic = es.querySelector('.es-graphic');
  const canvas = es.querySelector('.es-canvas');
  const svg = es.querySelector('.es-svg');
  const path = es.querySelector('.es-path');
  const field = es.querySelector('.es-field');
  const fieldLit = es.querySelector('.es-field-lit');
  const cardsEl = es.querySelector('.es-cards');
  const layoutEl = es.querySelector('.es-layout');
  const nodes = [...es.querySelectorAll('.es-node')];
  const cards = [...es.querySelectorAll('.es-card')];

  function layout() {
    if (!graphic || getComputedStyle(graphic).display === 'none') return;
    // the grid field spans the listings' height and ends exactly on the divider line beside them
    if (field) {
      const sec = es.getBoundingClientRect(), lay = layoutEl.getBoundingClientRect();
      es.style.setProperty('--es-top', Math.round(lay.top - sec.top) + 'px');
      es.style.setProperty('--es-h', Math.round(lay.height) + 'px');
      es.style.setProperty('--es-divider', Math.round(cardsEl.getBoundingClientRect().left - sec.left) + 1 + 'px');
      es.classList.add('has-field');
    }
    const H = cardsEl.offsetHeight;
    if (!H) return;
    canvas.style.height = H + 'px';
    svg.setAttribute('viewBox', `0 0 200 ${H}`);
    const N = cards.length, MID = 100, AMP = 70, FREQ = N / 1.6;
    const xAt = y => MID + Math.sin((y / H) * Math.PI * FREQ) * AMP;
    let d = '';
    const steps = Math.max(80, Math.round(H / 10));
    for (let i = 0; i <= steps; i++) {
      const y = (i / steps) * H;
      d += (i ? 'L' : 'M') + xAt(y).toFixed(2) + ' ' + y.toFixed(2) + ' ';
    }
    path.setAttribute('d', d.trim());
    const top = cardsEl.getBoundingClientRect().top;
    nodes.forEach((n, i) => {
      const r = cards[i].getBoundingClientRect();
      const y = r.top - top + Math.min(r.height / 2, 260);
      n.style.top = y + 'px';
      n.style.left = (xAt(y) / 2) + '%';
    });
  }
  function pan() {
    if (!graphic) return;
    canvas.style.transform = `translateY(${cardsEl.getBoundingClientRect().top - graphic.getBoundingClientRect().top}px)`;
  }

  let active = null;
  function setActive(i) {
    if (i === active) return;
    active = i;
    nodes.forEach((n, k) => n.classList.toggle('is-active', k === i));
    cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
  }

  let scrollQuietUntil = 0, framePending = false;
  window.addEventListener('scroll', () => {
    scrollQuietUntil = performance.now() + 200;
    setActive(null);
    if (!framePending) { framePending = true; requestAnimationFrame(() => { framePending = false; pan(); }); }
  }, { passive: true });

  let lastX = -1, lastY = -1;
  document.addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const moved = e.clientX !== lastX || e.clientY !== lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (!moved || performance.now() < scrollQuietUntil) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const item = hit && hit.closest && hit.closest('#estateLine .es-card, #estateLine .es-node');
    setActive(item ? Number(item.dataset.index) : null);
    if (field && fieldLit) {
      const r = field.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      es.classList.toggle('is-lit', inside && canHover() && !reducedMotion());
      if (inside) { fieldLit.style.setProperty('--x', (e.clientX - r.left) + 'px'); fieldLit.style.setProperty('--y', (e.clientY - r.top) + 'px'); }
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { setActive(null); es.classList.remove('is-lit'); });
  window.addEventListener('blur', () => setActive(null));

  // keyboard users get the same highlight while a card has visible focus
  cards.forEach((c, i) => {
    c.addEventListener('focus', () => { if (c.matches(':focus-visible')) setActive(i); });
    c.addEventListener('blur', () => setActive(null));
  });
  nodes.forEach((n, i) => n.addEventListener('click', () => { location.href = cards[i].href; }));

  const relayout = () => { layout(); pan(); };
  window.addEventListener('resize', relayout);
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(cardsEl);
  cardsEl.querySelectorAll('img').forEach(img => { if (!img.complete) img.addEventListener('load', relayout, { once: true }); });
  relayout();
}

/* ---------------------------------------------------------------------------
   Residency planner (kept for a later phase; runs only when the section is on the page)
   --------------------------------------------------------------------------- */
const pl = document.getElementById('planner');
if (pl) {
  const site = data.site || {};
  const props = data.properties || [];
  const budget = pl.querySelector('#plBudget');
  const budgetOut = pl.querySelector('#plBudgetOut');
  const famInput = pl.querySelector('#plFamily');
  const famOut = pl.querySelector('#plFamilyOut');
  const eur = n => formatMoney(n, 'EUR', site);
  function update() {
    const b = Number(budget.value);
    budget.style.setProperty('--fill', ((b - budget.min) / (budget.max - budget.min) * 100) + '%');
    budgetOut.textContent = b >= Number(budget.max) ? '€2,000,000+' : eur(b);
    const area = (pl.querySelector('input[name="plArea"]:checked') || {}).value || '';
    const fam = Number(famInput.value);
    famOut.textContent = fam;
    let route, note;
    if (b >= 800000) { route = '€800,000 route'; note = 'Your budget meets the Attica threshold: one residential property of at least 120 m² in Athens, Glyfada or Piraeus.'; }
    else if (b >= 400000) { route = 'Conversion route'; note = 'In Athens and the Riviera this budget qualifies through the €250,000 route: a building converted from commercial to residential use, or a restored listed building. €400,000 applies outside Attica.'; }
    else { route = '€250,000 conversion route'; note = 'For buildings converted from commercial to residential use, or restored listed buildings, anywhere in Greece.'; }
    pl.querySelector('#plRoute').textContent = route;
    pl.querySelector('#plRouteNote').textContent = note;
    const yearly = Math.round(b * 0.06 / 100) * 100;
    pl.querySelector('#plIncome').textContent = eur(yearly) + ' a year';
    pl.querySelector('#plFamilyV').textContent = fam === 1 ? 'Just you' : `All ${fam} covered`;
    const n = props.filter(p => !p.priceOnRequest && p.price <= b && (!area || p.market === area)).length;
    const cta = pl.querySelector('#plCta');
    const q = new URLSearchParams({ price_to: String(b), status: 'available' });
    if (area) q.set('location', area);
    cta.href = 'properties.html?' + q.toString();
    cta.textContent = n ? `View ${n} matching ${n === 1 ? 'home' : 'homes'}` : 'Talk to us about off-market homes';
    if (!n) cta.href = 'contact.html';
  }
  budget.addEventListener('input', update);
  pl.querySelectorAll('input[name="plArea"]').forEach(r => r.addEventListener('change', update));
  pl.querySelectorAll('[data-step]').forEach(btn => btn.addEventListener('click', () => {
    famInput.value = Math.min(10, Math.max(1, Number(famInput.value) + Number(btn.dataset.step)));
    update();
  }));
  update();
}
