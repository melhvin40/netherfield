// Properties search: JamesEdition-style filters, categories, sort, grid/list/map views, saved searches.
import { pageData, prefs, setPrefs, paintPrefs, paintSaved, savedIds, toast, trapFocus, canHover } from './core.js';
import { esc, formatMoney, formatArea } from '../../src/lib/util.mjs';
import { stateFromParams, paramsFromState, search, facetCounts, activeFilterCount, emptyState, MEDIA, STATUSES } from '../../src/lib/search.mjs';
import { typeOf, marketOf, featureOf, titleForFilters, pageUrl, locationLine, isSold, cardImage } from '../../src/lib/model.mjs';
import { cardHTML, priceText } from '../../src/templates/card.mjs';

const D = pageData();
const { site, tax, properties } = D;
const PER = D.perPage || 12;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ctx = () => ({ tax, saved: savedIds() });
const cardCtx = { site, tax };

let state = stateFromParams(new URLSearchParams(location.search));
let lastResults = [];

const el = {
  title: $('#lsTitle'), count: $('#lsCount'), grid: $('#lsGrid'), empty: $('#lsEmpty'), pages: $('#lsPages'),
  chips: $('#lsChips'), body: $('#lsBody'), mapCol: $('#lsMapCol'), sort: $('#lsSort'), currency: $('#lsCurrency'),
  unit: $('#lsUnit'), q: $('#lsQ'), suggest: $('#lsSuggest'), allBtn: $('#lsAll'), allCount: $('#lsAllCount'),
  barZone: $('#lsBarZone'), cats: $('#lsCats')
};

// A shorter search hint where the field is narrow, so it is never cut off mid-word.
const fullHint = el.q.placeholder, narrow = matchMedia('(max-width: 640px)');
const fitHint = () => { el.q.placeholder = narrow.matches ? 'Area or property' : fullHint; };
narrow.addEventListener('change', fitHint);
fitHint();

/* ------------------------------------------------------------------ labels */
const money = (v, compact = true) => formatMoney(v, prefs().currency, site, { compact });
const area = v => formatArea(v, prefs().unit);
function priceRangeLabel(s) {
  if (s.price_from != null && s.price_to != null) return `${money(s.price_from)} – ${money(s.price_to)}`;
  if (s.price_from != null) return `From ${money(s.price_from)}`;
  if (s.price_to != null) return `Up to ${money(s.price_to)}`;
  return '';
}
function areaRangeLabel(s) {
  if (s.area_from != null && s.area_to != null) return `${area(s.area_from)} – ${area(s.area_to)}`;
  if (s.area_from != null) return `From ${area(s.area_from)}`;
  if (s.area_to != null) return `Up to ${area(s.area_to)}`;
  return '';
}

function chips(s) {
  const out = [];
  const add = (key, label) => out.push(`<button class="chip" type="button" data-remove="${esc(key)}">${esc(label)}<svg class="i" width="14" height="14" aria-hidden="true"><use href="#i-close"/></svg><span class="sr">Remove filter</span></button>`);
  if (s.saved) add('saved', 'Saved properties');
  if (s.q) add('q', `“${s.q}”`);
  if (s.category) { const c = tax.categories.find(x => x.id === s.category); if (c) add('category', c.label); }
  s.markets.forEach(m => add('markets:' + m, marketOf(tax, m)?.label || m));
  s.types.forEach(t => add('types:' + t, typeOf(tax, t).label));
  if (s.price_from != null || s.price_to != null) add('price', priceRangeLabel(s));
  if (s.bedrooms_from) add('bedrooms_from', `${s.bedrooms_from}+ beds`);
  if (s.bathrooms_from) add('bathrooms_from', `${s.bathrooms_from}+ baths`);
  if (s.area_from != null || s.area_to != null) add('area', areaRangeLabel(s));
  s.features.forEach(f => add('features:' + f, featureOf(tax, f).label));
  s.status.forEach(x => add('status:' + x, STATUSES.find(y => y.id === x)?.label || x));
  s.media.forEach(x => add('media:' + x, MEDIA.find(y => y.id === x)?.label || x));
  if (s.golden_visa) add('golden_visa', 'Golden Visa eligible');
  if (out.length > 1) out.push('<button class="chip-clear" type="button" data-clear-all>Clear all</button>');
  return out.join('');
}

function removeKey(key) {
  const [k, v] = key.split(':');
  if (v != null) state[k] = state[k].filter(x => x !== v);
  else if (k === 'price') { state.price_from = null; state.price_to = null; }
  else if (k === 'area') { state.area_from = null; state.area_to = null; }
  else if (k === 'q') { state.q = ''; el.q.value = ''; }
  else if (k === 'category') state.category = '';
  else if (k === 'saved') state.saved = false;
  else if (k === 'golden_visa') state.golden_visa = false;
  else state[k] = 0;
}

/* ------------------------------------------------------------------ render */
function pagesHTML(total, page) {
  const n = Math.ceil(total / PER);
  if (n <= 1) return '';
  const btn = (p, label, attrs = '') => `<button type="button" data-page="${p}"${p === page ? ' aria-current="page"' : ''}${attrs}>${label}</button>`;
  const nums = [];
  for (let i = 1; i <= n; i++) {
    if (i === 1 || i === n || Math.abs(i - page) <= 1) nums.push(btn(i, i));
    else if (nums[nums.length - 1] !== '<span class="gap">…</span>') nums.push('<span class="gap">…</span>');
  }
  return btn(Math.max(1, page - 1), '<svg class="i" aria-hidden="true"><use href="#i-chevron-left"/></svg><span>Previous</span>', page === 1 ? ' disabled' : '') +
    nums.join('') +
    btn(Math.min(n, page + 1), '<span>Next</span><svg class="i" aria-hidden="true"><use href="#i-chevron-right"/></svg>', page === n ? ' disabled' : '');
}

function syncControls() {
  el.sort.value = state.order;
  el.currency.value = prefs().currency;
  el.unit.value = prefs().unit;
  if (document.activeElement !== el.q) el.q.value = state.q;
  $$('[data-quick="price_from"]').forEach(s => { s.value = state.price_from ?? ''; });
  $$('[data-quick="price_to"]').forEach(s => { s.value = state.price_to ?? ''; });
  $$('[data-quick="types"]').forEach(c => { c.checked = state.types.includes(c.value); });
  $$('[data-quick="bedrooms_from"]').forEach(r => { r.checked = Number(r.value) === (state.bedrooms_from || 0); });
  $$('.ls-views [data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view ? 'true' : 'false'));
  $$('.ls-cat').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === state.category ? 'true' : 'false'));
  const setPill = (key, label, on) => {
    const lab = $(`[data-pill-label="${key}"]`); if (!lab) return;
    lab.textContent = label; lab.closest('.ls-pill').classList.toggle('is-set', on);
  };
  setPill('price', priceRangeLabel(state) || 'Price', state.price_from != null || state.price_to != null);
  setPill('type', state.types.length === 1 ? typeOf(tax, state.types[0]).label : state.types.length ? `${state.types.length} types` : 'Property type', !!state.types.length);
  setPill('beds', state.bedrooms_from ? `${state.bedrooms_from}+ beds` : 'Bedrooms', !!state.bedrooms_from);
  const n = activeFilterCount(state) - (state.q ? 1 : 0) - (state.saved ? 1 : 0) - (state.category ? 1 : 0);
  el.allCount.textContent = n; el.allCount.hidden = !n;
  el.allBtn.classList.toggle('is-set', n > 0);
}

function render(opts = {}) {
  const results = search(properties, state, ctx());
  lastResults = results;
  const counts = facetCounts(properties, state, ctx());
  const pages = Math.max(1, Math.ceil(results.length / PER));
  if (state.page > pages) state.page = pages;

  const filtered = activeFilterCount(state) > 0;
  el.title.textContent = state.saved ? 'Your saved properties' : (filtered ? titleForFilters(state, tax) : 'All properties');
  const forSale = results.filter(p => !isSold(p)).length;
  el.count.textContent = `${results.length} ${results.length === 1 ? 'property' : 'properties'}${results.length ? ` · ${forSale} for sale` : ''}`;

  const pageItems = results.slice((state.page - 1) * PER, state.page * PER);
  el.grid.innerHTML = pageItems.map(p => cardHTML(p, cardCtx, { layout: state.view === 'list' ? 'list' : 'grid' })).join('');
  paintSaved(el.grid);
  paintPrefs(site, el.grid);
  el.empty.hidden = results.length > 0;
  if (!results.length && state.saved && !savedIds().length) {
    el.empty.querySelector('.h3').textContent = 'You have not saved any properties yet';
    el.empty.querySelector('p:not(.h3)').textContent = 'Tap the heart on any property to keep it here. Saved homes stay on this device.';
  }
  el.pages.innerHTML = pagesHTML(results.length, state.page);
  el.chips.innerHTML = chips(state);
  $$('.ls-cat').forEach(b => b.classList.toggle('is-zero', !counts.categories[b.dataset.cat] && b.dataset.cat !== state.category));
  $$('[data-count-for]').forEach(c => {
    if (c.closest('#fsSheet') && sheetOpen) return;
    const [k, v] = c.dataset.countFor.split(':');
    c.textContent = counts[k]?.[v] ?? '';
    c.closest('.check')?.classList.toggle('is-zero', !counts[k]?.[v]);
  });
  el.body.dataset.view = state.view;
  el.mapCol.hidden = state.view !== 'map';
  syncControls();
  if (state.view === 'map') updateMap(results);
  const qs = paramsFromState(state).toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  if (opts.scroll) document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function update(patch, opts) {
  Object.assign(state, patch);
  if (!('page' in patch)) state.page = 1;
  render(opts);
}

/* ------------------------------------------------------------------ events */
el.chips.addEventListener('click', e => {
  const rm = e.target.closest('[data-remove]');
  if (rm) { removeKey(rm.dataset.remove); state.page = 1; render(); return; }
  if (e.target.closest('[data-clear-all]')) clearAll();
});
document.addEventListener('click', e => { if (e.target.closest('.ls-empty [data-clear-all]')) clearAll(); });
function clearAll() {
  const keep = { order: state.order, view: state.view };
  state = Object.assign(emptyState(), keep);
  el.q.value = '';
  render();
}

el.pages.addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (!b || b.disabled) return;
  update({ page: Number(b.dataset.page) }, { scroll: true });
});
el.sort.addEventListener('change', () => update({ order: el.sort.value }));
$$('.ls-views [data-view]').forEach(b => b.addEventListener('click', () => update({ view: b.dataset.view, page: state.page })));
el.currency.addEventListener('change', () => { setPrefs({ currency: el.currency.value }); relabelSelects(); render(); });
el.unit.addEventListener('change', () => { setPrefs({ unit: el.unit.value }); relabelSelects(); render(); });

// card photo carousels (delegated: cards are re-rendered)
el.grid.addEventListener('click', e => {
  const nav = e.target.closest('.pc-nav');
  if (!nav) return;
  e.preventDefault();
  const media = nav.closest('.pc-media');
  const frames = $$('.pc-frame', media);
  let i = Number(media.dataset.i || 0);
  i = (i + (nav.classList.contains('pc-next') ? 1 : -1) + frames.length) % frames.length;
  media.dataset.i = i;
  frames.forEach((f, k) => { f.hidden = k !== i; });
  const cur = $('[data-current]', media); if (cur) cur.textContent = i + 1;
});

/* categories */
el.cats.addEventListener('click', e => {
  const b = e.target.closest('.ls-cat');
  if (b) update({ category: state.category === b.dataset.cat ? '' : b.dataset.cat });
});
const catPrev = $('.ls-cats-arrow.is-prev'), catNext = $('.ls-cats-arrow.is-next');
function catArrows() {
  const max = el.cats.scrollWidth - el.cats.clientWidth;
  catPrev.disabled = el.cats.scrollLeft < 8;
  catNext.disabled = el.cats.scrollLeft > max - 8 || max <= 0;
  el.cats.parentElement.classList.toggle('no-scroll', max <= 0);
  el.cats.classList.toggle('fade-l', !catPrev.disabled);
  el.cats.classList.toggle('fade-r', !catNext.disabled);
}
catPrev.addEventListener('click', () => el.cats.scrollBy({ left: -el.cats.clientWidth * .7, behavior: 'smooth' }));
catNext.addEventListener('click', () => el.cats.scrollBy({ left: el.cats.clientWidth * .7, behavior: 'smooth' }));
el.cats.addEventListener('scroll', catArrows, { passive: true });
window.addEventListener('resize', catArrows);
catArrows();

/* sticky search bar shadow */
window.addEventListener('scroll', () => {
  const hdrH = document.getElementById('hdr')?.offsetHeight || 0;
  el.barZone.classList.toggle('is-stuck', el.barZone.getBoundingClientRect().top <= hdrH + 1);
}, { passive: true });

/* price / area select labels follow the chosen currency and unit (values stay EUR and m²) */
function relabelSelects() {
  $$('[data-price-select] option[value]:not([value=""])').forEach(o => { o.textContent = money(Number(o.value), false).replace('≈ ', ''); });
  $$('[data-area-select] option[value]:not([value=""])').forEach(o => { o.textContent = area(Number(o.value)); });
}

/* ------------------------------------------------------------------ popovers */
let openPop = null;
function closePop() {
  if (!openPop) return;
  openPop.pop.hidden = true;
  openPop.btn.setAttribute('aria-expanded', 'false');
  openPop = null;
}
$$('.ls-pill[data-pop]').forEach(btn => {
  const pop = document.getElementById('pop-' + btn.dataset.pop);
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const same = openPop && openPop.pop === pop;
    closePop();
    if (same) return;
    pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
    openPop = { pop, btn };
    // keep the popover inside the viewport
    pop.style.left = '0'; pop.style.right = 'auto';
    const r = pop.getBoundingClientRect();
    if (r.right > innerWidth - 12) { pop.style.left = 'auto'; pop.style.right = '0'; }
  });
  pop.addEventListener('click', e => e.stopPropagation());
});
document.addEventListener('click', closePop);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openPop) { const b = openPop.btn; closePop(); b.focus(); } });
$$('[data-pop-done]').forEach(b => b.addEventListener('click', closePop));
$$('[data-quick]').forEach(inp => inp.addEventListener('change', () => {
  const k = inp.dataset.quick;
  if (k === 'types') update({ types: $$('[data-quick="types"]:checked').map(c => c.value) });
  else if (k === 'bedrooms_from') update({ bedrooms_from: Number(inp.value) });
  else {
    const v = inp.value === '' ? null : Number(inp.value);
    const patch = { [k]: v };
    if (k === 'price_from' && v != null && state.price_to != null && state.price_to < v) patch.price_to = null;
    if (k === 'price_to' && v != null && state.price_from != null && state.price_from > v) patch.price_from = null;
    update(patch);
  }
}));
$$('[data-clear]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.clear;
  if (k === 'price') update({ price_from: null, price_to: null });
  else if (k === 'types') update({ types: [] });
  else update({ [k]: 0 });
}));

/* ------------------------------------------------------------------ filter sheet */
const sheet = $('#fsSheet'), backdrop = $('#fsBackdrop'), form = $('#fsForm');
let draft = null, sheetOpen = false, releaseSheet = null;
function readForm() {
  const d = Object.assign({}, draft);
  const vals = name => $$(`[name="${name}"]:checked`, form).map(i => i.value);
  d.status = vals('status'); d.types = vals('types'); d.markets = vals('markets'); d.features = vals('features'); d.media = vals('media');
  const num = id => { const v = $('#' + id).value; return v === '' ? null : Number(v); };
  d.price_from = num('fsPriceFrom'); d.price_to = num('fsPriceTo');
  if (d.price_from != null && d.price_to != null && d.price_to < d.price_from) d.price_to = null;
  d.area_from = num('fsAreaFrom'); d.area_to = num('fsAreaTo');
  if (d.area_from != null && d.area_to != null && d.area_to < d.area_from) d.area_to = null;
  d.bedrooms_from = Number(($('[name="bedrooms_from"]:checked', form) || {}).value || 0);
  d.bathrooms_from = Number(($('[name="bathrooms_from"]:checked', form) || {}).value || 0);
  d.golden_visa = $('[name="golden_visa"]', form).checked;
  return d;
}
function writeForm(d) {
  const set = (name, list) => $$(`[name="${name}"]`, form).forEach(i => { i.checked = list.includes(i.value); });
  set('status', d.status); set('types', d.types); set('markets', d.markets); set('features', d.features); set('media', d.media);
  $('#fsPriceFrom').value = d.price_from ?? ''; $('#fsPriceTo').value = d.price_to ?? '';
  $('#fsAreaFrom').value = d.area_from ?? ''; $('#fsAreaTo').value = d.area_to ?? '';
  $$('[name="bedrooms_from"]', form).forEach(r => { r.checked = Number(r.value) === (d.bedrooms_from || 0); });
  $$('[name="bathrooms_from"]', form).forEach(r => { r.checked = Number(r.value) === (d.bathrooms_from || 0); });
  $('[name="golden_visa"]', form).checked = !!d.golden_visa;
}
function refreshSheetCounts() {
  draft = readForm();
  const res = search(properties, draft, ctx());
  const counts = facetCounts(properties, draft, ctx());
  $('[data-fs-count]', sheet).textContent = res.length;
  $$('[data-count-for]', sheet).forEach(c => {
    const [k, v] = c.dataset.countFor.split(':');
    c.textContent = counts[k]?.[v] ?? '';
    c.closest('.check')?.classList.toggle('is-zero', !counts[k]?.[v]);
  });
  const btn = $('[data-fs-apply]', sheet);
  btn.disabled = res.length === 0;
}
function openSheet() {
  closePop();
  draft = Object.assign({}, state, { features: [...state.features], types: [...state.types], markets: [...state.markets], status: [...state.status], media: [...state.media] });
  writeForm(draft);
  refreshSheetCounts();
  sheet.hidden = false; backdrop.hidden = false; sheetOpen = true;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { sheet.classList.add('is-open'); backdrop.classList.add('is-open'); });
  releaseSheet = trapFocus(sheet, closeSheet);
  $('[data-fs-close]', sheet).focus();
}
function closeSheet() {
  sheet.classList.remove('is-open'); backdrop.classList.remove('is-open'); sheetOpen = false;
  document.body.style.overflow = '';
  setTimeout(() => { if (!sheetOpen) { sheet.hidden = true; backdrop.hidden = true; } }, 380);
  if (releaseSheet) { releaseSheet(); releaseSheet = null; }
}
el.allBtn.addEventListener('click', openSheet);
backdrop.addEventListener('click', closeSheet);
$('[data-fs-close]', sheet).addEventListener('click', closeSheet);
form.addEventListener('change', refreshSheetCounts);
$('[data-fs-clear]', sheet).addEventListener('click', () => { writeForm(Object.assign(emptyState(), { q: state.q })); refreshSheetCounts(); });
$('[data-fs-apply]', sheet).addEventListener('click', () => {
  state = Object.assign(readForm(), { page: 1 });
  closeSheet();
  render();
});

/* ------------------------------------------------------------------ search box */
let sugItems = [], sugIndex = -1, qTimer;
function suggestions(text) {
  const t = text.trim().toLowerCase();
  if (!t) return [];
  const out = [];
  tax.markets.forEach(m => { if ((m.label + ' ' + m.city + ' ' + m.region).toLowerCase().includes(t) && properties.some(p => p.location?.market === m.id)) out.push({ kind: 'market', id: m.id, label: m.label, note: 'Area', icon: 'pin' }); });
  properties.forEach(p => { if ((p.title + ' ' + p.ref).toLowerCase().includes(t)) out.push({ kind: 'property', id: p.id, label: p.title, note: isSold(p) ? 'Delivered' : 'Property', icon: 'home' }); });
  tax.features.forEach(f => { if (f.searchable && f.label.toLowerCase().includes(t) && properties.some(p => (p.features || []).includes(f.id))) out.push({ kind: 'feature', id: f.id, label: f.label, note: 'Feature', icon: f.icon || 'spark' }); });
  tax.propertyTypes.forEach(ty => { if ((ty.label + ' ' + ty.plural).toLowerCase().includes(t) && properties.some(p => p.type === ty.id)) out.push({ kind: 'type', id: ty.id, label: ty.plural, note: 'Type', icon: 'home' }); });
  return out.slice(0, 8);
}
function showSuggest() {
  sugItems = suggestions(el.q.value); sugIndex = -1;
  el.suggest.innerHTML = sugItems.map((s, i) => `<li role="option" id="sg${i}" aria-selected="false" data-i="${i}"><svg class="i" aria-hidden="true"><use href="#i-${s.icon}"/></svg>${esc(s.label)}<small>${s.note}</small></li>`).join('');
  el.suggest.hidden = !sugItems.length;
  el.q.closest('.ls-search').setAttribute('aria-expanded', sugItems.length ? 'true' : 'false');
}
function pick(i) {
  const s = sugItems[i]; if (!s) return;
  el.suggest.hidden = true; el.q.value = '';
  if (s.kind === 'property') { location.href = pageUrl(properties.find(p => p.id === s.id)); return; }
  if (s.kind === 'market') update({ q: '', markets: state.markets.includes(s.id) ? state.markets : [...state.markets, s.id] });
  if (s.kind === 'feature') update({ q: '', features: state.features.includes(s.id) ? state.features : [...state.features, s.id] });
  if (s.kind === 'type') update({ q: '', types: state.types.includes(s.id) ? state.types : [...state.types, s.id] });
}
el.q.addEventListener('input', () => {
  showSuggest();
  clearTimeout(qTimer);
  qTimer = setTimeout(() => update({ q: el.q.value.trim() }), 280);
});
el.q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!sugItems.length) return;
    e.preventDefault();
    sugIndex = (sugIndex + (e.key === 'ArrowDown' ? 1 : -1) + sugItems.length) % sugItems.length;
    $$('li', el.suggest).forEach((li, k) => li.setAttribute('aria-selected', k === sugIndex ? 'true' : 'false'));
    el.q.setAttribute('aria-activedescendant', 'sg' + sugIndex);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (sugIndex >= 0) pick(sugIndex); else { el.suggest.hidden = true; clearTimeout(qTimer); update({ q: el.q.value.trim() }); }
  } else if (e.key === 'Escape') { el.suggest.hidden = true; }
});
el.suggest.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(Number(li.dataset.i)); } });
el.q.addEventListener('blur', () => setTimeout(() => { el.suggest.hidden = true; }, 120));

/* ------------------------------------------------------------------ saved searches */
$('#lsSave').addEventListener('click', () => {
  const name = titleForFilters(state, tax);
  const qs = paramsFromState(Object.assign({}, state, { page: 1 })).toString();
  let list = [];
  try { list = JSON.parse(localStorage.getItem('nf-searches') || '[]'); } catch (e) {}
  if (!list.some(x => x.qs === qs)) list.unshift({ name, qs, saved: new Date().toISOString().slice(0, 10) });
  try { localStorage.setItem('nf-searches', JSON.stringify(list.slice(0, 12))); } catch (e) {}
  const link = location.origin + location.pathname + (qs ? '?' + qs : '');
  const mail = `mailto:${site.email}?subject=${encodeURIComponent('New listings alert: ' + name)}&body=${encodeURIComponent(`Please let me know when new properties match this search:\n${name}\n${link}\n\nName:\nPhone:`)}`;
  toast(`Search saved on this device. <a href="${mail}">Email me new matches</a>`, 6000);
});

/* ------------------------------------------------------------------ map view */
let map = null, markerLayer = null, markerById = {};
function spread(list) {
  // listings that share a position (e.g. delivered projects shown at city level) fan out slightly
  const seen = {};
  return list.map(p => {
    const l = p.location || {};
    if (l.lat == null) return null;
    const key = l.lat.toFixed(4) + ',' + l.lng.toFixed(4);
    const n = seen[key] = (seen[key] || 0) + 1;
    if (n === 1) return { p, lat: l.lat, lng: l.lng };
    const ang = n * 2.399, r = 0.0016 * Math.sqrt(n);
    return { p, lat: l.lat + Math.sin(ang) * r, lng: l.lng + Math.cos(ang) * r * 1.27 };
  }).filter(Boolean);
}
function popupHTML(p) {
  const ph = p.photos && p.photos[0];
  const img = ph ? cardImage(ph) : null;
  return `<a class="lm-card" href="${pageUrl(p)}">
    <span class="lm-card-img">${img ? `<img src="${esc(img.src)}" alt="" width="${img.w}" height="${img.h}">` : ''}</span>
    <span class="lm-card-body"><span class="lm-card-price">${esc(priceText(p, site, prefs().currency))}</span><span class="lm-card-title">${esc(p.title)}</span><span class="lm-card-loc">${esc(locationLine(p))}</span></span></a>`;
}
let mapPoints = [];
function updateMap(results) {
  if (!window.L) return;
  if (!map) {
    map = L.map('lsMap', { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer(site.maps.tiles, { attribution: site.maps.tilesAttribution, maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('zoomend', drawMarkers);
  }
  mapPoints = spread(results);
  setTimeout(() => {
    map.invalidateSize();
    if (mapPoints.length === 1) map.setView([mapPoints[0].lat, mapPoints[0].lng], 15);
    else if (mapPoints.length) map.fitBounds(L.latLngBounds(mapPoints.map(x => [x.lat, x.lng])), { padding: [56, 56], maxZoom: 15 });
    else map.setView([37.93, 23.70], 11);
    drawMarkers();
  }, 30);
}
// Pins closer than ~60px merge into one "N homes" pin; clicking it zooms in, or lists the homes
// when they share an approximate position (e.g. delivered projects shown at city level).
function drawMarkers() {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers(); markerById = {};
  const z = map.getZoom();
  const groups = [];
  mapPoints.forEach(pt => {
    const px = map.project([pt.lat, pt.lng], z);
    const g = groups.find(g => g.px.distanceTo(px) < 60);
    if (g) g.items.push(pt); else groups.push({ px, items: [pt] });
  });
  groups.forEach(g => {
    const lat = g.items.reduce((a, x) => a + x.lat, 0) / g.items.length;
    const lng = g.items.reduce((a, x) => a + x.lng, 0) / g.items.length;
    if (g.items.length === 1) {
      const p = g.items[0].p;
      const label = isSold(p) ? 'Delivered' : (p.priceOnRequest || !p.price ? 'On request' : formatMoney(p.price, prefs().currency, site, { compact: true }));
      const icon = L.divIcon({ className: 'lm-wrap', html: `<span class="lm-pin${isSold(p) ? ' is-sold' : ''}" data-pin="${esc(p.id)}">${esc(label)}</span>`, iconSize: null });
      const m = L.marker([lat, lng], { icon, riseOnHover: true, title: p.title, keyboard: true }).bindPopup(popupHTML(p), { offset: [0, -28] });
      m.on('mouseover', () => highlight(p.id, true));
      m.on('mouseout', () => highlight(p.id, false));
      m.addTo(markerLayer);
      markerById[p.id] = m;
      return;
    }
    const ids = g.items.map(x => x.p.id);
    const icon = L.divIcon({ className: 'lm-wrap', html: `<span class="lm-pin lm-cluster" data-pins="${esc(ids.join(' '))}">${g.items.length} homes</span>`, iconSize: null });
    const m = L.marker([lat, lng], { icon, riseOnHover: true, keyboard: true, title: `${g.items.length} homes` });
    const bounds = L.latLngBounds(g.items.map(x => [x.lat, x.lng]));
    const list = `<div class="lm-list"><p class="lm-list-h">${g.items.length} homes here</p>${g.items.map(x => `<a href="${pageUrl(x.p)}"><span>${esc(x.p.title)}</span><small>${esc(priceText(x.p, site, prefs().currency))}</small></a>`).join('')}</div>`;
    m.on('click', () => {
      const tooTight = map.getBoundsZoom(bounds) <= z || z >= 16;
      if (tooTight) m.bindPopup(list, { offset: [0, -28] }).openPopup();
      else map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
    });
    m.on('mouseover', () => ids.forEach(id => highlight(id, true)));
    m.on('mouseout', () => ids.forEach(id => highlight(id, false)));
    m.addTo(markerLayer);
  });
}
function highlight(id, on) {
  const card = el.grid.querySelector(`.pc[data-id="${CSS.escape(id)}"]`);
  if (card) card.classList.toggle('is-hl', on);
  const pin = document.querySelector(`[data-pin="${CSS.escape(id)}"]`) || [...document.querySelectorAll('[data-pins]')].find(x => x.dataset.pins.split(' ').includes(id));
  if (pin) pin.classList.toggle('is-hl', on);
}
el.grid.addEventListener('mouseover', e => {
  if (state.view !== 'map' || !canHover()) return;
  const c = e.target.closest('.pc'); if (c && !c.contains(e.relatedTarget)) highlight(c.dataset.id, true);
});
el.grid.addEventListener('mouseout', e => {
  if (state.view !== 'map') return;
  const c = e.target.closest('.pc'); if (c && !c.contains(e.relatedTarget)) highlight(c.dataset.id, false);
});

/* ------------------------------------------------------------------ go */
relabelSelects();
render();
document.addEventListener('nf:saved-change', () => { if (state.saved) render(); });
