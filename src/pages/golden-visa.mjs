// Golden Visa Benefits: hero, the programme at a glance (2024 thresholds), benefits, step-by-step guide, FAQ.
import { esc, icon, monthLabel } from '../lib/util.mjs';
import { filmHero } from '../partials.mjs';
import { FILMS, BENEFIT_IMAGES } from '../media.mjs';

const BENEFITS = [
  { n: 'I', key: 'healthcare', title: 'Healthcare', text: 'Access quality healthcare in Greece and benefit from easier connections to trusted EU health systems.' },
  { n: 'II', key: 'investment', title: 'Investment', text: 'Affordable entry to the EU, and an investment that pays back with an average 6% yearly rental income.' },
  { n: 'III', key: 'lifestyle', title: 'Lifestyle', text: 'A life of peace, safety and comfort awaits in Greece, tailored for families and retirees alike.' },
  { n: 'IV', key: 'education', title: 'Education', text: 'Access a strong European education system, from bilingual schools to respected universities across Greece and the EU.' }
];

const STEPS = [
  { t: 'Consultation', time: 'Week 1', d: 'We map your goals, budget and family, and confirm which Golden Visa route fits you.' },
  { t: 'Property selection', time: 'Weeks 1–4', d: 'A shortlist of eligible homes with floor plans and yields; visits in person or by video call.' },
  { t: 'Legal checks', time: 'Weeks 2–6', d: 'Our lawyers verify title, permits and eligibility, and obtain your Greek tax number and bank account.' },
  { t: 'Purchase', time: 'Weeks 4–8', d: 'Contracts are signed before a notary and the price is paid by bank transfer, as the law requires.' },
  { t: 'Application', time: 'After purchase', d: 'We file the residence permit application and accompany you to your biometrics appointment.' },
  { t: 'Residence & relocation', time: 'Then', d: 'Permits for the whole family, and help with schools, healthcare, furnishing and long-term rental.' }
];

function glance(site) {
  const facts = [
    ['passport', 'Residence permit', '5 years, renewable'],
    ['globe', 'Travel', 'Schengen Area, 90 days in any 180'],
    ['users', 'Family', 'Spouse, children under 21, parents of both spouses'],
    ['clock', 'Minimum stay', 'None'],
    ['key', 'Investment', '€250,000 to €800,000, by area and route'],
    ['home', 'Renting out', 'Long-term leases only, no holiday lets']
  ];
  return `<section class="sec gv-glance" aria-labelledby="hGlance">
  <div class="wrap gv-glance-grid">
    <div class="gv-glance-head">
      <p class="eyebrow">At a glance</p>
      <h2 class="h2" id="hGlance">The programme, <em>simply put</em></h2>
      <p class="lede">Greece offers one of Europe's most straightforward residency-by-investment programmes. These are the essentials, as of ${esc(monthLabel(site.goldenVisa.updated))}.</p>
    </div>
    <dl class="gv-facts">${facts.map(([ic, k, v]) => `<div>${icon(ic, 26)}<dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </div>
  <div class="wrap">
    <div class="gv-tiers" role="table" aria-label="Investment thresholds since 2024">
      <div class="gv-tiers-head" role="row"><span role="columnheader">Threshold</span><span role="columnheader">Where</span><span role="columnheader">What qualifies</span></div>
      ${site.goldenVisa.tiers.map(t => `<div class="gv-tier" role="row"><span class="gv-tier-amt" role="cell">${esc(t.label)}</span><span role="cell">${esc(t.where)}</span><span role="cell">${esc(t.rule)}</span></div>`).join('')}
    </div>
    <p class="fine gv-tiers-note">Set by ${esc(site.goldenVisa.law || 'Law 5100/2024')}. Netherfield's advisors confirm the route that applies to each property before you reserve. General information, not legal advice.</p>
  </div>
</section>`;
}

function benefits() {
  return `<section class="sec gv-benefits" aria-labelledby="hBenefits">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">Benefits</p><h2 class="h2" id="hBenefits">What residency in Greece <em>gives your family</em></h2></div>
    <div class="gvb-panels">
      ${BENEFITS.map((b, i) => `<button class="gvb-panel${i === 0 ? ' is-open' : ''}" type="button" aria-expanded="${i === 0}" style="background-image:url('${BENEFIT_IMAGES[b.key]}')"><span class="gvb-panel-shade"></span><span class="gvb-n">${b.n}</span><span class="gvb-panel-t">${b.title}</span><span class="gvb-panel-d">${b.text}</span></button>`).join('')}
    </div>
  </div>
</section>`;
}

function steps() {
  return `<section class="sec gv-steps on-navy" aria-labelledby="hSteps"><div class="wrap">
  <div class="gvs gvs-timeline">
    <div class="gvs-head"><p class="eyebrow on-dark">Step by step</p><h2 class="h2" id="hSteps">Step-by-step guide to the Golden Visa program and <em>legal services</em></h2><p class="gvs-lede">From business to retirement, your gateway to Europe starts here, with seamless relocation for you and your family.</p></div>
    <div class="gvs-line" role="tablist" aria-label="Steps">${STEPS.map((s, i) => `<button class="gvs-dot" type="button" role="tab" aria-selected="${i === 0}" aria-controls="gvsPanel" data-step="${i}"><span class="gvs-dot-n">${String(i + 1).padStart(2, '0')}</span><span class="gvs-dot-t">${s.t}</span></button>`).join('')}<span class="gvs-progress" aria-hidden="true"></span></div>
    <div class="gvs-panel" id="gvsPanel" role="tabpanel" aria-live="polite">${STEPS.map((s, i) => `<div class="gvs-card" data-card="${i}"${i ? ' hidden' : ''}><span class="gvs-card-n">${String(i + 1).padStart(2, '0')}</span><div><p class="gvs-card-time">${s.time}</p><h3>${s.t}</h3><p>${s.d}</p></div></div>`).join('')}</div>
  </div>
</div></section>`;
}

function faqSection(faq) {
  const cats = faq.categories;
  const items = faq.items.map((it, i) => ({ ...it, i, n: String(i + 1).padStart(2, '0') }));
  const pane = `<div class="gvf gvf-pane">
    <div class="gvf-pane-list" role="tablist" aria-label="Questions" aria-orientation="vertical">${cats.map(c => `<p class="gvf-pane-cat">${esc(c.label)}</p>${items.filter(it => it.cat === c.id).map(it => `<button class="gvf-pane-q" type="button" role="tab" aria-selected="${it.i === 0}" data-q="${it.i}">${esc(it.q)}</button>`).join('')}`).join('')}</div>
    <div class="gvf-pane-read" role="tabpanel" aria-live="polite">${items.map(it => `<article class="gvf-pane-a" data-a="${it.i}"${it.i ? ' hidden' : ''}><p class="gvf-pane-n">${it.n} &middot; ${esc(cats.find(c => c.id === it.cat)?.label || '')}</p><h3>${esc(it.q)}</h3><p>${esc(it.a)}</p>${it.i < items.length - 1 ? `<button class="link-arrow" type="button" data-next="${it.i + 1}">Next question ${icon('arrow-right', 16)}</button>` : ''}</article>`).join('')}</div>
  </div>`;
  return `<section class="sec gv-faq" id="faq" aria-labelledby="hFaq">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">Questions</p><h2 class="h2" id="hFaq">Golden Visa questions, <em>answered</em></h2><p class="lede">Clear answers to what families ask us most. Updated ${esc(monthLabel(faq.updated))}; general information, not legal or financial advice.</p></div>
    ${pane}
  </div>
</section>`;
}

export function goldenVisaPage(ctx) {
  const { site, faq } = ctx;
  const content = [
    filmHero({ clip: FILMS.goldenVisa, eyebrow: 'Golden Visa Benefits', title: 'Your path to a <em>European future</em>', lede: "Secure EU residency for you and your family through real estate in Greece, one of Europe's most accessible Golden Visa programmes.", actions: '<div class="hh-ctas"><a class="btn btn-gold" href="contact.html">Book a consultation</a><a class="btn btn-line-light ph-ghost" href="#faq">Read the FAQ</a></div>' }),
    glance(site),
    benefits(),
    steps(),
    faqSection(faq),
    `<section class="cta cta-light"><div class="wrap cta-in"><p class="eyebrow">Begin</p><h2 class="h2">Start your <em>Golden Visa journey</em></h2><p>Book a free consultation and we will map out the clearest path to your residency.</p><a class="btn btn-primary" href="contact.html">Book a consultation</a></div></section>`
  ].join('\n');
  return {
    path: 'golden-visa-benefits.html', active: 'golden-visa', bodyClass: 'pg-gv',
    title: 'Greece Golden Visa: Benefits, Rules and Steps | Netherfield Developments',
    description: 'How the Greek Golden Visa works in 2026: investment thresholds, family, travel and residency benefits, the step-by-step process and answers to common questions.',
    ogImage: `img/hero/${FILMS.goldenVisa}.jpg`, scripts: ['gv'],
    jsonld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.items.map(it => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })) }],
    content
  };
}
