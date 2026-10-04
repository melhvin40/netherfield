// Golden Visa Benefits: hero, the programme at a glance (2024 thresholds), benefits, step-by-step guide, FAQ.
import { esc, icon, monthLabel } from '../lib/util.mjs';
import { heroVariants } from '../partials.mjs';

const OPTIONS = [
  { id: 'gv-hero', title: 'Golden Visa: hero', default: 'cinema', variants: [
    { id: 'cinema', label: 'Full-bleed film', note: 'Santorini’s caldera in slow motion behind the title.' },
    { id: 'scope', label: 'Cinemascope film', note: 'A wide band of film; the title sits below on paper.' },
    { id: 'split', label: 'Editorial frame', note: 'Title on paper beside the film in a framed panel.' }
  ] },
  { id: 'gv-benefits', title: 'Golden Visa: benefits', default: 'pillars', variants: [
    { id: 'pillars', label: 'Four pillars', note: 'Typographic and calm: numbered pillars on fine rules, no stock photography.' },
    { id: 'immersive', label: 'Immersive film', note: 'One large film frame that changes as you move through the four benefits.' },
    { id: 'panels', label: 'Gallery panels', note: 'Four tall panels; the one you point at opens to tell its story.' }
  ] },
  { id: 'gv-steps', title: 'Golden Visa: step-by-step guide', default: 'timeline', variants: [
    { id: 'timeline', label: 'Interactive timeline', note: 'Six steps on one line; select a step to read it.' },
    { id: 'story', label: 'Scrolling story', note: 'The steps light up one by one as you scroll.' },
    { id: 'grid', label: 'Quiet grid', note: 'All six steps at a glance on fine rules.' }
  ] },
  { id: 'gv-faq', title: 'Golden Visa: FAQ', default: 'index', variants: [
    { id: 'index', label: 'Indexed questions', note: 'Topics and a search on the left, numbered answers on the right.' },
    { id: 'pane', label: 'Reading pane', note: 'Pick a question; the answer opens beside it in large type.' },
    { id: 'cards', label: 'Question cards', note: 'A calm wall of questions that open where you click.' }
  ] }
];

const BENEFITS = [
  { n: 'I', key: 'healthcare', title: 'Healthcare', icon: 'medical', film: 'beach', text: 'Access quality healthcare in Greece and benefit from easier connections to trusted EU health systems.' },
  { n: 'II', key: 'investment', title: 'Investment', icon: 'chart', film: 'bay', text: 'Affordable entry to the EU, and an investment that pays back with an average 6% yearly rental income.' },
  { n: 'III', key: 'lifestyle', title: 'Lifestyle', icon: 'sun', film: 'caldera', text: 'A life of peace, safety and comfort awaits in Greece, tailored for families and retirees alike.' },
  { n: 'IV', key: 'education', title: 'Education', icon: 'school', film: 'athens', text: 'Access a strong European education system, from bilingual schools to respected universities across Greece and the EU.' }
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
    ['users', 'Family', 'Spouse, children under 21, parents'],
    ['clock', 'Minimum stay', 'None'],
    ['key', 'Investment', 'From €250,000, by route'],
    ['home', 'Renting out', 'Long-term lets allowed']
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
    <p class="fine gv-tiers-note">Thresholds introduced in 2024. Netherfield's advisors confirm the route that applies to each property before you reserve. General information, not legal advice.</p>
  </div>
</section>`;
}

function benefits() {
  const pillars = `<div class="gvb gvb-pillars" data-variant-of="gv-benefits" data-variant="pillars">
    <ol class="gvb-list">${BENEFITS.map(b => `<li class="gvb-item" data-reveal><span class="gvb-n">${b.n}</span>${icon(b.icon, 30)}<h3>${b.title}</h3><p>${b.text}</p></li>`).join('')}</ol>
  </div>`;
  const immersive = `<div class="gvb gvb-immersive" data-variant-of="gv-benefits" data-variant="immersive">
    <div class="gvb-stage">${BENEFITS.map((b, i) => `<video class="gvb-film${i ? '' : ' is-on'}" data-key="${b.key}" muted loop playsinline preload="none" poster="img/hero/${b.film}.jpg" aria-hidden="true"${i ? '' : ' data-autoplay'}><source src="video/${b.film}.mp4" type="video/mp4"><source src="video/${b.film}.webm" type="video/webm"></video>`).join('')}</div>
    <div class="gvb-tabs" role="tablist" aria-label="Benefits">${BENEFITS.map((b, i) => `<button class="gvb-tab" type="button" role="tab" aria-selected="${i === 0}" data-key="${b.key}"><span class="gvb-n">${b.n}</span><span class="gvb-tab-t">${b.title}</span><span class="gvb-tab-d">${b.text}</span></button>`).join('')}</div>
  </div>`;
  const panels = `<div class="gvb gvb-panels" data-variant-of="gv-benefits" data-variant="panels">
    ${BENEFITS.map((b, i) => `<button class="gvb-panel${i === 0 ? ' is-open' : ''}" type="button" aria-expanded="${i === 0}" style="background-image:url('img/hero/${b.film}.jpg')"><span class="gvb-panel-shade"></span><span class="gvb-n">${b.n}</span><span class="gvb-panel-t">${b.title}</span><span class="gvb-panel-d">${b.text}</span></button>`).join('')}
  </div>`;
  return `<section class="sec gv-benefits" aria-labelledby="hBenefits">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">Benefits</p><h2 class="h2" id="hBenefits">What residency in Greece <em>gives your family</em></h2></div>
    ${pillars}${immersive}${panels}
  </div>
</section>`;
}

function steps() {
  const head = `<p class="eyebrow on-dark">Step by step</p><h2 class="h2" id="hSteps">Step-by-step guide to the Golden Visa program and <em>legal services</em></h2><p class="gvs-lede">From business to retirement, your gateway to Europe starts here, with seamless relocation for you and your family.</p>`;
  const timeline = `<div class="gvs gvs-timeline" data-variant-of="gv-steps" data-variant="timeline">
    <div class="gvs-head">${head}</div>
    <div class="gvs-line" role="tablist" aria-label="Steps">${STEPS.map((s, i) => `<button class="gvs-dot" type="button" role="tab" aria-selected="${i === 0}" aria-controls="gvsPanel" data-step="${i}"><span class="gvs-dot-n">${String(i + 1).padStart(2, '0')}</span><span class="gvs-dot-t">${s.t}</span></button>`).join('')}<span class="gvs-progress" aria-hidden="true"></span></div>
    <div class="gvs-panel" id="gvsPanel" role="tabpanel" aria-live="polite">${STEPS.map((s, i) => `<div class="gvs-card" data-card="${i}"${i ? ' hidden' : ''}><span class="gvs-card-n">${String(i + 1).padStart(2, '0')}</span><div><p class="gvs-card-time">${s.time}</p><h3>${s.t}</h3><p>${s.d}</p></div></div>`).join('')}</div>
  </div>`;
  const story = `<div class="gvs gvs-story" data-variant-of="gv-steps" data-variant="story">
    <div class="gvs-story-aside"><div class="gvs-sticky">${head}<p class="gvs-big" aria-hidden="true"><span data-story-n>01</span><span class="gvs-big-of">/ 06</span></p></div></div>
    <ol class="gvs-story-list">${STEPS.map((s, i) => `<li class="gvs-story-item" data-story="${i}"><p class="gvs-card-time">${String(i + 1).padStart(2, '0')} &middot; ${s.time}</p><h3>${s.t}</h3><p>${s.d}</p></li>`).join('')}</ol>
  </div>`;
  const grid = `<div class="gvs gvs-grid" data-variant-of="gv-steps" data-variant="grid">
    <div class="gvs-head">${head}</div>
    <ol class="gvs-grid-list">${STEPS.map((s, i) => `<li data-reveal><span class="gvs-card-n">${String(i + 1).padStart(2, '0')}</span><p class="gvs-card-time">${s.time}</p><h3>${s.t}</h3><p>${s.d}</p></li>`).join('')}</ol>
  </div>`;
  return `<section class="sec gv-steps on-navy" aria-labelledby="hSteps"><div class="wrap">${timeline}${story}${grid}</div></section>`;
}

function faqSection(faq) {
  const cats = faq.categories;
  const items = faq.items.map((it, i) => ({ ...it, i, n: String(i + 1).padStart(2, '0') }));
  const index = `<div class="gvf gvf-index" data-variant-of="gv-faq" data-variant="index">
    <aside class="gvf-nav">
      <label class="gvf-search">${icon('search', 18)}<input type="search" placeholder="Search the questions" aria-label="Search the questions" data-faq-search></label>
      <div class="gvf-cats" role="group" aria-label="Topics"><button type="button" aria-pressed="true" data-faq-cat="">All topics</button>${cats.map(c => `<button type="button" aria-pressed="false" data-faq-cat="${c.id}">${esc(c.label)}</button>`).join('')}</div>
    </aside>
    <div class="gvf-list">${items.map(it => `<details class="gvf-q" data-cat="${it.cat}"${it.i === 0 ? ' open' : ''}><summary><span class="gvf-n">${it.n}</span><span class="gvf-t">${esc(it.q)}</span><span class="gvf-pm" aria-hidden="true"></span></summary><div class="gvf-a"><p>${esc(it.a)}</p></div></details>`).join('')}<p class="gvf-empty" hidden>No question matches. <a class="link-underline" href="contact.html">Ask us directly</a>.</p></div>
  </div>`;
  const pane = `<div class="gvf gvf-pane" data-variant-of="gv-faq" data-variant="pane">
    <div class="gvf-pane-list" role="tablist" aria-label="Questions" aria-orientation="vertical">${cats.map(c => `<p class="gvf-pane-cat">${esc(c.label)}</p>${items.filter(it => it.cat === c.id).map(it => `<button class="gvf-pane-q" type="button" role="tab" aria-selected="${it.i === 0}" data-q="${it.i}">${esc(it.q)}</button>`).join('')}`).join('')}</div>
    <div class="gvf-pane-read" role="tabpanel" aria-live="polite">${items.map(it => `<article class="gvf-pane-a" data-a="${it.i}"${it.i ? ' hidden' : ''}><p class="gvf-pane-n">${it.n} &middot; ${esc(cats.find(c => c.id === it.cat)?.label || '')}</p><h3>${esc(it.q)}</h3><p>${esc(it.a)}</p>${it.i < items.length - 1 ? `<button class="link-arrow" type="button" data-next="${it.i + 1}">Next question ${icon('arrow-right', 16)}</button>` : ''}</article>`).join('')}</div>
  </div>`;
  const cards = `<div class="gvf gvf-cards" data-variant-of="gv-faq" data-variant="cards">
    ${items.map(it => `<details class="gvf-card" data-reveal><summary><span class="gvf-n">${it.n}</span><span class="gvf-t">${esc(it.q)}</span><span class="gvf-card-more">Read the answer</span></summary><p>${esc(it.a)}</p></details>`).join('')}
  </div>`;
  return `<section class="sec gv-faq" id="faq" aria-labelledby="hFaq">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">Questions</p><h2 class="h2" id="hFaq">Golden Visa questions, <em>answered</em></h2><p class="lede">Clear answers to what families ask us most. Updated ${esc(monthLabel(faq.updated))}; general information, not legal or financial advice.</p></div>
    ${index}${pane}${cards}
  </div>
</section>`;
}

export function goldenVisaPage(ctx) {
  const { site, faq } = ctx;
  const content = [
    heroVariants('gv-hero', { clip: 'caldera', eyebrow: 'Golden Visa Benefits', title: 'Your path to a <em>European future</em>', lede: "Secure EU residency for you and your family through real estate in Greece, one of Europe's most accessible Golden Visa programmes.", variants: ['cinema', 'scope', 'split'], actions: '<div class="hh-ctas"><a class="btn btn-gold" href="contact.html">Book a consultation</a><a class="btn btn-line-light ph-ghost" href="#faq">Read the FAQ</a></div>' }),
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
    ogImage: 'img/hero/caldera.jpg', options: OPTIONS, scripts: ['gv'],
    jsonld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.items.map(it => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })) }],
    content
  };
}
