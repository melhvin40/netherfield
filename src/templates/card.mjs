// Listing card, shared by the build (server-rendered first paint) and listing.js (re-render after filtering).
import { esc, icon, formatMoney, formatArea, plural } from '../lib/util.mjs';
import { pageUrl, typeOf, locationLine, cardImage, isSold, groupedFeatures } from '../lib/model.mjs';

function slides(p, eager) {
  const photos = p.photos || [];
  if (!photos.length) {
    return `<span class="pc-frame pc-empty">${icon('photos', 28)}<span>Photos on request</span></span>`;
  }
  return photos.map((ph, i) => {
    const c = cardImage(ph);
    const srcset = ph.card ? `${esc(ph.card)} ${ph.cw}w, ${esc(ph.src)} ${ph.w}w` : `${esc(ph.src)} ${ph.w}w`;
    return `<span class="pc-frame${i === 0 ? ' is-current' : ''}" data-slide="${i}"${i ? ' hidden' : ''}>` +
      (ph.lqip ? `<span class="pc-backdrop" style="background-image:url('${ph.lqip}')"></span>` : '') +
      `<img class="pc-img" src="${esc(c.src)}" srcset="${srcset}" sizes="(min-width:1180px) 380px, (min-width:760px) 46vw, 92vw" width="${c.w}" height="${c.h}" alt="${esc(ph.alt || p.title)}"${eager && i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></span>`;
  }).join('');
}

export function priceText(p, site, currency) {
  if (isSold(p)) return 'Delivered';
  if (p.priceOnRequest || !p.price) return 'Price on request';
  return formatMoney(p.price, currency, site, { from: p.currency || 'EUR' });
}

export function specsHTML(p, tax, unit, withType = true) {
  const bits = [];
  if (p.bedrooms) bits.push(`<span>${icon('bed', 16)}${p.bedrooms} ${plural(p.bedrooms, 'bed')}</span>`);
  if (p.bathrooms) bits.push(`<span>${icon('bath', 16)}${p.bathrooms} ${plural(p.bathrooms, 'bath')}</span>`);
  if (p.livingArea) bits.push(`<span data-m2="${p.livingArea}">${icon('area', 16)}${formatArea(p.livingArea, unit)}</span>`);
  if (withType && p.type) bits.push(`<span>${icon('home', 16)}${esc(typeOf(tax, p.type).label)}</span>`);
  return bits.join('');
}

export function cardHTML(p, ctx, opts = {}) {
  const { site, tax } = ctx;
  const currency = opts.currency || 'EUR', unit = opts.unit || 'm2';
  const url = pageUrl(p);
  const many = (p.photos || []).length > 1;
  const sold = isSold(p);
  const tags = [];
  if (sold) tags.push('<span class="tag tag-quiet">Delivered</span>');
  else if (p.goldenVisa) tags.push('<span class="tag">Golden Visa</span>');
  if (p.video) tags.push(`<span class="tag tag-icon" title="Video tour">${icon('play', 14)}<span class="sr">Video</span></span>`);
  const list = opts.layout === 'list';
  const feats = list ? groupedFeatures(p, tax).flatMap(g => g.items).slice(0, 5) : [];
  return `<article class="pc${list ? ' pc-list' : ''}${sold ? ' is-sold' : ''}" data-id="${esc(p.id)}">
  <div class="pc-media">
    <a class="pc-link-img" href="${url}" tabindex="-1" aria-hidden="true">${slides(p, opts.eager)}</a>
    ${tags.length ? `<div class="pc-tags">${tags.join('')}</div>` : ''}
    <button class="pc-save" type="button" data-save="${esc(p.id)}" aria-pressed="false" aria-label="Save ${esc(p.title)}">${icon('heart', 18)}</button>
    ${many ? `<button class="pc-nav pc-prev" type="button" aria-label="Previous photo">${icon('chevron-left', 18)}</button><button class="pc-nav pc-next" type="button" aria-label="Next photo">${icon('chevron-right', 18)}</button><span class="pc-count"><span data-current>1</span> / ${p.photos.length}</span>` : ''}
  </div>
  <a class="pc-body" href="${url}">
    <p class="pc-price"${!sold && p.price && !p.priceOnRequest ? ` data-eur="${p.price}"` : ''}>${esc(priceText(p, site, currency))}</p>
    <h3 class="pc-title">${esc(p.title)}</h3>
    <p class="pc-loc">${esc(locationLine(p))}</p>
    <p class="pc-specs">${specsHTML(p, tax, unit)}</p>
    ${list ? `<p class="pc-excerpt">${esc((p.description || [])[0] || '')}</p>${feats.length ? `<p class="pc-feats">${feats.map(f => `<span>${esc(f.label)}</span>`).join('')}</p>` : ''}` : ''}
  </a>
</article>`;
}
