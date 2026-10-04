// Page shell: <head>, header, mobile drawer, footer, icon sprite and the design-options plumbing.
import { esc, icon } from './lib/util.mjs';
import { sprite } from './templates/icons.mjs';

export const NAV = [
  { id: 'home', href: 'index.html', label: 'Home' },
  { id: 'properties', href: 'properties.html', label: 'Properties' },
  { id: 'golden-visa', href: 'golden-visa-benefits.html', label: 'Golden Visa Benefits' },
  { id: 'why', href: 'why-netherfield.html', label: 'Why Netherfield' },
  { id: 'testimonials', href: 'testimonials.html', label: 'Testimonials' }
];

// Runs in <head> before first paint: applies design-option choices (from ?opt-<group>=<variant>
// or a previous visit) so a non-default variant never flashes the default first.
const OPTIONS_BOOT = `(function(){var d=document.documentElement;d.className+=' js';try{var q=new URLSearchParams(location.search),s=JSON.parse(localStorage.getItem('nf-options')||'{}');q.forEach(function(v,k){if(k.indexOf('opt-')===0)s[k.slice(4)]=v});if(q.has('options'))localStorage.setItem('nf-options-panel',q.get('options'));localStorage.setItem('nf-options',JSON.stringify(s));for(var k in s)d.setAttribute('data-opt-'+k,s[k])}catch(e){}})();`;

// Hide every variant except the chosen one (or the default when nothing is chosen).
export function optionsCSS(groups) {
  if (!groups || !groups.length) return '';
  return groups.map(g => {
    const rules = [`html:not([data-opt-${g.id}]) [data-variant-of="${g.id}"]:not([data-variant="${g.default}"])`];
    g.variants.forEach(v => rules.push(`html[data-opt-${g.id}="${v.id}"] [data-variant-of="${g.id}"]:not([data-variant="${v.id}"])`));
    return rules.join(',\n') + '{display:none!important}';
  }).join('\n');
}

export function jsonScript(id, data) {
  return `<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function head(ctx, page) {
  const { site, v } = ctx;
  const base = site.indexable ? site.siteUrl.replace(/\/$/, '') + '/' : site.previewUrl;
  const url = base + (page.path === 'index.html' ? '' : page.path);
  const ogImage = page.ogImage ? base + page.ogImage : base + 'img/hero/mykonos.jpg';
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
<script>${OPTIONS_BOOT}</script>
${page.options && page.options.length ? `<style id="nf-options-css">${optionsCSS(page.options)}</style>` : ''}
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
${page.options && page.options.length ? jsonScript('nf-options-data', page.options) : ''}
${page.leaflet ? `<script src="assets/vendor/leaflet/leaflet.js" defer></script>` : ''}
<script type="module" src="assets/js/site.js?v=${v}"></script>
${(page.scripts || []).map(s => `<script type="module" src="assets/js/${s}.js?v=${v}"></script>`).join('\n')}
</body>
</html>
`;
}

// A hero in the chosen variant. Variants share one markup family:
//  cinema   full-bleed slow-motion loop, headline over a soft gradient
//  split    editorial: headline on paper, the film in a framed panel beside it
//  scope    cinemascope band, headline set below on paper (text never over the image)
//  minimal  no imagery: compact, type-led header (JamesEdition-style for the listing)
export function heroVariants(group, cfg) {
  const media = (cls = '') => `<div class="ph-media${cls}">
      <video class="ph-video" muted loop playsinline preload="none" poster="img/hero/${cfg.clip}.jpg" aria-hidden="true" data-autoplay>
        <source src="video/${cfg.clip}.mp4" type="video/mp4"><source src="video/${cfg.clip}.webm" type="video/webm">
      </video>
    </div>`;
  const text = (dark) => `<p class="eyebrow${dark ? ' on-dark' : ''}">${esc(cfg.eyebrow)}</p>
      <h1 class="ph-title">${cfg.title}</h1>
      ${cfg.lede ? `<p class="ph-lede">${esc(cfg.lede)}</p>` : ''}
      ${cfg.actions || ''}`;
  const v = cfg.variants || ['cinema', 'split', 'scope'];
  const out = [];
  if (v.includes('cinema')) out.push(`<section class="ph ph-cinema" data-variant-of="${group}" data-variant="cinema">
    ${media()}
    <div class="ph-shade"></div>
    <div class="wrap ph-inner">${text(true)}</div>
  </section>`);
  if (v.includes('split')) out.push(`<section class="ph ph-split" data-variant-of="${group}" data-variant="split">
    <div class="wrap ph-split-grid">
      <div class="ph-split-text">${text(false)}</div>
      ${media(' ph-media-framed')}
    </div>
  </section>`);
  if (v.includes('scope')) out.push(`<section class="ph ph-scope" data-variant-of="${group}" data-variant="scope">
    ${media(' ph-media-scope')}
    <div class="wrap ph-scope-text">${text(false)}</div>
  </section>`);
  if (v.includes('minimal')) out.push(`<section class="ph ph-minimal" data-variant-of="${group}" data-variant="minimal">
    <div class="wrap">${text(false)}</div>
  </section>`);
  return out.join('\n');
}
