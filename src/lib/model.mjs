// Derived data for listings. Pure functions shared by the build, the browser and the admin preview.
import { distanceKm, slugify } from './util.mjs';

export const pageUrl = p => `property-${p.id}.html`;

export function typeOf(tax, id) {
  return tax.propertyTypes.find(t => t.id === id) || { id, label: id ? id[0].toUpperCase() + id.slice(1) : '', plural: id };
}

export function marketOf(tax, id) {
  return tax.markets.find(m => m.id === id) || null;
}

export function featureOf(tax, id) {
  return tax.features.find(f => f.id === id) || { id, label: id.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()), group: 'lot', filterGroup: 'lot', searchable: false };
}

// Features of one listing, grouped Lot / Interior / Outdoor in taxonomy order, as JamesEdition lists them.
export function groupedFeatures(p, tax) {
  const order = new Map(tax.features.map((f, i) => [f.id, i]));
  return tax.featureGroups.map(g => ({
    ...g,
    items: (p.features || []).map(id => featureOf(tax, id)).filter(f => f.group === g.id)
      .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  })).filter(g => g.items.length);
}

export function locationLine(p) {
  const l = p.location || {};
  if (!l.area || l.area === l.city) return [l.city, l.country].filter(Boolean).join(', ');
  return [l.area, l.city].filter(Boolean).join(', ');
}

export function pricePerSqm(p) {
  return p.price && p.livingArea && !p.priceOnRequest ? Math.round(p.price / p.livingArea) : null;
}

export function isSold(p) { return p.status === 'sold'; }

export function primaryPhoto(p) { return (p.photos && p.photos[0]) || null; }

export function cardImage(photo) {
  if (!photo) return null;
  return { src: photo.card || photo.src, w: photo.card ? photo.cw : photo.w, h: photo.card ? photo.ch : photo.h };
}

// "Recommended" order: available before delivered, featured first, then newest update, then price.
export function recommendedSort(a, b) {
  const s = (isSold(a) - isSold(b)); if (s) return s;
  const f = (!!b.featured - !!a.featured); if (f) return f;
  const u = String(b.updated || '').localeCompare(String(a.updated || '')); if (u) return u;
  return (b.price || 0) - (a.price || 0);
}

export function similarTo(p, all, n = 3) {
  const others = all.filter(o => o.id !== p.id);
  const score = o =>
    (o.location?.market === p.location?.market ? 4 : 0) +
    (o.type === p.type ? 2 : 0) +
    (o.status === p.status ? 2 : 0) +
    (p.price && o.price ? Math.max(0, 2 - Math.abs(Math.log(o.price / p.price)) * 2) : 0);
  return others.map(o => [score(o), o]).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}

export const LANDMARKS = [
  { id: 'syntagma', label: 'Syntagma Square, central Athens', lat: 37.9755, lng: 23.7348 },
  { id: 'acropolis', label: 'Acropolis', lat: 37.9715, lng: 23.7257 },
  { id: 'airport', label: 'Athens International Airport', lat: 37.9364, lng: 23.9445 },
  { id: 'piraeus', label: 'Port of Piraeus', lat: 37.9420, lng: 23.6465 },
  { id: 'glyfada-marina', label: 'Glyfada marinas', lat: 37.8618, lng: 23.7457 }
];

// Straight-line distances from the (approximate) listing position to useful landmarks.
export function nearby(p, limit = 4) {
  const l = p.location;
  if (!l || l.lat == null) return [];
  return LANDMARKS.map(m => ({ ...m, km: distanceKm(l, m) }))
    .filter(m => m.km > 0.4)
    .sort((a, b) => a.km - b.km).slice(0, limit);
}

export function titleForFilters(state, tax) {
  // e.g. "Penthouses with sea view in Kato Glyfada"
  const types = (state.types || []).map(t => typeOf(tax, t).plural);
  const feats = (state.features || []).map(f => featureOf(tax, f).label.toLowerCase());
  const markets = (state.markets || []).map(m => marketOf(tax, m)?.label).filter(Boolean);
  let t = types.length === 1 ? types[0] : 'Properties';
  if (feats.length) t += ' with ' + feats.slice(0, 2).join(' and ');
  t += ' in ' + (markets.length ? markets.join(' & ') : 'Greece');
  return t;
}

export function newId(title, existing) {
  let base = slugify(title) || 'property', id = base, n = 2;
  while (existing.some(p => p.id === id)) id = `${base}-${n++}`;
  return id;
}
