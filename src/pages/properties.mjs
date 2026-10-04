// Properties: JamesEdition-style search. Server-renders the first page of results (fast first paint,
// readable without JavaScript); assets/js/listing.js takes over filtering, sorting, views and the map.
import { esc, icon, formatMoney } from '../lib/util.mjs';
import { isSold } from '../lib/model.mjs';
import { SORTS, MEDIA, STATUSES, emptyState, search, facetCounts } from '../lib/search.mjs';
import { heroVariants } from '../partials.mjs';
import { cardHTML } from '../templates/card.mjs';

const OPTIONS = [{
  id: 'properties-hero', title: 'Properties: hero', default: 'scope',
  variants: [
    { id: 'scope', label: 'Cinemascope film', note: 'A wide, slow-motion band of the Aegean; the title sits below on paper, never over the image.' },
    { id: 'cinema', label: 'Full-bleed film', note: 'The film fills the hero; the title rests on a soft gradient.' },
    { id: 'split', label: 'Editorial frame', note: 'Title on paper beside the film in a framed panel.' },
    { id: 'minimal', label: 'JamesEdition-style', note: 'No imagery: straight into search and listings.' }
  ]
}];

export const PRICE_STEPS = [250000, 300000, 400000, 500000, 600000, 800000, 1000000, 1250000, 1500000, 2000000, 3000000];
export const AREA_STEPS = [50, 75, 100, 120, 150, 200, 250, 300];

function filterSheet(ctx, counts) {
  const { tax } = ctx;
  const featureSection = fg => {
    const feats = tax.features.filter(f => f.filterGroup === fg.id && f.searchable);
    if (!feats.length) return '';
    return `<section class="fs-sec" data-sec="${fg.id}">
      <h3 class="fs-h">${esc(fg.label)}</h3>
      <div class="fs-checks">${feats.map(f => `<label class="check${counts.features[f.id] ? '' : ' is-zero'}"><input type="checkbox" name="features" value="${f.id}"><span>${esc(f.label)}</span><span class="count" data-count-for="features:${f.id}">${counts.features[f.id]}</span></label>`).join('')}</div>
    </section>`;
  };
  const seg = (name, max) => `<div class="seg" role="radiogroup">${[0, 1, 2, 3, 4, 5].slice(0, max + 1).map(n => `<label><input type="radio" name="${name}" value="${n}"${n === 0 ? ' checked' : ''}><span>${n ? n + '+' : 'Any'}</span></label>`).join('')}</div>`;
  return `<div class="sheet-backdrop" id="fsBackdrop" hidden></div>
<aside class="sheet fs" id="fsSheet" role="dialog" aria-modal="true" aria-labelledby="fsTitle" hidden>
  <div class="sheet-head"><h2 id="fsTitle">Filters</h2><button class="icon-btn" type="button" data-fs-close aria-label="Close filters">${icon('close', 22)}</button></div>
  <form class="sheet-body" id="fsForm" onsubmit="return false">
    <section class="fs-sec">
      <h3 class="fs-h">Listing status</h3>
      <div class="fs-checks fs-row">${STATUSES.map(s => `<label class="check"><input type="checkbox" name="status" value="${s.id}"><span>${s.label}</span><span class="count" data-count-for="status:${s.id}">${counts.status[s.id]}</span></label>`).join('')}</div>
    </section>
    <section class="fs-sec">
      <h3 class="fs-h">Price</h3>
      <div class="fs-range">
        <div class="field"><label for="fsPriceFrom">Minimum</label><select class="select" id="fsPriceFrom" name="price_from" data-price-select><option value="">No min</option>${PRICE_STEPS.map(v => `<option value="${v}">${formatMoney(v, 'EUR', ctx.site)}</option>`).join('')}</select></div>
        <span class="fs-dash" aria-hidden="true"></span>
        <div class="field"><label for="fsPriceTo">Maximum</label><select class="select" id="fsPriceTo" name="price_to" data-price-select><option value="">No max</option>${PRICE_STEPS.map(v => `<option value="${v}">${formatMoney(v, 'EUR', ctx.site)}</option>`).join('')}</select></div>
      </div>
      <p class="fine fs-note">Delivered homes have no public price and are hidden while a price filter is set.</p>
    </section>
    <section class="fs-sec">
      <h3 class="fs-h">Property type</h3>
      <div class="fs-checks fs-cols">${tax.propertyTypes.map(t => `<label class="check${counts.types[t.id] ? '' : ' is-zero'}"><input type="checkbox" name="types" value="${t.id}"><span>${esc(t.label)}</span><span class="count" data-count-for="types:${t.id}">${counts.types[t.id]}</span></label>`).join('')}</div>
    </section>
    <section class="fs-sec">
      <h3 class="fs-h">Rooms</h3>
      <div class="fs-rooms">
        <div class="field"><span class="label">Bedrooms</span>${seg('bedrooms_from', 5)}</div>
        <div class="field"><span class="label">Bathrooms</span>${seg('bathrooms_from', 4)}</div>
      </div>
    </section>
    <section class="fs-sec">
      <h3 class="fs-h">Living area</h3>
      <div class="fs-range">
        <div class="field"><label for="fsAreaFrom">Minimum</label><select class="select" id="fsAreaFrom" name="area_from" data-area-select><option value="">No min</option>${AREA_STEPS.map(v => `<option value="${v}">${v} m²</option>`).join('')}</select></div>
        <span class="fs-dash" aria-hidden="true"></span>
        <div class="field"><label for="fsAreaTo">Maximum</label><select class="select" id="fsAreaTo" name="area_to" data-area-select><option value="">No max</option>${AREA_STEPS.map(v => `<option value="${v}">${v} m²</option>`).join('')}</select></div>
      </div>
    </section>
    <section class="fs-sec">
      <h3 class="fs-h">Location</h3>
      <div class="fs-checks fs-cols">${tax.markets.map(m => `<label class="check${counts.markets[m.id] ? '' : ' is-zero'}"><input type="checkbox" name="markets" value="${m.id}"><span>${esc(m.label)}</span><span class="count" data-count-for="markets:${m.id}">${counts.markets[m.id]}</span></label>`).join('')}</div>
    </section>
    ${tax.filterGroups.map(featureSection).join('')}
    ${ctx.properties.some(p => p.video || p.virtualTour || (p.floorplans && p.floorplans.length)) ? `<section class="fs-sec">
      <h3 class="fs-h">House tour</h3>
      <div class="fs-checks fs-cols">${MEDIA.map(m => `<label class="check"><input type="checkbox" name="media" value="${m.id}"><span>${m.label}</span></label>`).join('')}</div>
    </section>` : ''}
    <section class="fs-sec">
      <h3 class="fs-h">Golden Visa</h3>
      <label class="check"><input type="checkbox" name="golden_visa" value="1"><span>Golden Visa eligible only</span></label>
    </section>
  </form>
  <div class="sheet-foot"><button class="link-underline fs-clear" type="button" data-fs-clear>Clear all</button><button class="btn btn-primary" type="button" data-fs-apply>Show <span data-fs-count>${counts.total}</span>&nbsp;properties</button></div>
</aside>`;
}

function seoBlock(ctx) {
  const { tax, properties } = ctx;
  const used = new Set(properties.flatMap(p => p.features || []));
  const feats = tax.features.filter(f => f.searchable && used.has(f.id)).slice(0, 12);
  const types = tax.propertyTypes.filter(t => properties.some(p => p.type === t.id));
  return `<section class="sec-tight ls-seo">
  <div class="wrap ls-seo-grid">
    <div class="ls-seo-text">
      <h2 class="h3">Golden Visa homes on the Athens Riviera</h2>
      <p>Netherfield's portfolio spans Kato Glyfada, central Athens and the port of Piraeus: contemporary new builds and characterful renovations, each presented with its Golden Visa route, indicative yield and the support of one team from reservation to residence permit.</p>
      <p>Save the homes you like, set up a search for your criteria, or book a consultation and we will share floor plans, availability and current pricing.</p>
    </div>
    <nav class="ls-seo-links" aria-label="Popular searches">
      <div><h3>By area</h3><ul>${tax.markets.filter(m => properties.some(p => p.location?.market === m.id)).map(m => `<li><a href="properties.html?location=${m.id}">Properties in ${esc(m.label)}</a></li>`).join('')}</ul></div>
      <div><h3>By type</h3><ul>${types.map(t => `<li><a href="properties.html?type=${t.id}">${esc(t.plural)}</a></li>`).join('')}</ul></div>
      <div><h3>By feature</h3><ul>${feats.map(f => `<li><a href="properties.html?features=${f.id}">${esc(f.label)}</a></li>`).join('')}</ul></div>
    </nav>
  </div>
</section>`;
}

export function listingPage(ctx) {
  // The full JamesEdition filter set is offered, as on JamesEdition: every property type, area and
  // searchable feature, each with its live count (options without matches are shown dimmed).
  const { site, properties, tax } = ctx;
  const state = emptyState();
  const results = search(properties, state, { tax, saved: [] });
  const counts = facetCounts(properties, state, { tax, saved: [] });
  counts.total = results.length;
  const firstPage = results.slice(0, 12);
  const available = properties.filter(p => !isSold(p)).length;

  const hero = heroVariants('properties-hero', {
    clip: 'bay', eyebrow: 'Our portfolio',
    title: 'Golden Visa properties <em>in Greece</em>',
    lede: 'Residences in Kato Glyfada, central Athens and Piraeus, each presented with its Golden Visa route and delivered with legal and relocation support.',
    variants: ['scope', 'cinema', 'split', 'minimal']
  }).replace(/class="ph ph-(cinema|scope|split)"/g, 'class="ph ph-$1 ph-short"');

  const pills = `
    <div class="ls-pillwrap"><button class="ls-pill" type="button" aria-expanded="false" data-pop="price"><span data-pill-label="price">Price</span>${icon('chevron-down', 16)}</button>
      <div class="pop" id="pop-price" hidden>
        <div class="fs-range">
          <div class="field"><label for="ppFrom">Minimum</label><select class="select" id="ppFrom" data-quick="price_from" data-price-select><option value="">No min</option>${PRICE_STEPS.map(v => `<option value="${v}">${formatMoney(v, 'EUR', site)}</option>`).join('')}</select></div>
          <span class="fs-dash" aria-hidden="true"></span>
          <div class="field"><label for="ppTo">Maximum</label><select class="select" id="ppTo" data-quick="price_to" data-price-select><option value="">No max</option>${PRICE_STEPS.map(v => `<option value="${v}">${formatMoney(v, 'EUR', site)}</option>`).join('')}</select></div>
        </div>
        <div class="pop-foot"><button class="link-underline" type="button" data-clear="price">Clear</button><button class="btn btn-primary btn-sm" type="button" data-pop-done>Done</button></div>
      </div>
    </div>
    <div class="ls-pillwrap"><button class="ls-pill" type="button" aria-expanded="false" data-pop="type"><span data-pill-label="type">Property type</span>${icon('chevron-down', 16)}</button>
      <div class="pop" id="pop-type" hidden>
        <div class="fs-checks">${tax.propertyTypes.map(t => `<label class="check${counts.types[t.id] ? '' : ' is-zero'}"><input type="checkbox" data-quick="types" value="${t.id}"><span>${esc(t.label)}</span><span class="count" data-count-for="types:${t.id}">${counts.types[t.id]}</span></label>`).join('')}</div>
        <div class="pop-foot"><button class="link-underline" type="button" data-clear="types">Clear</button><button class="btn btn-primary btn-sm" type="button" data-pop-done>Done</button></div>
      </div>
    </div>
    <div class="ls-pillwrap"><button class="ls-pill" type="button" aria-expanded="false" data-pop="beds"><span data-pill-label="beds">Bedrooms</span>${icon('chevron-down', 16)}</button>
      <div class="pop" id="pop-beds" hidden>
        <div class="seg" role="radiogroup" aria-label="Bedrooms">${[0, 1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="qbeds" data-quick="bedrooms_from" value="${n}"${n ? '' : ' checked'}><span>${n ? n + '+' : 'Any'}</span></label>`).join('')}</div>
        <div class="pop-foot"><button class="link-underline" type="button" data-clear="bedrooms_from">Clear</button><button class="btn btn-primary btn-sm" type="button" data-pop-done>Done</button></div>
      </div>
    </div>`;

  const cats = tax.categories.map(c => `<button class="ls-cat" type="button" data-cat="${c.id}" aria-pressed="false">${icon(c.icon || 'spark', 22)}<span>${esc(c.label)}</span></button>`).join('');

  const content = `${hero}
<section class="ls" id="results" aria-labelledby="lsTitle">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">Properties</span></nav>
    <div class="ls-head">
      <h2 class="ls-title" id="lsTitle">All properties</h2>
      <p class="ls-count" id="lsCount" aria-live="polite">${results.length} properties &middot; ${available} for sale</p>
    </div>
  </div>
  <div class="ls-barzone" id="lsBarZone">
    <div class="wrap">
      <div class="ls-bar" id="lsBar">
        <div class="ls-search" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-owns="lsSuggest">
          ${icon('search', 20)}
          <input class="ls-q" id="lsQ" type="search" placeholder="Area, street or property name" autocomplete="off" aria-label="Search by area, street or property name" aria-autocomplete="list" aria-controls="lsSuggest">
          <ul class="ls-suggest" id="lsSuggest" role="listbox" hidden></ul>
        </div>
        <div class="ls-pills">${pills}</div>
        <button class="ls-pill ls-pill-all" type="button" id="lsAll" aria-haspopup="dialog">${icon('sliders', 18)}<span>Filters</span><span class="ls-badge" id="lsAllCount" hidden>0</span></button>
        <button class="ls-save" type="button" id="lsSave">${icon('bell', 18)}<span>Save search</span></button>
      </div>
    </div>
  </div>
  <div class="wrap">
    <div class="ls-cats-wrap">
      <button class="ls-cats-arrow is-prev" type="button" aria-label="Scroll categories left" disabled>${icon('chevron-left', 18)}</button>
      <div class="ls-cats" id="lsCats" role="group" aria-label="Categories">${cats}</div>
      <button class="ls-cats-arrow is-next" type="button" aria-label="Scroll categories right">${icon('chevron-right', 18)}</button>
    </div>
    <div class="ls-tools">
      <div class="ls-chips" id="lsChips"></div>
      <div class="ls-tools-r">
        <label class="ls-sel"><span>Sort</span><select id="lsSort" aria-label="Sort properties">${SORTS.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</select></label>
        <label class="ls-sel"><span>Currency</span><select id="lsCurrency" aria-label="Currency">${Object.keys(site.currencies.rates).map(c => `<option value="${c}">${c}</option>`).join('')}</select></label>
        <label class="ls-sel"><span>Area</span><select id="lsUnit" aria-label="Area unit"><option value="m2">m²</option><option value="sqft">sq ft</option></select></label>
        <div class="ls-views" role="group" aria-label="View">
          <button type="button" data-view="grid" aria-pressed="true" aria-label="Grid view">${icon('grid', 20)}</button>
          <button type="button" data-view="list" aria-pressed="false" aria-label="List view">${icon('list', 20)}</button>
          <button type="button" data-view="map" aria-pressed="false" aria-label="Map view">${icon('map', 20)}<span>Map</span></button>
        </div>
      </div>
    </div>
    <div class="ls-body" id="lsBody" data-view="grid">
      <div class="ls-results">
        <div class="ls-grid" id="lsGrid">${firstPage.map((p, i) => cardHTML(p, ctx, { eager: i < 3 })).join('')}</div>
        <div class="ls-empty" id="lsEmpty" hidden>
          <p class="h3">No properties match all of your filters</p>
          <p>Try removing a filter, or tell us what you are looking for: many of our homes are offered privately before they are listed.</p>
          <div class="ls-empty-act"><button class="btn btn-line" type="button" data-clear-all>Clear all filters</button><a class="btn btn-primary" href="contact.html">Ask about off-market homes</a></div>
        </div>
        <nav class="ls-pages" id="lsPages" aria-label="Pagination"></nav>
      </div>
      <div class="ls-mapcol" id="lsMapCol" hidden><div class="ls-map" id="lsMap" role="region" aria-label="Map of results"></div><p class="ls-map-note">Positions are approximate; exact addresses are shared on request.</p></div>
    </div>
    <p class="fine ls-fine">Prices, sizes and features are indicative and confirmed per property by the Netherfield team. Converted prices use indicative rates (${esc(site.currencies.asOf)}).</p>
  </div>
</section>
${seoBlock(ctx)}
${filterSheet(ctx, counts)}`;

  const slim = properties.map(p => ({ ...p, description: (p.description || []).slice(0, 1) }));
  return {
    path: 'properties.html', active: 'properties', bodyClass: 'pg-listing',
    title: 'Golden Visa Properties in Greece | Netherfield Developments',
    description: 'Search Golden Visa properties in Kato Glyfada, central Athens and Piraeus: filter by price, type, bedrooms, view and features, on a list or a map.',
    ogImage: 'img/hero/bay.jpg', leaflet: true, options: OPTIONS, scripts: ['listing'],
    data: { site: { currencies: site.currencies, maps: site.maps, email: site.email, name: site.name }, tax, properties: slim, perPage: 12, priceSteps: PRICE_STEPS, areaSteps: AREA_STEPS },
    content
  };
}
