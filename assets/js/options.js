// "Design options": a discreet review panel that switches between alternative designs of a section.
// Choices live in localStorage (nf-options) and in shareable links (?opt-<group>=<variant>).
// Hide it with ?options=off, bring it back with ?options=on.
import { pageData } from './core.js';

const groups = pageData('nf-options-data') || [];
const root = document.documentElement;
const read = () => { try { return JSON.parse(localStorage.getItem('nf-options') || '{}'); } catch (e) { return {}; } };
const write = v => { try { localStorage.setItem('nf-options', JSON.stringify(v)); } catch (e) {} };
const panelPref = () => { try { return localStorage.getItem('nf-options-panel'); } catch (e) { return null; } };

function current(g) { return read()[g.id] || g.default; }

function apply(groupId, variant, scroll) {
  const all = read();
  all[groupId] = variant;
  write(all);
  root.setAttribute('data-opt-' + groupId, variant);
  document.dispatchEvent(new CustomEvent('nf:options-change', { detail: { group: groupId, variant } }));
  if (scroll) {
    const target = document.querySelector(`[data-variant-of="${groupId}"][data-variant="${variant}"]`);
    if (target && target.getBoundingClientRect().height) {
      const r = target.getBoundingClientRect();
      if (r.top < 60 || r.top > innerHeight * .6) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function shareLink() {
  const u = new URL(location.href);
  [...u.searchParams.keys()].filter(k => k.startsWith('opt-') || k === 'options').forEach(k => u.searchParams.delete(k));
  groups.forEach(g => u.searchParams.set('opt-' + g.id, current(g)));
  return u.toString();
}

function build() {
  if (!groups.length || panelPref() === 'off') return;
  const wrap = document.createElement('div');
  wrap.className = 'opt';
  wrap.innerHTML = `
    <button class="opt-pill" type="button" aria-expanded="false" aria-controls="optPanel">
      <svg class="i" width="16" height="16" aria-hidden="true"><use href="#i-sliders"/></svg>
      <span>Design options</span><span class="opt-count">${groups.length}</span>
    </button>
    <section class="opt-panel" id="optPanel" hidden aria-label="Design options">
      <header class="opt-head">
        <div><p class="opt-title">Design options</p><p class="opt-sub">Click to compare. Your picks stay in this browser.</p></div>
        <button class="icon-btn opt-close" type="button" aria-label="Close design options"><svg class="i" width="20" height="20" aria-hidden="true"><use href="#i-close"/></svg></button>
      </header>
      <div class="opt-body">
        ${groups.map(g => `<fieldset class="opt-group">
          <legend>${g.title}</legend>
          ${g.variants.map(v => `<label class="opt-choice">
            <input type="radio" name="opt-${g.id}" value="${v.id}">
            <span class="opt-choice-text"><span class="opt-choice-label">${v.label}${v.id === g.default ? ' <em>recommended</em>' : ''}</span><span class="opt-choice-note">${v.note || ''}</span></span>
          </label>`).join('')}
        </fieldset>`).join('')}
      </div>
      <footer class="opt-foot">
        <button class="opt-link" type="button" data-act="copy">Copy link to this combination</button>
        <button class="opt-link" type="button" data-act="reset">Reset</button>
        <button class="opt-link" type="button" data-act="hide">Hide panel</button>
      </footer>
    </section>`;
  document.body.appendChild(wrap);
  // On narrower screens the page margin is too slim for the side tab, so the panel opens from the header.
  const hdrBtn = document.createElement('button');
  hdrBtn.className = 'hdr-icon opt-hdr';
  hdrBtn.type = 'button';
  hdrBtn.setAttribute('aria-label', 'Design options');
  hdrBtn.setAttribute('aria-expanded', 'false');
  hdrBtn.setAttribute('aria-controls', 'optPanel');
  hdrBtn.innerHTML = `<svg class="i" width="20" height="20" aria-hidden="true"><use href="#i-sliders"/></svg><span class="hdr-badge">${groups.length}</span>`;
  const act = document.querySelector('.hdr-act');
  if (act) act.insertBefore(hdrBtn, act.querySelector('.hdr-burger'));
  const pill = wrap.querySelector('.opt-pill');
  const panel = wrap.querySelector('.opt-panel');
  let trigger = pill;
  const sync = () => groups.forEach(g => { const r = wrap.querySelector(`input[name="opt-${g.id}"][value="${current(g)}"]`); if (r) r.checked = true; });
  const open = on => {
    panel.hidden = !on;
    [pill, hdrBtn].forEach(b => b.setAttribute('aria-expanded', on ? 'true' : 'false'));
    if (on) sync();
  };
  const toggle = b => { trigger = b; open(panel.hidden); };
  pill.addEventListener('click', () => toggle(pill));
  hdrBtn.addEventListener('click', () => toggle(hdrBtn));
  wrap.querySelector('.opt-close').addEventListener('click', () => { open(false); trigger.focus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { open(false); trigger.focus(); } });
  wrap.addEventListener('change', e => {
    const input = e.target.closest('input[type="radio"]');
    if (input) apply(input.name.slice(4), input.value, true);
  });
  wrap.querySelector('[data-act="copy"]').addEventListener('click', async e => {
    const link = shareLink();
    try { await navigator.clipboard.writeText(link); e.target.textContent = 'Link copied'; }
    catch (err) { prompt('Copy this link:', link); }
    setTimeout(() => { e.target.textContent = 'Copy link to this combination'; }, 2200);
  });
  wrap.querySelector('[data-act="reset"]').addEventListener('click', () => { groups.forEach(g => apply(g.id, g.default, false)); sync(); });
  wrap.querySelector('[data-act="hide"]').addEventListener('click', () => {
    try { localStorage.setItem('nf-options-panel', 'off'); } catch (e) {}
    wrap.remove();
    hdrBtn.remove();
  });
  sync();
}

build();
