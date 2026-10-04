// Shared browser state: saved listings, display preferences (currency, area unit), toasts.
import { formatMoney, formatArea } from '../../src/lib/util.mjs';

const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: keep working without persistence */ } }
};

export function pageData(id = 'nf-data') {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch (e) { return null; }
}

/* saved listings ---------------------------------------------------------- */
export function savedIds() { return store.get('nf-saved', []); }
export function isSaved(id) { return savedIds().includes(id); }
export function toggleSaved(id) {
  const list = savedIds();
  const i = list.indexOf(id);
  if (i === -1) list.push(id); else list.splice(i, 1);
  store.set('nf-saved', list);
  document.dispatchEvent(new CustomEvent('nf:saved-change', { detail: { id, saved: i === -1 } }));
  return i === -1;
}
export function paintSaved(root = document) {
  const list = savedIds();
  root.querySelectorAll('[data-save]').forEach(b => b.setAttribute('aria-pressed', list.includes(b.dataset.save) ? 'true' : 'false'));
  document.querySelectorAll('[data-saved-count]').forEach(el => { el.textContent = list.length; el.hidden = !list.length; });
}

/* display preferences -------------------------------------------------------- */
export function prefs() { return Object.assign({ currency: 'EUR', unit: 'm2' }, store.get('nf-prefs', {})); }
export function setPrefs(patch) {
  const p = Object.assign(prefs(), patch);
  store.set('nf-prefs', p);
  document.dispatchEvent(new CustomEvent('nf:prefs-change', { detail: p }));
  return p;
}
// Re-label every price/area on the page in the visitor's currency and unit.
export function paintPrefs(site, root = document) {
  const p = prefs();
  root.querySelectorAll('[data-eur]').forEach(el => {
    const eur = Number(el.dataset.eur);
    const approx = p.currency !== 'EUR';
    el.textContent = (approx ? '≈ ' : '') + formatMoney(eur, p.currency, site, el.dataset.compact ? { compact: true } : {});
    el.title = approx ? formatMoney(eur, 'EUR', site) + ' (listing price)' : '';
  });
  root.querySelectorAll('[data-m2]').forEach(el => {
    const icon = el.querySelector('svg');
    const text = formatArea(Number(el.dataset.m2), p.unit) + (el.dataset.suffix || '');
    if (icon) { el.textContent = ''; el.append(icon, document.createTextNode(text)); } else el.textContent = text;
  });
}

/* toast ------------------------------------------------------------------------ */
let toastTimer;
export function toast(html, ms = 3600) {
  let el = document.getElementById('nfToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nfToast'; el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  requestAnimationFrame(() => el.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const canHover = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

// Focus trap for dialogs/sheets; returns a release function.
export function trapFocus(container, onEscape) {
  const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const prev = document.activeElement;
  function key(e) {
    if (e.key === 'Escape' && onEscape) { e.preventDefault(); onEscape(); return; }
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll(sel)].filter(n => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', key);
  return () => { document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); };
}
