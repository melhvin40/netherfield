// Shared helpers. Pure functions only: this module runs in Node (tools/build.mjs) and in the
// browser (listing, property page, admin preview), so it must not touch the DOM or the filesystem.

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function icon(name, size = 18, cls = '') {
  return `<svg class="i${cls ? ' ' + cls : ''}" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}

export function plural(n, one, many) {
  return n === 1 ? one : (many || one + 's');
}

export const SQFT_PER_M2 = 10.7639;

export function formatArea(m2, unit = 'm2') {
  if (m2 == null || m2 === '') return '';
  if (unit === 'sqft') return Math.round(m2 * SQFT_PER_M2).toLocaleString('en-US') + ' sq ft';
  return Math.round(m2).toLocaleString('en-US') + ' m²';
}

// Money in the listing currency, or converted with the agency's indicative rates.
// opts.compact -> "€890K" / "€1.25M" for map pins.
export function formatMoney(amount, currency, site, opts = {}) {
  if (amount == null) return '';
  const cur = site?.currencies || { base: 'EUR', rates: { EUR: 1 }, symbols: { EUR: '€' } };
  const from = opts.from || cur.base;
  const to = currency || cur.base;
  const rateFrom = cur.rates[from] || 1;
  const rateTo = cur.rates[to] || 1;
  const value = amount / rateFrom * rateTo;
  const sym = (cur.symbols && cur.symbols[to]) || to + ' ';
  if (opts.compact) {
    if (value >= 1e6) return sym + trimZeros((value / 1e6).toFixed(value >= 1e7 ? 1 : 2)) + 'M';
    if (value >= 1e3) return sym + Math.round(value / 1e3) + 'K';
    return sym + Math.round(value);
  }
  const rounded = to === cur.base ? Math.round(value) : roundNice(value);
  return sym + rounded.toLocaleString('en-US');
}

function trimZeros(s) { return s.replace(/\.?0+$/, ''); }
function roundNice(v) {
  if (v >= 1e6) return Math.round(v / 1e3) * 1e3;
  if (v >= 1e4) return Math.round(v / 100) * 100;
  return Math.round(v);
}

export function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = String(ym).split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return (names[(m || 1) - 1] || '') + ' ' + y;
}

export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Great-circle distance in km.
export function distanceKm(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(url) ? url : null;
}

export function vimeoId(url) {
  const m = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
