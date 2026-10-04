// Property page: photo viewer + "Show all photos", read more, share, enquiry form, map/satellite/Street View, video.
import { pageData, setPrefs, prefs, toast, trapFocus } from './core.js';

const D = pageData() || {};
const P = D.property || {};
const site = D.site || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lockScroll = on => { document.documentElement.style.overflow = on ? 'hidden' : ''; };

/* ------------------------------------------------------------------ viewer */
const viewer = $('#pvViewer');
const stageImg = viewer && $('.vw-stage img', viewer);
let vList = [], vIndex = 0, releaseViewer = null;
function showSlide(i) {
  vIndex = (i + vList.length) % vList.length;
  const it = vList[vIndex];
  stageImg.src = it.src;
  stageImg.alt = it.alt || '';
  if (it.w) { stageImg.width = it.w; stageImg.height = it.h; }
  $('.vw-count', viewer).textContent = `${vIndex + 1} / ${vList.length}`;
  $('.vw-cap', viewer).textContent = it.label || it.alt || '';
  $$('.vw-nav', viewer).forEach(b => { b.hidden = vList.length < 2; });
  [vIndex + 1, vIndex - 1].forEach(k => { const n = vList[(k + vList.length) % vList.length]; if (n) { const im = new Image(); im.src = n.src; } });
}
function openViewer(list, i) {
  if (!viewer || !list.length) return;
  vList = list; viewer.hidden = false; lockScroll(true);
  showSlide(i);
  releaseViewer = trapFocus(viewer, closeViewer);
  $('.vw-close', viewer).focus();
}
function closeViewer() {
  viewer.hidden = true;
  if (allPhotos.hidden) lockScroll(false);
  if (releaseViewer) { releaseViewer(); releaseViewer = null; }
}
if (viewer) {
  $('.vw-close', viewer).addEventListener('click', closeViewer);
  $('.vw-prev', viewer).addEventListener('click', () => showSlide(vIndex - 1));
  $('.vw-next', viewer).addEventListener('click', () => showSlide(vIndex + 1));
  viewer.addEventListener('click', e => { if (e.target === viewer || e.target.classList.contains('vw-stage')) closeViewer(); });
  document.addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'ArrowLeft') showSlide(vIndex - 1);
    if (e.key === 'ArrowRight') showSlide(vIndex + 1);
  });
  let x0 = null;
  const stage = $('.vw-stage', viewer);
  stage.addEventListener('pointerdown', e => { x0 = e.clientX; });
  stage.addEventListener('pointerup', e => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) showSlide(vIndex + (dx < 0 ? 1 : -1));
  });
}

/* ------------------------------------------------------------------ all photos */
const allPhotos = $('#pvAll');
let releaseAll = null;
function openAll() {
  allPhotos.hidden = false; lockScroll(true); allPhotos.scrollTop = 0;
  releaseAll = trapFocus(allPhotos, () => { if (viewer.hidden) closeAll(); });
  $('[data-pv-close]', allPhotos).focus();
}
function closeAll() {
  allPhotos.hidden = true; lockScroll(false);
  if (releaseAll) { releaseAll(); releaseAll = null; }
}
if (allPhotos) {
  $('[data-pv-close]', allPhotos).addEventListener('click', closeAll);
  $$('[data-all]').forEach(b => b.addEventListener('click', () => (P.photos || []).length > 1 ? openAll() : openViewer(P.photos || [], 0)));
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]');
  if (o) { e.preventDefault(); openViewer(P.photos || [], Number(o.dataset.open)); return; }
  const pl = e.target.closest('[data-plan]');
  if (pl) { e.preventDefault(); openViewer(P.plans || [], Number(pl.dataset.plan)); }
});

/* ------------------------------------------------------------------ read more */
const more = $('.pd-more');
if (more) more.addEventListener('click', () => {
  const d = $('#pdDesc');
  const open = d.classList.toggle('is-clamped') === false;
  more.firstChild.textContent = open ? 'Show less' : 'Read more';
  more.setAttribute('aria-expanded', open ? 'true' : 'false');
});

/* ------------------------------------------------------------------ back to search (keeps the visitor's filters) */
const back = $('[data-back]');
if (back) back.addEventListener('click', e => {
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === location.origin && /properties\.html$/.test(ref.pathname)) { e.preventDefault(); history.back(); }
  } catch (err) { /* no referrer: follow the link */ }
});

/* ------------------------------------------------------------------ currency */
const cur = $('[data-currency]');
if (cur) {
  cur.value = prefs().currency;
  cur.addEventListener('change', () => setPrefs({ currency: cur.value }));
}

/* ------------------------------------------------------------------ share */
const shareBtn = $('[data-share]');
const sharePop = $('.pd-sharepop');
if (shareBtn && sharePop) {
  const url = location.href.split('#')[0];
  const text = `${P.title} (${P.ref}) | ${site.name}`;
  const targets = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
    email: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  };
  $$('[data-share-to]', sharePop).forEach(a => { if (targets[a.dataset.shareTo]) a.href = targets[a.dataset.shareTo]; });
  const close = () => { sharePop.hidden = true; shareBtn.setAttribute('aria-expanded', 'false'); };
  shareBtn.addEventListener('click', async e => {
    e.stopPropagation();
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: text, url }); } catch (err) { /* dismissed */ }
      return;
    }
    const open = sharePop.hidden;
    sharePop.hidden = !open; shareBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  sharePop.addEventListener('click', e => e.stopPropagation());
  $('[data-share-to="copy"]', sharePop).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copied.'); } catch (err) { prompt('Copy this link:', url); }
    close();
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* ------------------------------------------------------------------ enquiry */
const form = $('#pdForm');
function ask(kind) {
  const box = form && $(`[data-ask="${kind}"]`, form);
  if (box) box.checked = true;
}
document.addEventListener('click', e => {
  const r = e.target.closest('[data-request]');
  if (!r || !form) return;
  e.preventDefault();
  ask(r.dataset.request);
  $('#enquire').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => $('#pdName').focus({ preventScroll: true }), 500);
});
if (form) form.addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(form);
  const required = [['#pdName', v => v.trim()], ['#pdEmail', v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())]];
  let ok = true;
  required.forEach(([sel, test]) => { const i = $(sel, form); const good = test(i.value); i.classList.toggle('is-invalid', !good); if (!good && ok) { i.focus(); ok = false; } });
  const consent = $('[name="consent"]', form);
  if (!consent.checked) { consent.closest('.check').classList.add('is-invalid'); if (ok) consent.focus(); ok = false; } else consent.closest('.check').classList.remove('is-invalid');
  if (!ok) return;
  const asks = f.getAll('ask');
  const phone = f.get('phone') ? `${f.get('cc')} ${f.get('phone')}` : '';
  const subject = `Enquiry: ${form.dataset.title} (${form.dataset.ref})`;
  const body = [
    `Property: ${form.dataset.title} (${form.dataset.ref})`,
    `Page: ${location.origin}${location.pathname}`,
    asks.length ? `I would like: ${asks.join(', ')}` : '',
    '', String(f.get('message') || ''), '',
    `Name: ${f.get('name')}`, `Email: ${f.get('email')}`, phone ? `Phone: ${phone}` : ''
  ].filter((l, i, a) => l || a[i - 1]).join('\n');
  $('.pd-form-ok', form).hidden = false;
  location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

/* ------------------------------------------------------------------ video, 3D tour: load the third-party player only on request */
$$('[data-embed]').forEach(box => {
  const start = () => {
    if (box.querySelector('iframe')) return;
    const f = document.createElement('iframe');
    f.src = box.dataset.embed;
    f.title = `${P.title} video`;
    f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media; xr-spatial-tracking';
    f.allowFullscreen = true;
    box.innerHTML = '';
    box.appendChild(f);
  };
  box.addEventListener('click', start);
});

/* ------------------------------------------------------------------ map, satellite, Street View */
const mapEl = $('#pdMap');
let map = null, layers = {};
function initMap() {
  if (map || !mapEl || !window.L) return;
  const lat = Number(mapEl.dataset.lat), lng = Number(mapEl.dataset.lng), radius = Number(mapEl.dataset.radius);
  map = L.map(mapEl, { scrollWheelZoom: false, center: [lat, lng], zoom: radius > 1000 ? 12 : 15 });
  layers.map = L.tileLayer(site.maps.tiles, { attribution: site.maps.tilesAttribution, maxZoom: 19, subdomains: 'abcd' }).addTo(map);
  layers.satellite = L.tileLayer(site.maps.satellite, { attribution: site.maps.satelliteAttribution, maxZoom: 19 });
  if (radius) L.circle([lat, lng], { radius, color: '#C7A253', weight: 1.5, fillColor: '#C7A253', fillOpacity: .16 }).addTo(map);
  else L.marker([lat, lng]).addTo(map);
  map.on('click focus', () => map.scrollWheelZoom.enable());
  map.on('mouseout blur', () => map.scrollWheelZoom.disable());
}
if (mapEl) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(en => { if (en.some(x => x.isIntersecting)) { initMap(); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(mapEl);
  } else initMap();
}
const tabs = $$('.pd-maptabs [data-tab]');
const street = $('#pdStreet');
function selectTab(name) {
  tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false'));
  if (name === 'street') {
    street.hidden = false;
    const fr = street.querySelector('iframe[data-src]');
    if (fr && !fr.src) fr.src = fr.dataset.src;
    return;
  }
  street.hidden = true;
  initMap();
  if (!map) return;
  const want = name === 'satellite' ? layers.satellite : layers.map;
  const other = name === 'satellite' ? layers.map : layers.satellite;
  if (map.hasLayer(other)) map.removeLayer(other);
  if (!map.hasLayer(want)) want.addTo(map);
  setTimeout(() => map.invalidateSize(), 0);
}
tabs.forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto-tab]');
  if (!g) return;
  e.preventDefault();
  $('#location').scrollIntoView({ behavior: 'smooth', block: 'start' });
  selectTab(g.dataset.gotoTab);
});

/* ------------------------------------------------------------------ mobile sticky bar: hidden while the enquiry card is on screen */
const sticky = $('#pdSticky'), card = $('#enquire');
if (sticky && card && 'IntersectionObserver' in window) {
  new IntersectionObserver(en => { sticky.classList.toggle('is-hidden', en[0].isIntersecting); }).observe(card);
}
