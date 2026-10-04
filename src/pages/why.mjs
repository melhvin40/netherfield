// Why Netherfield: hero, mission, why choose us, key figures, founders & partners.
import { esc } from '../lib/util.mjs';
import { filmHero } from '../partials.mjs';
import { FILMS, WHY_IMAGES } from '../media.mjs';

const FOUNDERS = [
  { img: 'img/founder-mostafa.jpg', name: 'Mostafa El Shibini', role: 'Managing Partner', bio: 'With over 30 years of experience in legal, financial and real estate consulting, Mostafa brings industry knowledge and strategic insight to every project. As the leader of Netherfield Developments, he focuses on delivering high-end real estate solutions with a specialty in Golden Visa investments in Greece and England. Also a Managing Partner at Redcon for Real Estate and the Egyptian International Consulting Group, his cross-border expertise connects investors from the Middle East with high-potential opportunities in Europe.' },
  { img: 'img/founder-amr-abou.jpg', name: 'Amr Abou El Seoud', role: 'Chairman & Non-Executive Director, Tejara Capital Ltd', bio: 'A seasoned finance executive with over two decades in investment banking, corporate governance and strategic leadership. A Certified Public Accountant, he has held roles including Chairman and Senior Executive Officer at Tejara Capital, and served on the boards of companies including Aston Martin Lagonda and Investment Dar. Amr played a pivotal role in high-profile transactions, including the acquisition and IPO of Aston Martin, with expertise spanning Sharia-compliant finance and cross-border investment.' },
  { img: 'img/founder-amr-helmy.jpg', name: 'Amr Helmy', role: '“The Godfather of Egyptian Design”', bio: 'A visionary known for redefining design through cultural revival and innovation. Since the 1980s he has pioneered the “7 years ahead” method, founded the Egyptian Designers Forum and launched the Talent Academy to nurture young creatives. His concepts include democratic design retail (Designy) and Egypt’s first innovation consultancy for businesses, with works like “Cairo 2200” fusing heritage with future-forward thinking.' },
  { img: 'img/founder-samer.jpg', name: 'Samer El Waziri', role: 'Finance Executive', bio: 'An Egyptian finance executive with over 30 years of experience in corporate finance, strategic leadership and operational excellence, including serving as Chairman and Senior Executive Officer at Raya Holding, where he led restructuring and international expansion in the frozen foods sector. He holds a Bachelor of Commerce from Cairo University and a management diploma from Harvard Business School.' }
];

function figures(site) {
  return `<section class="sec kf kf-numerals" aria-labelledby="hKf">
    <div class="wrap">
      <div class="sec-head"><p class="eyebrow">Key figures</p><h2 class="h2" id="hKf">A practice built <em>over years</em>, not seasons</h2></div>
      <dl class="kf-grid">${site.keyFigures.map(f => `<div class="kf-item" data-reveal><dt class="kf-v" data-count="${f.value}">${f.value}</dt><dd><span class="kf-l">${esc(f.label)}</span><span class="kf-d">${esc(f.detail)}</span></dd></div>`).join('')}</dl>
    </div>
  </section>`;
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
  const { site } = ctx;
  const media = im => `<figure class="wr-media"><img src="${im.src}" width="${im.w}" height="${im.h}" alt="${esc(im.alt)}" loading="lazy" decoding="async"></figure>`;
  const content = [
    filmHero({ clip: FILMS.why, eyebrow: 'Why Netherfield', title: 'Led by experience, <em>built on trust</em>', lede: 'A seasoned team with deep expertise in real estate, construction, finance and design, delivering secure, high-value investments across Greece.' }),
    `<section class="sec why-rows">
  <div class="wrap">
    <div class="wr" data-reveal>
      <div class="wr-text"><p class="eyebrow">Our mission</p><h2 class="h2">Confidence and clarity, <em>every step</em></h2><p>Our mission is to deliver high-quality properties and exceptional, end-to-end service that ensures every client makes the right investment decision, with confidence and clarity. We guide individuals and families from around the world through every step of the process, from property selection and legal support to relocation and rental management.</p></div>
      ${media(WHY_IMAGES.mission)}
    </div>
    <div class="wr wr-rev" data-reveal>
      <div class="wr-text"><p class="eyebrow">Why choose us</p><h2 class="h2">Deep market knowledge, <em>tailored guidance</em></h2><p>With a proven track record of successful property sales in London and Greece, we bring deep market knowledge and experience to each client we serve. Our team specialises in supporting Egyptians and expats across the Middle East, with tailored guidance from property selection and legal support to interior design and rental management.</p></div>
      ${media(WHY_IMAGES.choose)}
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
    ogImage: `img/hero/${FILMS.why}.jpg`, scripts: ['pages'],
    content
  };
}
