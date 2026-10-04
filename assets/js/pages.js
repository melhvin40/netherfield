// Why Netherfield (founder biographies) and Contact (office map, enquiry form).
import { pageData } from './core.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* founder biographies */
$$('.fd-more').forEach(b => b.addEventListener('click', () => {
  const bio = document.getElementById(b.getAttribute('aria-controls'));
  const open = bio.classList.toggle('is-open');
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  b.textContent = open ? 'Close biography' : 'Read biography';
}));

/* contact: office map */
const D = pageData() || {};
const ctMap = $('#ctMap');
if (ctMap && window.L && D.site) {
  const lat = Number(ctMap.dataset.lat), lng = Number(ctMap.dataset.lng);
  const m = L.map(ctMap, { scrollWheelZoom: false, center: [lat, lng], zoom: 16 });
  L.tileLayer(D.site.maps.tiles, { attribution: D.site.maps.tilesAttribution, maxZoom: 19, subdomains: 'abcd' }).addTo(m);
  L.marker([lat, lng], { icon: L.divIcon({ className: 'lm-wrap', html: '<span class="lm-pin">Netherfield</span>', iconSize: null }) }).addTo(m);
  m.on('click focus', () => m.scrollWheelZoom.enable());
}

/* contact: enquiry form -> email; ?interest= preselects a property (sold ones are added as an option) */
const form = $('#contactForm');
if (form) {
  const select = $('#cf-interest'), msg = $('#cf-message');
  const interest = new URLSearchParams(location.search).get('interest');
  if (interest && select) {
    let match = [...select.options].findIndex(o => o.value === interest);
    if (match === -1) { select.add(new Option(interest, interest)); match = select.options.length - 1; }
    select.selectedIndex = match;
    if (msg && !msg.value) msg.value = `I'm interested in ${interest}. Please share availability and pricing.`;
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form);
    const name = $('#cf-name'), email = $('#cf-email'), consent = $('[name="consent"]', form);
    let ok = true;
    [[name, v => v.trim()], [email, v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())]].forEach(([i, test]) => {
      const good = !!test(i.value); i.classList.toggle('is-invalid', !good); if (!good && ok) { i.focus(); ok = false; }
    });
    consent.closest('.check').classList.toggle('is-invalid', !consent.checked);
    if (!consent.checked) { if (ok) consent.focus(); ok = false; }
    if (!ok) return;
    const phone = f.get('phone') ? `${f.get('cc')} ${f.get('phone')}` : '';
    const subject = `Consultation request: ${f.get('interest')}`;
    const body = [`Name: ${f.get('name')}`, `Email: ${f.get('email')}`, phone ? `Phone: ${phone}` : '', `Interested in: ${f.get('interest')}`, `Preferred contact: ${f.get('via')}`, '', String(f.get('message') || '')].filter(Boolean).join('\n');
    $('#formSuccess').hidden = false;
    location.href = `mailto:${D.site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}
