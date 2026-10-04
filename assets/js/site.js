// Global behaviour for every page: header, drawer, reveal, film loops, counters, saved listings, prefs.
import { paintSaved, toggleSaved, paintPrefs, pageData, reducedMotion, trapFocus, toast } from './core.js';

const data = pageData();
const site = data && data.site;

/* header shadow + back to top */
const hdr = document.getElementById('hdr');
const totop = document.getElementById('totop');
let ticking = false;
function onScroll() {
  ticking = false;
  const y = window.scrollY;
  if (hdr) hdr.classList.toggle('is-scrolled', y > 8);
  if (totop) totop.hidden = y < 700;
}
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();
if (totop) totop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }));

/* mobile drawer */
const drawer = document.getElementById('drawer');
const burger = document.querySelector('.hdr-burger');
let releaseDrawer = null;
function openDrawer() {
  drawer.hidden = false;
  burger.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  releaseDrawer = trapFocus(drawer, closeDrawer);
  drawer.querySelector('.drawer-close').focus();
}
function closeDrawer() {
  drawer.hidden = true;
  burger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  if (releaseDrawer) { releaseDrawer(); releaseDrawer = null; }
}
if (drawer && burger) {
  burger.addEventListener('click', openDrawer);
  drawer.querySelector('.drawer-close').addEventListener('click', closeDrawer);
  drawer.addEventListener('click', e => { if (e.target.closest('a')) closeDrawer(); });
}

/* reveal on scroll */
const revealEls = document.querySelectorAll('[data-reveal]');
if (revealEls.length && 'IntersectionObserver' in window && !reducedMotion()) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  revealEls.forEach(el => io.observe(el));
} else revealEls.forEach(el => el.classList.add('is-in'));

/* film loops: play only while visible (hidden design variants never play), never with reduced motion.
   Chrome may pause muted background video to save power; it resumes on a retry. */
const films = document.querySelectorAll('video[data-autoplay]');
function playFilm(v) {
  v.muted = true;
  if (v.preload === 'none') v.preload = 'auto';
  const p = v.play();
  if (p && p.catch) p.catch(() => { setTimeout(() => { if (v.dataset.visible === '1') v.play().catch(() => {}); }, 400); });
}
if (films.length && !reducedMotion()) {
  if ('IntersectionObserver' in window) {
    const fio = new IntersectionObserver(entries => entries.forEach(en => {
      const v = en.target;
      v.dataset.visible = en.isIntersecting ? '1' : '0';
      if (en.isIntersecting) playFilm(v); else v.pause();
    }), { threshold: .05 });
    films.forEach(v => fio.observe(v));
  } else films.forEach(playFilm);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') films.forEach(v => { if (v.dataset.visible === '1') playFilm(v); });
  });
}

/* count-up figures */
const counters = document.querySelectorAll('[data-count]');
function countUp(el) {
  const target = parseFloat(el.dataset.count), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
  if (reducedMotion()) { el.textContent = pre + target + suf; return; }
  const t0 = performance.now(), dur = 1400;
  (function step(t) {
    const k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = pre + Math.round(target * e) + suf;
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
if (counters.length && 'IntersectionObserver' in window) {
  const cio = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { countUp(en.target); cio.unobserve(en.target); }
  }), { threshold: .5 });
  counters.forEach(el => cio.observe(el));
}

/* saved listings: any [data-save] button on any page */
paintSaved();
document.addEventListener('click', e => {
  const b = e.target.closest('[data-save]');
  if (!b) return;
  e.preventDefault();
  const on = toggleSaved(b.dataset.save);
  paintSaved();
  toast(on ? 'Saved. <a href="properties.html?saved=1">View saved properties</a>' : 'Removed from your saved properties.');
});
window.addEventListener('storage', e => { if (e.key === 'nf-saved') paintSaved(); });

/* currency and unit preferences */
if (site) {
  paintPrefs(site);
  document.addEventListener('nf:prefs-change', () => paintPrefs(site));
}

/* design options panel (only on pages that offer alternatives) */
if (document.getElementById('nf-options-data')) import('./options.js');
