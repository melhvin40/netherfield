// Property detail page, modelled on JamesEdition's listing page: gallery mosaic with "Show all photos",
// key facts, description, features (Lot / Interior / Outdoor), property details, video, floor plans,
// map / satellite / Street View, agent card with enquiry form, similar homes.
import { esc, icon, formatMoney, formatArea, monthLabel, plural, youtubeId, vimeoId } from '../lib/util.mjs';
import { pageUrl, typeOf, marketOf, locationLine, groupedFeatures, pricePerSqm, isSold, similarTo, nearby } from '../lib/model.mjs';
import { cardHTML, priceText } from '../templates/card.mjs';
import { locatorSVG } from '../templates/rivieraMap.mjs';

function photoImg(ph, p, attrs = '') {
  const srcset = ph.card ? `${esc(ph.card)} ${ph.cw}w, ${esc(ph.src)} ${ph.w}w` : `${esc(ph.src)} ${ph.w}w`;
  return `<img src="${esc(ph.src)}" srcset="${srcset}" sizes="(min-width:1100px) 760px, 100vw" width="${ph.w}" height="${ph.h}" alt="${esc(ph.alt || p.title)}" decoding="async"${attrs}>`;
}

function gallery(p, site) {
  const photos = p.photos || [];
  const main = photos[0];
  const lq = main?.lqip ? ` style="--lq:url('${main.lqip}')"` : '';
  const video = p.video ? (youtubeId(p.video) || vimeoId(p.video) ? 'Watch the video' : 'Video tour') : 'On request';
  const plans = (p.floorplans || []).length;
  const feature = [
    `<a class="pd-tile pd-tile-video" href="#video"${lq}><span class="pd-tile-bg"></span>${icon('play', 34)}<span class="pd-tile-label">Video tour</span><span class="pd-tile-sub">${video}</span></a>`,
    `<a class="pd-tile pd-tile-plan" href="#floorplan"><span class="pd-tile-art" aria-hidden="true"></span><span class="pd-tile-label">Floor plans</span><span class="pd-tile-sub">${plans ? `${plans} ${plural(plans, 'plan')}` : 'On request'}</span></a>`,
    `<a class="pd-tile pd-tile-map" href="#location">${p.location?.lat != null ? locatorSVG(p.location.lat, p.location.lng) : ''}<span class="pd-tile-label">Location</span><span class="pd-tile-sub">${esc(p.location?.area || '')}</span></a>`,
    `<a class="pd-tile pd-tile-street" href="#location" data-goto-tab="street">${icon('street', 32)}<span class="pd-tile-label">Street View</span><span class="pd-tile-sub">${esc(p.location?.city || '')}</span></a>`
  ];
  const tiles = [];
  for (let i = 1; i < 5; i++) {
    const ph = photos[i];
    if (ph) tiles.push(`<button class="pd-tile pd-tile-photo" type="button" data-open="${i}"${ph.lqip ? ` style="--lq:url('${ph.lqip}')"` : ''}><span class="pd-tile-bg"></span>${photoImg(ph, p, ' loading="lazy"')}</button>`);
  }
  while (tiles.length < 4) tiles.push(feature[tiles.length - Math.max(0, photos.length - 1)] || feature[tiles.length]);
  const count = photos.length;
  return `<section class="pd-gal wrap" aria-label="Photos and media">
  <div class="pd-mosaic">
    <button class="pd-tile pd-tile-main" type="button" data-open="0"${lq}>
      <span class="pd-tile-bg"></span>
      ${main ? photoImg(main, p, ' fetchpriority="high"') : `<span class="pd-nophoto">${icon('photos', 32)}Photos on request</span>`}
    </button>
    ${tiles.join('')}
    ${count > 1 ? `<button class="pd-all" type="button" data-all>${icon('grid', 18)}<span>Show all ${count} photos</span></button>` : ''}
  </div>
  <div class="pd-mediabar" role="navigation" aria-label="Media">
    <button type="button" data-all>${icon('photos', 18)}Photos <span>${count}</span></button>
    <a href="#video">${icon('video', 18)}Video</a>
    ${p.virtualTour ? `<a href="#tour">${icon('cube', 18)}3D tour</a>` : ''}
    <a href="#floorplan">${icon('plan', 18)}Floor plan</a>
    <a href="#location">${icon('map', 18)}Map</a>
    <a href="#location" data-goto-tab="street">${icon('street', 18)}Street View</a>
  </div>
</section>`;
}

function facts(p, tax) {
  const items = [];
  if (p.bedrooms) items.push(['bed', 'Bedrooms', p.bedrooms]);
  if (p.bathrooms) items.push(['bath', 'Bathrooms', p.bathrooms]);
  if (p.livingArea) items.push(['area', 'Living area', `<span data-m2="${p.livingArea}">${formatArea(p.livingArea)}</span>`]);
  if (p.lotSize) items.push(['leaf', 'Lot size', `<span data-m2="${p.lotSize}">${formatArea(p.lotSize)}</span>`]);
  items.push(['home', 'Property type', esc(typeOf(tax, p.type).label)]);
  if (p.yearBuilt) items.push(['calendar', 'Year built', esc(p.yearBuilt)]);
  return `<dl class="pd-facts">${items.map(([ic, k, v]) => `<div>${icon(ic, 24)}<dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function features(p, tax) {
  const groups = groupedFeatures(p, tax);
  if (!groups.length) return '';
  const market = p.location?.market;
  return `<section class="pd-sec" id="features" aria-labelledby="hFeatures">
    <h2 class="pd-h" id="hFeatures">Features</h2>
    <div class="pd-feat">${groups.map(g => `<div class="pd-feat-g"><h3>${esc(g.label)}</h3><ul>${g.items.map(f => `<li>${icon(f.icon || 'check', 20)}${f.searchable ? `<a href="properties.html?features=${f.id}${market ? '&amp;location=' + market : ''}">${esc(f.label)}</a>` : `<span>${esc(f.label)}</span>`}</li>`).join('')}</ul></div>`).join('')}</div>
  </section>`;
}

function details(p, tax, site) {
  const m = marketOf(tax, p.location?.market);
  const pps = pricePerSqm(p);
  const rows = [
    ['Reference', esc(p.ref)],
    ['Status', isSold(p) ? 'Delivered' : 'For sale'],
    ['Price', isSold(p) ? 'Delivered' : (p.priceOnRequest || !p.price ? 'On request' : `<span data-eur="${p.price}">${formatMoney(p.price, 'EUR', site)}</span>`)],
    pps && !isSold(p) ? ['Price per m²', `<span data-eur="${pps}">${formatMoney(pps, 'EUR', site)}</span>`] : null,
    ['Property type', esc(typeOf(tax, p.type).label)],
    p.bedrooms ? ['Bedrooms', p.bedrooms] : null,
    p.bathrooms ? ['Bathrooms', p.bathrooms] : null,
    p.livingArea ? ['Living area', `<span data-m2="${p.livingArea}">${formatArea(p.livingArea)}</span>`] : null,
    p.lotSize ? ['Lot size', `<span data-m2="${p.lotSize}">${formatArea(p.lotSize)}</span>`] : null,
    p.yearBuilt ? ['Year built', esc(p.yearBuilt)] : null,
    ['Area', esc(m ? m.label : (p.location?.area || ''))],
    ['City', esc(p.location?.city || '')],
    ['Golden Visa', p.goldenVisa ? 'Eligible, route confirmed per property' : 'Not eligible'],
    p.updated ? ['Updated', esc(monthLabel(p.updated))] : null
  ].filter(Boolean);
  return `<section class="pd-sec" id="details" aria-labelledby="hDetails">
    <h2 class="pd-h" id="hDetails">Property details</h2>
    <dl class="pd-table">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${p.indicative ? '<p class="fine pd-indicative">Figures are indicative and confirmed by the Netherfield team on request.</p>' : ''}
  </section>`;
}

function videoSection(p) {
  const yt = youtubeId(p.video), vm = vimeoId(p.video);
  let body;
  if (yt) {
    body = `<div class="pd-video" data-embed="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&amp;rel=0&amp;playsinline=1">
      <img src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy">
      <button class="pd-play" type="button" aria-label="Play video">${icon('play', 64)}</button></div>`;
  } else if (vm) {
    body = `<div class="pd-video pd-video-vimeo" data-embed="https://player.vimeo.com/video/${vm}?autoplay=1"><button class="pd-play" type="button" aria-label="Play video">${icon('play', 64)}</button></div>`;
  } else {
    body = `<div class="pd-request">
        <span class="pd-request-art pd-request-play" aria-hidden="true">${icon('play', 44)}</span>
        <div><p class="pd-request-h">Video tour on request</p><p>A filmed walkthrough of the home and its surroundings, or a live video call from the property with one of our advisors.</p>
        <a class="btn btn-line" href="#enquire" data-request="video">Request a video tour</a></div>
      </div>`;
  }
  return `<section class="pd-sec" id="video" aria-labelledby="hVideo"><h2 class="pd-h" id="hVideo">Video</h2>${body}</section>`;
}

function tourSection(p) {
  if (!p.virtualTour) return '';
  return `<section class="pd-sec" id="tour" aria-labelledby="hTour"><h2 class="pd-h" id="hTour">3D virtual tour</h2>
    <div class="pd-video pd-tour" data-embed="${esc(p.virtualTour)}"><button class="btn btn-gold" type="button">${icon('cube', 18)}Start the 3D tour</button></div></section>`;
}

function floorplanSection(p) {
  const plans = p.floorplans || [];
  const body = plans.length
    ? `<div class="pd-plans">${plans.map((f, i) => `<button class="pd-plan" type="button" data-plan="${i}"><img src="${esc(f.src)}" width="${f.w || 800}" height="${f.h || 600}" alt="${esc(f.alt || p.title + ' floor plan')}" loading="lazy"><span>${esc(f.label || 'Floor plan ' + (i + 1))}</span></button>`).join('')}</div>`
    : `<div class="pd-request">
        <span class="pd-request-art" aria-hidden="true"></span>
        <div><p class="pd-request-h">Floor plans on request</p><p>Layouts, unit sizes and specifications are shared directly with interested buyers, usually within one working day.</p>
        <a class="btn btn-line" href="#enquire" data-request="plans">Request floor plans</a></div>
      </div>`;
  return `<section class="pd-sec" id="floorplan" aria-labelledby="hPlan"><h2 class="pd-h" id="hPlan">Floor plan</h2>${body}</section>`;
}

function locationSection(p, site) {
  const l = p.location || {};
  if (l.lat == null) return '';
  const near = nearby(p);
  const gm = `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;
  const pano = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${l.lat},${l.lng}`;
  const streetSrc = p.streetView || (site.maps.googleMapsEmbedKey ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(site.maps.googleMapsEmbedKey)}&location=${l.lat},${l.lng}&fov=80` : '');
  return `<section class="pd-sec" id="location" aria-labelledby="hLoc">
    <h2 class="pd-h" id="hLoc">Location</h2>
    <p class="pd-loc-line">${icon('pin', 18)}${esc(locationLine(p))}, ${esc(l.country || 'Greece')}</p>
    <div class="pd-maptabs" role="tablist" aria-label="Map type">
      <button type="button" role="tab" aria-selected="true" data-tab="map">${icon('map', 18)}Map</button>
      <button type="button" role="tab" aria-selected="false" data-tab="satellite">${icon('satellite', 18)}Satellite</button>
      <button type="button" role="tab" aria-selected="false" data-tab="street">${icon('street', 18)}Street View</button>
    </div>
    <div class="pd-mapbox">
      <div class="pd-map" id="pdMap" data-lat="${l.lat}" data-lng="${l.lng}" data-radius="${l.approximate ? (l.radius || 300) : 0}" role="region" aria-label="Map of the area around ${esc(p.title)}"></div>
      <div class="pd-street" id="pdStreet" hidden>
        ${streetSrc ? `<iframe title="Street View near ${esc(p.title)}" data-src="${esc(streetSrc)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>`
          : `<div class="pd-street-card">${icon('street', 40)}<p class="pd-request-h">Walk the street</p><p>See the neighbourhood at street level in Google Street View.</p><a class="btn btn-gold" href="${esc(pano)}" target="_blank" rel="noopener">Open Street View ${icon('external', 16)}</a></div>`}
      </div>
    </div>
    <div class="pd-loc-foot">
      <p class="fine">${l.approximate ? `The circle marks the area within about ${l.radius || 300} m; the exact address is shared on request.` : 'Exact position.'}</p>
      <a class="link-arrow" href="${esc(gm)}" target="_blank" rel="noopener">Open in Google Maps ${icon('external', 16)}</a>
    </div>
    ${near.length ? `<div class="pd-near"><h3>Distances</h3><ul>${near.map(n => `<li><span>${esc(n.label)}</span><span>${n.km < 10 ? n.km.toFixed(1) : Math.round(n.km)} km</span></li>`).join('')}</ul><p class="fine">Straight-line distances.</p></div>` : ''}
  </section>`;
}

function agent(p, site) {
  const codes = [['+30', 'GR'], ['+20', 'EG'], ['+971', 'AE'], ['+966', 'SA'], ['+974', 'QA'], ['+965', 'KW'], ['+973', 'BH'], ['+968', 'OM'], ['+962', 'JO'], ['+961', 'LB'], ['+44', 'GB'], ['+49', 'DE'], ['+33', 'FR'], ['+39', 'IT'], ['+1', 'US'], ['+90', 'TR'], ['+7', 'RU'], ['+86', 'CN'], ['+91', 'IN']];
  const wa = site.whatsapp ? site.whatsapp.replace(/[^\d]/g, '') : '';
  return `<aside class="pd-aside" aria-label="Contact the agent">
  <div class="pd-agent" id="enquire">
    <div class="pd-agent-top">
      <span class="pd-agent-logo" aria-hidden="true"><svg viewBox="0 0 64 64" width="30" height="30"><path d="M19 46V18h3.2l17.6 21.6V18H45v28h-3.2L24.2 24.4V46z" fill="#E3C87E"/></svg></span>
      <div><p class="pd-agent-name">${esc(site.name)}</p><p class="pd-agent-sub">Golden Visa property advisors &middot; ${esc(site.address.city)}</p></div>
    </div>
    <p class="pd-agent-price"${!isSold(p) && p.price && !p.priceOnRequest ? ` data-eur="${p.price}"` : ''}>${esc(priceText(p, site, 'EUR'))}</p>
    <form class="pd-form" id="pdForm" novalidate data-title="${esc(p.title)}" data-ref="${esc(p.ref)}" data-url="${esc(pageUrl(p))}">
      <fieldset class="pd-asks"><legend class="sr">I would like to</legend>
        <label class="check"><input type="checkbox" name="ask" value="Price and availability" checked><span>Price &amp; availability</span></label>
        <label class="check"><input type="checkbox" name="ask" value="Floor plans" data-ask="plans"><span>Floor plans</span></label>
        <label class="check"><input type="checkbox" name="ask" value="Video tour" data-ask="video"><span>Video tour</span></label>
        <label class="check"><input type="checkbox" name="ask" value="A viewing or video call" data-ask="viewing"><span>Arrange a viewing</span></label>
      </fieldset>
      <div class="field"><label for="pdName">Full name</label><input class="input" id="pdName" name="name" autocomplete="name" required></div>
      <div class="field"><label for="pdEmail">Email</label><input class="input" id="pdEmail" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="pdPhone">Phone</label><div class="pd-phone"><select class="select" name="cc" aria-label="Country code">${codes.map(([c, n]) => `<option value="${c}">${n} ${c}</option>`).join('')}</select><input class="input" id="pdPhone" name="phone" type="tel" autocomplete="tel-national" placeholder="Optional"></div></div>
      <div class="field"><label for="pdMsg">Message</label><textarea class="textarea" id="pdMsg" name="message" rows="4">I'm interested in ${esc(p.title)} (${esc(p.ref)}). Please send me more information.</textarea></div>
      <label class="check pd-consent"><input type="checkbox" name="consent" required><span>I agree to be contacted about this property.</span></label>
      <button class="btn btn-primary btn-block" type="submit">Send message</button>
      <p class="fine pd-form-note">Opens your email app with the message ready to send to ${esc(site.email)}.</p>
      <p class="pd-form-ok" role="status" hidden>Your email app is opening with the message ready to send.</p>
    </form>
    <div class="pd-agent-alt">
      ${site.phone ? `<a class="btn btn-line btn-sm" href="tel:${esc(site.phone.replace(/\s+/g, ''))}">${icon('phone', 16)}Call</a>` : ''}
      ${wa ? `<a class="btn btn-line btn-sm" href="https://wa.me/${wa}?text=${encodeURIComponent(`Hello Netherfield, I'm interested in ${p.title} (${p.ref}).`)}" target="_blank" rel="noopener">${icon('whatsapp', 16)}WhatsApp</a>` : ''}
      <a class="btn btn-line btn-sm" href="mailto:${esc(site.email)}?subject=${encodeURIComponent(`${p.title} (${p.ref})`)}">${icon('mail', 16)}Email</a>
    </div>
  </div>
</aside>`;
}

export function propertyPage(ctx, p) {
  const { site, tax, properties } = ctx;
  const sold = isSold(p);
  const market = marketOf(tax, p.location?.market);
  const pps = pricePerSqm(p);
  const desc = p.description || [];
  const similar = similarTo(p, properties, 3);
  const photos = (p.photos || []).map(ph => ({ src: ph.src, w: ph.w, h: ph.h, alt: ph.alt || p.title }));
  const plans = (p.floorplans || []).map(f => ({ src: f.src, w: f.w, h: f.h, alt: f.alt || p.title + ' floor plan', label: f.label }));

  const content = `<div class="wrap pd-top">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="properties.html">Properties</a>${market ? `<span aria-hidden="true">/</span><a href="properties.html?location=${market.id}">${esc(market.label)}</a>` : ''}<span aria-hidden="true">/</span><span aria-current="page">${esc(p.title)}</span></nav>
  <div class="pd-actions">
    <a class="pd-back" href="properties.html" data-back>${icon('arrow-left', 18)}Back to search</a>
    <div class="pd-actions-r">
      <div class="pd-sharewrap"><button class="pd-act" type="button" data-share aria-expanded="false">${icon('share', 18)}<span>Share</span></button>
        <div class="pop pd-sharepop" hidden>
          <a href="https://wa.me/?text=" data-share-to="whatsapp" target="_blank" rel="noopener">${icon('whatsapp', 18)}WhatsApp</a>
          <a href="mailto:?subject=" data-share-to="email">${icon('mail', 18)}Email</a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=" data-share-to="facebook" target="_blank" rel="noopener">${icon('facebook', 18)}Facebook</a>
          <a href="https://twitter.com/intent/tweet?url=" data-share-to="x" target="_blank" rel="noopener">${icon('x', 18)}X</a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=" data-share-to="linkedin" target="_blank" rel="noopener">${icon('linkedin', 18)}LinkedIn</a>
          <button type="button" data-share-to="copy">${icon('copy', 18)}Copy link</button>
        </div>
      </div>
      <button class="pd-act" type="button" data-save="${esc(p.id)}" aria-pressed="false">${icon('heart', 18)}<span>Save</span></button>
    </div>
  </div>
</div>
${gallery(p, site)}
<div class="wrap pd-grid">
  <article class="pd-col">
    <header class="pd-head">
      <div class="pd-tags">${sold ? '<span class="tag tag-quiet">Delivered</span>' : '<span class="tag tag-gold">For sale</span>'}${p.goldenVisa ? '<span class="tag">Golden Visa</span>' : ''}<span class="pd-ref">Ref. ${esc(p.ref)}</span></div>
      <h1 class="pd-title">${esc(p.title)}</h1>
      <p class="pd-loc"><a href="#location">${icon('pin', 18)}${esc(locationLine(p))}, ${esc(p.location?.country || 'Greece')}</a></p>
      <div class="pd-pricerow">
        <p class="pd-price"${!sold && p.price && !p.priceOnRequest ? ` data-eur="${p.price}"` : ''}>${esc(priceText(p, site, 'EUR'))}</p>
        ${pps && !sold ? `<p class="pd-ppsqm"><span data-eur="${pps}">${formatMoney(pps, 'EUR', site)}</span> per m²</p>` : ''}
        <label class="ls-sel pd-cur"><span>Currency</span><select data-currency aria-label="Currency">${Object.keys(site.currencies.rates).map(c => `<option value="${c}">${c}</option>`).join('')}</select></label>
      </div>
    </header>
    ${facts(p, tax)}
    <section class="pd-sec" id="description" aria-labelledby="hDesc">
      <h2 class="pd-h" id="hDesc">About this home</h2>
      <div class="pd-desc${desc.length > 2 ? ' is-clamped' : ''}" id="pdDesc">${desc.map(t => `<p>${esc(t)}</p>`).join('')}</div>
      ${desc.length > 2 ? '<button class="link-arrow pd-more" type="button" aria-expanded="false" aria-controls="pdDesc">Read more</button>' : ''}
    </section>
    ${features(p, tax)}
    ${details(p, tax, site)}
    ${videoSection(p)}
    ${tourSection(p)}
    ${floorplanSection(p)}
    ${locationSection(p, site)}
    <section class="pd-sec pd-gv" aria-labelledby="hGv">
      <h2 class="pd-h" id="hGv">Golden Visa</h2>
      <p>Greece grants a five-year, renewable residence permit to non-EU buyers of qualifying property, covering spouse, children under 21 and the parents of both spouses, with visa-free travel across the Schengen Area. Since 2024 the threshold depends on location and building type; our advisors confirm the route that applies to ${esc(p.title)} before you reserve.</p>
      <a class="link-arrow" href="golden-visa-benefits.html">How the Golden Visa works ${icon('arrow-right', 16)}</a>
    </section>
  </article>
  ${agent(p, site)}
</div>
${similar.length ? `<section class="wrap pd-similar" aria-labelledby="hSim"><div class="pd-similar-head"><h2 class="h3" id="hSim">Similar properties</h2><a class="link-arrow" href="properties.html${market ? '?location=' + market.id : ''}">View all ${icon('arrow-right', 16)}</a></div><div class="ls-grid">${similar.map(s => cardHTML(s, ctx)).join('')}</div></section>` : ''}
<section class="cta cta-light"><div class="wrap cta-in"><p class="eyebrow">Next step</p><h2 class="h2">See it <em>for yourself</em></h2><p>Book a private consultation and we will share full specifications, availability and the Golden Visa route for this home.</p><a class="btn btn-primary" href="#enquire" data-request="viewing">Arrange a viewing</a></div></section>
<div class="pd-sticky" id="pdSticky"><div><p class="pd-sticky-price"${!sold && p.price && !p.priceOnRequest ? ` data-eur="${p.price}"` : ''}>${esc(priceText(p, site, 'EUR'))}</p><p class="pd-sticky-t">${esc(p.title)}</p></div><a class="btn btn-primary btn-sm" href="#enquire">Enquire</a></div>
<div class="pv" id="pvAll" role="dialog" aria-modal="true" aria-label="All photos of ${esc(p.title)}" hidden>
  <div class="pv-bar"><button class="pv-close" type="button" data-pv-close>${icon('arrow-left', 20)}<span>Back</span></button><p class="pv-title">${esc(p.title)}</p><span class="pv-count">${photos.length} ${plural(photos.length, 'photo')}${plans.length ? ` &middot; ${plans.length} ${plural(plans.length, 'plan')}` : ''}</span></div>
  <div class="pv-body">
    <div class="pv-grid">${photos.map((ph, i) => `<button class="pv-item" type="button" data-open="${i}"><img src="${esc(ph.src)}" width="${ph.w}" height="${ph.h}" alt="${esc(ph.alt)}" loading="lazy" decoding="async"></button>`).join('')}</div>
    ${plans.length ? `<h2 class="pv-h">Floor plans</h2><div class="pv-grid">${plans.map((f, i) => `<button class="pv-item" type="button" data-plan="${i}"><img src="${esc(f.src)}" alt="${esc(f.alt)}" loading="lazy"></button>`).join('')}</div>` : ''}
  </div>
</div>
<div class="vw" id="pvViewer" role="dialog" aria-modal="true" aria-label="Photo viewer" hidden>
  <div class="vw-bar"><span class="vw-count" aria-live="polite"></span><p class="vw-cap"></p><button class="vw-close" type="button" aria-label="Close viewer">${icon('close', 24)}</button></div>
  <button class="vw-nav vw-prev" type="button" aria-label="Previous photo">${icon('chevron-left', 28)}</button>
  <figure class="vw-stage"><img alt=""></figure>
  <button class="vw-nav vw-next" type="button" aria-label="Next photo">${icon('chevron-right', 28)}</button>
</div>`;

  return {
    path: pageUrl(p), active: 'properties', bodyClass: 'pg-property',
    title: `${p.title}, ${locationLine(p)} | ${site.name}`,
    description: `${p.title} in ${locationLine(p)}: ${typeOf(tax, p.type).label}${p.bedrooms ? `, ${p.bedrooms} ${plural(p.bedrooms, 'bedroom')}` : ''}${p.livingArea ? `, ${p.livingArea} m²` : ''}. ${sold ? 'A delivered Netherfield project.' : 'Golden Visa property from Netherfield Developments.'}`,
    ogImage: p.photos?.[0]?.src, leaflet: true, scripts: ['property'],
    data: { site: { currencies: site.currencies, maps: site.maps, email: site.email, name: site.name }, property: { id: p.id, title: p.title, ref: p.ref, photos, plans, location: p.location } },
    jsonld: [{
      '@context': 'https://schema.org', '@type': ['Product', 'Accommodation'], name: p.title, description: desc.join(' '),
      image: (p.photos || []).map(ph => (site.indexable ? site.siteUrl + '/' : site.previewUrl) + ph.src),
      floorSize: p.livingArea ? { '@type': 'QuantitativeValue', value: p.livingArea, unitCode: 'MTK' } : undefined,
      numberOfBedrooms: p.bedrooms || undefined, numberOfBathroomsTotal: p.bathrooms || undefined,
      address: { '@type': 'PostalAddress', addressLocality: p.location?.city, addressRegion: 'Attica', addressCountry: 'GR' },
      offers: sold ? { '@type': 'Offer', availability: 'https://schema.org/SoldOut' }
        : (p.indicative || p.priceOnRequest ? { '@type': 'Offer', availability: 'https://schema.org/InStock' }
          : { '@type': 'Offer', availability: 'https://schema.org/InStock', price: p.price, priceCurrency: p.currency || 'EUR' })
    }],
    content
  };
}
