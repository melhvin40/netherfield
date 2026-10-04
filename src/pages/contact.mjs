// Contact / Book a consultation: details, office map, enquiry form (mailto; ?interest= preselects a property).
import { esc, icon } from '../lib/util.mjs';
import { isSold } from '../lib/model.mjs';

export function contactPage(ctx) {
  const { site, properties } = ctx;
  const avail = properties.filter(p => !isSold(p));
  const wa = site.whatsapp ? site.whatsapp.replace(/[^\d]/g, '') : '';
  const codes = [['+30', 'GR'], ['+20', 'EG'], ['+971', 'AE'], ['+966', 'SA'], ['+974', 'QA'], ['+965', 'KW'], ['+973', 'BH'], ['+968', 'OM'], ['+962', 'JO'], ['+961', 'LB'], ['+44', 'GB'], ['+49', 'DE'], ['+33', 'FR'], ['+39', 'IT'], ['+1', 'US'], ['+90', 'TR'], ['+7', 'RU'], ['+86', 'CN'], ['+91', 'IN']];
  const content = `<section class="ph ph-minimal ct-hero"><div class="wrap"><p class="eyebrow">Contact</p><h1 class="ph-title">Book a <em>consultation</em></h1><p class="ph-lede">Tell us a little about your plans. An advisor replies within one working day with availability, the Golden Visa route that fits you and a time to talk.</p></div></section>
<section class="sec-tight ct">
  <div class="wrap ct-grid">
    <div class="ct-info">
      <dl class="ct-dl">
        <div>${icon('pin', 22)}<dt>Office</dt><dd>${esc(site.address.street)}<br>${esc(site.address.postalCode)} ${esc(site.address.city)}, ${esc(site.address.country)}</dd></div>
        <div>${icon('mail', 22)}<dt>Email</dt><dd><a class="link-underline" href="mailto:${esc(site.email)}">${esc(site.email)}</a></dd></div>
        ${site.phone ? `<div>${icon('phone', 22)}<dt>Phone</dt><dd><a class="link-underline" href="tel:${esc(site.phone.replace(/\s+/g, ''))}">${esc(site.phone)}</a></dd></div>` : ''}
        ${wa ? `<div>${icon('whatsapp', 22)}<dt>WhatsApp</dt><dd><a class="link-underline" href="https://wa.me/${wa}" target="_blank" rel="noopener">Message us</a></dd></div>` : ''}
        <div>${icon('instagram', 22)}<dt>Instagram</dt><dd><a class="link-underline" href="${esc(site.instagram)}" target="_blank" rel="noopener">${esc(site.instagramHandle)}</a></dd></div>
        <div>${icon('globe', 22)}<dt>Offices</dt><dd>${site.offices.map(o => esc(o.city === 'Athens' ? 'Glyfada, Athens' : o.city)).join(' &middot; ')}</dd></div>
      </dl>
      <div class="ct-map" id="ctMap" data-lat="${site.address.lat}" data-lng="${site.address.lng}" role="region" aria-label="Map of the Netherfield office in Glyfada"></div>
      <a class="link-arrow ct-dir" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(site.address.street + ', ' + site.address.city)}" target="_blank" rel="noopener">Get directions ${icon('external', 16)}</a>
    </div>
    <form class="ct-form" id="contactForm" novalidate>
      <div class="ct-form-grid">
        <div class="field"><label for="cf-name">Full name</label><input class="input" id="cf-name" name="name" autocomplete="name" required></div>
        <div class="field"><label for="cf-email">Email</label><input class="input" id="cf-email" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="cf-phone">Phone</label><div class="pd-phone"><select class="select" name="cc" aria-label="Country code">${codes.map(([c, n]) => `<option value="${c}">${n} ${c}</option>`).join('')}</select><input class="input" id="cf-phone" name="phone" type="tel" autocomplete="tel-national" placeholder="Optional"></div></div>
        <div class="field"><label for="cf-interest">Interested in</label><select class="select" id="cf-interest" name="interest"><option value="General Golden Visa enquiry">General Golden Visa enquiry</option>${avail.map(p => `<option value="${esc(p.title)}">${esc(p.title)}</option>`).join('')}</select></div>
        <fieldset class="field ct-full"><legend class="label">Preferred contact</legend><div class="seg"><label><input type="radio" name="via" value="Email" checked><span>Email</span></label><label><input type="radio" name="via" value="Phone call"><span>Phone call</span></label><label><input type="radio" name="via" value="WhatsApp"><span>WhatsApp</span></label><label><input type="radio" name="via" value="Video call"><span>Video call</span></label></div></fieldset>
        <div class="field ct-full"><label for="cf-message">Message</label><textarea class="textarea" id="cf-message" name="message" placeholder="Your timeline, budget and who will be moving with you"></textarea></div>
        <label class="check ct-full"><input type="checkbox" name="consent" required><span>I agree to be contacted by ${esc(site.name)} about my enquiry.</span></label>
      </div>
      <button class="btn btn-primary" type="submit">Send &amp; open email ${icon('arrow-right', 16)}</button>
      <p class="fine ct-note">Submitting opens your email app with the message ready to send to ${esc(site.email)}. Nothing is sent automatically.</p>
      <p class="pd-form-ok" id="formSuccess" role="status" hidden>Opening your email app now.</p>
    </form>
  </div>
</section>`;
  return {
    path: 'contact.html', active: '', bodyClass: 'pg-contact',
    title: 'Book a Consultation | Netherfield Developments',
    description: `Contact ${site.name} to book a Golden Visa consultation. ${site.address.street}, ${site.address.city} ${site.address.postalCode}, Greece.`,
    ogImage: 'img/hero/mykonos.jpg', leaflet: true, scripts: ['pages'],
    data: { site: { email: site.email, maps: site.maps, name: site.name, currencies: site.currencies } },
    content
  };
}
