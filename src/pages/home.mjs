import { esc, icon, monthLabel } from '../lib/util.mjs';
import { pageUrl, locationLine, primaryPhoto, isSold } from '../lib/model.mjs';
import { specsHTML } from '../templates/card.mjs';
import { FILMS } from '../media.mjs';

function hero() {
  return `<section class="hh">
  <div class="hh-media">
    <video class="hh-video" muted loop playsinline preload="auto" poster="img/hero/${FILMS.home}.jpg" aria-hidden="true" data-autoplay>
      <source src="video/${FILMS.home}.mp4" type="video/mp4"><source src="video/${FILMS.home}.webm" type="video/webm">
    </video>
  </div>
  <div class="hh-shade"></div>
  <div class="wrap hh-inner">
    <p class="eyebrow on-dark">Greece &middot; Golden Visa &middot; Real Estate</p>
    <h1 class="hh-title">Your Gateway to <em>Europe</em> Starts Here</h1>
    <p class="hh-lede">Golden Visa opportunities, a family-friendly lifestyle and business freedom across Europe. At Netherfield, quality always comes first.</p>
    <div class="hh-ctas">
      <a class="btn btn-gold" href="contact.html">Book a consultation</a>
      <a class="btn btn-line-light" href="properties.html">View properties</a>
    </div>
    <dl class="hh-facts">
      <div><dt data-count="30" data-suffix="+">30+</dt><dd>Years of combined team expertise</dd></div>
      <div><dt data-count="6" data-suffix="%">6%</dt><dd>Average annual rental yield</dd></div>
      <div><dt data-count="250" data-prefix="€" data-suffix="K">€250K</dt><dd>Entry investment level</dd></div>
      <div><dt data-count="3">3</dt><dd>Prime Greek markets</dd></div>
    </dl>
  </div>
</section>`;
}

// Residency planner: budget, area and family in; Golden Visa route, rental income and matching homes out.
// Kept for a later phase (the calculation is to be reviewed first) and not placed on the page yet.
function planner(ctx) {
  const { site } = ctx;
  return `<section class="sec pl" id="planner">
  <div class="wrap">
    <div class="pl-head">
      <p class="eyebrow">Plan your residency</p>
      <h2 class="h2">What your investment <em>could look like</em></h2>
      <p class="lede">Move the dials. We match the 2024 Golden Visa rules, Netherfield's average rental yield and the homes available today.</p>
    </div>
    <div class="pl-grid">
      <form class="pl-form" onsubmit="return false">
        <div class="pl-field">
          <label for="plBudget">Investment budget</label>
          <output class="pl-big" id="plBudgetOut" for="plBudget">€500,000</output>
          <input type="range" id="plBudget" min="250000" max="2000000" step="25000" value="500000">
          <div class="pl-scale"><span>€250K</span><span>€2M+</span></div>
        </div>
        <fieldset class="pl-field">
          <legend>Where would you like to be?</legend>
          <div class="seg" role="radiogroup">
            <label><input type="radio" name="plArea" value="" checked><span>Anywhere</span></label>
            <label><input type="radio" name="plArea" value="kato-glyfada"><span>Riviera</span></label>
            <label><input type="radio" name="plArea" value="athens-center"><span>Central Athens</span></label>
            <label><input type="radio" name="plArea" value="piraeus"><span>Piraeus</span></label>
          </div>
        </fieldset>
        <div class="pl-field">
          <label for="plFamily">People on the application</label>
          <div class="stepper"><button type="button" data-step="-1" aria-label="Fewer">${icon('minus', 16)}</button><output id="plFamilyOut">3</output><button type="button" data-step="1" aria-label="More">${icon('plus', 16)}</button></div>
          <input type="hidden" id="plFamily" value="3">
        </div>
      </form>
      <div class="pl-out" aria-live="polite">
        <div class="pl-card">
          <p class="pl-k">Golden Visa route</p>
          <p class="pl-v" id="plRoute">Conversion route</p>
          <p class="pl-d" id="plRouteNote"></p>
        </div>
        <div class="pl-card">
          <p class="pl-k">Indicative rental income</p>
          <p class="pl-v" id="plIncome">€30,000 a year</p>
          <p class="pl-d">At Netherfield's 6% average gross yield. Golden Visa homes may be let long-term only.</p>
        </div>
        <div class="pl-card">
          <p class="pl-k">Your family</p>
          <p class="pl-v" id="plFamilyV">All 3 covered</p>
          <p class="pl-d">One permit covers spouse, children under 21 and the parents of both spouses. No minimum stay.</p>
        </div>
        <a class="btn btn-primary pl-cta" id="plCta" href="properties.html">View matching homes</a>
        <p class="pl-fine">Illustrative only, not legal or financial advice. Thresholds as of ${esc(monthLabel(site.goldenVisa.updated))}.</p>
      </div>
    </div>
  </div>
</section>`;
}

function estate(ctx) {
  const { properties, tax } = ctx;
  const feat = properties.filter(p => p.featured && !isSold(p)).slice(0, 6);
  const nodes = feat.map((p, i) => {
    const ph = primaryPhoto(p);
    return `<div class="es-node" data-index="${i}"><span class="es-ring"></span><img src="${esc(ph.card || ph.src)}" width="72" height="72" alt="" loading="lazy" decoding="async"><span class="es-pointer"></span></div>`;
  }).join('');
  const cards = feat.map((p, i) => {
    const ph = primaryPhoto(p);
    return `<a class="es-card" data-index="${i}" href="${pageUrl(p)}">
        <span class="es-img"><img src="${esc(ph.card || ph.src)}" srcset="${ph.card ? `${esc(ph.card)} ${ph.cw}w, ` : ''}${esc(ph.src)} ${ph.w}w" sizes="(min-width:1100px) 640px, 92vw" width="${ph.card ? ph.cw : ph.w}" height="${ph.card ? ph.ch : ph.h}" loading="lazy" decoding="async" alt="${esc(p.title)}, exterior"></span>
        <span class="es-body">
          <span class="es-title">${esc(p.title)}</span>
          <span class="es-loc">${esc(locationLine(p))}</span>
          <span class="es-specs">${specsHTML(p, tax, 'm2', false)}</span>
          ${p.updated ? `<span class="es-updated">Updated ${esc(monthLabel(p.updated))}</span>` : ''}
        </span>
      </a>`;
  }).join('');
  return `<section class="es" id="estateLine">
  <div class="es-field" aria-hidden="true"><div class="es-field-lit"></div></div>
  <div class="wrap"><div class="es-head">
    <p class="eyebrow on-dark">Featured listings</p>
    <h2 class="h2">Ready to make <em>Greece home?</em></h2>
    <p>${feat.length} residences, each one worth a closer look. Follow the thread.</p>
  </div></div>
  <div class="wrap es-layout">
    <div class="es-graphic" aria-hidden="true">
      <div class="es-canvas"><svg class="es-svg" viewBox="0 0 200 1000" preserveAspectRatio="none"><path class="es-path" d="M100,0 L100,1000"/></svg>${nodes}</div>
    </div>
    <div class="es-cards">${cards}</div>
  </div>
  <div class="wrap es-foot"><a class="link-arrow on-dark" href="properties.html">View all properties ${icon('arrow-right', 16)}</a></div>
</section>`;
}

export function homePage(ctx) {
  const content = [
    hero(),
    estate(ctx),
    `<section class="cta cta-light"><div class="wrap cta-in"><p class="eyebrow">Begin</p><h2 class="h2">Quality always <em>comes first</em></h2><p>From property selection and legal support to relocation and rental management: one team, every step.</p><a class="btn btn-gold" href="contact.html">Book a consultation</a></div></section>`
  ].join('\n');
  const { site } = ctx;
  return {
    path: 'index.html', active: 'home', bodyClass: 'pg-home',
    title: 'Netherfield Developments | Greece Golden Visa Real Estate',
    description: 'Netherfield Developments helps international investors secure Greece Golden Visa residency through premium real estate in Glyfada, Athens and Piraeus.',
    ogImage: `img/hero/${FILMS.home}.jpg`,
    scripts: ['home'],
    data: {
      site: { currencies: site.currencies, goldenVisa: site.goldenVisa },
      properties: ctx.properties.filter(p => !isSold(p)).map(p => ({ id: p.id, price: p.price, priceOnRequest: p.priceOnRequest, market: p.location?.market }))
    },
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'RealEstateAgent', name: site.name, email: site.email,
      url: site.indexable ? site.siteUrl : site.previewUrl, areaServed: ['Glyfada', 'Athens', 'Piraeus', 'Greece'],
      address: { '@type': 'PostalAddress', streetAddress: site.address.street, addressLocality: site.address.city, postalCode: site.address.postalCode, addressCountry: 'GR' },
      sameAs: [site.instagram]
    }],
    content
  };
}
