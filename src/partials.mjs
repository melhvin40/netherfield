// Page shell: <head>, header, mobile drawer, footer, icon sprite, and the full-bleed film hero.
import { esc, icon } from './lib/util.mjs';
import { sprite } from './templates/icons.mjs';
import { FILMS } from './media.mjs';

export const NAV = [
  { id: 'home', href: 'index.html', label: 'Home' },
  { id: 'properties', href: 'properties.html', label: 'Properties' },
  { id: 'golden-visa', href: 'golden-visa-benefits.html', label: 'Golden Visa Benefits' },
  { id: 'why', href: 'why-netherfield.html', label: 'Why Netherfield' },
  { id: 'testimonials', href: 'testimonials.html', label: 'Testimonials' }
];

// Runs in <head> before first paint: marks that scripts run (reveal-on-scroll styles depend on it).
const JS_BOOT = `document.documentElement.className+=' js';`;

export function jsonScript(id, data) {
  return `<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function head(ctx, page) {
  const { site, v } = ctx;
  const base = site.indexable ? site.siteUrl.replace(/\/$/, '') + '/' : site.previewUrl;
  const url = base + (page.path === 'index.html' ? '' : page.path);
  const ogImage = base + (page.ogImage || `img/hero/${FILMS.home}.jpg`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="${site.indexable && !page.noindex ? 'index,follow' : 'noindex,nofollow'}">
${site.indexable ? `<link rel="canonical" href="${esc(url)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0b1530">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/fraunces-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/albert-sans-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/site.css?v=${v}">
${page.leaflet ? `<link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css">` : ''}
<script>${JS_BOOT}</script>
${(page.jsonld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>`;
}

function header(active, site) {
  const links = NAV.map(n => `<a href="${n.href}"${n.id === active ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
  return `<a class="skip" href="#main">Skip to content</a>
<header class="hdr" id="hdr">
  <div class="hdr-in wrap">
    <a class="hdr-logo" href="index.html" aria-label="${esc(site.name)}, home"><img src="img/logo.png" alt="${esc(site.name)}" width="500" height="126"></a>
    <nav class="hdr-nav" aria-label="Primary">${links}</nav>
    <div class="hdr-act">
      <a class="hdr-icon" href="properties.html?saved=1" aria-label="Saved properties">${icon('heart', 20)}<span class="hdr-badge" data-saved-count hidden>0</span></a>
      <a class="hdr-icon hdr-insta" href="${esc(site.instagram)}" target="_blank" rel="noopener" aria-label="Netherfield on Instagram">${icon('instagram', 20)}</a>
      <a class="btn btn-gold btn-sm hdr-cta" href="contact.html">Book a consultation</a>
      <button class="hdr-burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">${icon('menu', 26)}</button>
    </div>
  </div>
</header>
<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Menu" hidden>
  <div class="drawer-top"><img src="img/logo.png" alt="${esc(site.name)}" width="500" height="126"><button class="drawer-close" type="button" aria-label="Close menu">${icon('close', 26)}</button></div>
  <nav class="drawer-nav" aria-label="Mobile">${NAV.map(n => `<a href="${n.href}"${n.id === active ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}<a href="contact.html">Contact</a></nav>
  <div class="drawer-foot">
    <a class="btn btn-gold" href="contact.html">Book a consultation</a>
    <p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>
  </div>
</div>`;
}

function footer(site, tax) {
  const markets = (tax?.markets || []).filter(m => m.id !== 'athens');
  return `<footer class="ftr">
  <div class="wrap ftr-grid">
    <div class="ftr-brand">
      <img src="img/logo.png" alt="${esc(site.name)}" width="500" height="126">
      <p>${esc(site.tagline)}. Guiding international families to Greek residency through considered real estate on the Athens Riviera.</p>
      <p class="ftr-offices">Glyfada &middot; Dubai &middot; Cairo</p>
    </div>
    <div>
      <h2 class="ftr-h">Explore</h2>
      <ul>${NAV.map(n => `<li><a href="${n.href}">${n.label}</a></li>`).join('')}<li><a href="contact.html">Book a consultation</a></li></ul>
    </div>
    <div>
      <h2 class="ftr-h">Properties by area</h2>
      <ul>${markets.map(m => `<li><a href="properties.html?location=${m.id}">${esc(m.label)}</a></li>`).join('')}<li><a href="properties.html?status=sold">Delivered projects</a></li></ul>
    </div>
    <div>
      <h2 class="ftr-h">Contact</h2>
      <ul class="ftr-contact">
        <li>${esc(site.address.street)}, ${esc(site.address.city)} ${esc(site.address.postalCode)}</li>
        <li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
        ${site.phone ? `<li><a href="tel:${esc(site.phone.replace(/\s+/g, ''))}">${esc(site.phone)}</a></li>` : ''}
        <li><a href="${esc(site.instagram)}" target="_blank" rel="noopener">Instagram ${esc(site.instagramHandle || '')}</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap ftr-bottom">
    <span>&copy; 2026 ${esc(site.name)}</span>
    <span>Redesign concept &middot; Figures marked indicative are confirmed per property</span>
    <a href="admin.html" rel="nofollow">Agency login</a>
  </div>
</footer>
<button class="totop" id="totop" type="button" aria-label="Back to top" hidden>${icon('chevron-up', 20)}</button>`;
}

export function layout(ctx, page) {
  const { site, v } = ctx;
  return `${head(ctx, page)}
<body class="${esc(page.bodyClass || '')}">
${sprite()}
${header(page.active, site)}
<main id="main">
${page.content}
</main>
${footer(site, ctx.tax)}
${page.data ? jsonScript('nf-data', page.data) : ''}
${page.leaflet ? `<script src="assets/vendor/leaflet/leaflet.js" defer></script>` : ''}
<script type="module" src="assets/js/site.js?v=${v}"></script>
${(page.scripts || []).map(s => `<script type="module" src="assets/js/${s}.js?v=${v}"></script>`).join('\n')}
</body>
</html>
`;
}

// Full-bleed film hero: a slow-motion loop behind the title, which rests on a soft gradient.
// cfg: clip (video/<clip>.mp4|webm and img/hero/<clip>.jpg), eyebrow, title (HTML), lede, actions (HTML),
// extra (HTML placed after the text, e.g. a quote), cls (extra classes on the section).
export function filmHero(cfg) {
  return `<section class="ph ph-cinema${cfg.cls ? ' ' + cfg.cls : ''}">
    <div class="ph-media">
      <video class="ph-video" muted loop playsinline preload="none" poster="img/hero/${cfg.clip}.jpg" aria-hidden="true" data-autoplay>
        <source src="video/${cfg.clip}.mp4" type="video/mp4"><source src="video/${cfg.clip}.webm" type="video/webm">
      </video>
    </div>
    <div class="ph-shade"></div>
    <div class="wrap ph-inner">
      <div class="ph-text">
        <p class="eyebrow on-dark">${esc(cfg.eyebrow)}</p>
        <h1 class="ph-title">${cfg.title}</h1>
        ${cfg.lede ? `<p class="ph-lede">${esc(cfg.lede)}</p>` : ''}
        ${cfg.actions || ''}
      </div>
      ${cfg.extra || ''}
    </div>
  </section>`;
}
