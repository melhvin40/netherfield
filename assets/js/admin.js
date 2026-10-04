// Netherfield Studio (admin.html): the agency's back office.
// Listings with photos, video, 3D tour, floor plans and map position; the JamesEdition feature list;
// listing categories, property types and areas; client stories; the Golden Visa FAQ; site settings.
// "Publish" saves every change as one commit in the GitHub repository (fine-grained token with
// Contents: read and write); the Pages workflow then rebuilds the website from data/*.json.
// "Work offline" needs no token: the changes are exported as a ZIP file for the developer.
// Previews reuse the site's own templates from src/, so they match the published pages exactly.
import { esc, icon, slugify, formatMoney, youtubeId, vimeoId, plural } from '../../src/lib/util.mjs';
import { newId, pageUrl, typeOf, marketOf, locationLine, isSold, pricePerSqm } from '../../src/lib/model.mjs';
import { matchesCategory, STATUSES } from '../../src/lib/search.mjs';
import { layout } from '../../src/partials.mjs';
import { propertyPage } from '../../src/pages/property.mjs';
import { cardHTML } from '../../src/templates/card.mjs';
import { sprite, ICON_NAMES } from '../../src/templates/icons.mjs';
import { toast, trapFocus } from './core.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const M = $('#admMain');

const API = 'https://api.github.com';
const AUTH_KEY = 'nf-admin-auth';
const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
const FILES = [
  { key: 'site', path: 'data/site.json' },
  { key: 'tax', path: 'data/taxonomy.json' },
  { key: 'props', path: 'data/properties.json' },
  { key: 'faq', path: 'data/faq.json' },
  { key: 'stories', path: 'data/testimonials.json', optional: true }
];
const file = key => FILES.find(f => f.key === key);
const STORIES_FILE = {
  _comment: "Client stories shown on testimonials.html, in this order. A story is published only when 'consent' is true (the client agreed in writing). Edited in admin.html.",
  testimonials: []
};
const FALLBACK_REPO = { owner: 'melhvin40', name: 'netherfield', branch: 'main' };
const PHOTO_MAX = 2400, CARD_MAX = 960, LQIP_MAX = 28, LOW_RES = 1600;
const STREET_RE = /^https:\/\/www\.google\.[a-z.]+\/maps\/embed/i;
const UI_ICONS = new Set(['menu', 'close', 'arrow-right', 'arrow-left', 'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right', 'search', 'sliders', 'plus', 'minus', 'external', 'share', 'copy', 'logout', 'edit', 'trash', 'download', 'upload', 'reset', 'move', 'x', 'facebook', 'linkedin', 'instagram', 'whatsapp', 'grid', 'list', 'bell', 'heart', 'eye', 'lock']);

const S = {
  mode: null,            // 'github' | 'offline'
  auth: null,            // { token, owner, name, branch, login }
  head: null,            // commit the data was loaded from (github mode)
  base: {},              // normalised JSON text of each file as loaded (null: file does not exist yet)
  baseObj: {},           // parsed copies of the loaded data, for change summaries
  d: {},                 // working copies, edited in place
  uploads: new Map(),    // repo path -> Blob: images added in this session, not yet published
  local: new Map(),      // repo path -> object URL, so new images show before the website has them
  maps: [],              // Leaflet maps of the current view
  ui: { q: '', status: 'all' },
  repoDefaults: FALLBACK_REPO,
  signInError: '',
  busy: false
};
const site = () => S.d.site;
const tax = () => S.d.tax;
const props = () => S.d.props.properties;
const stories = () => S.d.stories.testimonials;
const ser = o => JSON.stringify(o, null, 2) + '\n';
const clone = o => JSON.parse(JSON.stringify(o));
const thisMonth = () => new Date().toISOString().slice(0, 7);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const srcOf = path => S.local.get(path) || path;

/* ------------------------------------------------------------------ token storage */
function readAuth() {
  for (const store of [sessionStorage, localStorage]) {
    try { const a = JSON.parse(store.getItem(AUTH_KEY) || 'null'); if (a && a.token) return a; } catch (e) { /* storage blocked */ }
  }
  return null;
}
function writeAuth(a, remember) {
  forgetAuth();
  try { (remember ? localStorage : sessionStorage).setItem(AUTH_KEY, JSON.stringify({ token: a.token, owner: a.owner, name: a.name, branch: a.branch })); } catch (e) { /* this tab only */ }
}
function forgetAuth() {
  for (const store of [sessionStorage, localStorage]) { try { store.removeItem(AUTH_KEY); } catch (e) { /* ignore */ } }
}

/* ------------------------------------------------------------------ GitHub API */
const repoPath = () => `/repos/${encodeURIComponent(S.auth.owner)}/${encodeURIComponent(S.auth.name)}`;
const branchRef = () => S.auth.branch.split('/').map(encodeURIComponent).join('/');

async function gh(path, { method = 'GET', body, raw = false } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method, cache: 'no-store',
      headers: {
        Authorization: `Bearer ${S.auth.token}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw Object.assign(new Error('GitHub could not be reached. Check the internet connection and try again.'), { status: 0 });
  }
  if (!res.ok) {
    let message = '';
    try { message = (await res.json()).message || ''; } catch (e) { /* not JSON */ }
    throw Object.assign(new Error(message || `GitHub answered with status ${res.status}.`), { status: res.status });
  }
  if (raw) return res.text();
  return res.status === 204 ? null : res.json();
}

function explain(e, what = '') {
  const s = e.status, m = e.message || '';
  if (s === 401) return 'GitHub did not accept the token. It may have expired or been revoked: create a new one and sign in again.';
  if (s === 403 && /rate limit/i.test(m)) return 'GitHub’s request limit was reached. Wait a few minutes, then try again.';
  if (s === 403) return 'The token is not allowed to do this. On GitHub, edit the token: Repository access must include this repository, and Repository permissions → Contents must be “Read and write”.';
  if (s === 404 && what === 'repo') return `Repository ${S.auth.owner}/${S.auth.name} was not found, or the token has no access to it.`;
  if (s === 404 && what === 'branch') return `Branch “${S.auth.branch}” was not found in ${S.auth.owner}/${S.auth.name}.`;
  if (s === 409) return 'GitHub reported a conflict (the branch may be empty or being updated). Try again in a moment.';
  if (s === 422) return 'GitHub rejected the update' + (m ? `: ${m}` : '.');
  return m || 'Something went wrong.';
}
const fail = (e, what) => { throw Object.assign(new Error(explain(e, what)), { status: e.status }); };

/* ------------------------------------------------------------------ loading data */
async function loadFromGithub() {
  const R = repoPath();
  const repo = await gh(R).catch(e => fail(e, 'repo'));
  if (repo.permissions && repo.permissions.push === false) {
    throw new Error(`Your GitHub account can read ${repo.full_name} but cannot change it. Ask the owner for write access.`);
  }
  const ref = await gh(`${R}/git/ref/heads/${branchRef()}`).catch(e => fail(e, 'branch'));
  const user = await gh('/user').catch(() => null);
  const head = ref.object.sha;
  const texts = await Promise.all(FILES.map(f => gh(`${R}/contents/${f.path}?ref=${head}`, { raw: true })
    .catch(e => { if (e.status === 404 && f.optional) return null; throw new Error(`${f.path}: ${explain(e)}`); })));
  S.auth.login = user?.login || '';
  S.head = head;
  setData(texts);
}

async function loadFromWebsite() {
  const texts = await Promise.all(FILES.map(f => fetch(`${f.path}?t=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.ok ? r.text() : (f.optional && r.status === 404 ? null : Promise.reject(new Error(`${f.path} could not be loaded (${r.status}).`))))));
  S.head = null;
  setData(texts);
}

function setData(texts) {
  FILES.forEach((f, i) => {
    const obj = texts[i] == null ? clone(STORIES_FILE) : JSON.parse(texts[i]);
    if (f.key === 'stories' && !Array.isArray(obj.testimonials)) obj.testimonials = [];
    S.base[f.key] = texts[i] == null ? null : ser(obj);
    S.baseObj[f.key] = clone(obj);
    S.d[f.key] = obj;
  });
  S.uploads.clear();
}

/* ------------------------------------------------------------------ change tracking */
function fileChanged(f) {
  if (S.base[f.key] == null) return f.key !== 'stories' || stories().length > 0;
  return ser(S.d[f.key]) !== S.base[f.key];
}
function imageRefs(list) {
  const out = new Set();
  for (const p of list || []) {
    for (const ph of p.photos || []) { if (ph.src) out.add(ph.src); if (ph.card) out.add(ph.card); }
    for (const fp of p.floorplans || []) if (fp.src) out.add(fp.src);
  }
  return out;
}
function newImages() {
  const used = imageRefs(props());
  return [...S.uploads.keys()].filter(p => used.has(p));
}
function droppedImages() {
  const used = imageRefs(props());
  return [...imageRefs(S.baseObj.props.properties)].filter(p => !used.has(p) && p.startsWith('img/properties/'));
}
const snapshot = list => new Map((list || []).map(x => [x.id, JSON.stringify(x)]));
function diff(before, after) {
  const b = snapshot(before), a = snapshot(after);
  return {
    added: (after || []).filter(x => !b.has(x.id)),
    removed: (before || []).filter(x => !a.has(x.id)),
    edited: (after || []).filter(x => b.has(x.id) && b.get(x.id) !== JSON.stringify(x))
  };
}
function changes() {
  const out = [];
  const add = (ic, text, href = '') => out.push({ icon: ic, text, href });
  const p = diff(S.baseObj.props.properties, props());
  p.added.forEach(x => add('plus', `New property: ${x.title || x.id}`, `#/property/${encodeURIComponent(x.id)}`));
  p.edited.forEach(x => add('edit', `Edited property: ${x.title || x.id}`, `#/property/${encodeURIComponent(x.id)}`));
  p.removed.forEach(x => add('trash', `Removed property: ${x.title || x.id}`));
  if (!p.added.length && !p.edited.length && !p.removed.length && fileChanged(file('props'))) add('list', 'Order of the properties', '#/properties');
  let taxLines = 0;
  for (const [k, name, href] of [['features', 'feature', '#/features'], ['categories', 'category', '#/categories'], ['propertyTypes', 'property type', '#/types'], ['markets', 'area', '#/areas']]) {
    const d = diff(S.baseObj.tax[k], tax()[k]);
    d.added.forEach(x => { taxLines++; add('plus', `New ${name}: ${x.label}`, href); });
    d.edited.forEach(x => { taxLines++; add('edit', `Edited ${name}: ${x.label}`, href); });
    d.removed.forEach(x => { taxLines++; add('trash', `Removed ${name}: ${x.label}`); });
  }
  if (!taxLines && fileChanged(file('tax'))) add('list', 'Order of features, categories, types or areas', '#/features');
  if (fileChanged(file('site'))) add('sliders', 'Settings', '#/settings');
  if (fileChanged(file('faq'))) add('info', 'Golden Visa FAQ', '#/faq');
  if (fileChanged(file('stories'))) add('quote', 'Client stories', '#/stories');
  const up = newImages().length, rm = droppedImages().length;
  if (up) add('upload', `${up} new image ${plural(up, 'file')}`);
  if (rm) add('trash', `${rm} image ${plural(rm, 'file')} no longer used, to be removed`);
  return out;
}
const hasChanges = () => !!S.mode && (FILES.some(fileChanged) || newImages().length > 0);

let paintTimer;
function touched() {
  clearTimeout(paintTimer);
  paintTimer = setTimeout(paintChanges, 250);
}
function paintChanges() {
  const n = S.mode ? changes().length : 0;
  $$('[data-changes]').forEach(el => { el.hidden = !n; });
  $$('[data-changes-n]').forEach(el => { el.textContent = n; });
}

/* ------------------------------------------------------------------ validation */
function problems() {
  const errs = [], warns = [];
  const seen = new Set();
  for (const p of props()) {
    const href = `#/property/${encodeURIComponent(p.id)}`, name = p.title || p.id;
    if (!String(p.title || '').trim()) errs.push({ text: `A property has no title (${p.id}).`, href });
    if (seen.has(p.id)) errs.push({ text: `Two properties use the page address ${p.id}.`, href });
    seen.add(p.id);
    if (!isSold(p) && !p.priceOnRequest && !(p.price > 0)) errs.push({ text: `${name}: add a price or switch on “Price on request”.`, href });
    if (p.location?.lat == null || p.location?.lng == null) errs.push({ text: `${name}: place the pin on the map.`, href });
    if (!tax().propertyTypes.some(t => t.id === p.type)) errs.push({ text: `${name}: choose a property type.`, href });
    if (p.video && !youtubeId(p.video) && !vimeoId(p.video)) errs.push({ text: `${name}: the video link is not a YouTube or Vimeo link.`, href });
    if (p.virtualTour && !/^https:\/\//i.test(p.virtualTour)) errs.push({ text: `${name}: the 3D tour link must start with https://.`, href });
    if (p.streetView && !STREET_RE.test(p.streetView)) errs.push({ text: `${name}: the Street View embed is not a Google Maps embed link.`, href });
    if (!(p.photos || []).length) warns.push({ text: `${name}: no photos yet.`, href });
    if (!(p.description || []).length) warns.push({ text: `${name}: no description yet.`, href });
  }
  tax().features.forEach(f => { if (!String(f.label || '').trim()) errs.push({ text: `A feature has no name (${f.id}).`, href: '#/features' }); });
  tax().categories.forEach(c => { if (!String(c.label || '').trim()) errs.push({ text: `A category has no name (${c.id}).`, href: '#/categories' }); });
  stories().forEach((s, i) => {
    if (!s.consent) warns.push({ text: `Client story ${i + 1} stays hidden until consent is confirmed.`, href: '#/stories' });
    else if (!String(s.quote || '').trim() || !String(s.name || '').trim()) errs.push({ text: `Client story ${i + 1} needs a quote and a name.`, href: '#/stories' });
  });
  S.d.faq.items.forEach((it, i) => {
    if (!String(it.q || '').trim() || !String(it.a || '').trim()) errs.push({ text: `FAQ question ${i + 1} needs both a question and an answer.`, href: '#/faq' });
  });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(site().email || '')) errs.push({ text: 'Settings: the email address is not valid.', href: '#/settings' });
  return { errs, warns };
}

/* ------------------------------------------------------------------ markup helpers */
let seq = 0;
const uid = () => 'a' + (++seq);
const head = (eyebrow, title, sub = '', actions = '') => `<header class="adm-head"><div class="adm-head-l"><p class="eyebrow">${eyebrow}</p><h1 class="adm-h1">${title}</h1>${sub ? `<p class="adm-sub">${sub}</p>` : ''}</div>${actions ? `<div class="adm-head-act">${actions}</div>` : ''}</header>`;
const field = (id, label, control, o = {}) => `<div class="field${o.cls ? ' ' + o.cls : ''}"><label for="${id}">${label}</label>${control}${o.hint ? `<p class="adm-hint">${o.hint}</p>` : ''}</div>`;
function input(k, label, value, o = {}) {
  const id = uid();
  return field(id, label, `<input class="input" id="${id}" type="${o.type || 'text'}" data-k="${k}"${o.kind ? ` data-type="${o.kind}"` : ''} value="${esc(value ?? '')}"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${o.attrs || ''}>`, o);
}
function textarea(k, label, value, o = {}) {
  const id = uid();
  return field(id, label, `<textarea class="textarea" id="${id}" data-k="${k}"${o.kind ? ` data-type="${o.kind}"` : ''} rows="${o.rows || 4}"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}>${esc(value ?? '')}</textarea>`, o);
}
function select(k, label, value, options, o = {}) {
  const id = uid();
  return field(id, label, `<select class="select" id="${id}" data-k="${k}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${o.after || ''}`, o);
}
function toggle(k, label, on, hint = '') {
  return `<label class="adm-toggle-row"><span class="adm-switch"><input type="checkbox" data-k="${k}"${on ? ' checked' : ''}><span aria-hidden="true"></span></span><span class="adm-toggle-text"><span class="adm-toggle-l">${label}</span>${hint ? `<span class="adm-hint">${hint}</span>` : ''}</span></label>`;
}
function iconSelect(value, attrs, label = 'Icon') {
  return `<span class="adm-iconsel"><span class="adm-iconsel-prev" aria-hidden="true">${icon(value || 'check', 20)}</span><select class="select input-sm" data-icon-select ${attrs} aria-label="${label}">${ICON_NAMES.filter(n => !UI_ICONS.has(n)).map(n => `<option value="${n}"${n === value ? ' selected' : ''}>${n.replace(/-/g, ' ')}</option>`).join('')}</select></span>`;
}
function rowAct(first, last, blocked = '') {
  return `<span class="adm-rowact">
    <button class="icon-btn" type="button" data-move="-1" aria-label="Move up"${first ? ' disabled' : ''}>${icon('chevron-up', 18)}</button>
    <button class="icon-btn" type="button" data-move="1" aria-label="Move down"${last ? ' disabled' : ''}>${icon('chevron-down', 18)}</button>
    <button class="icon-btn adm-danger" type="button" data-remove aria-label="Delete"${blocked ? ` aria-disabled="true" data-blocked="${esc(blocked)}" title="${esc(blocked)}"` : ''}>${icon('trash', 18)}</button>
  </span>`;
}
const countLabel = (n, one, many) => `${n} ${plural(n, one, many)}`;

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k, i) => { if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {}; o = o[k]; });
  o[keys[keys.length - 1]] = value;
}
function embedSrc(v) {
  v = String(v || '').trim();
  if (!v) return null;
  const m = v.match(/src\s*=\s*["']([^"']+)["']/i);
  return (m ? m[1] : v).replace(/&amp;/g, '&');
}
function readValue(el) {
  if (el.type === 'checkbox') return el.checked;
  const v = el.value, t = el.dataset.type;
  if (t === 'num' || t === 'int') {
    if (String(v).trim() === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? (t === 'int' ? Math.round(n) : n) : null;
  }
  if (t === 'paras') return v.split(/\n\s*\n/).map(s => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (t === 'url') return v.trim() || null;
  if (t === 'embed') return embedSrc(v);
  return v;
}
// Generic binding for [data-k] controls: writes the value into target at the dotted path.
function fieldEvent(e, target, after) {
  const el = e.target.closest?.('[data-k]');
  if (!el) return false;
  const choice = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio';
  if (el.type === 'radio' && !el.checked) return true;
  if (e.type === 'input' && choice && el.type !== 'range') return true;
  let value = readValue(el);
  if (e.type === 'change' && typeof value === 'string' && !el.dataset.type) { value = value.trim(); el.value = value; }
  if (e.type === 'change' && el.dataset.type === 'embed' && value) el.value = value;
  setPath(target, el.dataset.k, value);
  after(el.dataset.k, el, e.type);
  return true;
}
function uniqueId(base, list) {
  let id = base || 'item', n = 2;
  while (list.some(x => x.id === id)) id = `${base || 'item'}-${n++}`;
  return id;
}
function moveWithin(list, item, dir, same = () => true) {
  const i = list.indexOf(item);
  let j = i + dir;
  while (j >= 0 && j < list.length && !same(list[j])) j += dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}
function focusLater(sel) {
  requestAnimationFrame(() => { const el = $(sel); if (el && !el.disabled) el.focus({ preventScroll: true }); });
}
function blockedNotice(b) {
  if (b.getAttribute('aria-disabled') !== 'true') return false;
  toast(esc(b.dataset.blocked || 'Not possible right now.'));
  return true;
}
function usage() {
  const u = { features: {}, types: {}, markets: {} };
  for (const p of props()) {
    (p.features || []).forEach(f => { u.features[f] = (u.features[f] || 0) + 1; });
    u.types[p.type] = (u.types[p.type] || 0) + 1;
    const m = p.location?.market;
    if (m) u.markets[m] = (u.markets[m] || 0) + 1;
  }
  return u;
}
const priceLabel = p => isSold(p) ? 'Delivered' : p.priceOnRequest || !p.price ? 'Price on request' : formatMoney(p.price, 'EUR', site());

/* ------------------------------------------------------------------ modal, confirm, undo */
function modal({ title, body, actions = [], size = '', onClose }) {
  const host = $('#admModal');
  host.innerHTML = `<div class="adm-modal-bg" data-close></div>
    <div class="adm-modal-card${size ? ' adm-modal-' + size : ''}" role="dialog" aria-modal="true" aria-labelledby="admModalT">
      <div class="adm-modal-head"><h2 class="adm-h2" id="admModalT">${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Close">${icon('close', 22)}</button></div>
      <div class="adm-modal-body">${body}</div>
      ${actions.length ? `<div class="adm-modal-foot">${actions.map((a, i) => `<button class="btn btn-sm ${a.primary ? (a.danger ? 'btn-danger' : 'btn-primary') : 'btn-line'}" type="${a.form ? 'submit' : 'button'}"${a.form ? ` form="${a.form}"` : ''} data-act="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
  host.hidden = false;
  document.body.classList.add('adm-locked');
  let open = true;
  const release = trapFocus(host, () => close());
  function close() {
    if (!open) return;
    open = false;
    host.hidden = true;
    host.innerHTML = '';
    host.onclick = null;
    document.body.classList.remove('adm-locked');
    release();
    if (onClose) onClose();
  }
  host.onclick = e => {
    if (e.target.closest('[data-close]')) { close(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = actions[+b.dataset.act];
    if (a.form) return;
    if (a.onClick) a.onClick(close); else close();
  };
  setTimeout(() => { const f = $('[autofocus]', host) || $('.adm-modal-body input, .adm-modal-body select, .adm-modal-body textarea', host) || $('[data-act]:last-child', host); if (f) f.focus(); }, 30);
  return { el: host, close };
}

function ask({ title, text, ok = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    modal({
      title, body: `<p class="adm-p">${text}</p>`,
      actions: [{ label: 'Cancel', onClick: c => { resolve(false); c(); } }, { label: ok, primary: true, danger, onClick: c => { resolve(true); c(); } }],
      onClose: () => resolve(false)
    });
  });
}

function invalid(sel, msg) {
  const el = $(sel);
  if (!el) return;
  el.classList.add('is-invalid');
  el.focus();
  el.addEventListener('input', () => el.classList.remove('is-invalid'), { once: true });
  if (msg) toast(esc(msg));
}

let undoFn = null;
function undoable(html, fn) {
  undoFn = fn;
  toast(`<span>${html}</span><button class="adm-undo" type="button" data-undo>Undo</button>`, 7000);
}

/* ------------------------------------------------------------------ router and chrome */
const NAV = [
  ['properties', 'Properties', 'home', () => props().length],
  ['features', 'Features', 'spark', () => tax().features.length],
  ['categories', 'Categories', 'grid', () => tax().categories.length],
  ['types', 'Property types', 'layers', () => tax().propertyTypes.length],
  ['areas', 'Areas', 'pin', () => tax().markets.length],
  ['stories', 'Client stories', 'quote', () => stories().length],
  ['faq', 'FAQ', 'info', () => S.d.faq.items.length],
  ['settings', 'Settings', 'sliders'],
  ['publish', 'Publish', 'upload']
];
const VIEWS = {
  properties: viewList, property: viewEditor, features: viewFeatures, categories: viewCategories, types: viewTypes,
  areas: viewAreas, stories: viewStories, faq: viewFaq, settings: viewSettings, publish: viewPublish
};

function route() {
  S.maps.forEach(m => m.remove());
  S.maps = [];
  if (!S.mode) { paintChrome(''); viewSignIn(); return; }
  const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  const view = VIEWS[name] ? name : 'properties';
  paintChrome(view === 'property' ? 'properties' : view);
  VIEWS[view](decodeURIComponent(rest.join('/')));
  paintChanges();
}
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function rerender() { const y = window.scrollY; route(); window.scrollTo(0, y); }

function main(html) {
  for (const ev of ['onclick', 'oninput', 'onchange', 'ondragstart', 'ondragover', 'ondragleave', 'ondrop', 'ondragend']) M[ev] = null;
  M.innerHTML = html;
  window.scrollTo(0, 0);
}

function paintChrome(active) {
  const nav = $('#admNav'), top = $('#admTopR');
  document.body.classList.toggle('adm-signed', !!S.mode);
  if (!S.mode) { nav.hidden = true; nav.innerHTML = ''; top.innerHTML = ''; return; }
  nav.hidden = false;
  nav.innerHTML = NAV.map(([id, label, ic, count]) => `<a href="#/${id}"${id === active ? ' aria-current="page"' : ''}>${icon(ic, 18)}<span>${label}</span>${count ? `<span class="adm-nav-n">${count()}</span>` : id === 'publish' ? '<span class="adm-nav-n adm-nav-dot" data-changes hidden><span data-changes-n></span></span>' : ''}</a>`).join('');
  top.innerHTML = `<a class="adm-pill" href="#/publish" data-changes hidden>${icon('upload', 16)}<span><span data-changes-n>0</span><span class="adm-pill-l"> unpublished</span></span></a>
    <a class="adm-top-a" href="index.html" target="_blank" rel="noopener" title="Open the website">${icon('external', 16)}<span>Website</span></a>
    <span class="adm-who" title="${S.mode === 'github' ? `Publishing to ${esc(S.auth.owner)}/${esc(S.auth.name)} (${esc(S.auth.branch)})` : 'Working offline: changes are exported as a ZIP file'}">${S.mode === 'github' ? `${icon('user', 16)}<span>${esc(S.auth.login || S.auth.owner)}</span>` : `${icon('lock', 16)}<span>Offline</span>`}</span>
    <button class="adm-top-a" type="button" data-signout>${icon('logout', 16)}<span>${S.mode === 'github' ? 'Sign out' : 'Exit'}</span></button>`;
  $('[data-signout]', top).onclick = signOut;
}

async function signOut() {
  if (hasChanges() && !await ask({ title: 'Leave without publishing?', text: 'Your unpublished changes will be lost. To keep them, cancel and download them as a ZIP file under Publish.', ok: S.mode === 'github' ? 'Sign out' : 'Exit', danger: true })) return;
  forgetAuth();
  Object.assign(S, { mode: null, auth: null, head: null, signInError: '' });
  history.replaceState(null, '', location.pathname + location.search);
  route();
}

/* ------------------------------------------------------------------ sign in */
function viewSignIn() {
  const r = S.repoDefaults;
  main(`<div class="adm-sign">
    <section class="adm-sign-card" aria-labelledby="admSignH">
      <p class="eyebrow">Agency admin</p>
      <h1 class="adm-sign-h" id="admSignH">Netherfield <em>Studio</em></h1>
      <p class="adm-sign-lede">Add and edit properties, photos, features and categories, then publish them to the website in one step.</p>
      <form class="adm-form" id="admSign" novalidate>
        <div class="field"><label for="admToken">GitHub access token</label><input class="input" id="admToken" name="token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" required></div>
        <label class="check"><input type="checkbox" name="remember"><span>Keep me signed in on this device</span></label>
        <details class="adm-details"><summary>Repository</summary>
          <div class="adm-grid3">
            <div class="field"><label for="admOwner">Owner</label><input class="input" id="admOwner" name="owner" value="${esc(r.owner)}" spellcheck="false"></div>
            <div class="field"><label for="admRepo">Repository</label><input class="input" id="admRepo" name="name" value="${esc(r.name)}" spellcheck="false"></div>
            <div class="field"><label for="admBranch">Branch</label><input class="input" id="admBranch" name="branch" value="${esc(r.branch)}" spellcheck="false"></div>
          </div>
        </details>
        <p class="adm-error" role="alert"${S.signInError ? '' : ' hidden'}>${esc(S.signInError)}</p>
        <button class="btn btn-primary btn-block" type="submit">Sign in</button>
      </form>
      <div class="adm-or"><span>or</span></div>
      <button class="btn btn-line btn-block" type="button" data-offline>Work offline</button>
      <p class="fine adm-sign-fine">Edit without a token and download your changes as a ZIP file for your developer.</p>
    </section>
    <aside class="adm-sign-help" aria-labelledby="admHelpH">
      <h2 class="adm-h2" id="admHelpH">Your access token</h2>
      <p>Publishing saves your changes in the website’s GitHub repository. A fine-grained token gives Netherfield Studio exactly that permission, and nothing more.</p>
      <ol class="adm-steps">
        <li>On GitHub, open <a href="${TOKEN_URL}" target="_blank" rel="noopener">Settings → Developer settings → Fine-grained tokens → Generate new token</a>.</li>
        <li>Name it “Netherfield Studio” and choose an expiry date.</li>
        <li>Under <b>Repository access</b>, choose <b>Only select repositories</b> and pick <code>${esc(r.owner)}/${esc(r.name)}</code>.</li>
        <li>Under <b>Permissions</b>, set <b>Contents</b> to <b>Read and write</b>.</li>
        <li>Generate the token, copy it and paste it here.</li>
      </ol>
      <p class="fine">The token is kept in this browser only and is sent only to GitHub. On a shared computer, leave “Keep me signed in” unticked and sign out when you are done. If the repository belongs to another person’s account, ask them to add you as a collaborator and use a classic token with the <code>repo</code> scope.</p>
    </aside>
  </div>`);
  const form = $('#admSign'), err = $('.adm-error', M), btn = $('button[type="submit"]', form);
  const showErr = msg => { err.textContent = msg; err.hidden = !msg; };
  form.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(form);
    const token = String(f.get('token') || '').trim();
    if (!token) { showErr('Paste your GitHub token first.'); $('#admToken').focus(); return; }
    S.auth = { token, owner: String(f.get('owner') || r.owner).trim(), name: String(f.get('name') || r.name).trim(), branch: String(f.get('branch') || r.branch).trim() };
    btn.disabled = true; btn.textContent = 'Signing in…'; showErr('');
    try {
      await loadFromGithub();
      writeAuth(S.auth, !!f.get('remember'));
      S.mode = 'github'; S.signInError = '';
      go('#/properties');
      toast(`Signed in. Editing ${esc(S.auth.owner)}/${esc(S.auth.name)}.`);
    } catch (er) {
      S.auth = null;
      showErr(er.message);
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  };
  $('[data-offline]', M).onclick = async () => {
    try {
      await loadFromWebsite();
      S.mode = 'offline'; S.signInError = '';
      go('#/properties');
    } catch (er) { showErr(er.message); }
  };
}

/* ------------------------------------------------------------------ properties list */
function viewList() {
  const list = props(), avail = list.filter(p => !isSold(p)).length;
  main(`${head('Listings', 'Properties', `${countLabel(list.length, 'listing')} · ${avail} for sale · ${list.length - avail} delivered`, `<button class="btn btn-primary" type="button" data-add>${icon('plus', 16)}Add property</button>`)}
  <div class="adm-toolbar">
    <label class="adm-search">${icon('search', 18)}<span class="sr">Search properties</span><input class="input" type="search" data-q placeholder="Search by title, reference or area" value="${esc(S.ui.q)}"></label>
    <div class="seg" role="radiogroup" aria-label="Show">${[['all', 'All'], ['available', 'For sale'], ['sold', 'Delivered']].map(([v, l]) => `<label><input type="radio" name="admStatus" value="${v}"${S.ui.status === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
  </div>
  <div class="adm-plist" id="admPlist"></div>`);
  paintList();
  M.oninput = e => { if (e.target.matches('[data-q]')) { S.ui.q = e.target.value; paintList(); } };
  M.onchange = e => { if (e.target.name === 'admStatus') { S.ui.status = e.target.value; paintList(); } };
  M.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-add]')) addProperty();
    else if (b.dataset.dup) duplicateProperty(b.dataset.dup);
    else if (b.dataset.del) deleteProperty(b.dataset.del);
  };
}

function paintList() {
  const el = $('#admPlist');
  if (!el) return;
  const q = S.ui.q.trim().toLowerCase();
  const before = snapshot(S.baseObj.props.properties);
  const rows = props().filter(p => (S.ui.status === 'all' || p.status === S.ui.status) &&
    (!q || [p.title, p.ref, locationLine(p), p.location?.label, typeOf(tax(), p.type).label].join(' ').toLowerCase().includes(q)));
  el.innerHTML = rows.length ? rows.map(p => {
    const ph = p.photos?.[0], href = `#/property/${encodeURIComponent(p.id)}`;
    const state = !before.has(p.id) ? 'New' : before.get(p.id) !== JSON.stringify(p) ? 'Edited' : '';
    return `<article class="adm-prow">
      <a class="adm-thumb" href="${href}" tabindex="-1" aria-hidden="true">${ph ? `<img src="${esc(srcOf(ph.card || ph.src))}" alt="" loading="lazy">` : icon('photos', 24)}</a>
      <div class="adm-prow-main">
        <a class="adm-prow-t" href="${href}">${esc(p.title || 'Untitled')}</a>
        <p class="adm-prow-m">${esc([p.ref, typeOf(tax(), p.type).label, locationLine(p)].filter(Boolean).join(' · '))}</p>
        <p class="adm-tags">${isSold(p) ? '<span class="adm-tag">Delivered</span>' : '<span class="adm-tag adm-tag-gold">For sale</span>'}${p.featured ? '<span class="adm-tag">Home page</span>' : ''}${p.goldenVisa && !isSold(p) ? '<span class="adm-tag">Golden Visa</span>' : ''}${state ? `<span class="adm-tag adm-tag-new">${state} · not published</span>` : ''}</p>
      </div>
      <p class="adm-prow-price">${esc(priceLabel(p))}</p>
      <div class="adm-prow-act">
        <a class="btn btn-line btn-sm" href="${href}">${icon('edit', 16)}Edit</a>
        <button class="icon-btn" type="button" data-dup="${esc(p.id)}" title="Duplicate" aria-label="Duplicate ${esc(p.title)}">${icon('copy', 20)}</button>
        <button class="icon-btn adm-danger" type="button" data-del="${esc(p.id)}" title="Delete" aria-label="Delete ${esc(p.title)}">${icon('trash', 20)}</button>
      </div>
    </article>`;
  }).join('') : '<p class="adm-empty">No properties match.</p>';
}

function nextRef() {
  const n = Math.max(1000, ...props().map(p => parseInt(String(p.ref || '').replace(/\D/g, ''), 10) || 0));
  return `NF-${n + 1}`;
}
function blankProperty(title, type, mk, status) {
  return {
    id: newId(title, props()), ref: nextRef(), title, status, type,
    price: null, currency: 'EUR', priceOnRequest: false,
    bedrooms: null, bathrooms: null, livingArea: null, lotSize: null, yearBuilt: null,
    location: { market: mk?.id || '', area: mk?.label || '', city: mk?.city || '', lat: mk?.lat ?? null, lng: mk?.lng ?? null, radius: 300, label: '', approximate: true, country: 'Greece' },
    goldenVisa: status !== 'sold', featured: false, description: [], features: [], photos: [],
    video: null, virtualTour: null, streetView: null, floorplans: [], updated: thisMonth(), indicative: false
  };
}

function addProperty() {
  const t = tax();
  const m = modal({
    title: 'Add a property',
    body: `<form class="adm-form" id="admNew" novalidate>
      <div class="field"><label for="nwTitle">Title</label><input class="input" id="nwTitle" name="title" autofocus placeholder="e.g. Seafront penthouse in Voula"></div>
      <div class="adm-grid2">
        <div class="field"><label for="nwType">Property type</label><select class="select" id="nwType" name="type">${t.propertyTypes.map(x => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="nwMarket">Area</label><select class="select" id="nwMarket" name="market">${t.markets.map(x => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}</select></div>
      </div>
      <fieldset class="field"><legend class="label">Status</legend><div class="seg">${STATUSES.map((s, i) => `<label><input type="radio" name="status" value="${s.id}"${i ? '' : ' checked'}><span>${s.label}</span></label>`).join('')}</div></fieldset>
      <p class="adm-hint">You can change all of this later. The title also sets the page address.</p>
    </form>`,
    actions: [{ label: 'Cancel' }, { label: 'Create property', primary: true, form: 'admNew' }]
  });
  $('#admNew').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get('title') || '').trim();
    if (!title) { invalid('#nwTitle', 'Give the property a title.'); return; }
    const p = blankProperty(title, String(f.get('type')), marketOf(t, String(f.get('market'))), String(f.get('status') || 'available'));
    props().unshift(p);
    m.close();
    touched();
    go(`#/property/${encodeURIComponent(p.id)}`);
  };
}

function duplicateProperty(id) {
  const src = props().find(p => p.id === id);
  if (!src) return;
  const p = clone(src);
  p.title = `${src.title} (copy)`;
  p.id = newId(p.title, props());
  p.ref = nextRef();
  p.featured = false;
  p.updated = thisMonth();
  props().splice(props().indexOf(src) + 1, 0, p);
  touched();
  toast(`Duplicated. You are now editing “${esc(p.title)}”.`);
  go(`#/property/${encodeURIComponent(p.id)}`);
}

async function deleteProperty(id) {
  const list = props(), i = list.findIndex(p => p.id === id);
  if (i < 0) return;
  const p = list[i];
  if (!await ask({ title: `Delete “${p.title}”?`, text: 'The listing and its page are removed from the website when you publish. Photos used only by this listing are removed with it.', ok: 'Delete property', danger: true })) return;
  list.splice(i, 1);
  touched();
  go('#/properties');
  undoable(`Deleted “${esc(p.title)}”.`, () => { props().splice(Math.min(i, props().length), 0, p); touched(); rerender(); });
}

/* ------------------------------------------------------------------ property editor */
const SECTIONS = [['basics', 'Basics'], ['price', 'Price & size'], ['location', 'Location'], ['description', 'Description'], ['features', 'Features'], ['photos', 'Photos'], ['media', 'Video & 3D tour'], ['plans', 'Floor plans']];
const sec = (id, title, body, intro = '') => `<section class="adm-card adm-sec" id="ed-${id}" aria-labelledby="edh-${id}"><header class="adm-sec-head"><h2 class="adm-h2" id="edh-${id}">${title}</h2>${intro ? `<p class="adm-sec-intro">${intro}</p>` : ''}</header>${body}</section>`;

function viewEditor(id) {
  const p = props().find(x => x.id === id);
  if (!p) {
    main(`${head('Listings', 'Property not found', 'It may have been deleted or renamed.')}<a class="link-arrow" href="#/properties">All properties ${icon('arrow-right', 16)}</a>`);
    return;
  }
  p.location ||= {};
  p.photos ||= [];
  p.floorplans ||= [];
  p.features ||= [];
  const published = snapshot(S.baseObj.props.properties).has(p.id);
  main(`<header class="adm-head adm-head-ed">
    <div class="adm-head-l">
      <a class="adm-back" href="#/properties">${icon('arrow-left', 16)}All properties</a>
      <h1 class="adm-h1" data-ed-title>${esc(p.title || 'Untitled')}</h1>
      <p class="adm-sub"><span data-ed-ref>${esc(p.ref || '')}</span> · <code data-ed-url>${esc(pageUrl(p))}</code>${published ? '' : ' · <span class="adm-tag adm-tag-new">New, not published</span>'}</p>
    </div>
    <div class="adm-head-act">
      <button class="btn btn-line btn-sm" type="button" data-preview>${icon('eye', 16)}Preview page</button>
      ${published ? `<a class="btn btn-line btn-sm" href="${esc(pageUrl(p))}" target="_blank" rel="noopener">${icon('external', 16)}Live page</a>` : ''}
      <button class="icon-btn" type="button" data-dup title="Duplicate" aria-label="Duplicate this property">${icon('copy', 20)}</button>
      <button class="icon-btn adm-danger" type="button" data-del title="Delete" aria-label="Delete this property">${icon('trash', 20)}</button>
    </div>
  </header>
  <nav class="adm-jump" aria-label="Sections">${SECTIONS.map(([sid, l]) => `<button type="button" data-jump="${sid}">${l}</button>`).join('')}</nav>
  <div class="adm-ed">
    <div class="adm-ed-main">
      ${edBasics(p, published)}
      ${edPrice(p)}
      ${edLocation(p)}
      ${edDescription(p)}
      ${edFeatures(p)}
      ${edPhotos(p)}
      ${edMedia(p)}
      ${edPlans(p)}
    </div>
    <aside class="adm-ed-side" aria-label="Preview and checklist"><div class="adm-sticky">
      <section class="adm-card adm-side"><h2 class="adm-side-h">In the search results</h2><div class="adm-cardprev" data-cardprev></div></section>
      <section class="adm-card adm-side"><h2 class="adm-side-h">Listing checklist</h2><ul class="adm-quality" data-quality></ul></section>
    </div></aside>
  </div>`);

  const ed = { p, map: null, pin: null, circle: null, market: p.location.market };
  let sideTimer;
  const side = () => { clearTimeout(sideTimer); sideTimer = setTimeout(() => paintSide(p), 180); };
  const changed = () => { p.updated = thisMonth(); touched(); side(); };

  const after = (k, el, type) => {
    if (k === 'title') { $('[data-ed-title]').textContent = p.title || 'Untitled'; }
    if (k === 'ref') { $('[data-ed-ref]').textContent = p.ref || ''; }
    if (k === 'location.market' && type === 'change') onMarket();
    if (k === 'location.approximate' || k === 'location.radius') paintCircle();
    if ((k === 'location.lat' || k === 'location.lng') && type === 'change') movePin();
    if (k === 'video') paintVideo(p);
    if (k === 'streetView') paintStreet(p);
    if (k === 'description') paintDescCount(p);
    paintPriceBits(p);
    changed();
  };

  function onMarket() {
    const prev = marketOf(tax(), ed.market), mk = marketOf(tax(), p.location.market), l = p.location;
    ed.market = l.market;
    if (!mk) return;
    if (!l.area || (prev && l.area === prev.label)) { l.area = mk.label; setInput('location.area', l.area); }
    if (!l.city || (prev && l.city === prev.city)) { l.city = mk.city || ''; setInput('location.city', l.city); }
    const atPrev = prev && l.lat === prev.lat && l.lng === prev.lng;
    if (l.lat == null || atPrev) { l.lat = mk.lat; l.lng = mk.lng; movePin(true); }
  }
  function setInput(k, v) { const el = $(`[data-k="${k}"]`, M); if (el && document.activeElement !== el) el.value = v ?? ''; }
  function paintCoords() {
    const l = p.location, el = $('[data-coords]');
    if (el) el.textContent = l.lat != null && l.lng != null ? `${(+l.lat).toFixed(5)}, ${(+l.lng).toFixed(5)}` : 'Click the map to place the pin';
    setInput('location.lat', l.lat); setInput('location.lng', l.lng);
  }
  function paintCircle() {
    const l = p.location, r = l.radius || 300;
    const out = $('[data-radius-out]');
    if (out) out.textContent = `${r} m`;
    const rf = $('[data-radius-field]');
    if (rf) rf.classList.toggle('is-off', !l.approximate);
    if (ed.circle) { ed.circle.setRadius(r); ed.circle.setStyle({ opacity: l.approximate ? 1 : 0, fillOpacity: l.approximate ? 0.16 : 0 }); }
  }
  function movePin(pan = true) {
    const l = p.location;
    paintCoords();
    if (!ed.map || l.lat == null || l.lng == null) return;
    const ll = [l.lat, l.lng];
    ed.pin.setLatLng(ll); ed.circle.setLatLng(ll);
    if (pan) ed.map.setView(ll, Math.max(ed.map.getZoom(), 14));
  }
  function setPos(ll) {
    p.location.lat = +ll.lat.toFixed(6);
    p.location.lng = +ll.lng.toFixed(6);
    movePin(false);
    changed();
  }
  function initMap() {
    const el = $('#edMap');
    if (!el) return;
    if (!window.L) { el.innerHTML = '<p class="adm-empty adm-map-off">The map could not be loaded. Enter the coordinates under “Coordinates and label”.</p>'; return; }
    const l = p.location, has = l.lat != null && l.lng != null;
    const start = has ? [l.lat, l.lng] : [37.87, 23.75];
    const map = L.map(el, { scrollWheelZoom: false }).setView(start, has ? 15 : 11);
    S.maps.push(map);
    L.tileLayer(site().maps.tiles, { attribution: site().maps.tilesAttribution, maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    ed.map = map;
    ed.pin = L.marker(start, { draggable: true, title: 'Property position', icon: L.divIcon({ className: 'adm-pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map);
    ed.circle = L.circle(start, { radius: l.radius || 300, color: '#826428', weight: 1, fillColor: '#C7A253', fillOpacity: 0.16, interactive: false }).addTo(map);
    map.on('click', e => setPos(e.latlng));
    ed.pin.on('dragend', () => setPos(ed.pin.getLatLng()));
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    paintCircle();
    requestAnimationFrame(() => map.invalidateSize());
  }

  // photo and plan operations
  let dragFrom = null;
  function paintPhotos(focusSel) {
    const g = $('[data-photos]');
    if (g) g.innerHTML = photoGrid(p);
    if (focusSel) focusLater(focusSel);
  }
  function paintPlans(focusSel) {
    const g = $('[data-plans]');
    if (g) g.innerHTML = planList(p);
    if (focusSel) focusLater(focusSel);
  }
  function photoAction(act, i) {
    const list = p.photos;
    let to = i;
    if (act === 'left' && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; to = i - 1; }
    else if (act === 'right' && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; to = i + 1; }
    else if (act === 'cover' && i > 0) { list.unshift(list.splice(i, 1)[0]); to = 0; }
    else if (act === 'remove') {
      const [ph] = list.splice(i, 1);
      undoable('Photo removed.', () => { list.splice(Math.min(i, list.length), 0, ph); paintPhotos(); changed(); });
      paintPhotos(`[data-ph="remove"][data-i="${Math.min(i, list.length - 1)}"]`);
      changed();
      return;
    } else return;
    paintPhotos(act === 'cover' ? '[data-alt="0"]' : `[data-ph="${act}"][data-i="${to}"]`);
    changed();
  }
  function planAction(act, i) {
    const list = p.floorplans;
    let to = i;
    if (act === 'up' && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; to = i - 1; }
    else if (act === 'down' && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; to = i + 1; }
    else if (act === 'remove') {
      const [fp] = list.splice(i, 1);
      undoable('Floor plan removed.', () => { list.splice(Math.min(i, list.length), 0, fp); paintPlans(); changed(); });
      paintPlans();
      changed();
      return;
    } else return;
    paintPlans(`[data-pl="${act}"][data-i="${to}"]`);
    changed();
  }
  async function addImages(files, kind) {
    const imgs = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|avif)$/i.test(f.name));
    if (files.length && !imgs.length) { toast('Only image files can be added here.'); return; }
    const prog = $(`[data-progress="${kind}"]`);
    for (const f of imgs) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="adm-spin" aria-hidden="true"></span>Optimising ${esc(f.name)}…`;
      if (prog) prog.append(li);
      try {
        const { rec, small } = await processImage(f, p, kind);
        (kind === 'plan' ? p.floorplans : p.photos).push(rec);
        if (kind === 'plan') paintPlans(); else paintPhotos();
        changed();
        if (small) toast(`${esc(f.name)} is only ${rec.w}×${rec.h} px. For crisp photos, upload the original file (2000 px or more on the long side).`, 7000);
      } catch (err) {
        toast(esc(err.message || `${f.name} could not be added.`), 7000);
      } finally {
        li.remove();
      }
    }
  }
  function renameSlug(el) {
    const slug = slugify(el.value);
    if (!slug) { el.value = p.id; toast('The page address needs letters or numbers.'); return; }
    if (slug !== p.id && props().some(x => x.id === slug)) { el.value = p.id; toast('Another property already uses this address.'); return; }
    el.value = slug;
    if (slug === p.id) return;
    p.id = slug;
    history.replaceState(null, '', `#/property/${encodeURIComponent(slug)}`);
    $('[data-ed-url]').textContent = pageUrl(p);
    changed();
  }

  M.oninput = e => {
    if (fieldEvent(e, p, after)) return;
    const el = e.target;
    if (el.matches('[data-feat-q]')) { filterFeatures(el.value); return; }
    if (el.dataset.alt != null) { p.photos[+el.dataset.alt].alt = el.value; changed(); return; }
    if (el.dataset.planLabel != null) { p.floorplans[+el.dataset.planLabel].label = el.value; changed(); }
  };
  M.onchange = e => {
    if (fieldEvent(e, p, after)) return;
    const el = e.target;
    if (el.dataset.feature) {
      const on = el.checked, fid = el.dataset.feature;
      p.features = on ? [...new Set([...p.features, fid])] : p.features.filter(x => x !== fid);
      paintFeatCount(p);
      changed();
    } else if (el.dataset.upload) {
      addImages([...el.files], el.dataset.upload);
      el.value = '';
    } else if (el.matches('[data-slug]')) renameSlug(el);
  };
  M.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.jump) { $('#ed-' + b.dataset.jump).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (b.dataset.ph) { photoAction(b.dataset.ph, +b.dataset.i); return; }
    if (b.dataset.pl) { planAction(b.dataset.pl, +b.dataset.i); return; }
    if (b.matches('[data-preview]')) previewProperty(p);
    else if (b.matches('[data-dup]')) duplicateProperty(p.id);
    else if (b.matches('[data-del]')) deleteProperty(p.id);
    else if (b.matches('[data-centre]')) {
      const mk = marketOf(tax(), p.location.market);
      if (mk) setPos({ lat: mk.lat, lng: mk.lng }); else toast('Choose an area first.');
      if (mk) movePin(true);
    }
    else if (b.matches('[data-new-feature]')) newFeature(f => { p.features.push(f.id); changed(); const g = $('[data-feat-groups]'); if (g) g.innerHTML = featureChecks(p); paintFeatCount(p); });
    else if (b.matches('[data-new-type]')) newType(ty => { p.type = ty.id; changed(); rerender(); });
    else if (b.matches('[data-new-area]')) newArea(mk => { p.location.market = mk.id; ed.market = mk.id; p.location.area = mk.label; p.location.city = mk.city; changed(); rerender(); }, p.location);
  };
  M.ondragstart = e => {
    const f = e.target.closest?.('.adm-ph');
    if (!f) return;
    dragFrom = +f.dataset.i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragFrom));
    f.classList.add('is-drag');
  };
  M.ondragover = e => {
    const f = e.target.closest?.('.adm-ph'), dz = e.target.closest?.('[data-drop]');
    if (dragFrom != null && f) {
      e.preventDefault();
      $$('.adm-ph.is-over').forEach(x => x !== f && x.classList.remove('is-over'));
      f.classList.add('is-over');
    } else if (dragFrom == null && dz && [...e.dataTransfer.types].includes('Files')) {
      e.preventDefault();
      dz.classList.add('is-over');
    }
  };
  M.ondragleave = e => {
    const dz = e.target.closest?.('[data-drop]');
    if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('is-over');
  };
  M.ondrop = e => {
    const f = e.target.closest?.('.adm-ph'), dz = e.target.closest?.('[data-drop]');
    if (dragFrom != null && f) {
      e.preventDefault();
      const to = +f.dataset.i;
      if (to !== dragFrom) { const [x] = p.photos.splice(dragFrom, 1); p.photos.splice(to, 0, x); paintPhotos(); changed(); }
    } else if (dz && e.dataTransfer.files.length) {
      e.preventDefault();
      dz.classList.remove('is-over');
      addImages([...e.dataTransfer.files], dz.dataset.drop);
    }
  };
  M.ondragend = () => { dragFrom = null; $$('.adm-ph.is-drag, .adm-ph.is-over').forEach(x => x.classList.remove('is-drag', 'is-over')); };

  initMap();
  paintCoords();
  paintCircle();
  paintPriceBits(p);
  paintVideo(p);
  paintStreet(p);
  paintDescCount(p);
  paintFeatCount(p);
  paintSide(p);
}

function edBasics(p, published) {
  const t = tax();
  const slug = published ? '' : `<div class="field"><label for="edSlug">Page address</label><div class="adm-slug"><span>property-</span><input class="input" id="edSlug" data-slug value="${esc(p.id)}" spellcheck="false"><span>.html</span></div><p class="adm-hint">Fixed once published, so that links keep working.</p></div>`;
  return sec('basics', 'Basics', `
    <div class="adm-grid2">
      ${input('title', 'Title', p.title, { cls: 'adm-span2' })}
      ${input('ref', 'Reference', p.ref)}
      ${select('type', 'Property type', p.type, [...(t.propertyTypes.some(x => x.id === p.type) ? [] : [['', 'Choose a type']]), ...t.propertyTypes.map(x => [x.id, x.label])], { after: `<button class="adm-link" type="button" data-new-type>${icon('plus', 14)}New property type</button>` })}
      ${slug}
    </div>
    <fieldset class="field adm-mt"><legend class="label">Status</legend><div class="seg">${STATUSES.map(s => `<label><input type="radio" name="edStatus" data-k="status" value="${s.id}"${p.status === s.id ? ' checked' : ''}><span>${s.label}</span></label>`).join('')}</div></fieldset>
    <div class="adm-toggles">
      ${toggle('featured', 'Feature on the home page', p.featured, 'Shown along the estate line below the home page film, and first under “Recommended”.')}
      ${toggle('goldenVisa', 'Golden Visa eligible', p.goldenVisa, 'Adds the Golden Visa tag and includes the listing in the Golden Visa filter.')}
    </div>
    <div data-gv-note></div>`);
}

function edPrice(p) {
  const num = (k, label, kind, attrs, hint = '') => input(k, label, p[k], { type: 'number', kind, attrs: ` inputmode="${kind === 'int' ? 'numeric' : 'decimal'}"${attrs}`, hint });
  return sec('price', 'Price & size', `
    <div class="adm-grid3">
      ${num('price', 'Price (EUR)', 'num', ' min="0" step="1000"', '<span data-price-echo></span>')}
      <div class="adm-span2 adm-toggles adm-toggles-tight">
        ${toggle('priceOnRequest', 'Price on request', p.priceOnRequest, 'Hides the price on the website.')}
        ${toggle('indicative', 'Figures are indicative', p.indicative, 'Adds “Figures are indicative and confirmed by the Netherfield team on request” to the details.')}
      </div>
      ${num('bedrooms', 'Bedrooms', 'int', ' min="0" step="1"')}
      ${num('bathrooms', 'Bathrooms', 'int', ' min="0" step="1"')}
      ${num('livingArea', 'Living area (m²)', 'num', ' min="0" step="1"', '<span data-ppsqm></span>')}
      ${num('lotSize', 'Lot size (m²)', 'num', ' min="0" step="1"')}
      ${num('yearBuilt', 'Year built', 'int', ' min="1800" max="2100" step="1"')}
    </div>`);
}

function edLocation(p) {
  const t = tax(), l = p.location;
  return sec('location', 'Location', `
    <div class="adm-grid3">
      ${select('location.market', 'Area', l.market, [['', 'Choose an area'], ...t.markets.map(m => [m.id, m.label])], { after: `<button class="adm-link" type="button" data-new-area>${icon('plus', 14)}New area</button>` })}
      ${input('location.area', 'Neighbourhood', l.area)}
      ${input('location.city', 'City', l.city)}
    </div>
    <div class="adm-mapwrap">
      <div class="adm-map" id="edMap" role="region" aria-label="Map: click or drag the pin to set the position"></div>
      <div class="adm-map-bar"><span class="adm-coords">${icon('pin', 16)}<span data-coords></span></span><button class="adm-link" type="button" data-centre>${icon('reset', 14)}Move the pin to the area centre</button></div>
    </div>
    <div class="adm-grid2 adm-mt">
      <div class="adm-toggles adm-toggles-tight">${toggle('location.approximate', 'Show the approximate area only', l.approximate, 'Recommended. The page shows a circle around the pin instead of the exact position.')}</div>
      <div class="field adm-radius" data-radius-field><label for="edRadius">Circle radius <output data-radius-out></output></label><input type="range" id="edRadius" data-k="location.radius" data-type="int" min="100" max="1500" step="50" value="${l.radius || 300}"></div>
    </div>
    ${input('streetView', 'Street View (optional)', p.streetView, { kind: 'embed', cls: 'adm-mt', placeholder: '<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>', hint: 'In Google Maps, open Street View at the spot, then Share → Embed a map → Copy HTML, and paste it here. Without it, the page offers a button that opens Street View in Google Maps. <span data-street-ok></span>' })}
    <details class="adm-details"><summary>Coordinates and search label</summary>
      <div class="adm-grid3">
        ${input('location.lat', 'Latitude', l.lat, { type: 'number', kind: 'num', attrs: ' step="0.000001"' })}
        ${input('location.lng', 'Longitude', l.lng, { type: 'number', kind: 'num', attrs: ' step="0.000001"' })}
        ${input('location.country', 'Country', l.country || 'Greece')}
        ${input('location.label', 'Search label (optional)', l.label, { cls: 'adm-span3', hint: 'Extra words visitors might search for, for example “Prime Kato Glyfada”.' })}
      </div>
    </details>`);
}

function edDescription(p) {
  return sec('description', 'Description', textarea('description', '<span class="sr">Description</span>', (p.description || []).join('\n\n'), {
    kind: 'paras', rows: 12, hint: 'Separate paragraphs with an empty line. The first paragraph also appears in the list view of the search results. <span data-desc-count></span>'
  }), 'Write for the reader: the setting, the light, how life feels there. Facts such as size and features are shown separately on the page.');
}

function edFeatures(p) {
  return sec('features', 'Features', `<div class="adm-feat-bar">
      <label class="adm-search adm-search-sm">${icon('search', 16)}<span class="sr">Find a feature</span><input class="input" type="search" data-feat-q placeholder="Find a feature"></label>
      <span class="adm-feat-n" data-feat-n></span>
      <button class="btn btn-line btn-sm" type="button" data-new-feature>${icon('plus', 16)}New feature</button>
    </div>
    <div class="adm-feat-groups" data-feat-groups>${featureChecks(p)}</div>`,
  'Listed in three groups on the property page, as on JamesEdition. Features marked ◦ are listed on the page but are not offered as search filters.');
}
function featureChecks(p) {
  const t = tax(), on = new Set(p.features || []);
  return t.featureGroups.map(g => `<fieldset class="adm-feat-g"><legend>${esc(g.label)}</legend>${t.features.filter(f => f.group === g.id).map(f => `<label class="check adm-feat" data-label="${esc(f.label.toLowerCase())}"><input type="checkbox" data-feature="${esc(f.id)}"${on.has(f.id) ? ' checked' : ''}>${icon(f.icon || 'check', 18)}<span>${esc(f.label)}</span>${f.searchable ? '' : '<span class="adm-feat-ns" title="Listed on the page, not a search filter">◦</span>'}</label>`).join('')}</fieldset>`).join('');
}
function filterFeatures(q) {
  q = q.trim().toLowerCase();
  $$('.adm-feat').forEach(l => { l.hidden = !!q && !l.dataset.label.includes(q); });
  $$('.adm-feat-g').forEach(g => { g.hidden = !$$('.adm-feat', g).some(l => !l.hidden); });
}
function paintFeatCount(p) {
  const el = $('[data-feat-n]');
  if (el) el.textContent = `${countLabel(p.features.length, 'feature')} selected`;
}

function edPhotos(p) {
  return sec('photos', 'Photos', `
    <div class="adm-drop" data-drop="photo">
      ${icon('upload', 28)}
      <p><label class="btn btn-primary btn-sm" for="edPhotoIn">Upload photos</label><span class="adm-drop-or">or drop them here</span></p>
      <p class="adm-hint">JPEG, PNG or WebP. Upload the original, high-resolution files: they are optimised automatically (up to 2400 px), location data is removed, and photos are never cropped on the website. The first photo is the cover; drag to reorder.</p>
      <input class="sr" type="file" id="edPhotoIn" accept="image/jpeg,image/png,image/webp,image/avif" multiple data-upload="photo">
    </div>
    <ul class="adm-progress" data-progress="photo" aria-live="polite"></ul>
    <div class="adm-photos" data-photos>${photoGrid(p)}</div>`);
}
function photoGrid(p) {
  const list = p.photos || [];
  if (!list.length) return '<p class="adm-empty">No photos yet. Until there are, the website shows “Photos on request”.</p>';
  return list.map((ph, i) => `<figure class="adm-ph" draggable="true" data-i="${i}">
    <div class="adm-ph-img"><img src="${esc(srcOf(ph.card || ph.src))}" alt="" loading="lazy" draggable="false">${i === 0 ? '<span class="adm-ph-cover">Cover</span>' : ''}<span class="adm-ph-size${Math.max(ph.w || 0, ph.h || 0) < LOW_RES ? ' is-low' : ''}" title="${Math.max(ph.w || 0, ph.h || 0) < LOW_RES ? 'Low resolution: upload the original file for crisp results' : 'Resolution'}">${ph.w}×${ph.h}</span></div>
    <figcaption>
      <label class="sr" for="edAlt${i}">Description of photo ${i + 1}</label>
      <input class="input input-sm" id="edAlt${i}" data-alt="${i}" value="${esc(ph.alt || '')}" placeholder="Describe the photo">
      <div class="adm-ph-act">
        <button class="icon-btn" type="button" data-ph="left" data-i="${i}" aria-label="Move photo ${i + 1} earlier"${i === 0 ? ' disabled' : ''}>${icon('chevron-left', 18)}</button>
        <button class="icon-btn" type="button" data-ph="right" data-i="${i}" aria-label="Move photo ${i + 1} later"${i === list.length - 1 ? ' disabled' : ''}>${icon('chevron-right', 18)}</button>
        <button class="icon-btn" type="button" data-ph="cover" data-i="${i}" aria-label="Make photo ${i + 1} the cover"${i === 0 ? ' disabled' : ''}>${icon('star', 18)}</button>
        <button class="icon-btn adm-danger" type="button" data-ph="remove" data-i="${i}" aria-label="Remove photo ${i + 1}">${icon('trash', 18)}</button>
      </div>
    </figcaption>
  </figure>`).join('');
}

function edMedia(p) {
  return sec('media', 'Video & 3D tour', `
    ${input('video', 'Video (YouTube or Vimeo link)', p.video, { kind: 'url', type: 'url', placeholder: 'https://www.youtube.com/watch?v=…', hint: 'Unlisted YouTube videos work too. Without a video, the page shows a film of the area with a “Request the video tour” link.' })}
    <div class="adm-video" data-video></div>
    ${input('virtualTour', '3D tour link (optional)', p.virtualTour, { kind: 'url', type: 'url', placeholder: 'https://my.matterport.com/show/?m=…', hint: 'Matterport or any tour that can be embedded. Shown as “Start the 3D tour” on the page and in the search filters.' })}`);
}
function paintVideo(p) {
  const el = $('[data-video]');
  if (!el) return;
  const yt = youtubeId(p.video), vm = vimeoId(p.video);
  el.innerHTML = yt ? `<img src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" width="160" height="120"><span>${icon('check', 16)}YouTube video recognised</span>`
    : vm ? `<span>${icon('check', 16)}Vimeo video recognised</span>`
      : p.video ? `<span class="adm-warn">${icon('info', 16)}This is not a YouTube or Vimeo link, so it cannot be shown.</span>` : '';
}
function paintStreet(p) {
  const el = $('[data-street-ok]');
  if (!el) return;
  el.className = p.streetView && !STREET_RE.test(p.streetView) ? 'adm-warn' : 'adm-ok';
  el.textContent = !p.streetView ? '' : STREET_RE.test(p.streetView) ? '✓ Street View embed recognised.' : 'This is not a Google Maps embed link.';
}
function paintDescCount(p) {
  const el = $('[data-desc-count]');
  if (!el) return;
  const words = (p.description || []).join(' ').split(/\s+/).filter(Boolean).length;
  el.textContent = words ? `${countLabel((p.description || []).length, 'paragraph')}, ${words} words.` : '';
}

function edPlans(p) {
  return sec('plans', 'Floor plans', `
    <div class="adm-drop adm-drop-sm" data-drop="plan">
      <p><label class="btn btn-line btn-sm" for="edPlanIn">${icon('upload', 16)}Upload floor plans</label><span class="adm-drop-or">or drop images here</span></p>
      <p class="adm-hint">PNG or JPEG. Without floor plans, the page offers “Floor plans on request”.</p>
      <input class="sr" type="file" id="edPlanIn" accept="image/jpeg,image/png,image/webp" multiple data-upload="plan">
    </div>
    <ul class="adm-progress" data-progress="plan" aria-live="polite"></ul>
    <div class="adm-plans" data-plans>${planList(p)}</div>`);
}
function planList(p) {
  const list = p.floorplans || [];
  return list.map((fp, i) => `<figure class="adm-plan">
    <div class="adm-plan-img"><img src="${esc(srcOf(fp.src))}" alt=""></div>
    <figcaption>
      <label class="sr" for="edPlan${i}">Name of floor plan ${i + 1}</label>
      <input class="input input-sm" id="edPlan${i}" data-plan-label="${i}" value="${esc(fp.label || '')}" placeholder="e.g. Ground floor">
      <div class="adm-ph-act">
        <button class="icon-btn" type="button" data-pl="up" data-i="${i}" aria-label="Move floor plan ${i + 1} up"${i === 0 ? ' disabled' : ''}>${icon('chevron-left', 18)}</button>
        <button class="icon-btn" type="button" data-pl="down" data-i="${i}" aria-label="Move floor plan ${i + 1} down"${i === list.length - 1 ? ' disabled' : ''}>${icon('chevron-right', 18)}</button>
        <button class="icon-btn adm-danger" type="button" data-pl="remove" data-i="${i}" aria-label="Remove floor plan ${i + 1}">${icon('trash', 18)}</button>
      </div>
    </figcaption>
  </figure>`).join('');
}

function gvNote(p) {
  if (!p.goldenVisa || isSold(p)) return '';
  const tiers = site().goldenVisa?.tiers || [];
  const top = tiers.find(x => x.amount === 800000) || tiers[0];
  const conv = tiers.find(x => x.amount === 250000);
  if (!top) return '';
  const issues = [];
  if (p.price && !p.priceOnRequest && p.price < top.amount) issues.push(`the price is below ${top.label}`);
  if (p.livingArea && p.livingArea < 120) issues.push('the living area is under 120 m²');
  if (!issues.length) {
    return p.price && p.livingArea ? `<p class="adm-note">${icon('check', 16)}<span>Meets the ${esc(top.label)} route that applies in Attica (one home of at least 120 m²), subject to legal review.</span></p>` : '';
  }
  return `<p class="adm-note adm-note-warn">${icon('info', 16)}<span>In Attica (Athens, Glyfada, Piraeus) the Golden Visa needs ${esc(top.label)} for one home of at least 120 m², and here ${issues.join(' and ')}. It can still qualify through the ${esc(conv ? conv.label : '€250,000')} route if it is a commercial-to-residential conversion or a restored listed building. Confirm the route before marking it eligible.</span></p>`;
}
function paintPriceBits(p) {
  const echo = $('[data-price-echo]');
  if (echo) echo.textContent = p.price ? formatMoney(p.price, 'EUR', site()) : '';
  const pp = $('[data-ppsqm]');
  if (pp) { const v = pricePerSqm(p); pp.textContent = v ? `${formatMoney(v, 'EUR', site())} per m²` : ''; }
  const gv = $('[data-gv-note]');
  if (gv) gv.innerHTML = gvNote(p);
}
function quality(p) {
  const n = (p.photos || []).length, words = (p.description || []).join(' ').split(/\s+/).filter(Boolean).length, f = (p.features || []).length;
  return [
    [n >= 8, n ? `${countLabel(n, 'photo')}${n < 8 ? ': 8 or more look best' : ''}` : 'Add photos'],
    [words >= 60, words ? `Description, ${words} words` : 'Write a description'],
    [f >= 6, f ? `${countLabel(f, 'feature')}${f < 6 ? ': add a few more' : ''}` : 'Tick the features'],
    [p.location?.lat != null, 'Position on the map'],
    [isSold(p) || p.priceOnRequest || p.price > 0, 'Price'],
    [!!p.video, p.video ? 'Video' : 'Video (optional)'],
    [(p.floorplans || []).length > 0, (p.floorplans || []).length ? 'Floor plans' : 'Floor plans (optional)']
  ];
}
function paintSide(p) {
  const cp = $('[data-cardprev]');
  if (!cp) return;
  cp.innerHTML = withUploads(cardHTML(p, { site: site(), tax: tax() }, { layout: 'grid' }));
  $$('a, button', cp).forEach(a => { a.tabIndex = -1; });
  const q = $('[data-quality]');
  if (q) q.innerHTML = quality(p).map(([ok, text]) => `<li class="${ok ? 'is-ok' : ''}">${icon(ok ? 'check' : 'plus', 16)}<span>${esc(text)}</span></li>`).join('');
}
function withUploads(html) {
  const paths = [...S.local.keys()].sort((a, b) => b.length - a.length);
  for (const path of paths) html = html.split(path).join(S.local.get(path));
  return html;
}

function previewProperty(p) {
  const ctx = { site: site(), tax: tax(), properties: props(), testimonials: stories(), faq: S.d.faq, v: 'preview' };
  const html = withUploads(layout(ctx, propertyPage(ctx, p))).replace('<head>', `<head><base href="${esc(new URL('.', location.href).href)}">`);
  const m = modal({
    title: `Preview: ${p.title}`, size: 'full',
    body: `<div class="adm-pv-bar"><div class="adm-pv-sizes" role="group" aria-label="Screen size">${[['100%', 'Desktop'], ['820px', 'Tablet'], ['390px', 'Phone']].map(([w, l], i) => `<button type="button" class="adm-pv-size" data-w="${w}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div><span class="fine">Preview of your unpublished version. Links lead to the live website.</span></div>
      <div class="adm-pv-stage"><iframe class="adm-pv-frame" title="Preview of ${esc(p.title)}"></iframe></div>`
  });
  const fr = $('.adm-pv-frame', m.el);
  fr.srcdoc = html;
  $('.adm-pv-sizes', m.el).onclick = e => {
    const b = e.target.closest('[data-w]');
    if (!b) return;
    fr.style.width = b.dataset.w;
    $$('[data-w]', m.el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  };
}

/* ------------------------------------------------------------------ images */
async function decodeImage(f) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(f);
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    return im;
  } catch (e) {
    throw new Error(`${f.name} could not be read. Save it as JPEG or PNG and try again.`);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
function makeCanvas(w, h, opaque) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (opaque) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  return c;
}
// Downscale in halving steps for a clean result, never upscale, never crop.
function scaleTo(img, max, opaque) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const k = Math.min(1, max / Math.max(W, H));
  const tw = Math.max(1, Math.round(W * k)), th = Math.max(1, Math.round(H * k));
  let src = img, sw = W, sh = H;
  while (sw / 2 >= tw && sh / 2 >= th) {
    const c = makeCanvas(Math.round(sw / 2), Math.round(sh / 2), opaque);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const out = makeCanvas(tw, th, opaque);
  out.getContext('2d').drawImage(src, 0, 0, tw, th);
  return out;
}
const canvasBlob = (c, type, q) => new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('The image could not be saved.'))), type, q));
function addLocal(path, blob) {
  if (S.local.has(path)) URL.revokeObjectURL(S.local.get(path));
  S.uploads.set(path, blob);
  S.local.set(path, URL.createObjectURL(blob));
}
// Re-encoding also strips EXIF data (camera GPS position) from phone photos.
async function processImage(f, p, kind) {
  const img = await decodeImage(f);
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  if (!W || !H) throw new Error(`${f.name} could not be read.`);
  const plan = kind === 'plan';
  const png = plan && f.type === 'image/png';
  const n = String((plan ? p.floorplans : p.photos).length + 1).padStart(2, '0');
  const stem = `img/properties/${p.id}/${plan ? 'plan-' : ''}${n}-${Math.random().toString(36).slice(2, 6)}`;
  const mainC = scaleTo(img, PHOTO_MAX, !png);
  const ext = png ? 'png' : 'jpg';
  addLocal(`${stem}.${ext}`, await canvasBlob(mainC, png ? 'image/png' : 'image/jpeg', 0.9));
  if (img.close) img.close();
  if (plan) return { rec: { src: `${stem}.${ext}`, w: mainC.width, h: mainC.height, label: `Floor plan ${p.floorplans.length + 1}`, alt: `${p.title}, floor plan` }, small: false };
  const cardC = scaleTo(mainC, CARD_MAX, true);
  addLocal(`${stem}-card.jpg`, await canvasBlob(cardC, 'image/jpeg', 0.84));
  const lqip = scaleTo(cardC, LQIP_MAX, true).toDataURL('image/jpeg', 0.5);
  return {
    rec: { src: `${stem}.jpg`, w: mainC.width, h: mainC.height, alt: `${p.title}, photo ${p.photos.length + 1}`, lqip, card: `${stem}-card.jpg`, cw: cardC.width, ch: cardC.height },
    small: Math.max(W, H) < LOW_RES
  };
}

/* ------------------------------------------------------------------ taxonomy dialogs */
function newFeature(done) {
  const t = tax();
  const m = modal({
    title: 'New feature',
    body: `<form class="adm-form" id="admNf" novalidate>
      <div class="field"><label for="nfLabel">Name</label><input class="input" id="nfLabel" name="label" autofocus placeholder="e.g. Private elevator"></div>
      <div class="adm-grid2">
        <div class="field"><label for="nfGroup">Listed under</label><select class="select" id="nfGroup" name="group">${t.featureGroups.map(g => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="nfFilter">Filter section</label><select class="select" id="nfFilter" name="filterGroup">${t.filterGroups.map(g => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><span class="label">Icon</span>${iconSelect('check', 'name="icon"')}</div>
      <label class="check"><input type="checkbox" name="searchable" checked><span>Offer it as a search filter and link it on property pages</span></label>
    </form>`,
    actions: [{ label: 'Cancel' }, { label: 'Add feature', primary: true, form: 'admNf' }]
  });
  const g = $('#nfGroup'), fg = $('#nfFilter');
  const sync = () => { fg.value = { lot: 'lot', interior: 'indoor', outdoor: 'outdoor' }[g.value] || fg.value; };
  sync();
  g.onchange = sync;
  $('#admNf').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), label = String(f.get('label') || '').trim();
    if (!label) { invalid('#nfLabel', 'Give the feature a name.'); return; }
    if (t.features.some(x => x.label.toLowerCase() === label.toLowerCase())) { invalid('#nfLabel', 'A feature with this name exists already.'); return; }
    const feat = { id: uniqueId(slugify(label), t.features), label, group: String(f.get('group')), filterGroup: String(f.get('filterGroup')), searchable: !!f.get('searchable'), icon: String(f.get('icon') || 'check') };
    const last = t.features.map(x => x.group).lastIndexOf(feat.group);
    t.features.splice(last + 1, 0, feat);
    m.close();
    touched();
    toast(`Feature “${esc(label)}” added.`);
    if (done) done(feat);
  };
}

function newType(done) {
  const t = tax();
  const m = modal({
    title: 'New property type',
    body: `<form class="adm-form" id="admNt" novalidate><div class="adm-grid2">
      <div class="field"><label for="ntLabel">Name</label><input class="input" id="ntLabel" name="label" autofocus placeholder="e.g. Loft"></div>
      <div class="field"><label for="ntPlural">Plural</label><input class="input" id="ntPlural" name="plural" placeholder="e.g. Lofts"></div>
    </div></form>`,
    actions: [{ label: 'Cancel' }, { label: 'Add type', primary: true, form: 'admNt' }]
  });
  $('#admNt').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), label = String(f.get('label') || '').trim();
    if (!label) { invalid('#ntLabel', 'Give the type a name.'); return; }
    if (t.propertyTypes.some(x => x.label.toLowerCase() === label.toLowerCase())) { invalid('#ntLabel', 'This type exists already.'); return; }
    const ty = { id: uniqueId(slugify(label), t.propertyTypes), label, plural: String(f.get('plural') || '').trim() || `${label}s` };
    t.propertyTypes.push(ty);
    m.close();
    touched();
    if (done) done(ty);
  };
}

function newArea(done, near) {
  const t = tax();
  const m = modal({
    title: 'New area',
    body: `<form class="adm-form" id="admNa" novalidate>
      <div class="field"><label for="naLabel">Name</label><input class="input" id="naLabel" name="label" autofocus placeholder="e.g. Vouliagmeni"></div>
      <div class="adm-grid2">
        <div class="field"><label for="naCity">City</label><input class="input" id="naCity" name="city" placeholder="e.g. Vouliagmeni"></div>
        <div class="field"><label for="naRegion">Region</label><input class="input" id="naRegion" name="region" value="Athens Riviera"></div>
      </div>
      <p class="adm-hint">The area starts at ${near?.lat != null ? 'the property’s position' : 'the Athens Riviera'}. Refine its position and description under Areas.</p>
    </form>`,
    actions: [{ label: 'Cancel' }, { label: 'Add area', primary: true, form: 'admNa' }]
  });
  $('#admNa').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), label = String(f.get('label') || '').trim();
    if (!label) { invalid('#naLabel', 'Give the area a name.'); return; }
    if (t.markets.some(x => x.label.toLowerCase() === label.toLowerCase())) { invalid('#naLabel', 'This area exists already.'); return; }
    const mk = { id: uniqueId(slugify(label), t.markets), label, city: String(f.get('city') || '').trim() || label, region: String(f.get('region') || '').trim(), lat: near?.lat ?? 37.87, lng: near?.lng ?? 23.75, summary: '' };
    t.markets.push(mk);
    m.close();
    touched();
    if (done) done(mk);
  };
}

function pickPoint(start, title) {
  return new Promise(resolve => {
    let chosen = { lat: start.lat, lng: start.lng }, map = null;
    modal({
      title, size: 'wide',
      body: '<div class="adm-map adm-map-tall" id="admPick" role="region" aria-label="Map"></div><p class="adm-hint adm-mt">Click the map or drag the pin.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Use this position', primary: true, onClick: c => { resolve(chosen); c(); } }],
      onClose: () => { if (map) map.remove(); resolve(null); }
    });
    if (!window.L) return;
    requestAnimationFrame(() => {
      map = L.map('admPick').setView([start.lat, start.lng], 13);
      L.tileLayer(site().maps.tiles, { attribution: site().maps.tilesAttribution, maxZoom: 19, subdomains: 'abcd' }).addTo(map);
      const pin = L.marker([start.lat, start.lng], { draggable: true, icon: L.divIcon({ className: 'adm-pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map);
      const set = ll => { chosen = { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) }; pin.setLatLng(ll); };
      map.on('click', e => set(e.latlng));
      pin.on('dragend', () => set(pin.getLatLng()));
    });
  });
}

/* ------------------------------------------------------------------ features */
function viewFeatures() {
  const t = tax(), used = usage();
  const groupOpts = v => t.featureGroups.map(g => `<option value="${esc(g.id)}"${g.id === v ? ' selected' : ''}>${esc(g.label)}</option>`).join('');
  const filterOpts = v => t.filterGroups.map(g => `<option value="${esc(g.id)}"${g.id === v ? ' selected' : ''}>${esc(g.label)}</option>`).join('');
  main(`${head('Taxonomy', 'Features', `The JamesEdition feature list, in three groups. Searchable features become filters on the Properties page (in the View, Outdoor, Indoor and Lot sections of “All filters”) and links on property pages.`, `<button class="btn btn-primary" type="button" data-new-feature>${icon('plus', 16)}New feature</button>`)}
  ${t.featureGroups.map(g => {
    const list = t.features.filter(f => f.group === g.id);
    return `<section class="adm-card" aria-labelledby="fg-${esc(g.id)}"><h2 class="adm-h2" id="fg-${esc(g.id)}">${esc(g.label)} <span class="adm-count">${list.length}</span></h2>
    <div class="adm-table adm-ftable" role="table" aria-labelledby="fg-${esc(g.id)}">
      <div class="adm-tr adm-th" role="row"><span role="columnheader">Icon</span><span role="columnheader">Name</span><span role="columnheader">Listed under</span><span role="columnheader">Filter section</span><span role="columnheader">Search filter</span><span role="columnheader">Used by</span><span role="columnheader"><span class="sr">Order and delete</span></span></div>
      ${list.map((f, i) => `<div class="adm-tr" role="row" data-id="${esc(f.id)}">
        <span role="cell" data-l="Icon">${iconSelect(f.icon, 'data-f="icon"')}</span>
        <span role="cell" data-l="Name"><input class="input input-sm" data-f="label" value="${esc(f.label)}" aria-label="Name"></span>
        <span role="cell" data-l="Listed under"><select class="select input-sm" data-f="group" aria-label="Listed under">${groupOpts(f.group)}</select></span>
        <span role="cell" data-l="Filter section"><select class="select input-sm" data-f="filterGroup" aria-label="Filter section">${filterOpts(f.filterGroup)}</select></span>
        <span role="cell" data-l="Search filter"><label class="adm-switch"><input type="checkbox" data-f="searchable"${f.searchable ? ' checked' : ''} aria-label="Offer “${esc(f.label)}” as a search filter"><span aria-hidden="true"></span></label></span>
        <span role="cell" data-l="Used by" class="adm-num">${countLabel(used.features[f.id] || 0, 'listing')}</span>
        <span role="cell">${rowAct(i === 0, i === list.length - 1)}</span>
      </div>`).join('')}
    </div></section>`;
  }).join('')}`);
  const feat = el => t.features.find(x => x.id === el.closest('[data-id]')?.dataset.id);
  const edit = e => {
    const el = e.target.closest('[data-f]'), f = el && feat(el);
    if (!f) return;
    const k = el.dataset.f;
    if (k === 'label') {
      if (el.value.trim()) f.label = e.type === 'change' ? el.value.trim() : el.value;
      else if (e.type === 'change') { el.value = f.label; toast('A feature needs a name.'); return; }
    } else if (e.type !== 'change') return;
    else if (k === 'searchable') f.searchable = el.checked;
    else f[k] = el.value;
    touched();
    if (k === 'group') { rerender(); toast(`“${esc(f.label)}” moved to ${esc(t.featureGroups.find(g => g.id === f.group)?.label || '')}.`); }
  };
  M.oninput = edit;
  M.onchange = edit;
  M.onclick = async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-new-feature]')) { newFeature(() => rerender()); return; }
    const f = feat(b);
    if (!f) return;
    if (b.dataset.move) {
      if (moveWithin(t.features, f, +b.dataset.move, x => x.group === f.group)) { touched(); rerender(); focusLater(`[data-id="${CSS.escape(f.id)}"] [data-move="${b.dataset.move}"]`); }
    } else if (b.matches('[data-remove]')) deleteFeature(f);
  };
}

async function deleteFeature(f) {
  const t = tax();
  const inProps = props().filter(p => (p.features || []).includes(f.id));
  const inCats = t.categories.filter(c => (c.rule?.features || []).includes(f.id));
  const text = inProps.length || inCats.length
    ? `It is ticked on ${countLabel(inProps.length, 'property', 'properties')}${inCats.length ? ` and used by ${countLabel(inCats.length, 'category', 'categories')}` : ''}, and will be removed there too.`
    : 'No property uses it.';
  if (!await ask({ title: `Delete “${f.label}”?`, text, ok: 'Delete feature', danger: true })) return;
  t.features.splice(t.features.indexOf(f), 1);
  inProps.forEach(p => { p.features = p.features.filter(x => x !== f.id); });
  inCats.forEach(c => { c.rule.features = c.rule.features.filter(x => x !== f.id); if (!c.rule.features.length) delete c.rule.features; });
  touched();
  rerender();
}

/* ------------------------------------------------------------------ categories */
function viewCategories() {
  const t = tax();
  main(`${head('Taxonomy', 'Categories', 'Quick filters in the strip above the search results, as on JamesEdition. A category shows every property that meets all of its conditions; leave a condition empty to ignore it.', `<button class="btn btn-primary" type="button" data-new-cat>${icon('plus', 16)}New category</button>`)}
  <div class="adm-cats">${t.categories.map((c, i) => catCard(c, i === 0, i === t.categories.length - 1)).join('')}</div>`);
  const cat = el => t.categories.find(c => c.id === el.closest('[data-id]')?.dataset.id);
  const repaint = (c, focusSel) => {
    const el = $(`.adm-cat[data-id="${CSS.escape(c.id)}"]`);
    const i = t.categories.indexOf(c);
    if (el) el.outerHTML = catCard(c, i === 0, i === t.categories.length - 1);
    if (focusSel) focusLater(`.adm-cat[data-id="${CSS.escape(c.id)}"] ${focusSel}`);
  };
  const setNum = (c, el) => {
    const r = (c.rule ||= {}), k = el.dataset.ruleNum, n = el.value === '' ? null : Number(el.value);
    if (n == null || !Number.isFinite(n) || n <= 0) delete r[k]; else r[k] = n;
    const cnt = $(`.adm-cat[data-id="${CSS.escape(c.id)}"] [data-cat-n]`);
    if (cnt) cnt.textContent = catCount(c);
    touched();
  };
  M.oninput = e => {
    const el = e.target, c = cat(el);
    if (!c) return;
    if (el.dataset.c === 'label' && el.value.trim()) { c.label = el.value; touched(); }
    if (el.dataset.ruleNum) setNum(c, el);
  };
  M.onchange = e => {
    const el = e.target, c = cat(el);
    if (!c) return;
    if (el.dataset.ruleAdd) {
      if (el.value) { const r = (c.rule ||= {}); (r.features ||= []).push(el.value); touched(); repaint(c, '[data-rule-add]'); }
    } else if (el.dataset.ruleNum) setNum(c, el);
    else if (el.dataset.c === 'icon') { c.icon = el.value; touched(); }
    else if (el.dataset.c === 'label') {
      if (!el.value.trim()) { el.value = c.label; toast('A category needs a name.'); return; }
      c.label = el.value.trim(); el.value = c.label; touched();
    }
  };
  M.onclick = async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-new-cat]')) { newCategory(); return; }
    const c = cat(b);
    if (!c) return;
    if (b.dataset.rule) {
      const r = (c.rule ||= {}), k = b.dataset.rule, list = r[k] || [], i = list.indexOf(b.dataset.v);
      if (i >= 0) list.splice(i, 1); else list.push(b.dataset.v);
      if (list.length) r[k] = list; else delete r[k];
      touched();
      repaint(c, k === 'features' ? '[data-rule-add]' : `[data-rule="${k}"][data-v="${CSS.escape(b.dataset.v)}"]`);
    } else if (b.dataset.move) {
      if (moveWithin(t.categories, c, +b.dataset.move)) { touched(); rerender(); focusLater(`.adm-cat[data-id="${CSS.escape(c.id)}"] [data-move="${b.dataset.move}"]`); }
    } else if (b.matches('[data-remove]')) {
      if (!await ask({ title: `Delete the category “${c.label}”?`, text: 'It disappears from the strip above the search results. Properties are not changed.', ok: 'Delete category', danger: true })) return;
      t.categories.splice(t.categories.indexOf(c), 1);
      touched();
      rerender();
    }
  };
}
const catCount = c => countLabel(props().filter(p => matchesCategory(c, p)).length, 'property', 'properties');
function catCard(c, first, last) {
  const t = tax(), r = c.rule || {};
  const chips = (key, items) => `<div class="adm-chipset">${items.map(([v, l]) => `<button type="button" class="adm-chip" data-rule="${key}" data-v="${esc(v)}" aria-pressed="${(r[key] || []).includes(v)}">${esc(l)}</button>`).join('')}</div>`;
  const feats = r.features || [];
  const empty = !Object.keys(r).length;
  const num = (k, label) => `<label class="field"><span class="label">${label}</span><input class="input input-sm" type="number" min="0" step="${k === 'bedrooms_from' ? 1 : 10000}" data-rule-num="${k}" value="${r[k] ?? ''}"></label>`;
  return `<article class="adm-card adm-cat" data-id="${esc(c.id)}">
    <div class="adm-cat-top">
      ${iconSelect(c.icon, 'data-c="icon"')}
      <input class="input adm-cat-name" data-c="label" value="${esc(c.label)}" aria-label="Category name">
      <span class="adm-cat-n" data-cat-n>${catCount(c)}</span>
      ${rowAct(first, last)}
    </div>
    <div class="adm-rules">
      <div class="adm-rule"><span class="adm-rule-k">Features (all of)</span><div class="adm-chipset">${feats.map(f => `<button type="button" class="adm-chip" aria-pressed="true" data-rule="features" data-v="${esc(f)}" aria-label="Remove ${esc(t.features.find(x => x.id === f)?.label || f)}">${esc(t.features.find(x => x.id === f)?.label || f)}${icon('close', 14)}</button>`).join('')}<select class="select input-sm adm-addsel" data-rule-add="features" aria-label="Add a feature"><option value="">Add a feature…</option>${t.features.filter(f => !feats.includes(f.id)).map(f => `<option value="${esc(f.id)}">${esc(f.label)}</option>`).join('')}</select></div></div>
      <div class="adm-rule"><span class="adm-rule-k">Property type</span>${chips('types', t.propertyTypes.map(x => [x.id, x.label]))}</div>
      <div class="adm-rule"><span class="adm-rule-k">Area</span>${chips('markets', t.markets.map(x => [x.id, x.label]))}</div>
      <div class="adm-rule"><span class="adm-rule-k">Status</span>${chips('status', STATUSES.map(x => [x.id, x.label]))}</div>
      <div class="adm-rule"><span class="adm-rule-k">Limits</span><div class="adm-grid3">${num('bedrooms_from', 'Bedrooms from')}${num('price_from', 'Price from (€)')}${num('price_to', 'Price up to (€)')}</div></div>
    </div>
    <p class="adm-hint adm-mt">Link: <code>properties.html?category=${esc(c.id)}</code>${empty ? ' · No conditions yet, so it shows every property.' : ''}</p>
  </article>`;
}
function newCategory() {
  const t = tax();
  const m = modal({
    title: 'New category',
    body: `<form class="adm-form" id="admNc" novalidate>
      <div class="field"><label for="ncLabel">Name</label><input class="input" id="ncLabel" name="label" autofocus placeholder="e.g. Sea-view penthouses"></div>
      <div class="field"><span class="label">Icon</span>${iconSelect('star', 'name="icon"')}</div>
      <p class="adm-hint">Next, choose its conditions: features, property types, areas, status or price.</p>
    </form>`,
    actions: [{ label: 'Cancel' }, { label: 'Add category', primary: true, form: 'admNc' }]
  });
  $('#admNc').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), label = String(f.get('label') || '').trim();
    if (!label) { invalid('#ncLabel', 'Give the category a name.'); return; }
    const c = { id: uniqueId(slugify(label), t.categories), label, icon: String(f.get('icon') || 'star'), rule: {} };
    t.categories.push(c);
    m.close();
    touched();
    rerender();
    const el = $(`.adm-cat[data-id="${CSS.escape(c.id)}"]`);
    if (el) { el.scrollIntoView({ block: 'center' }); focusLater(`.adm-cat[data-id="${CSS.escape(c.id)}"] [data-rule-add]`); }
  };
}

/* ------------------------------------------------------------------ property types */
function viewTypes() {
  const t = tax(), used = usage();
  main(`${head('Taxonomy', 'Property types', 'Used in the Type filter, on listing cards and on property pages.')}
  <section class="adm-card">
    <div class="adm-table adm-ttable" role="table" aria-label="Property types">
      <div class="adm-tr adm-th" role="row"><span role="columnheader">Name</span><span role="columnheader">Plural</span><span role="columnheader">Used by</span><span role="columnheader"><span class="sr">Order and delete</span></span></div>
      ${t.propertyTypes.map((ty, i) => `<div class="adm-tr" role="row" data-id="${esc(ty.id)}">
        <span role="cell" data-l="Name"><input class="input input-sm" data-t="label" value="${esc(ty.label)}" aria-label="Name"></span>
        <span role="cell" data-l="Plural"><input class="input input-sm" data-t="plural" value="${esc(ty.plural || '')}" aria-label="Plural"></span>
        <span role="cell" data-l="Used by" class="adm-num">${countLabel(used.types[ty.id] || 0, 'listing')}</span>
        <span role="cell">${rowAct(i === 0, i === t.propertyTypes.length - 1, used.types[ty.id] ? `Used by ${countLabel(used.types[ty.id], 'listing')}: change their type first.` : '')}</span>
      </div>`).join('')}
    </div>
    <form class="adm-addrow" id="admTypeAdd" novalidate>
      <input class="input input-sm" name="label" placeholder="New type, e.g. Loft" aria-label="New type">
      <input class="input input-sm" name="plural" placeholder="Plural, e.g. Lofts" aria-label="Plural of the new type">
      <button class="btn btn-line btn-sm" type="submit">${icon('plus', 16)}Add type</button>
    </form>
  </section>`);
  const ty = el => t.propertyTypes.find(x => x.id === el.closest('[data-id]')?.dataset.id);
  const edit = e => {
    const el = e.target.closest('[data-t]'), x = el && ty(el);
    if (!x) return;
    const k = el.dataset.t;
    if (el.value.trim()) x[k] = e.type === 'change' ? el.value.trim() : el.value;
    else if (e.type === 'change') { el.value = x[k] || ''; if (k === 'label') toast('A property type needs a name.'); return; }
    touched();
  };
  M.oninput = edit;
  M.onchange = edit;
  M.onclick = async e => {
    const b = e.target.closest('button');
    if (!b || blockedNotice(b)) return;
    const x = ty(b);
    if (!x) return;
    if (b.dataset.move) { if (moveWithin(t.propertyTypes, x, +b.dataset.move)) { touched(); rerender(); focusLater(`[data-id="${CSS.escape(x.id)}"] [data-move="${b.dataset.move}"]`); } }
    else if (b.matches('[data-remove]')) {
      if (!await ask({ title: `Delete “${x.label}”?`, text: 'No property uses this type. It is removed from the Type filter and from category conditions.', ok: 'Delete type', danger: true })) return;
      t.propertyTypes.splice(t.propertyTypes.indexOf(x), 1);
      t.categories.forEach(c => { if (c.rule?.types) { c.rule.types = c.rule.types.filter(v => v !== x.id); if (!c.rule.types.length) delete c.rule.types; } });
      touched();
      rerender();
    }
  };
  $('#admTypeAdd').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), label = String(f.get('label') || '').trim();
    if (!label) { invalid('#admTypeAdd [name="label"]', 'Give the type a name.'); return; }
    if (t.propertyTypes.some(x => x.label.toLowerCase() === label.toLowerCase())) { invalid('#admTypeAdd [name="label"]', 'This type exists already.'); return; }
    t.propertyTypes.push({ id: uniqueId(slugify(label), t.propertyTypes), label, plural: String(f.get('plural') || '').trim() || `${label}s` });
    touched();
    rerender();
    focusLater('#admTypeAdd [name="label"]');
  };
}

/* ------------------------------------------------------------------ areas */
function viewAreas() {
  const t = tax(), used = usage();
  main(`${head('Taxonomy', 'Areas', 'The locations visitors search by. Kato Glyfada, Athens Centre and Piraeus also appear on the home page map; each area’s summary is shown there and helps search.', `<button class="btn btn-primary" type="button" data-new-area>${icon('plus', 16)}New area</button>`)}
  <div class="adm-areas">${t.markets.map((m, i) => `<article class="adm-card adm-area" data-id="${esc(m.id)}">
    <div class="adm-area-top"><h2 class="adm-h2" data-area-h>${esc(m.label)}</h2><span class="adm-num">${countLabel(used.markets[m.id] || 0, 'listing')}</span>${rowAct(i === 0, i === t.markets.length - 1, used.markets[m.id] ? `Used by ${countLabel(used.markets[m.id], 'listing')}: move them to another area first.` : '')}</div>
    <div class="adm-grid3">
      <div class="field"><label for="ar${i}l">Name</label><input class="input" id="ar${i}l" data-m="label" value="${esc(m.label)}"></div>
      <div class="field"><label for="ar${i}c">City</label><input class="input" id="ar${i}c" data-m="city" value="${esc(m.city || '')}"></div>
      <div class="field"><label for="ar${i}r">Region</label><input class="input" id="ar${i}r" data-m="region" value="${esc(m.region || '')}"></div>
      <div class="field adm-span3"><label for="ar${i}s">Summary</label><textarea class="textarea" id="ar${i}s" data-m="summary" rows="3">${esc(m.summary || '')}</textarea></div>
    </div>
    <div class="adm-area-pos">${icon('pin', 16)}<span>${m.lat != null ? `${(+m.lat).toFixed(4)}, ${(+m.lng).toFixed(4)}` : 'No position'}</span><button class="adm-link" type="button" data-pick>${icon('map', 14)}Change on the map</button></div>
  </article>`).join('')}</div>`);
  const area = el => t.markets.find(x => x.id === el.closest('[data-id]')?.dataset.id);
  const edit = e => {
    const el = e.target.closest('[data-m]'), m = el && area(el);
    if (!m) return;
    const k = el.dataset.m;
    if (k === 'label' && !el.value.trim()) { if (e.type === 'change') { el.value = m.label; toast('An area needs a name.'); } return; }
    m[k] = e.type === 'change' ? el.value.trim() : el.value;
    if (k === 'label') { const h = $('[data-area-h]', el.closest('[data-id]')); if (h) h.textContent = m.label; }
    touched();
  };
  M.oninput = edit;
  M.onchange = edit;
  M.onclick = async e => {
    const b = e.target.closest('button');
    if (!b || blockedNotice(b)) return;
    if (b.matches('[data-new-area]')) { newArea(() => rerender()); return; }
    const m = area(b);
    if (!m) return;
    if (b.matches('[data-pick]')) {
      const pt = await pickPoint({ lat: m.lat ?? 37.87, lng: m.lng ?? 23.75 }, `Position of ${m.label}`);
      if (pt) { m.lat = pt.lat; m.lng = pt.lng; touched(); rerender(); }
    } else if (b.dataset.move) {
      if (moveWithin(t.markets, m, +b.dataset.move)) { touched(); rerender(); focusLater(`[data-id="${CSS.escape(m.id)}"] [data-move="${b.dataset.move}"]`); }
    } else if (b.matches('[data-remove]')) {
      if (!await ask({ title: `Delete “${m.label}”?`, text: 'No property uses this area. It is removed from the Location filter and from category conditions.', ok: 'Delete area', danger: true })) return;
      t.markets.splice(t.markets.indexOf(m), 1);
      t.categories.forEach(c => { if (c.rule?.markets) { c.rule.markets = c.rule.markets.filter(v => v !== m.id); if (!c.rule.markets.length) delete c.rule.markets; } });
      touched();
      rerender();
    }
  };
}

/* ------------------------------------------------------------------ client stories */
function viewStories() {
  const list = stories();
  main(`${head('Testimonials', 'Client stories', 'Shown on the Testimonials page, in this order. Publish a story only with the client’s written consent: stories without it stay hidden. Until the first story is published, the page invites visitors to request a reference call.', `<button class="btn btn-primary" type="button" data-new-story>${icon('plus', 16)}Add story</button>`)}
  <datalist id="admTitles">${props().map(p => `<option value="${esc(p.title)}">`).join('')}</datalist>
  ${list.length ? list.map((s, i) => `<article class="adm-card adm-story" data-i="${i}">
    <div class="field"><label for="st${i}q">Quote</label><textarea class="textarea" id="st${i}q" data-s="quote" rows="4" placeholder="Two or three sentences in the client’s own words">${esc(s.quote || '')}</textarea></div>
    <div class="adm-grid3 adm-mt">
      <div class="field"><label for="st${i}n">Name</label><input class="input" id="st${i}n" data-s="name" value="${esc(s.name || '')}" placeholder="e.g. Layla and Omar K."></div>
      <div class="field"><label for="st${i}f">From</label><input class="input" id="st${i}f" data-s="from" value="${esc(s.from || '')}" placeholder="e.g. Dubai"></div>
      <div class="field"><label for="st${i}p">Property</label><input class="input" id="st${i}p" data-s="property" value="${esc(s.property || '')}" list="admTitles" placeholder="Optional"></div>
    </div>
    <div class="adm-story-foot">
      <label class="check"><input type="checkbox" data-s="consent"${s.consent ? ' checked' : ''}><span>The client agreed in writing to publish this story.</span></label>
      ${rowAct(i === 0, i === list.length - 1)}
    </div>
  </article>`).join('') : '<div class="adm-card"><p class="adm-empty">No stories yet.</p></div>'}`);
  const edit = e => {
    const el = e.target.closest('[data-s]'), card = el?.closest('[data-i]');
    if (!card) return;
    const s = stories()[+card.dataset.i], k = el.dataset.s;
    if (k === 'consent') { if (e.type === 'change') s.consent = el.checked; else return; }
    else s[k] = e.type === 'change' ? el.value.trim() : el.value;
    touched();
  };
  M.oninput = edit;
  M.onchange = edit;
  M.onclick = async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-new-story]')) {
      stories().push({ quote: '', name: '', from: '', property: '', consent: false });
      touched();
      rerender();
      const last = $$('.adm-story').pop();
      if (last) { last.scrollIntoView({ block: 'center' }); focusLater(`.adm-story[data-i="${stories().length - 1}"] [data-s="quote"]`); }
      return;
    }
    const card = b.closest('[data-i]');
    if (!card) return;
    const i = +card.dataset.i, list2 = stories();
    if (b.dataset.move) {
      const j = i + +b.dataset.move;
      if (j < 0 || j >= list2.length) return;
      [list2[i], list2[j]] = [list2[j], list2[i]];
      touched(); rerender(); focusLater(`.adm-story[data-i="${j}"] [data-move="${b.dataset.move}"]`);
    } else if (b.matches('[data-remove]')) {
      const [s] = list2.splice(i, 1);
      touched(); rerender();
      undoable('Story removed.', () => { stories().splice(Math.min(i, stories().length), 0, s); touched(); rerender(); });
    }
  };
}

/* ------------------------------------------------------------------ FAQ */
function viewFaq() {
  const f = S.d.faq;
  const count = id => f.items.filter(it => it.cat === id).length;
  main(`${head('Golden Visa page', 'FAQ', 'Questions and answers on the Golden Visa page, grouped by topic. Keep answers general and have the legal team confirm any change.', `<button class="btn btn-primary" type="button" data-new-q="${esc(f.categories[0]?.id || '')}">${icon('plus', 16)}New question</button>`)}
  <section class="adm-card"><h2 class="adm-h2">Topics</h2>
    <div class="adm-topics">${f.categories.map((c, i) => `<div class="adm-topic" data-cid="${esc(c.id)}"><input class="input input-sm" data-topic value="${esc(c.label)}" aria-label="Topic name"><span class="adm-num">${countLabel(count(c.id), 'question')}</span>${rowAct(i === 0, i === f.categories.length - 1, count(c.id) ? 'Move or delete its questions first.' : '')}</div>`).join('')}</div>
    <button class="adm-link adm-mt" type="button" data-new-topic>${icon('plus', 14)}New topic</button>
  </section>
  ${f.categories.map(c => `<section class="adm-card" aria-labelledby="fq-${esc(c.id)}"><h2 class="adm-h2" id="fq-${esc(c.id)}">${esc(c.label)}</h2>
    ${f.items.map((it, idx) => [it, idx]).filter(([it]) => it.cat === c.id).map(([it, idx], k, arr) => `<article class="adm-faq" data-i="${idx}">
      <div class="adm-faq-top">
        <input class="input" data-q value="${esc(it.q)}" aria-label="Question" placeholder="Question">
        <select class="select input-sm" data-cat aria-label="Topic">${f.categories.map(x => `<option value="${esc(x.id)}"${x.id === it.cat ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        ${rowAct(k === 0, k === arr.length - 1)}
      </div>
      <textarea class="textarea" data-a rows="3" aria-label="Answer" placeholder="Answer">${esc(it.a)}</textarea>
    </article>`).join('') || '<p class="adm-empty">No questions in this topic.</p>'}
    <button class="adm-link adm-mt" type="button" data-new-q="${esc(c.id)}">${icon('plus', 14)}Add a question here</button>
  </section>`).join('')}`);
  const stamp = () => { f.updated = thisMonth(); touched(); };
  const edit = e => {
    const el = e.target;
    const topic = el.closest('[data-cid]');
    if (topic && el.matches('[data-topic]')) {
      const c = f.categories.find(x => x.id === topic.dataset.cid);
      if (el.value.trim()) c.label = e.type === 'change' ? el.value.trim() : el.value;
      else if (e.type === 'change') { el.value = c.label; toast('A topic needs a name.'); return; }
      stamp();
      return;
    }
    const card = el.closest('.adm-faq');
    if (!card) return;
    const it = f.items[+card.dataset.i];
    if (el.matches('[data-q]')) it.q = e.type === 'change' ? el.value.trim() : el.value;
    else if (el.matches('[data-a]')) it.a = e.type === 'change' ? el.value.trim() : el.value;
    else if (el.matches('[data-cat]') && e.type === 'change') { it.cat = el.value; stamp(); rerender(); return; }
    else return;
    stamp();
  };
  M.oninput = edit;
  M.onchange = edit;
  M.onclick = async e => {
    const b = e.target.closest('button');
    if (!b || blockedNotice(b)) return;
    if (b.dataset.newQ != null) {
      if (!f.categories.length) { toast('Add a topic first.'); return; }
      const cat = b.dataset.newQ || f.categories[0].id;
      const lastIdx = f.items.map(x => x.cat).lastIndexOf(cat);
      f.items.splice(lastIdx + 1, 0, { cat, q: '', a: '' });
      stamp(); rerender();
      focusLater(`.adm-faq[data-i="${lastIdx + 1}"] [data-q]`);
      const el = $(`.adm-faq[data-i="${lastIdx + 1}"]`);
      if (el) el.scrollIntoView({ block: 'center' });
      return;
    }
    if (b.matches('[data-new-topic]')) {
      const m = modal({
        title: 'New topic',
        body: '<form class="adm-form" id="admTopic" novalidate><div class="field"><label for="tpLabel">Name</label><input class="input" id="tpLabel" name="label" autofocus placeholder="e.g. Taxes"></div></form>',
        actions: [{ label: 'Cancel' }, { label: 'Add topic', primary: true, form: 'admTopic' }]
      });
      $('#admTopic').onsubmit = ev => {
        ev.preventDefault();
        const label = String(new FormData(ev.target).get('label') || '').trim();
        if (!label) { invalid('#tpLabel', 'Give the topic a name.'); return; }
        f.categories.push({ id: uniqueId(slugify(label), f.categories), label });
        m.close(); stamp(); rerender();
      };
      return;
    }
    const topic = b.closest('[data-cid]');
    if (topic) {
      const c = f.categories.find(x => x.id === topic.dataset.cid);
      if (b.dataset.move) { if (moveWithin(f.categories, c, +b.dataset.move)) { stamp(); rerender(); } }
      else if (b.matches('[data-remove]')) { f.categories.splice(f.categories.indexOf(c), 1); stamp(); rerender(); }
      return;
    }
    const card = b.closest('.adm-faq');
    if (!card) return;
    const it = f.items[+card.dataset.i];
    if (b.dataset.move) { if (moveWithin(f.items, it, +b.dataset.move, x => x.cat === it.cat)) { stamp(); rerender(); focusLater(`.adm-faq[data-i="${f.items.indexOf(it)}"] [data-move="${b.dataset.move}"]`); } }
    else if (b.matches('[data-remove]')) {
      const i = f.items.indexOf(it);
      f.items.splice(i, 1);
      stamp(); rerender();
      undoable('Question removed.', () => { f.items.splice(Math.min(i, f.items.length), 0, it); stamp(); rerender(); });
    }
  };
}

/* ------------------------------------------------------------------ settings */
function viewSettings() {
  const s = site();
  const cur = s.currencies, others = Object.keys(cur.rates).filter(c => c !== cur.base);
  const block = (title, body, intro = '') => `<section class="adm-card adm-sec"><header class="adm-sec-head"><h2 class="adm-h2">${title}</h2>${intro ? `<p class="adm-sec-intro">${intro}</p>` : ''}</header>${body}</section>`;
  main(`${head('Agency', 'Settings', 'Contact details, figures and options used across the website.')}
  ${block('Contact', `<div class="adm-grid2">
    ${input('email', 'Email', s.email, { type: 'email' })}
    ${input('phone', 'Phone', s.phone, { type: 'tel', placeholder: '+30 210 000 0000', hint: 'Adds a Call button on property pages and the contact page. Leave empty to hide it.' })}
    ${input('whatsapp', 'WhatsApp', s.whatsapp, { type: 'tel', placeholder: '+30 690 000 0000', hint: 'Adds WhatsApp buttons on property pages and the contact page.' })}
    ${input('instagram', 'Instagram link', s.instagram, { type: 'url' })}
    ${input('instagramHandle', 'Instagram name', s.instagramHandle)}
  </div>`)}
  ${block('Office', `<div class="adm-grid3">
    ${input('address.street', 'Street', s.address.street, { cls: 'adm-span3' })}
    ${input('address.postalCode', 'Postcode', s.address.postalCode)}
    ${input('address.city', 'City', s.address.city)}
    ${input('address.country', 'Country', s.address.country)}
    ${input('address.lat', 'Latitude', s.address.lat, { type: 'number', kind: 'num', attrs: ' step="0.0001"' })}
    ${input('address.lng', 'Longitude', s.address.lng, { type: 'number', kind: 'num', attrs: ' step="0.0001"' })}
  </div>`, 'Shown in the footer and on the contact page with a map.')}
  ${block('Brand', `<div class="adm-grid2">${input('name', 'Company name', s.name)}${input('tagline', 'Tagline', s.tagline)}</div>`)}
  ${block('Key figures', `<div class="adm-kf">${(s.keyFigures || []).map((k, i) => `<div class="adm-kf-row">
      ${input(`keyFigures.${i}.value`, 'Figure', k.value, { type: 'number', kind: 'num' })}
      ${input(`keyFigures.${i}.label`, 'Label', k.label)}
      ${input(`keyFigures.${i}.detail`, 'Detail', k.detail)}
      <button class="icon-btn adm-danger" type="button" data-kf-del="${i}" aria-label="Remove figure ${i + 1}">${icon('trash', 18)}</button>
    </div>`).join('')}</div>
    <button class="adm-link adm-mt" type="button" data-kf-add>${icon('plus', 14)}Add a figure</button>`, 'Shown on Why Netherfield and on the Testimonials page.')}
  ${block('Currency rates', `<div class="adm-grid3">
    ${others.map(c => input(`currencies.rates.${c}`, `1 ${cur.base} in ${c}`, cur.rates[c], { type: 'number', kind: 'num', attrs: ' min="0" step="0.01"' })).join('')}
    ${input('currencies.asOf', 'Rates as of', cur.asOf, { type: 'date' })}
  </div>`, 'Visitors can show prices in these currencies; converted prices are marked as approximate.')}
  ${block('Golden Visa thresholds', `${input('goldenVisa.updated', 'Rules checked in', s.goldenVisa.updated, { type: 'month' })}
    ${s.goldenVisa.tiers.map((tr, i) => `<div class="adm-tier"><p class="adm-tier-amt">${esc(tr.label)}</p><div class="adm-grid2">
      ${textarea(`goldenVisa.tiers.${i}.where`, 'Where', tr.where, { rows: 2 })}
      ${textarea(`goldenVisa.tiers.${i}.rule`, 'What qualifies', tr.rule, { rows: 2 })}
    </div></div>`).join('')}`, 'The table on the Golden Visa page. The amounts follow the law (2024 rules); if the law changes, ask your developer to update the amounts and the residency planner on the home page.')}
  ${block('Maps', input('maps.googleMapsEmbedKey', 'Google Maps Embed API key (optional)', s.maps.googleMapsEmbedKey, { hint: 'With a key, Street View opens inside every property page. Without it, visitors get a button that opens Street View in Google Maps, unless a Street View embed is pasted on the property. The key is free from the Google Cloud console (Maps Embed API); restrict it to your website’s address.' }))}
  ${block('Search engines', `<div class="adm-toggles adm-toggles-tight">${toggle('indexable', 'Let search engines index the website', s.indexable, 'Turn on only when the site runs on the agency’s own domain below. While off, the preview asks search engines not to index it.')}</div>
    <div class="adm-grid2 adm-mt">${input('siteUrl', 'Website address', s.siteUrl, { type: 'url' })}${input('previewUrl', 'Preview address', s.previewUrl, { type: 'url' })}</div>`)}
  ${block('Publishing', `<div class="adm-grid3">${input('repo.owner', 'GitHub owner', s.repo?.owner)}${input('repo.name', 'Repository', s.repo?.name)}${input('repo.branch', 'Branch', s.repo?.branch)}</div>`, 'The repository the sign-in page suggests. It takes effect the next time someone signs in.')}`);
  M.oninput = e => fieldEvent(e, s, () => touched());
  M.onchange = e => fieldEvent(e, s, () => touched());
  M.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-kf-add]')) { (s.keyFigures ||= []).push({ value: 0, label: '', detail: '' }); touched(); rerender(); focusLater(`[data-k="keyFigures.${s.keyFigures.length - 1}.value"]`); }
    else if (b.dataset.kfDel != null) { s.keyFigures.splice(+b.dataset.kfDel, 1); touched(); rerender(); }
  };
}

/* ------------------------------------------------------------------ publish */
function viewPublish() {
  const list = changes(), { errs, warns } = problems();
  const online = S.mode === 'github';
  const issues = (title, items, cls) => items.length ? `<div class="adm-issues ${cls}"><h3>${title}</h3><ul>${items.map(x => `<li>${x.href ? `<a href="${x.href}">${esc(x.text)}</a>` : esc(x.text)}</li>`).join('')}</ul></div>` : '';
  main(`${head('Publish', list.length ? 'Ready to publish' : 'Everything is published', online
    ? `Publishing saves all changes to ${esc(S.auth.owner)}/${esc(S.auth.name)} (${esc(S.auth.branch)}). The website then rebuilds itself and is updated about a minute later.`
    : 'You are working offline. Download your changes as a ZIP file for your developer, or sign in with a GitHub token to publish directly.')}
  <div class="adm-pub">
    <section class="adm-card" aria-labelledby="pubCh"><h2 class="adm-h2" id="pubCh">Changes</h2>
      ${list.length ? `<ul class="adm-chlist">${list.map(c => `<li>${icon(c.icon, 18)}${c.href ? `<a href="${c.href}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}</li>`).join('')}</ul>` : '<p class="adm-empty">No unpublished changes.</p>'}
      ${issues('Fix before publishing', errs, 'adm-issues-err')}
      ${issues('Worth a look', warns, '')}
    </section>
    <section class="adm-card adm-pub-go" aria-labelledby="pubGo">
      <h2 class="adm-h2" id="pubGo">${online ? 'Publish' : 'Export'}</h2>
      ${online ? `<form class="adm-form adm-mt" id="admPub" novalidate>
        <div class="field"><label for="pubMsg">Note for the change history</label><input class="input" id="pubMsg" value="${esc(commitTitle(list))}"></div>
        <button class="btn btn-gold btn-block" type="submit"${!list.length || errs.length ? ' disabled' : ''}>${icon('upload', 16)}Publish to the website</button>
        ${errs.length ? '<p class="adm-hint">Fix the points on the left first.</p>' : ''}
      </form>` : `<p class="adm-p adm-mt">The ZIP contains the changed data files, new photos and a CHANGES.txt with instructions. Your developer copies them into the repository; the website then rebuilds itself.</p>
        <button class="btn btn-gold btn-block adm-mt" type="button" data-zip${!list.length ? ' disabled' : ''}>${icon('download', 16)}Download changes (ZIP)</button>`}
      <ol class="adm-log" data-log hidden></ol>
      <div class="adm-result" data-result hidden></div>
      <div class="adm-pub-more">
        ${online ? `<button class="adm-link" type="button" data-zip${!list.length ? ' disabled' : ''}>${icon('download', 14)}Download changes as ZIP</button>` : `<button class="adm-link" type="button" data-signin>${icon('user', 14)}Sign in to publish directly</button>`}
        <button class="adm-link adm-danger" type="button" data-discard${!list.length ? ' disabled' : ''}>${icon('reset', 14)}Discard all changes</button>
      </div>
    </section>
  </div>`);
  const form = $('#admPub');
  if (form) form.onsubmit = e => { e.preventDefault(); publish($('#pubMsg').value.trim() || commitTitle(list)); };
  M.onclick = async e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.matches('[data-zip]')) exportZip();
    else if (b.matches('[data-discard]')) discardAll();
    else if (b.matches('[data-signin]')) {
      if (hasChanges()) { toast('Download your changes first: signing in starts from the published version.'); return; }
      S.mode = null; route();
    }
  };
}
function commitTitle(list) {
  if (!list.length) return 'Update the website';
  if (list.length === 1) return list[0].text.slice(0, 72);
  return `Update ${list.length} items via Netherfield Studio`;
}

async function publish(message, force = false) {
  if (S.busy) return;
  S.busy = true;
  const log = $('[data-log]'), result = $('[data-result]'), btn = $('#admPub button[type="submit"]');
  if (btn) btn.disabled = true;
  log.hidden = false; log.innerHTML = '';
  result.hidden = true; result.className = 'adm-result';
  const step = text => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="adm-spin" aria-hidden="true"></span><span>${esc(text)}</span>`;
    log.append(li);
    return {
      update: t => { li.lastElementChild.textContent = t; },
      done: () => { li.className = 'is-done'; li.firstElementChild.outerHTML = icon('check', 16); },
      fail: () => { li.className = 'is-fail'; li.firstElementChild.outerHTML = icon('close', 16); }
    };
  };
  const body = changes().map(c => `- ${c.text}`).join('\n');
  let s;
  try {
    const files = FILES.filter(fileChanged).map(f => ({ key: f.key, path: f.path, text: ser(S.d[f.key]) }));
    const images = newImages();
    const R = repoPath();
    s = step('Checking the latest version on GitHub');
    let head = (await gh(`${R}/git/ref/heads/${branchRef()}`)).object.sha;
    if (!force) await checkConflicts(R, head, files);
    s.done();
    const total = files.length + images.length;
    s = step(`Uploading ${countLabel(total, 'file')}`);
    const tree = [];
    let n = 0;
    for (const f of files) {
      const blob = await gh(`${R}/git/blobs`, { method: 'POST', body: { content: utf8ToBase64(f.text), encoding: 'base64' } });
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
      s.update(`Uploading files (${++n} of ${total})`);
    }
    for (const path of images) {
      const blob = await gh(`${R}/git/blobs`, { method: 'POST', body: { content: await blobToBase64(S.uploads.get(path)), encoding: 'base64' } });
      tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
      s.update(`Uploading files (${++n} of ${total})`);
    }
    s.done();
    s = step('Saving the new version');
    let sha;
    for (let attempt = 0; ; attempt++) {
      const commit = await gh(`${R}/git/commits/${head}`);
      const existing = await treePaths(R, commit.tree.sha);
      const removals = droppedImages().filter(p => !existing || existing.has(p)).map(path => ({ path, mode: '100644', type: 'blob', sha: null }));
      const t = await gh(`${R}/git/trees`, { method: 'POST', body: { base_tree: commit.tree.sha, tree: [...tree, ...removals] } });
      const c = await gh(`${R}/git/commits`, { method: 'POST', body: { message: `${message}\n\n${body}\n\nPublished with Netherfield Studio (admin.html).`, tree: t.sha, parents: [head] } });
      try {
        await gh(`${R}/git/refs/heads/${branchRef()}`, { method: 'PATCH', body: { sha: c.sha, force: false } });
        sha = c.sha;
        break;
      } catch (e) {
        if (e.status !== 422 || attempt >= 2) throw e;
        head = (await gh(`${R}/git/ref/heads/${branchRef()}`)).object.sha;
        if (!force) await checkConflicts(R, head, files);
      }
    }
    s.done();
    // The published version is the new starting point.
    S.head = sha;
    for (const f of files) { S.base[f.key] = f.text; S.baseObj[f.key] = JSON.parse(f.text); }
    S.uploads.clear();
    paintChrome('publish');
    paintChanges();
    const pages = `https://github.com/${encodeURIComponent(S.auth.owner)}/${encodeURIComponent(S.auth.name)}/actions`;
    result.hidden = false;
    result.innerHTML = `${icon('check', 18)}<span>Published. The website is rebuilding and will show the changes in about a minute. <span data-live>Waiting for the new version…</span> <a href="${pages}" target="_blank" rel="noopener">Progress on GitHub</a></span>`;
    waitForLive(files);
  } catch (e) {
    if (s) s.fail();
    if (e.conflicts) {
      S.busy = false;
      const ok = await ask({
        title: 'Changed elsewhere in the meantime',
        text: `Since you signed in, ${esc(e.conflicts.join(', '))} ${e.conflicts.length > 1 ? 'were' : 'was'} changed by someone else. Publishing now would replace that version with yours. To be safe, download your changes as a ZIP first, then sign out and in again to start from the latest version.`,
        ok: 'Publish mine anyway', danger: true
      });
      if (btn) btn.disabled = false;
      if (ok) await publish(message, true);
      return;
    }
    result.hidden = false;
    result.classList.add('is-err');
    result.innerHTML = `${icon('info', 18)}<span>${esc(explain(e))} Nothing was changed on the website.</span>`;
    if (btn) btn.disabled = false;
  } finally {
    S.busy = false;
  }
}

async function checkConflicts(R, head, files) {
  if (head === S.head) return;
  const conflicts = [];
  for (const f of files) {
    const remote = await gh(`${R}/contents/${f.path}?ref=${head}`, { raw: true }).catch(e => (e.status === 404 ? null : Promise.reject(e)));
    const now = remote == null ? null : ser(JSON.parse(remote));
    if (now !== S.base[f.key]) conflicts.push(f.path);
  }
  if (conflicts.length) throw Object.assign(new Error('conflict'), { conflicts });
}
async function treePaths(R, treeSha) {
  try {
    const t = await gh(`${R}/git/trees/${treeSha}?recursive=1`);
    return t.truncated ? null : new Set(t.tree.filter(x => x.type === 'blob').map(x => x.path));
  } catch (e) { return null; }
}
async function waitForLive(files) {
  const probe = files.find(f => f.key === 'props') || files[0];
  if (!probe) return;
  const start = Date.now();
  while (Date.now() - start < 8 * 60 * 1000) {
    await sleep(8000);
    try {
      const r = await fetch(`${probe.path}?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok && ser(JSON.parse(await r.text())) === probe.text) {
        const el = $('[data-live]');
        if (el) el.innerHTML = '<b>The website now shows the new version.</b> <a href="index.html" target="_blank" rel="noopener">Open the website</a> ·';
        else toast('Your changes are live on the website.');
        return;
      }
    } catch (e) { /* keep waiting */ }
  }
  const el = $('[data-live]');
  if (el) el.textContent = 'This is taking longer than usual.';
}

function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const utf8ToBase64 = text => bytesToBase64(new TextEncoder().encode(text));
const blobToBase64 = async blob => bytesToBase64(new Uint8Array(await blob.arrayBuffer()));

async function discardAll() {
  if (!await ask({ title: 'Discard all changes?', text: 'Everything you changed since the last publish is reset. This cannot be undone.', ok: 'Discard changes', danger: true })) return;
  for (const f of FILES) S.d[f.key] = clone(S.baseObj[f.key]);
  S.uploads.clear();
  touched();
  go('#/properties');
  toast('All changes discarded.');
}

/* ------------------------------------------------------------------ ZIP export (stored, no compression) */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipBlob(entries) {
  const enc = new TextEncoder(), parts = [], central = [];
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name), data = e.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(ch, name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, x) => n + x.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
async function exportZip() {
  const enc = new TextEncoder();
  const entries = FILES.filter(fileChanged).map(f => ({ name: f.path, data: enc.encode(ser(S.d[f.key])) }));
  for (const path of newImages()) entries.push({ name: path, data: new Uint8Array(await S.uploads.get(path).arrayBuffer()) });
  const dropped = droppedImages();
  const notes = [
    'Netherfield Studio: changes to publish',
    `Exported ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`, '',
    'Changes:', ...changes().map(c => `- ${c.text}`), '',
    'How to apply:',
    '1. Copy the data and img folders from this ZIP into the website repository, replacing files with the same name.',
    ...(dropped.length ? ['2. Delete these files, which are no longer used:', ...dropped.map(p => `   ${p}`), '3. Commit and push. GitHub Pages rebuilds the website (locally: node tools/build.mjs).']
      : ['2. Commit and push. GitHub Pages rebuilds the website (locally: node tools/build.mjs).'])
  ];
  entries.unshift({ name: 'CHANGES.txt', data: enc.encode(notes.join('\n') + '\n') });
  const url = URL.createObjectURL(zipBlob(entries));
  const a = document.createElement('a');
  a.href = url;
  a.download = `netherfield-changes-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('ZIP file downloaded.');
}

/* ------------------------------------------------------------------ global listeners and start */
addEventListener('hashchange', route);
addEventListener('beforeunload', e => { if (hasChanges()) { e.preventDefault(); e.returnValue = ''; } });
// Dropping a file outside a drop zone must not navigate away from unpublished work.
addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
addEventListener('drop', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
document.addEventListener('change', e => {
  const s = e.target.closest?.('[data-icon-select]');
  if (s && s.previousElementSibling) s.previousElementSibling.innerHTML = icon(s.value, 20);
});
document.addEventListener('click', e => {
  if (!e.target.closest('[data-undo]') || !undoFn) return;
  const fn = undoFn;
  undoFn = null;
  fn();
  const t = document.getElementById('nfToast');
  if (t) t.classList.remove('is-on');
});

async function init() {
  $('#nfSprite').innerHTML = sprite();
  try {
    const s = await fetch(`data/site.json?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json());
    if (s.repo && s.repo.owner) S.repoDefaults = { owner: s.repo.owner, name: s.repo.name, branch: s.repo.branch };
  } catch (e) { /* keep the fallback */ }
  const saved = readAuth();
  if (saved) {
    S.auth = { ...saved };
    M.innerHTML = '<div class="adm-loading">Signing in…</div>';
    try {
      await loadFromGithub();
      S.mode = 'github';
    } catch (e) {
      S.auth = null;
      S.signInError = e.message;
      if (e.status === 401) forgetAuth();
    }
  }
  route();
}
init();
