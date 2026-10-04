// Testimonials ("Client stories"): persuasion without invented reviews. Real proof (figures, delivered
// projects, the service promise) and a story component that fills itself from data/testimonials.json.
import { esc, icon } from '../lib/util.mjs';
import { heroVariants } from '../partials.mjs';
import { pageUrl, isSold, locationLine } from '../lib/model.mjs';

const OPTIONS = [
  { id: 'stories', title: 'Testimonials: client stories block', default: 'live', variants: [
    { id: 'live', label: 'As published', note: 'Shows real stories once the agency adds them in the admin; until then, an invitation to speak with an owner.' },
    { id: 'preview', label: 'Preview the story layout', note: 'Placeholder cards, clearly marked, to judge the design before real stories arrive.' }
  ] }
];

const PROMISE = [
  ['users', 'One team, start to finish', 'Property selection, legal work, relocation, interior design and rental management, handled by people who know your file.'],
  ['scales', 'Clarity before commitment', 'A full cost breakdown and the Golden Visa route confirmed in writing before you reserve anything.'],
  ['shield', 'Checked, residency-ready homes', 'Title, permits and eligibility verified by our legal partners before a property reaches your shortlist.'],
  ['school', 'Families first', 'Schools, healthcare and the practicalities of a move, planned around the people who are moving.'],
  ['key', 'After the keys', 'Furnishing, long-term tenants and upkeep, so your home keeps working for you when you are away.']
];

function storyCards(list, sample) {
  return list.map(t => `<figure class="st${sample ? ' st-sample' : ''}">
    ${sample ? '<span class="st-flag">Sample layout</span>' : ''}
    ${icon('quote', 30)}
    <blockquote><p>${esc(t.quote)}</p></blockquote>
    <figcaption><span class="st-name">${esc(t.name)}</span><span class="st-meta">${esc([t.from, t.property].filter(Boolean).join(' · '))}</span></figcaption>
  </figure>`).join('');
}

export function testimonialsPage(ctx) {
  const { site, properties, testimonials } = ctx;
  const delivered = properties.filter(isSold);
  const k = site.keyFigures;
  const sample = [
    { quote: 'A sentence or two from the family, in their own words: why they chose Greece, how the purchase went, what the team made easier.', name: 'Client name', from: 'Home city', property: 'Property' },
    { quote: 'Stories are published only with the client’s written consent, and can be anonymised to first names or initials.', name: 'Client name', from: 'Home city', property: 'Property' },
    { quote: 'Short is better: two or three lines read beautifully here. Longer stories open on their own page.', name: 'Client name', from: 'Home city', property: 'Property' }
  ];
  const live = testimonials.length
    ? `<div class="st-grid">${storyCards(testimonials, false)}</div>`
    : `<div class="st-invite">
        <div class="st-invite-text">
          <p class="st-invite-h">Hear it from an owner</p>
          <p>We publish client stories only with their consent, and the first are being written now. In the meantime, we will gladly connect you with a Netherfield owner who has agreed to speak with prospective buyers.</p>
        </div>
        <a class="btn btn-primary" href="mailto:${esc(site.email)}?subject=${encodeURIComponent('Reference request')}&amp;body=${encodeURIComponent('I would like to speak with a Netherfield owner before I decide.\n\nName:\nPhone:\nBest time to call:')}">Request a reference call</a>
      </div>`;
  const content = [
    heroVariants('stories-hero', { clip: 'beach', eyebrow: 'Testimonials', title: 'Trust, earned <em>one family at a time</em>', lede: 'For most of our clients a Greek home is also a new chapter. Here is what working with Netherfield looks like, and how to hear it first-hand.', variants: ['scope'] }),
    `<section class="sec-tight proof" aria-label="Netherfield in figures">
  <div class="wrap"><dl class="proof-grid">
    ${k.map(f => `<div><dt data-count="${f.value}">${f.value}</dt><dd>${esc(f.label)}</dd></div>`).join('')}
    <div><dt data-count="${delivered.length}">${delivered.length}</dt><dd>Homes delivered</dd></div>
  </dl></div>
</section>`,
    `<section class="sec stories" aria-labelledby="hStories">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">In their words</p><h2 class="h2" id="hStories">Client stories</h2></div>
    <div data-variant-of="stories" data-variant="live">${live}</div>
    <div data-variant-of="stories" data-variant="preview"><div class="st-grid">${storyCards(sample, true)}</div></div>
  </div>
</section>`,
    `<section class="sec delivered" aria-labelledby="hDelivered">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">Delivered</p><h2 class="h2" id="hDelivered">Homes we have <em>handed over</em></h2><p class="lede">Every building here is complete and in its owners' hands. Ask us about any of them: the people who live there are our best references.</p></div>
    <div class="dv-grid">${delivered.map(p => { const ph = p.photos?.[0]; return `<a class="dv" href="${pageUrl(p)}" data-reveal>
      <span class="dv-img">${ph ? `<img src="${esc(ph.card || ph.src)}" width="${ph.card ? ph.cw : ph.w}" height="${ph.card ? ph.ch : ph.h}" alt="${esc(p.title)}" loading="lazy" decoding="async">` : ''}</span>
      <span class="dv-t">${esc(p.title)}</span><span class="dv-l">${esc(locationLine(p))} &middot; Delivered</span></a>`; }).join('')}</div>
  </div>
</section>`,
    `<section class="sec promise on-navy" aria-labelledby="hPromise">
  <div class="wrap promise-grid">
    <div class="promise-head"><p class="eyebrow on-dark">The Netherfield promise</p><h2 class="h2" id="hPromise">What every client <em>can count on</em></h2></div>
    <ol class="promise-list">${PROMISE.map(([ic, t, d], i) => `<li data-reveal><span class="promise-n">0${i + 1}</span>${icon(ic, 28)}<h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
  </div>
</section>`,
    `<section class="cta cta-light"><div class="wrap cta-in"><p class="eyebrow">Your story</p><h2 class="h2">Be among <em>our first stories</em></h2><p>Start your own Golden Visa journey with Netherfield.</p><a class="btn btn-primary" href="contact.html">Book a consultation</a></div></section>`
  ].join('\n');
  return {
    path: 'testimonials.html', active: 'testimonials', bodyClass: 'pg-stories',
    title: 'Client Stories | Netherfield Developments',
    description: 'How Netherfield works with families buying a Golden Visa home in Greece: delivered projects, our service promise and how to speak with an owner.',
    ogImage: 'img/hero/beach.jpg', options: OPTIONS,
    content
  };
}
