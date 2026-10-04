// Listing search: filter state, matching, facet counts, sorting and URL (de)serialisation.
// Parameter names follow JamesEdition's search URLs (bedrooms_from, price_from, order, ...).
import { recommendedSort, pricePerSqm, isSold, typeOf, marketOf, featureOf, locationLine } from './model.mjs';

export const SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'newest', label: 'Newest' },
  { id: 'price_desc', label: 'Price: high to low' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'ppsqm_asc', label: 'Price per m²: low to high' },
  { id: 'ppsqm_desc', label: 'Price per m²: high to low' },
  { id: 'area_desc', label: 'Living area: largest first' },
  { id: 'area_asc', label: 'Living area: smallest first' },
  { id: 'bedrooms_desc', label: 'Bedrooms: most first' }
];

export const MEDIA = [
  { id: 'video', label: 'Video' },
  { id: 'virtual_tour', label: '3D virtual tour' },
  { id: 'floor_plan', label: 'Floor plan' }
];

export const STATUSES = [
  { id: 'available', label: 'For sale' },
  { id: 'sold', label: 'Delivered' }
];

export function emptyState() {
  return {
    q: '', markets: [], types: [], price_from: null, price_to: null,
    bedrooms_from: 0, bathrooms_from: 0, area_from: null, area_to: null,
    features: [], status: [], golden_visa: false, media: [], category: '',
    order: 'recommended', view: 'grid', page: 1, saved: false
  };
}

const LISTS = ['markets', 'types', 'features', 'status', 'media'];
const NUMS = ['price_from', 'price_to', 'area_from', 'area_to'];
const MINS = ['bedrooms_from', 'bathrooms_from'];
const PARAM = { markets: 'location', types: 'type' };

export function stateFromParams(params) {
  const s = emptyState();
  const get = k => params.get(k);
  if (get('q')) s.q = get('q');
  LISTS.forEach(k => { const v = get(PARAM[k] || k); if (v) s[k] = v.split(',').filter(Boolean); });
  NUMS.forEach(k => { const v = parseInt(get(k), 10); if (!isNaN(v)) s[k] = v; });
  MINS.forEach(k => { const v = parseInt(get(k), 10); if (!isNaN(v)) s[k] = v; });
  if (get('golden_visa') === '1') s.golden_visa = true;
  if (get('saved') === '1') s.saved = true;
  if (get('category')) s.category = get('category');
  if (get('order') && SORTS.some(o => o.id === get('order'))) s.order = get('order');
  if (['grid', 'list', 'map'].includes(get('view'))) s.view = get('view');
  const page = parseInt(get('page'), 10); if (page > 1) s.page = page;
  return s;
}

export function paramsFromState(s) {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.category) p.set('category', s.category);
  LISTS.forEach(k => { if (s[k] && s[k].length) p.set(PARAM[k] || k, s[k].join(',')); });
  NUMS.forEach(k => { if (s[k] != null) p.set(k, String(s[k])); });
  MINS.forEach(k => { if (s[k]) p.set(k, String(s[k])); });
  if (s.golden_visa) p.set('golden_visa', '1');
  if (s.saved) p.set('saved', '1');
  if (s.order && s.order !== 'recommended') p.set('order', s.order);
  if (s.view && s.view !== 'grid') p.set('view', s.view);
  if (s.page > 1) p.set('page', String(s.page));
  return p;
}

function haystack(p, tax) {
  return [p.title, p.ref, locationLine(p), p.location?.label, p.location?.city, p.location?.region,
    marketOf(tax, p.location?.market)?.label, typeOf(tax, p.type).label,
    ...(p.features || []).map(f => featureOf(tax, f).label)].join(' ').toLowerCase();
}

export function matchesCategory(cat, p) {
  if (!cat) return true;
  const r = cat.rule || {};
  if (r.features && !r.features.every(f => (p.features || []).includes(f))) return false;
  if (r.types && !r.types.includes(p.type)) return false;
  if (r.markets && !r.markets.includes(p.location?.market)) return false;
  if (r.status && !r.status.includes(p.status)) return false;
  if (r.bedrooms_from && (p.bedrooms || 0) < r.bedrooms_from) return false;
  if (r.price_to && (isSold(p) || p.priceOnRequest || p.price > r.price_to)) return false;
  if (r.price_from && (isSold(p) || p.priceOnRequest || p.price < r.price_from)) return false;
  return true;
}

// skip: name of one facet to ignore (used for facet counts, so each option shows what it would add)
export function matches(p, s, ctx, skip) {
  const { tax, saved } = ctx;
  if (s.q && skip !== 'q') {
    const h = haystack(p, tax);
    if (!s.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => h.includes(w))) return false;
  }
  if (skip !== 'markets' && s.markets.length && !s.markets.includes(p.location?.market)) return false;
  if (skip !== 'types' && s.types.length && !s.types.includes(p.type)) return false;
  if (skip !== 'status' && s.status.length && !s.status.includes(p.status)) return false;
  const priced = !isSold(p) && !p.priceOnRequest && p.price;
  if (skip !== 'price' && (s.price_from != null || s.price_to != null)) {
    if (!priced) return false;
    if (s.price_from != null && p.price < s.price_from) return false;
    if (s.price_to != null && p.price > s.price_to) return false;
  }
  if (skip !== 'bedrooms' && s.bedrooms_from && (p.bedrooms || 0) < s.bedrooms_from) return false;
  if (skip !== 'bathrooms' && s.bathrooms_from && (p.bathrooms || 0) < s.bathrooms_from) return false;
  if (skip !== 'area') {
    if (s.area_from != null && (p.livingArea || 0) < s.area_from) return false;
    if (s.area_to != null && (p.livingArea || 0) > s.area_to) return false;
  }
  if (skip !== 'features' && s.features.length && !s.features.every(f => (p.features || []).includes(f))) return false;
  if (skip !== 'golden_visa' && s.golden_visa && !p.goldenVisa) return false;
  if (skip !== 'media' && s.media.length) {
    const has = { video: !!p.video, virtual_tour: !!p.virtualTour, floor_plan: !!(p.floorplans && p.floorplans.length) };
    if (!s.media.every(m => has[m])) return false;
  }
  if (skip !== 'category' && s.category) {
    const cat = tax.categories.find(c => c.id === s.category);
    if (cat && !matchesCategory(cat, p)) return false;
  }
  if (skip !== 'saved' && s.saved && !(saved || []).includes(p.id)) return false;
  return true;
}

const num = v => (v == null ? -Infinity : v);
export function sortListings(list, order) {
  const arr = list.slice();
  const pricedLast = (a, b, f) => {
    const pa = !isSold(a) && !a.priceOnRequest, pb = !isSold(b) && !b.priceOnRequest;
    if (pa !== pb) return pa ? -1 : 1;
    return f(a, b);
  };
  switch (order) {
    case 'newest': return arr.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')) || recommendedSort(a, b));
    case 'price_desc': return arr.sort((a, b) => pricedLast(a, b, (x, y) => y.price - x.price));
    case 'price_asc': return arr.sort((a, b) => pricedLast(a, b, (x, y) => x.price - y.price));
    case 'ppsqm_asc': return arr.sort((a, b) => pricedLast(a, b, (x, y) => num(pricePerSqm(x)) - num(pricePerSqm(y))));
    case 'ppsqm_desc': return arr.sort((a, b) => pricedLast(a, b, (x, y) => num(pricePerSqm(y)) - num(pricePerSqm(x))));
    case 'area_desc': return arr.sort((a, b) => (b.livingArea || 0) - (a.livingArea || 0));
    case 'area_asc': return arr.sort((a, b) => (a.livingArea || 0) - (b.livingArea || 0));
    case 'bedrooms_desc': return arr.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0) || recommendedSort(a, b));
    default: return arr.sort(recommendedSort);
  }
}

export function search(all, s, ctx) {
  return sortListings(all.filter(p => matches(p, s, ctx)), s.order);
}

export function facetCounts(all, s, ctx) {
  const count = (skip, pred) => all.filter(p => matches(p, s, ctx, skip) && pred(p)).length;
  const { tax } = ctx;
  return {
    types: Object.fromEntries(tax.propertyTypes.map(t => [t.id, count('types', p => p.type === t.id)])),
    markets: Object.fromEntries(tax.markets.map(m => [m.id, count('markets', p => p.location?.market === m.id)])),
    features: Object.fromEntries(tax.features.map(f => [f.id, count('features', p => (p.features || []).includes(f.id) && s.features.every(x => (p.features || []).includes(x)))])),
    status: Object.fromEntries(STATUSES.map(x => [x.id, count('status', p => p.status === x.id)])),
    categories: Object.fromEntries(tax.categories.map(c => [c.id, count('category', p => matchesCategory(c, p))]))
  };
}

export function activeFilterCount(s) {
  return s.markets.length + s.types.length + s.features.length + s.status.length + s.media.length +
    (s.price_from != null || s.price_to != null ? 1 : 0) + (s.bedrooms_from ? 1 : 0) + (s.bathrooms_from ? 1 : 0) +
    (s.area_from != null || s.area_to != null ? 1 : 0) + (s.golden_visa ? 1 : 0) + (s.category ? 1 : 0) + (s.q ? 1 : 0) + (s.saved ? 1 : 0);
}
