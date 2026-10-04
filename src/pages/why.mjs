// Why Netherfield: hero, mission, why choose us, key figures (3 variants), founders & partners.
import { esc, icon } from '../lib/util.mjs';
import { heroVariants } from '../partials.mjs';

const OPTIONS = [
  { id: 'why-hero', title: 'Why Netherfield: hero', default: 'cinema', variants: [
    { id: 'cinema', label: 'Full-bleed film', note: 'Athens at sunset in slow motion behind the title.' },
    { id: 'scope', label: 'Cinemascope film', note: 'A wide band of film; the title sits below on paper.' },
    { id: 'split', label: 'Editorial frame', note: 'Title on paper beside the film in a framed panel.' }
  ] },
  { id: 'why-figures', title: 'Why Netherfield: key figures', default: 'numerals', variants: [
    { id: 'numerals', label: 'Grand numerals', note: 'Three large figures on paper, divided by fine rules.' },
    { id: 'map', label: 'Three offices', note: 'Greece, Dubai and Cairo drawn as one network, with the figures beside it.' },
    { id: 'band', label: 'Night band', note: 'Gold figures on a navy band, quiet and compact.' }
  ] }
];

const FOUNDERS = [
  { img: 'img/founder-mostafa.jpg', name: 'Mostafa El Shibini', role: 'Managing Partner', bio: 'With over 30 years of experience in legal, financial and real estate consulting, Mostafa brings industry knowledge and strategic insight to every project. As the leader of Netherfield Developments, he focuses on delivering high-end real estate solutions with a specialty in Golden Visa investments in Greece and England. Also a Managing Partner at Redcon for Real Estate and the Egyptian International Consulting Group, his cross-border expertise connects investors from the Middle East with high-potential opportunities in Europe.' },
  { img: 'img/founder-amr-abou.jpg', name: 'Amr Abou El Seoud', role: 'Chairman & Non-Executive Director, Tejara Capital Ltd', bio: 'A seasoned finance executive with over two decades in investment banking, corporate governance and strategic leadership. A Certified Public Accountant, he has held roles including Chairman and Senior Executive Officer at Tejara Capital, and served on the boards of companies including Aston Martin Lagonda and Investment Dar. Amr played a pivotal role in high-profile transactions, including the acquisition and IPO of Aston Martin, with expertise spanning Sharia-compliant finance and cross-border investment.' },
  { img: 'img/founder-amr-helmy.jpg', name: 'Amr Helmy', role: '“The Godfather of Egyptian Design”', bio: 'A visionary known for redefining design through cultural revival and innovation. Since the 1980s he has pioneered the “7 years ahead” method, founded the Egyptian Designers Forum and launched the Talent Academy to nurture young creatives. His concepts include democratic design retail (Designy) and Egypt’s first innovation consultancy for businesses, with works like “Cairo 2200” fusing heritage with future-forward thinking.' },
  { img: 'img/founder-samer.jpg', name: 'Samer El Waziri', role: 'Finance Executive', bio: 'An Egyptian finance executive with over 30 years of experience in corporate finance, strategic leadership and operational excellence, including serving as Chairman and Senior Executive Officer at Raya Holding, where he led restructuring and international expansion in the frozen foods sector. He holds a Bachelor of Commerce from Cairo University and a management diploma from Harvard Business School.' }
];

function figures(site) {
  const k = site.keyFigures;
  const numerals = `<section class="sec kf kf-numerals" data-variant-of="why-figures" data-variant="numerals" aria-labelledby="hKf1">
    <div class="wrap">
      <div class="sec-head"><p class="eyebrow">Key figures</p><h2 class="h2" id="hKf1">A practice built <em>over years</em>, not seasons</h2></div>
      <dl class="kf-grid">${k.map(f => `<div class="kf-item" data-reveal><dt class="kf-v" data-count="${f.value}">${f.value}</dt><dd><span class="kf-l">${esc(f.label)}</span><span class="kf-d">${esc(f.detail)}</span></dd></div>`).join('')}</dl>
    </div>
  </section>`;
  // three offices projected from their real coordinates
  const pts = site.offices.map(o => ({ ...o, x: (o.lng - 18) / (60 - 18) * 1000, y: (40 - o.lat) / (40 - 21) * 460 }));
  const [ath, dxb, cai] = pts;
  const arc = (a, b, lift) => { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - lift; return `M${a.x.toFixed(0)},${a.y.toFixed(0)} Q${mx.toFixed(0)},${my.toFixed(0)} ${b.x.toFixed(0)},${b.y.toFixed(0)}`; };
  let dots = '';
  for (let gx = 0; gx <= 1000; gx += 25) for (let gy = 0; gy <= 460; gy += 25) dots += `<circle cx="${gx}" cy="${gy}" r="1"/>`;
  const map = `<section class="sec kf kf-map on-navy" data-variant-of="why-figures" data-variant="map" aria-labelledby="hKf2">
    <div class="wrap kf-map-grid">
      <div>
        <p class="eyebrow on-dark">Key figures</p><h2 class="h2" id="hKf2">Three offices, <em>one team</em></h2>
        <dl class="kf-list">${k.map(f => `<div><dt data-count="${f.value}">${f.value}</dt><dd><span class="kf-l">${esc(f.label)}</span><span class="kf-d">${esc(f.detail)}</span></dd></div>`).join('')}</dl>
      </div>
      <svg class="kf-net" viewBox="0 0 1000 460" role="img" aria-label="Netherfield offices in Athens, Dubai and Cairo">
        <g class="kf-dots">${dots}</g>
        <path class="kf-arc" d="${arc(ath, dxb, 120)}"/><path class="kf-arc" d="${arc(ath, cai, 40)}"/><path class="kf-arc" d="${arc(cai, dxb, 60)}"/>
        ${pts.map(p => `<g class="kf-office"><circle class="kf-halo" cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="22"/><circle class="kf-pt" cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="6"/><text x="${p.x.toFixed(0)}" y="${(p.y + 44).toFixed(0)}" text-anchor="middle">${esc(p.city)}</text><text class="kf-note" x="${p.x.toFixed(0)}" y="${(p.y + 68).toFixed(0)}" text-anchor="middle">${esc(p.note)}</text></g>`).join('')}
      </svg>
    </div>
  </section>`;
  const band = `<section class="kf kf-band" data-variant-of="why-figures" data-variant="band" aria-label="Key figures">
    <div class="wrap"><dl class="kf-band-grid">${k.map(f => `<div><dt data-count="${f.value}">${f.value}</dt><dd>${esc(f.label)}<span>${esc(f.detail)}</span></dd></div>`).join('')}</dl></div>
  </section>`;
  return numerals + map + band;
}

function founders() {
  return `<section class="sec founders" aria-labelledby="hFounders">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">Founders &amp; partners</p><h2 class="h2" id="hFounders">The people <em>behind the name</em></h2><p class="lede">Netherfield Developments is led by a seasoned team with deep expertise in real estate, construction, finance and design. We go beyond selling properties: we deliver secure, high-value investments backed by experience, integrity and personal support.</p></div>
    <div class="fd-grid">${FOUNDERS.map((f, i) => `<article class="fd" data-reveal>
      <figure class="fd-photo"><img src="${f.img}" width="600" height="800" alt="${esc(f.name)}" loading="lazy" decoding="async"></figure>
      <p class="fd-n">0${i + 1}</p>
      <h3 class="fd-name">${esc(f.name)}</h3>
      <p class="fd-role">${esc(f.role)}</p>
      <p class="fd-bio" id="fdBio${i}">${esc(f.bio)}</p>
      <button class="fd-more" type="button" aria-expanded="false" aria-controls="fdBio${i}">Read biography</button>
    </article>`).join('')}</div>
  </div>
</section>`;
}

export function whyPage(ctx) {
  const { site, properties } = ctx;
  const img = id => properties.find(p => p.id === id)?.photos?.[0];
  const mission = img('papandreou-21'), choose = img('electra');
  const media = (ph, alt) => ph ? `<figure class="wr-media"><img src="${ph.src}" width="${ph.w}" height="${ph.h}" alt="${esc(alt)}" loading="lazy" decoding="async"></figure>` : '';
  const content = [
    heroVariants('why-hero', { clip: 'athens', eyebrow: 'Why Netherfield', title: 'Led by experience, <em>built on trust</em>', lede: 'A seasoned team with deep expertise in real estate, construction, finance and design, delivering secure, high-value investments across Greece.', variants: ['cinema', 'scope', 'split'] }),
    `<section class="sec why-rows">
  <div class="wrap">
    <div class="wr" data-reveal>
      <div class="wr-text"><p class="eyebrow">Our mission</p><h2 class="h2">Confidence and clarity, <em>every step</em></h2><p>Our mission is to deliver high-quality properties and exceptional, end-to-end service that ensures every client makes the right investment decision, with confidence and clarity. We guide individuals and families from around the world through every step of the process, from property selection and legal support to relocation and rental management.</p></div>
      ${media(mission, 'Papandreou 21, a Netherfield residence in Kato Glyfada')}
    </div>
    <div class="wr wr-rev" data-reveal>
      <div class="wr-text"><p class="eyebrow">Why choose us</p><h2 class="h2">Deep market knowledge, <em>tailored guidance</em></h2><p>With a proven track record of successful property sales in London and Greece, we bring deep market knowledge and experience to each client we serve. Our team specialises in supporting Egyptians and expats across the Middle East, with tailored guidance from property selection and legal support to interior design and rental management.</p></div>
      ${media(choose, 'Electra, a completed Netherfield residence')}
    </div>
  </div>
</section>`,
    figures(site),
    founders(),
    `<section class="cta cta-light"><div class="wrap cta-in"><p class="eyebrow">Meet the team</p><h2 class="h2">Work with a team <em>that has done this before</em></h2><p>Let's talk about the right Golden Visa property for your family.</p><a class="btn btn-primary" href="contact.html">Book a consultation</a></div></section>`
  ].join('\n');
  return {
    path: 'why-netherfield.html', active: 'why', bodyClass: 'pg-why',
    title: 'Why Netherfield | Our Team, Mission and Key Figures',
    description: 'Meet the founders and partners behind Netherfield Developments: 12 years of experience, offices in Greece, Dubai and Cairo, and 12 projects delivered.',
    ogImage: 'img/hero/athens.jpg', options: OPTIONS, scripts: ['pages'],
    content
  };
}
