/* ==================================================================
   KinderGuide Ottawa: Prototype 2
   1. Helpers, language, saved state     7. Step 3: Visit checklist
   2. Navigation and stepper             8. Step 4: Apply (plan + cost)
   3. Home                               9. Services hub and Ask Kip
   4. Step 1: Find (filters, list, map) 10. About the data
   5. Details panel (+ Google reviews)  11. Help                
   6. Step 2: Shortlist (compare, share) 12. Start-up
   ================================================================== */

/* ---------- 1. Helpers, language, saved state ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BY_ID = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));
const CENTRES = PROVIDERS.filter(p => p.kind === 'centre');
const AGE = Object.fromEntries(AGES.map(a => [a.key, a]));
const MAX_PICKS = 9, MIN_PICKS = 5, STALE_DAYS = 90;
const STEPS = ['find', 'shortlist', 'visit', 'apply'];

function km(a, b) {
  const r = x => x * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
// Distance (km) from point p to the straight line between home and work
function kmToSegment(p, a, b) {
  const kx = 111.32 * Math.cos(a.lat * Math.PI / 180), ky = 110.57;
  const P = [(p.lon - a.lon) * kx, (p.lat - a.lat) * ky], B = [(b.lon - a.lon) * kx, (b.lat - a.lat) * ky];
  const len2 = B[0] ** 2 + B[1] ** 2 || 1;
  const t = Math.max(0, Math.min(1, (P[0] * B[0] + P[1] * B[1]) / len2));
  return Math.hypot(P[0] - t * B[0], P[1] - t * B[1]);
}
const KEY = 'kinderguide.v2';
const state = Object.assign({
  lang: null, age: 'any', home: null, work: null, route: false, radius: 5, query: '',
  french: false, indigenous: false, agencies: true, okOnly: false,
  shortlist: [], notes: {}, visited: {}, answers: {}, qnotes: {}, clFor: 'general', clMode: 'top',
  tasks: {}, estAge: 'toddler', estDays: 5, tourDone: false, slMode: 'list', gplaces: {},
  trainOnly: false, wait: {}, hints: {},
}, (() => {
  try {
    const v2 = JSON.parse(localStorage.getItem(KEY));
    if (v2) return v2;
    const v1 = JSON.parse(localStorage.getItem('kinderguide.v1'));   // keep a Prototype 1 shortlist
    return v1 ? { shortlist: v1.shortlist || [], notes: v1.notes || {}, visited: v1.visited || {}, answers: v1.answers || {}, qnotes: v1.qnotes || {}, age: v1.age || 'any', home: v1.center || null, tourDone: !!v1.tourDone } : {};
  } catch (e) { return {}; }
})());
state.shortlist = state.shortlist.filter(id => BY_ID[id]);
state.wait = state.wait || {}; state.hints = state.hints || {};
const params = new URLSearchParams(location.search);
if (params.get('lang') === 'fr' || params.get('lang') === 'en') state.lang = params.get('lang');
if (!state.lang) state.lang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: works, not saved */ } }

const t = (k, ...a) => { const v = (I18N[state.lang] || I18N.en)[k] ?? I18N.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
const tr = o => (o && typeof o === 'object') ? (o[state.lang] ?? o.en) : o;   // pick the text in the current language
const fmt = n => n.toLocaleString(state.lang === 'fr' ? 'fr-CA' : 'en-CA');
const kmText = d => `${d < 10 ? d.toFixed(1).replace('.', state.lang === 'fr' ? ',' : '.') : Math.round(d)} km`;
const dateText = d => new Date(d + 'T12:00:00').toLocaleDateString(state.lang === 'fr' ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

let toastTimer;
function toast(msg, ms = 2600) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ } ta.remove(); return ok; }
}
function downloadIcs(name, events) {
  const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KinderGuide Ottawa//EN'];
  events.forEach((e, i) => lines.push('BEGIN:VEVENT', `UID:kg-${Date.now()}-${i}@kinderguide`, `DTSTAMP:${ymd(new Date())}T000000Z`, `DTSTART;VALUE=DATE:${ymd(e.date)}`,
    ...(e.rrule ? [e.rrule] : []), `SUMMARY:${e.title}`, `DESCRIPTION:${e.desc}`, 'BEGIN:VALARM', 'TRIGGER:PT9H', 'ACTION:DISPLAY', `DESCRIPTION:${e.title}`, 'END:VALARM', 'END:VEVENT'));
  lines.push('END:VCALENDAR');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
const fold = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();   // ignore accents and case
const ext = (url, label, cls = 'btn ghost small') => `<a class="${cls}" href="${url}" target="_blank" rel="noopener">${esc(label)} ${ic('external', 'sm')}</a>`;

// Ottawa Public Health inspection status of a provider
function insp(p) {
  const r = INSPECTIONS[p.id];
  if (!r) return { kind: p.kind === 'home' ? 'na' : 'none' };
  const recent = r.last >= new Date(Date.now() - 3 * 365 * 864e5).toISOString().slice(0, 10);
  return { kind: !recent ? 'old' : r.ok ? 'ok' : 'bad', r };
}
function inspBadge(p, short) {
  const s = insp(p);
  if (s.kind === 'na') return '';
  if (s.kind === 'ok') return `<span class="badge ok" title="${esc(t('inspBy'))}">${ic('check', 'sm')}${esc(short ? t('inspOk') : t('inspOk') + ' · ' + dateText(s.r.last))}</span>`;
  if (s.kind === 'bad') return `<span class="badge bad" title="${esc(t('inspBy'))}">${ic('alert', 'sm')}${esc(short ? t('inspBad') : t('inspBad') + ' · ' + dateText(s.r.last))}</span>`;
  if (s.kind === 'old') return short ? '' : `<span class="badge none">${esc(t('inspOld', s.r.last.slice(0, 4)))}</span>`;
  return short ? '' : `<span class="badge none">${esc(t('inspNone'))}</span>`;
}

// Addresses as people write them. The City's file puts some French street types after the name ("349 Olmstead Rue")
// and has a few incomplete ones; ADDR_FIX entries were checked against OpenStreetMap (Nov 3). Only the display changes.
const ADDR_FIX = { c2: 'Confederation Building, 229 Wellington Street', c145: 'Statistics Canada Main Building, 150 Tunney’s Pasture Driveway', c44: '116-4100 Strandherd Drive',
  c25: '1349 Randall Avenue', c27: '2605 Alta Vista Drive', c28: '557 Queen Mary Street', c30: '700 Montréal Road', c31: '258 Lisgar Street', c143: '100 Thomas More Private',
  c113: '5473 Abbott Street East', c196: '5473 Abbott Street East', c199: '2450 River Mist Road', c270: '88 Main Street', c279: '6025 Longleaf Drive', c273: '2540 Kaladar Avenue' };
const FR_EN = { Rue: 'Street', Chemin: 'Road', Promenade: 'Drive', Croissant: 'Crescent', Terrasse: 'Terrace', Cour: 'Court', Voie: 'Way' };
const EN_FR = { Street: 'rue', Road: 'chemin', Drive: 'promenade', Avenue: 'avenue', Crescent: 'croissant', Terrace: 'terrasse', Boulevard: 'boulevard', Court: 'cour', Place: 'place', Way: 'voie', Private: 'privé', Parkway: 'promenade' };
const DIRS = { Est: 'East', Ouest: 'West', Nord: 'North', Sud: 'South' }, DIRS_FR = { East: 'Est', West: 'Ouest', North: 'Nord', South: 'Sud' };
const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'of', 'the', 'and', 'et']);
const addrCache = {};
function addr(p) {
  const k = state.lang + p.id; if (k in addrCache) return addrCache[k];
  let a = ADDR_FIX[p.id] || p.address.replace(/ (Rue|Chemin|Promenade|Croissant|Terrasse|Cour|Voie)( (Est|Ouest|Nord|Sud))?$/, (m, ty, _, d) => ' ' + FR_EN[ty] + (d ? ' ' + DIRS[d] : ''))
    .replace(/\b[a-z][a-z]+\b/g, w => SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1));
  if (state.lang === 'fr') {   // "349 Olmstead Street" → "349, rue Olmstead"
    const cut = a.lastIndexOf(', '), head = cut < 0 ? '' : a.slice(0, cut + 2), m = a.slice(cut + 1).trim().match(/^([\d-]+[A-Z]?) (.+) (Street|Road|Drive|Avenue|Crescent|Terrace|Boulevard|Court|Place|Way|Private|Parkway)(?: (East|West|North|South))?$/);
    if (m && !/^(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)$/.test(m[2])) a = `${head}${m[1]}, ${EN_FR[m[3]]} ${m[2]}${m[4] ? ' ' + DIRS_FR[m[4]] : ''}`;
  }
  return (addrCache[k] = a);
}

/* ---------- 2. Navigation and stepper ---------- */
let current = 'home';
function stepDone(s) {
  if (s === 'find') return !!state.home || state.shortlist.length > 0;
  if (s === 'shortlist') return state.shortlist.length >= MIN_PICKS;
  if (s === 'visit' || s === 'apply') return stepStatus(s).k === 'stDone';   // same rule as the status on the home page
  return false;
}
// The step a parent would go to next from this page (null: nothing to do yet, or the last step)
function nextFrom(v) { const n = state.shortlist.length; return v === 'find' || v === 'shortlist' ? (n ? STEPS[STEPS.indexOf(v) + 1] : null) : v === 'visit' ? 'apply' : null; }
function renderStepper() {
  const n = state.shortlist.length, nx = nextFrom(current);
  const done = s => s !== 'find' && stepDone(s);   // Find is never "done": parents keep coming back to it
  const badge = s => s === 'shortlist' && n ? `<span class="badge-n" aria-label="${esc(t('stSaved', n))}">${n}</span>` : '';
  $('stepper').innerHTML = STEPS.map((s, i) => `${i ? '<span class="sep" aria-hidden="true"></span>' : ''}<button class="step${current === s ? ' on' : ''}${done(s) ? ' done' : ''}" data-view="${s}" ${current === s ? 'aria-current="step"' : ''}>
      <span class="num">${done(s) && current !== s ? ic('check', 'sm') : i + 1}${badge(s)}</span><span class="lbl">${esc(t('step' + (i + 1)))}</span></button>`).join('');
  // Phones: one bar. The next step's tab is filled in, so it also does the job of the "Next" button.
  $('bottomNav').innerHTML = [...STEPS.map((s, i) => `<button data-view="${s}" class="${current === s ? 'on' : ''}${nx === s ? ' next' : ''}"${nx === s ? ` aria-label="${esc(t('nextTab', t('step' + (i + 1))))}"` : ''}><span class="num">${done(s) && current !== s ? ic('check', 'sm') : nx === s ? ic('arrow', 'sm') : i + 1}${badge(s)}</span>${esc(t('step' + (i + 1)))}</button>`),
    `<button data-view="services" class="${current === 'services' ? 'on' : ''}"><span class="num">${ic('grid', 'sm')}</span>${esc(t('svcShort'))}</button>`].join('');
  $('svcBtn').classList.toggle('on', current === 'services');
}
function go(view, { scroll = true } = {}) {
  if (!$('view-' + view)) view = 'home';
  current = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
  if (location.hash !== '#' + view) history.replaceState(null, '', location.pathname + location.search + '#' + view);
  if (scroll) window.scrollTo({ top: 0 });
  closePanel(); hideKip();
  ({ home: renderHome, find: renderFind, shortlist: renderShortlist, visit: renderVisit, apply: renderApply, services: renderServices, about: renderAbout, insights: renderInsights })[view]();
  renderStepper(); renderDock(); showHint(view);
  if (!document.body.classList.contains('ready')) requestAnimationFrame(() => document.body.classList.add('ready'));   // no fade on the first page, so a link opens its page at once
  if (view === 'find') setTimeout(() => { if (map) { map.invalidateSize(); renderMap(lastList); } }, 120);
  const idx = STEPS.indexOf(view);
  ['slEyebrow', 'vEyebrow', 'aEyebrow'].forEach(id => { const n = { slEyebrow: 2, vEyebrow: 3, aEyebrow: 4 }[id]; $(id).textContent = `${state.lang === 'fr' ? 'Étape' : 'Step'} ${n} ${state.lang === 'fr' ? 'sur' : 'of'} 4`; });
  document.title = (idx >= 0 ? `${idx + 1}. ${t('step' + (idx + 1))} · ` : view === 'services' ? t('services') + ' · ' : view === 'insights' ? t('insTitle') + ' · ' : '') + 'KinderGuide Ottawa';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) { e.preventDefault(); go(b.dataset.view); }
});
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v.startsWith('p/')) { if (BY_ID[v.slice(2)] && activeId !== v.slice(2)) { if (current !== 'find') go('find'); openPanel(v.slice(2)); } return; } if (v && v !== current) go(v); });
// Next-step bar, fixed at the bottom of each step: what you have done so far and a button named after the next step
function renderDock() {
  const n = state.shortlist.length, d = $('dock');
  const info = (icon, b, small) => `<div class="dock-info"><span class="dock-ic">${icon}</span><span><b>${esc(b)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span></div>`;
  const btn = (view, label, cls = 'primary', back) => `<button class="btn ${cls}" data-view="${view}">${back ? ic('back', 'sm') : ''}${esc(label)}${back ? '' : ic('arrow', 'sm')}</button>`;
  let html = '';   // computers only (phones use the bottom bar); nothing when there is no next step yet
  if (current === 'find' && n) html = info(ic('heart'), t('dockSaved', n), t('dockSavedS', n)) + btn('shortlist', t('dockToShortlist', n));
  else if (current === 'shortlist' && n) html = info(ic('clipboard'), t('dockSlS'), '') + `<div class="dock-btns">${btn('find', t('dockMore'), 'ghost', true)}${btn('visit', t('dockToVisit'))}</div>`;
  else if (current === 'visit') { html = info(ic('file'), t('dockApply'), t('dockApplyS')) + `<div class="dock-btns">${btn('shortlist', t('step2'), 'ghost', true)}${btn('apply', t('dockToApply'))}</div>`; }
  d.innerHTML = html; d.hidden = !html; document.body.classList.toggle('has-dock', !!html);
}

/* ---------- 3. Home ---------- */
function renderAgeChips(el) {
  el.innerHTML = [...AGES.map(a => [a.key, tr(a.label)]), ['any', t('any')]].map(([k, l]) => `<button type="button" class="chip${state.age === k ? ' on' : ''}" data-age="${k}" aria-pressed="${state.age === k}">${esc(l)}</button>`).join('');
}
$('ageChips').addEventListener('click', e => { const b = e.target.closest('[data-age]'); if (!b) return; state.age = b.dataset.age; save(); renderAgeChips($('ageChips')); });
async function lookupPostal(code, statusEl) {
  const clean = code.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(clean)) { if (statusEl) statusEl.textContent = t('badPostal'); return null; }
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&country=Canada&postalcode=' + encodeURIComponent(clean.slice(0, 3) + ' ' + clean.slice(3));
    const hit = (await (await fetch(url, { headers: { 'Accept-Language': state.lang } })).json())[0];
    if (!hit) throw new Error('not found');
    return { lat: +hit.lat, lon: +hit.lon, label: clean.slice(0, 3) + ' ' + clean.slice(3) };
  } catch (e) { if (statusEl) statusEl.textContent = t('notFound'); return null; }
}
function locate(cb) {
  if (!navigator.geolocation) { cb(null); return; }
  navigator.geolocation.getCurrentPosition(pos => cb({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'GPS' }), () => cb(null), { timeout: 10000 });
}
$('locateBtn').addEventListener('click', () => {
  $('nearStatus').textContent = t('locating');
  locate(c => { if (!c) { $('nearStatus').textContent = t('locDenied'); return; } state.home = c; save(); $('nearStatus').textContent = t('nearX', t('yourLoc')); });
});
$('quick').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('postalInput').value.trim(), btn = e.submitter || $('quick').querySelector('[type=submit]');
  if (code) { btn.disabled = true; btn.classList.add('busy'); const c = await lookupPostal(code, $('nearStatus')); btn.disabled = false; btn.classList.remove('busy'); if (!c) return; state.home = c; }
  save(); go('find');
});
// Child's age group on the date care is needed (Ontario groups; kindergarten starts in September of the year the child turns 4)
const ymd = d => d.toISOString().slice(0, 10);
const addMonths = (iso, m) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + m); return ymd(d); };
function monthsBetween(a, b) { const x = new Date(a + 'T12:00:00'), y = new Date(b + 'T12:00:00'); return (y.getFullYear() - x.getFullYear()) * 12 + y.getMonth() - x.getMonth() - (y.getDate() < x.getDate() ? 1 : 0); }
function ageGroupAt(birth, when) {
  const by = +birth.slice(0, 4);
  if (when >= `${by + 6}-09-01`) return 'schoolAge';
  if (when >= `${by + 4}-09-01`) return 'kindergarten';
  const m = monthsBetween(birth, when);
  return m < 18 ? 'infant' : m < 30 ? 'toddler' : 'preschool';
}
function ageWhen(birth, when) {
  const m = monthsBetween(birth, when);
  if (when < birth) return t('notBorn');
  return m < 24 ? t('ageMonths', Math.max(0, m)) : t('ageYears', Math.floor(m / 12), m % 12);
}
function startInfo() {
  if (!state.birth) return null;
  const when = state.need && state.need > ymd(new Date()) ? state.need : ymd(new Date());
  return { when, group: ageGroupAt(state.birth, when) };
}
function applyDates() {
  const si = startInfo();
  if (si) { state.age = si.group; }
  save();
  const h = $('datesHint');
  if (h) h.textContent = si ? t('datesHint', tr(AGE[si.group].label).toLowerCase(), ageWhen(state.birth, si.when), dateText(si.when)) : '';
  renderAgeChips($('ageChips'));
}
['birthInput', 'needInput'].forEach(id => $(id).addEventListener('change', () => { state.birth = $('birthInput').value || null; state.need = $('needInput').value || null; applyDates(); }));
const STEP_COLORS = ['var(--teal)', 'var(--teal)', 'var(--teal)', 'var(--teal)'];
function stepStatus(s) {
  const n = state.shortlist.length;
  if (s === 'find') return stepDone('find') ? { k: 'stDone' } : { k: 'stStart' };
  if (s === 'shortlist') return !n ? { k: 'stNot' } : { k: n >= MIN_PICKS ? 'stDone' : 'stProg', d: t('stSaved', n) };
  if (s === 'visit') { const c = state.shortlist.filter(id => Object.values(state.answers[id] || {}).some(Boolean)).length; return !c ? { k: 'stNot' } : { k: n && c >= n ? 'stDone' : 'stProg', d: t('stChecked', c) }; }
  const reg = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'], d = reg.filter(k => (state.ap || {})[k]).length; return !d ? { k: 'stNot' } : { k: d === reg.length ? 'stDone' : 'stProg', d: t('stTasks', d) };
}
function renderHome() {
  renderAgeChips($('ageChips'));
  $('postalInput').placeholder = t('postal');
  if (state.home && !$('postalInput').value) $('postalInput').value = state.home.label === 'GPS' ? '' : state.home.label;
  $('nearStatus').textContent = state.home ? t('nearX', state.home.label === 'GPS' ? t('yourLoc') : state.home.label) : '';
  $('birthInput').value = state.birth || ''; $('needInput').value = state.need || '';
  if (state.birth) { $('datesBox').open = true; applyDates(); }
  const icons4 = ['search', 'heart', 'clipboard', 'file'];
  // Each step shows where the parent is (GOV.UK task list statuses); a returning parent gets one "Continue" button
  const st = STEPS.map(stepStatus), nextI = st.findIndex(x => x.k !== 'stDone'), back = st.some(x => x.k !== 'stNot' && x.k !== 'stStart');
  $('steps4').innerHTML = STEPS.map((s, i) => `<button class="s4 glass${i === nextI && back ? ' next' : ''}" data-view="${s}"><span class="n">${ic(icons4[i])}<i>${i + 1}</i></span><b>${esc(t('step' + (i + 1)))}</b><span>${esc(t('s' + (i + 1) + 'sub'))}</span>
    <em class="st ${st[i].k}">${st[i].k === 'stDone' ? ic('check', 'sm') : ''}${esc(t(st[i].k))}${st[i].d ? ' · ' + esc(st[i].d) : ''}</em></button>`).join('');
  $('welcome').hidden = !back;
  $('welcome').innerHTML = back ? `<div><b>${esc(t('wbTitle'))}</b><span>${esc(t('wbLead'))}</span></div><button class="btn primary" data-view="${STEPS[nextI < 0 ? 3 : nextI]}">${esc(t('wbGo', t('nextLbl')[STEPS[nextI < 0 ? 3 : nextI]]))}${ic('arrow', 'sm')}</button>` : '';
  // No "licensed spaces" total here: it reads like open spots, which the data cannot show
  $('stats').innerHTML = `<div><b>${fmt(PROVIDERS.length)}</b><span>${esc(t('statPrograms'))}</span></div><div><b>${fmt(Object.keys(INSPECTIONS).length)}</b><span>${esc(t('statInspected'))}</span></div><div><b>${fmt(SERVICES.length)}</b><span>${esc(t('statServices'))}</span></div>`;
  $('svcRow').innerHTML = SERVICES.filter(s => s.top).map(serviceCard).join('');
}
function serviceCard(s) {
  const g = SERVICE_GROUPS.find(x => x.id === s.group);
  return `<a class="svc glass" href="${SOURCES[s.src].url}" target="_blank" rel="noopener"><span class="ico">${ic(g.icon)}</span>
    <span><b>${esc(tr(s.name))}</b><p>${esc(tr(s.what))}</p><span class="badge ${s.who}">${esc(t('official'))} · ${esc(t(s.who))}</span></span><span class="go">${ic('external', 'sm')}</span></a>`;
}

/* ---------- 4. Step 1: Find ---------- */
let map, markerLayer, homeMarker, workMarker, radiusCircle, routeLine, activeId = null, editing = null;
const markers = {};
const COLORS = { centre: '#0f6b6b', home: '#7b5ea7', saved: '#102a33' };
function renderFindControls() {
  $('fAge').innerHTML = `<option value="any">${esc(t('any'))}</option>` + AGES.map(a => `<option value="${a.key}">${esc(tr(a.long))}</option>`).join('');
  $('fAge').value = state.age;
  const lbl = c => c ? (c.label === 'GPS' ? t('yourLoc') : c.label) : '';
  $('locBox').innerHTML = `
    <select id="fArea" aria-label="${esc(t('near'))}"><option value="">${esc(t('anyArea'))}</option>${state.home && !AREAS.some(a => a.name === state.home.label) ? `<option value="home" selected>${esc(t('nearX', lbl(state.home)))}</option>` : ''}${AREAS.map((a, i) => `<option value="${i}" ${state.home && state.home.label === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}<option value="postal">${esc(t('postal'))}…</option></select>
    ${editing ? `<input id="locInput" class="input" placeholder="${esc(editing === 'work' ? t('workPh') : t('postal'))}" aria-label="${esc(editing === 'work' ? t('workPh') : t('postal'))}"><button class="btn primary small" id="locOk">OK</button><button class="link" id="locCancel" aria-label="Cancel">${ic('x', 'sm')}</button>`
    : state.work ? `<span class="pill on" title="${esc(t('workL'))}">${ic('briefcase', 'sm')}${esc(lbl(state.work))} <button class="link" id="clearWork" aria-label="Remove work" style="color:#fff">${ic('x', 'sm')}</button></span>` : `<button class="pill" id="addWork">${ic('briefcase', 'sm')}${esc(t('work'))}</button>`}`;
  $('fRadius').innerHTML = [[2, '2 km'], [5, '5 km'], [10, '10 km'], [0, t('all')]].map(([v, l]) => `<button type="button" data-r="${v}" class="${state.radius === v ? 'on' : ''}">${esc(l)}</button>`).join('');
  $('fRadius').setAttribute('aria-label', t('within'));
  $('fQuery').placeholder = t('search'); $('fQuery').value = state.query;
  const n = [state.french, state.indigenous, !state.agencies, state.okOnly, state.trainOnly, state.route].filter(Boolean).length;
  $('fCount').hidden = !n; $('fCount').textContent = n;
  const sum = [state.age === 'any' ? t('any') : tr(AGE[state.age].label), state.home ? t('nearX', lbl(state.home)) : t('fAll'), ...(state.home && !routeOn() ? [state.radius ? state.radius + ' km' : t('all')] : []), ...(state.query ? ['“' + state.query + '”'] : []), ...(n ? [t('fN', n)] : [])];
  $('fSum').innerHTML = `${ic('filter', 'sm')}<span>${esc(sum.join(' · '))}</span><b>${esc(t('fEdit'))}</b>`;   // phones: the filters fold into this one line
  $('filterPop').innerHTML = [['french', 'french'], ['indigenous', 'indigenous'], ['agencies', 'homeAg'], ['okOnly', 'okOnly'], ['trainOnly', 'nearTrain']]
    .map(([k, l]) => `<label class="check"><input type="checkbox" data-f="${k}" ${state[k] ? 'checked' : ''}> ${esc(t(l))}</label>`).join('') +
    (state.home && state.work ? `<label class="check"><input type="checkbox" data-f="route" ${state.route ? 'checked' : ''}> ${ic('route', 'sm')}${esc(t('onRoute'))}</label>` : '');
  $('legend').innerHTML = `<span><i style="background:${COLORS.centre}"></i>${state.lang === 'fr' ? 'Centre' : 'Centre'}</span><span><i style="background:${COLORS.home}"></i>${esc(t('agency'))}</span><span><i style="background:${COLORS.saved}"></i>${esc(t('saved'))}</span>`;
}
document.querySelector('.find-bar').addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'fAge') { state.age = el.value; }
  else if (el.id === 'fArea') {
    if (el.value === 'postal') { editing = 'home'; renderFindControls(); $('locInput').focus(); return; }
    else if (el.value === '') state.home = null;
    else if (el.value !== 'home') { const a = AREAS[+el.value]; state.home = { lat: a.lat, lon: a.lon, label: a.name }; }
  } else if (el.dataset.f) { state[el.dataset.f] = el.checked; }
  save(); renderFind();
});
document.querySelector('.find-bar').addEventListener('click', async e => {
  if (e.target.closest('#fSum')) { const b = document.querySelector('.find-bar'); b.classList.toggle('open'); $('fSum').setAttribute('aria-expanded', String(b.classList.contains('open'))); return; }
  const r = e.target.closest('[data-r]'); if (r) { state.radius = +r.dataset.r; save(); renderFind(); return; }
  if (e.target.closest('#filterBtn')) { const pop = $('filterPop'); pop.hidden = !pop.hidden; $('filterBtn').setAttribute('aria-expanded', String(!pop.hidden)); return; }
  if (e.target.closest('#addWork')) { editing = 'work'; renderFindControls(); $('locInput').focus(); return; }
  if (e.target.closest('#locCancel')) { editing = null; renderFindControls(); return; }
  if (e.target.closest('#locOk')) { await submitLoc(); return; }
  if (e.target.closest('#clearWork')) { state.work = null; state.route = false; save(); renderFind(); }
});
async function submitLoc() {
  const c = await lookupPostal($('locInput').value, null);
  if (!c) { toast(t('badPostal')); return; }
  if (editing === 'work') { state.work = c; state.route = !!state.home; } else state.home = c;
  editing = null; save(); renderFind();
}
document.querySelector('.find-bar').addEventListener('keydown', e => { if (e.target.id === 'locInput' && e.key === 'Enter') { e.preventDefault(); submitLoc(); } });
$('fQuery').addEventListener('input', () => { state.query = $('fQuery').value.trim(); save(); renderList(); });
document.addEventListener('click', e => { if (!e.target.closest('#filterPop, #filterBtn')) { $('filterPop').hidden = true; $('filterBtn').setAttribute('aria-expanded', 'false'); } });

function routeOn() { return state.route && state.home && state.work; }
function matches(p) {
  if (p.kind === 'home' && !state.agencies) return false;
  if (state.french && !p.french) return false;
  if (state.indigenous && !p.indigenous) return false;
  if (state.okOnly && insp(p).kind !== 'ok') return false;
  if (state.trainOnly && !(TRANSIT[p.id] && TRANSIT[p.id].train && p.kind === 'centre')) return false;
  if (state.query && !fold([p.name, p.address, p.operator, p.city, p.postal].join(' ')).includes(fold(state.query))) return false;
  if (p.kind === 'centre' && state.age !== 'any' && !(p.spaces[state.age] > 0)) return false;
  if (routeOn()) return kmToSegment(p, state.home, state.work) <= Math.max(1.5, (state.radius || 5) / 3);
  if (state.home && state.radius > 0 && km(state.home, p) > state.radius) return false;
  return true;
}
const detour = p => km(state.home, p) + km(p, state.work) - km(state.home, state.work);
function sortedList() {
  const list = PROVIDERS.filter(matches);
  if (routeOn()) list.sort((a, b) => detour(a) - detour(b));
  else if (state.home) list.sort((a, b) => km(state.home, a) - km(state.home, b));
  else list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}
const trainOf = p => p.kind === 'centre' && TRANSIT[p.id] && TRANSIT[p.id].train ? TRANSIT[p.id] : null;
const extraTags = p => (p.french ? `<span class="tag fr">FR</span>` : '') + (p.indigenous ? `<span class="tag ind">${esc(t('indigenous'))}</span>` : '');
// Card status line: the inspection (a problem stands out in red), then the O-Train
function cardStatus(p) {
  const s = insp(p), x = trainOf(p), out = [];
  if (s.kind === 'ok') out.push(`<span class="st-ok" title="${esc(t('inspBy'))}">${ic('check', 'sm')}${esc(t('inspOk'))}</span>`);
  else if (s.kind === 'bad') out.push(`<span class="badge bad" title="${esc(t('inspBy'))}">${ic('alert', 'sm')}${esc(t('inspBad'))}</span>`);
  else if (s.kind !== 'na') out.push(`<span class="st-none">${esc(s.kind === 'old' ? t('inspOld', s.r.last.slice(0, 4)) : t('gNoInsp'))}</span>`);
  if (x) out.push(`<span title="${esc(t('trainNear', x.train, fmt(x.trainM)))}">${ic('train', 'sm')}O-Train ${fmt(x.trainM)} m</span>`);
  return out.join('<i class="sep-dot" aria-hidden="true">·</i>');
}
// Licensed spaces are a listing, not an open spot, so they are plain text
function cardFacts(p) {
  if (p.kind === 'home') return `<span class="tag home">${esc(t('agency'))}</span>`;
  const ages = AGES.filter(a => p.spaces[a.key] > 0);
  const txt = state.age === 'any' ? ages.map(a => tr(a.label)).join(' · ') : t('spacesFor', p.spaces[state.age], tr(AGE[state.age].label).toLowerCase()) + (ages.length > 1 ? ' · ' + t('moreAges', ages.length - 1) : '');
  return `<span class="facts">${esc(txt)}</span>`;
}
function distText(p) {
  if (routeOn()) return detour(p) < .15 ? t('onWay') : `+${kmText(detour(p))} ${t('detour')}`;
  return state.home ? (p.approx ? t('approxD', kmText(km(state.home, p))) : kmText(km(state.home, p))) : '';
}
function heartBtn(id) { const on = state.shortlist.includes(id); return `<button class="heart${on ? ' on' : ''}" data-save="${id}" aria-pressed="${on}">${ic('heart', 'sm')}${esc(on ? t('saved') : t('save'))}</button>`; }
function renderFind() {
  listMax = 40; renderFindControls(); renderList();
  const m = document.body.classList.contains('m-map');
  $('mSwitch').innerHTML = [['list', 'list', t('mList')], ['map', 'map', t('mMap')]].map(([k, icon, l]) => `<button type="button" data-msw="${k}" class="${(k === 'map') === m ? 'on' : ''}" aria-pressed="${(k === 'map') === m}">${ic(icon, 'sm')}${esc(l)}</button>`).join('');
}
// Phones: list or map, one at a time (the map gets the whole screen)
$('mSwitch').addEventListener('click', e => { const b = e.target.closest('[data-msw]'); if (!b) return; document.body.classList.toggle('m-map', b.dataset.msw === 'map'); renderFind(); setTimeout(() => { if (map) { map.invalidateSize(); renderMap(lastList); } }, 200); });
let lastList = [], listMax = 40;   // 40 cards at first (quick to draw), more on request
function renderList() {
  const list = lastList = sortedList();
  renderStory(list);
  renderTip(list);
  $('results').innerHTML = list.length ? list.slice(0, listMax).map(p => { const d = distText(p);
    return `<article class="pc glass${p.id === activeId ? ' active' : ''}${insp(p).kind === 'bad' ? ' is-bad' : ''}" data-id="${p.id}" tabindex="0" aria-label="${esc(p.name)}">
      <div class="pc-top"><div><h3>${esc(p.name)}</h3><div class="where">${esc(addr(p))}</div></div><div class="pc-side">${d ? `<b class="dist"${p.approx ? ` title="${esc(t('approxTip'))}"` : ''}>${esc(d)}</b>` : ''}${heartBtn(p.id)}</div></div>
      <div class="pc-status">${cardStatus(p)}</div>
      <div class="pc-foot">${cardFacts(p)}${extraTags(p)}</div></article>`; }).join('') + (list.length > listMax ? `<button class="btn ghost wide more-btn" data-more>${esc(t('showMore', Math.min(60, list.length - listMax)))}</button>` : '')
    : `<div class="empty glass">${esc(t('noResults'))}</div>`;
  const stale = (Date.now() - new Date(DATA_META.downloaded + 'T12:00:00')) / 864e5 > STALE_DAYS;
  $('results').insertAdjacentHTML('beforeend', `<p class="data-date${stale ? ' stale' : ''}">${ic(stale ? 'alert' : 'info', 'sm')}${esc(stale ? t('stale', dateText(DATA_META.downloaded)) : t('dataDate', dateText(DATA_META.downloaded), dateText(INSPECTIONS_META.feed)))} <button class="link" data-view="about">${esc(t('footerAbout'))}</button></p>`);
  renderMap(list);
}
// What is typical in Ottawa: licensed spaces for this age within the same radius of each named area, median
const cityCache = {};
function cityMedian(age, r) {
  const k = age + r; if (k in cityCache) return cityCache[k];
  const v = AREAS.map(a => CENTRES.filter(p => km(a, p) <= r).reduce((n, p) => n + (age ? p.spaces[age] || 0 : p.capacity), 0)).sort((x, y) => x - y);
  return (cityCache[k] = v[Math.floor(v.length / 2)]);
}
// The results told as a short story: how many, how many spaces for your child's age, how many passed inspection, how many near the O-Train
function renderStory(list) {
  const age = state.age !== 'any' ? state.age : null, ageWord = age ? t('storyAge')[age] : '';
  const lbl = state.home ? (state.home.label === 'GPS' ? t('yourLoc') : state.home.label) : '';
  const where = routeOn() ? t('storyRoute') : state.home && state.radius > 0 ? t('storyWithin', state.radius, lbl) : state.home ? t('storyCity') : t('storyCity');
  const centres = list.filter(p => p.kind === 'centre');
  const spaces = centres.reduce((n, p) => n + (age ? p.spaces[age] || 0 : p.capacity), 0);
  const ik = list.map(p => insp(p).kind), ok = ik.filter(k => k === 'ok').length, bad = ik.filter(k => k === 'bad').length, norep = ik.filter(k => k === 'none' || k === 'old').length, train = centres.filter(p => trainOf(p)).length;   // most of the rest have no recent report, not a failed one
  const med = state.home && !routeOn() && state.radius > 0 && !state.query ? cityMedian(age, state.radius) : null;   // compare only like with like: same circle, no name search
  const band = med ? [spaces < med * .7 ? 'bandLow' : spaces > med * 1.3 ? 'bandHigh' : 'bandMid', med] : null;
  const chips = [['french', 'french'], ['indigenous', 'indigenous'], ['okOnly', 'okOnly'], ['trainOnly', 'nearTrain']].filter(([k]) => state[k])
    .concat(!state.agencies ? [['agencies', 'homeAg', true]] : []).concat(state.query ? [['query', null]] : []);
  $('resultCount').innerHTML = `<p class="story"><b>${esc(t('storyN', list.length))}</b> ${age ? esc(t('storyFor', ageWord)) + ' ' : ''}${esc(where)}</p>
    ${list.length ? `<div class="story-nums"><span><b>${fmt(spaces)}</b>${esc(t('stSpaces', ageWord))}${band ? ` <em class="band ${band[0]}" title="${esc(t('cmpCity', fmt(band[1])) + '. ' + t('cityNote'))}">${esc(t(band[0]))}</em>` : ''}</span><span class="story-insp"><span><b>${fmt(ok)}</b>${esc(t('stOk'))}</span>${bad ? `<span class="bad"><b>${fmt(bad)}</b>${esc(t('stBad'))}</span>` : ''}${norep ? `<span><b>${fmt(norep)}</b>${esc(t('stNoRep'))}</span>` : ''}</span><span><b>${fmt(train)}</b>${esc(t('stTrain'))}</span></div>` : ''}
    ${age && list.length && !spaces ? `<p class="story-none">${ic('alert', 'sm')}${esc(t('stNone', ageWord))}</p>` : ''}
    ${chips.length ? `<div class="fchips">${chips.length > 1 ? `<button class="fchip clear" data-unf="all">${esc(t('clearAll'))}</button>` : ''}${chips.map(([k, l, neg]) => `<button class="fchip" data-unf="${k}" aria-label="${esc(t('chipClear'))}: ${esc(l ? t(l) : state.query)}">${neg ? '− ' : ''}${esc(l ? t(l) : '“' + state.query + '”')}${ic('x', 'sm')}</button>`).join('')}</div>` : ''}`;
}
$('resultCount').addEventListener('click', e => {
  const b = e.target.closest('[data-unf]'); if (!b) return;
  const k = b.dataset.unf; if (k === 'all') Object.assign(state, { query: '', agencies: true, french: false, indigenous: false, okOnly: false, trainOnly: false }); else if (k === 'query') state.query = ''; else if (k === 'agencies') state.agencies = true; else state[k] = false;
  save(); renderFind();
});
// List and map point at each other: hovering a card grows its dot, hovering a dot outlines its card
let hoverId = null;
function hoverOn(id) {
  if (hoverId === id) return;
  const prev = hoverId; hoverId = id;
  [prev, id].forEach(x => { if (x && markers[x]) { markers[x].setStyle(markerStyle(BY_ID[x])); if (x === id) markers[x].bringToFront(); } });
  document.querySelectorAll('.pc.hover').forEach(c => c.classList.remove('hover'));
  if (id) { const c = document.querySelector(`.pc[data-id="${id}"]`); if (c) c.classList.add('hover'); }
}
$('results').addEventListener('mouseover', e => { const c = e.target.closest('.pc'); hoverOn(c ? c.dataset.id : null); });
$('results').addEventListener('mouseleave', () => hoverOn(null));
function renderTip(list) {
  let html = '';   // a hint where it is needed, until the first save (it replaced the tour)
  if (!state.shortlist.length && !state.hints.save) html += `<div class="tip info save-hint">${ic('heart', 'sm')}<span><b>${esc(t('saveHintT'))}</b> ${esc(t('saveHint'))}</span></div>`;
  const si = startInfo();
  if (si && state.age === si.group) html += `<div class="tip info">${ic('calendar', 'sm')}<span>${esc(t('ageAtStart', tr(AGE[si.group].label).toLowerCase(), dateText(si.when)))}</span></div>`;
  if (list.length < MIN_PICKS) {   // few results: show every way out, each with how many programs it would give
    const opts = [];
    if (state.home && !routeOn() && state.radius > 0) { const next = [5, 10, 0].find(r => (r === 0 || r > state.radius) && countWith({ radius: r }) > list.length); if (next !== undefined) opts.push([`data-r="${next}"`, next ? t('tipWiden', next, countWith({ radius: next })) : t('tipAll', countWith({ radius: 0 }))]); }
    [['french', 'french'], ['indigenous', 'indigenous'], ['okOnly', 'okOnly'], ['trainOnly', 'nearTrain']].filter(([k]) => state[k]).forEach(([k, l]) => { const n = countWith({ [k]: false }); if (n > list.length) opts.push([`data-unf="${k}"`, t('tipWithout', t(l), n)]); });
    if (state.query) { const n = countWith({ query: '' }); if (n > list.length) opts.push([`data-unf="query"`, t('tipWithout', state.query, n)]); }
    if (state.age !== 'any') { const n = countWith({ age: 'any' }); if (n > list.length) opts.push([`data-anyage="1"`, t('tipNoAge', n)]); }
    if (opts.length) html += `<div class="tip warn">${ic('info', 'sm')}<span>${esc(list.length ? t('tipFew', list.length, '', state.radius || '–') : t('noResults'))}</span><div class="tip-opts">${opts.slice(0, 3).map(([a, l], i) => `<button class="btn small ${i ? 'ghost' : 'primary'}" ${a}>${esc(l)}</button>`).join('')}</div></div>`;
  }
  $('tipBox').innerHTML = html;
}
$('tipBox').addEventListener('click', e => {
  const r = e.target.closest('[data-r]'); if (r) { state.radius = +r.dataset.r; save(); renderFind(); return; }
  const u = e.target.closest('[data-unf]'); if (u) { if (u.dataset.unf === 'query') state.query = ''; else state[u.dataset.unf] = false; save(); renderFind(); return; }
  if (e.target.closest('[data-anyage]')) { state.age = 'any'; save(); renderFind(); }
});
function countWith(patch) { const keep = {}; Object.keys(patch).forEach(k => { keep[k] = state[k]; state[k] = patch[k]; }); const n = PROVIDERS.filter(matches).length; Object.assign(state, keep); return n; }
$('results').addEventListener('click', e => {
  if (e.target.closest('[data-more]')) { listMax += 60; renderList(); return; }
  const s = e.target.closest('[data-save]'); if (s) { e.stopPropagation(); toggleShortlist(s.dataset.save); return; }
  const c = e.target.closest('.pc'); if (c) openPanel(c.dataset.id);
});
$('results').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('pc')) openPanel(e.target.dataset.id); });
function markerStyle(p) {
  return { radius: p.id === activeId || p.id === hoverId ? 11 : 7, weight: p.id === hoverId ? 3 : 2, color: '#fff', fillOpacity: .95,
    fillColor: state.shortlist.includes(p.id) ? COLORS.saved : p.kind === 'home' ? COLORS.home : COLORS.centre };
}
function initMap() {
  if (map || typeof window.L === 'undefined') return;
  map = window.L.map('map', { zoomControl: true }).setView([45.38, -75.72], 11);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  markerLayer = window.L.layerGroup().addTo(map);
  PROVIDERS.forEach(p => { markers[p.id] = window.L.circleMarker([p.lat, p.lon], markerStyle(p)).bindTooltip(esc(p.name), { direction: 'top', offset: [0, -6] }).on('click', () => openPanel(p.id)).on('mouseover', () => hoverOn(p.id)).on('mouseout', () => hoverOn(null)); });
}
const pinIcon = name => window.L.divIcon({ className: 'map-pin', html: `<span>${ic(name)}</span>`, iconSize: [34, 34], iconAnchor: [17, 34] });
function renderMap(list) {
  initMap(); if (!map) return;
  markerLayer.clearLayers();
  list.forEach(p => { markers[p.id].setStyle(markerStyle(p)); markerLayer.addLayer(markers[p.id]); });
  [homeMarker, workMarker, radiusCircle, routeLine].forEach(x => x && x.remove());
  homeMarker = workMarker = radiusCircle = routeLine = null;
  if (state.home) homeMarker = window.L.marker([state.home.lat, state.home.lon], { icon: pinIcon('home'), title: t('home') }).addTo(map);
  if (state.work) workMarker = window.L.marker([state.work.lat, state.work.lon], { icon: pinIcon('briefcase'), title: t('workL') }).addTo(map);
  if (routeOn()) {
    routeLine = window.L.polyline([[state.home.lat, state.home.lon], [state.work.lat, state.work.lon]], { color: COLORS.saved, weight: 4, dashArray: '8 8' }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  } else if (state.home && state.radius > 0) {
    radiusCircle = window.L.circle([state.home.lat, state.home.lon], { radius: state.radius * 1000, color: COLORS.centre, weight: 1, fillOpacity: .05 }).addTo(map);
    map.fitBounds(radiusCircle.getBounds(), { padding: [20, 20] });
  } else if (list.length) map.fitBounds(list.map(p => [p.lat, p.lon]), { padding: [30, 30], maxZoom: 14 });
}

/* ---------- 5. Details panel ---------- */
// Summary first (save, 4 key facts, the data limit), everything else in sections that open on click
const PSECS = [['spaces', 'child'], ['safety', 'shield'], ['transit', 'bus'], ['cost', 'dollar'], ['reviews', 'star'], ['ask', 'question']];
function openPanel(id, sec) {
  const p = BY_ID[id]; if (!p) return;
  const keep = activeId === id && $('panel').classList.contains('open') ? [...document.querySelectorAll('#panel details[open]')].map(d => d.dataset.sec) : [];
  activeId = id;
  history.replaceState(null, '', location.pathname + location.search + '#p/' + id);
  const q = encodeURIComponent(`${p.name} ${p.address} ${p.city} ON`), on = state.shortlist.includes(id);
  const secs = PSECS.filter(([k]) => k !== 'spaces' || p.kind === 'centre').filter(([k]) => k !== 'transit' || (TRANSIT[p.id] && p.kind === 'centre'));
  $('panel').innerHTML = `
    <div class="p-head">
      <button class="p-close" id="pClose" aria-label="Close">${ic('x')}</button>
      <h2 id="pTitle">${esc(p.name)}</h2>
      <div class="p-sub">${esc(addr(p))}, ${esc(p.city)} ${esc(p.postal)}${distText(p) ? ' · <b>' + esc(distText(p)) + '</b>' : ''}${p.approx ? ' · ' + esc(t('approx')) : ''}</div>
    </div>
    <div class="p-body" id="pBody">
      <button class="btn big wide p-save${on ? ' on' : ''}" data-save="${id}" aria-pressed="${on}">${ic(on ? 'check' : 'heart')}<span>${esc(on ? t('pSaved') : t('pSave'))}</span>${on ? `<small>${esc(t('pSavedS', state.shortlist.length))}</small>` : ''}</button>
      <div class="p-actions">${ext(`https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${q}`, t('directions'))}${ext(`https://www.google.com/search?q=${encodeURIComponent(p.name + ' Ottawa')}`, t('contact'))}<button class="btn ghost small" id="copyLink" aria-label="${esc(t('copyLink'))}" title="${esc(t('copyLink'))}">${ic('link', 'sm')}</button></div>
      ${glance(p)}
      <p class="p-limit">${ic('info', 'sm')}<span>${esc(t('pLimit'))}</span></p>
      <h3 class="flabel p-more">${esc(t('pMore'))}</h3>
      <div class="accs">${secs.map(([k, icon]) => `<details class="acc" data-sec="${k}"${k === sec || keep.includes(k) ? ' open' : ''}><summary>${ic(icon)}<span><b>${esc(t('sec' + k[0].toUpperCase() + k.slice(1)))}</b><small>${esc(secSummary(p, k))}</small></span>${ic('down', 'sm chev')}</summary><div class="acc-body">${secBody(p, k)}</div></details>`).join('')}</div>
      <p class="note">${p.operator ? `${state.lang === 'fr' ? 'Exploitant' : 'Operator'}: ${esc(p.operator)} · ` : ''}<button class="link" data-lic>${esc(t('verifyLic'))} ${ic('external', 'sm')}</button></p>
    </div>`;
  $('panel').classList.add('open'); $('panel').setAttribute('aria-hidden', 'false'); $('scrim').hidden = false;
  if (sec === 'reviews' || keep.includes('reviews')) loadReviews(p);
  if (sec) { const d = document.querySelector(`#panel details[data-sec="${sec}"]`); if (d) setTimeout(() => d.scrollIntoView({ block: 'nearest' }), 50); }
  if (!keep.length) $('pClose').focus();
  if (current === 'find') { document.querySelectorAll('.pc').forEach(c => c.classList.toggle('active', c.dataset.id === id)); Object.values(markers).forEach((m, i) => m.setStyle(markerStyle(PROVIDERS[i]))); }
}
// The 4 facts parents asked about most: ages, safety, getting there, cost
function glance(p) {
  const s = insp(p), x = TRANSIT[p.id], under6 = p.kind === 'home' || ['infant', 'toddler', 'preschool', 'kindergarten'].some(k => p.spaces[k] > 0);
  const ages = p.kind === 'home' ? [t('agency'), t('gHomeCare')] : [AGES.filter(a => p.spaces[a.key] > 0).map(a => tr(a.label)).join(', ') || '–', t('gLicensed', p.capacity)];
  const ins = s.kind === 'ok' ? [t('inspOk'), dateText(s.r.last), 'ok'] : s.kind === 'bad' ? [t('inspBad'), dateText(s.r.last), 'bad'] : s.kind === 'na' ? [t('agency'), t('inspNone'), ''] : [t('gNoInsp'), s.r ? s.r.last.slice(0, 4) : '', ''];
  const trip = state.home ? [distText(p), x && x.train ? t('gTrain', fmt(x.trainM)) : x && x.bus != null && x.bus <= TRANSIT_META.busMetres ? t('gBus') : ''] :
    x && x.train ? [t('gTrain', fmt(x.trainM)), x.train] : x && x.bus != null ? [x.bus <= TRANSIT_META.busMetres ? t('gBus') : t('gBusFar', fmt(x.bus)), ''] : [t('gNoTransit'), ''];
  const v = VERIFIED_PRICES[p.id];
  const cost = v ? [v.text, t('confirmed')] : under6 ? [t('gCostCap', COSTS.cap), t('gCostCapS')] : [t('gCostSchool'), t('gCostSchoolS')];
  const tile = (icon, label, [val, sub, cls]) => `<div class="g-tile${cls ? ' ' + cls : ''}">${ic(icon, 'sm')}<span class="g-l">${esc(label)}</span><b>${esc(val)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  return `<div class="glance">${tile('child', t('gAges'), ages)}${tile('shield', t('gInsp'), ins)}${tile('bus', t('gTravel'), trip)}${tile('dollar', t('gCost'), cost)}</div>`;
}
function secSummary(p, k) {
  const r = INSPECTIONS[p.id], x = TRANSIT[p.id];
  return { spaces: () => t('secSpacesS', p.capacity), safety: () => r ? t('secSafetyS', dateText(r.last), r.n2y) : t('inspNone'),
    transit: () => x && x.train ? t('trainNear', x.train, fmt(x.trainM)) : x && x.bus != null && x.bus <= TRANSIT_META.busMetres ? t('stopsNear', x.stops) : t('noTrain'),
    cost: () => t('secCostS'), reviews: () => t('revGoogle'), ask: () => t('secAskS') }[k]();
}
function costBox(p) {
  const v = VERIFIED_PRICES[p.id];
  const under6 = p.kind === 'home' || ['infant', 'toddler', 'preschool', 'kindergarten'].some(k => p.spaces[k] > 0);
  const body = v ? `<p class="big-line"><b>${esc(t('confirmed'))}:</b> ${esc(v.text)} <span class="muted">(${esc(v.how)}, ${esc(v.date)})</span></p>`
    : under6 ? `<p class="big-line">${esc(t('costCap', COSTS.cap))}</p><p class="note">${esc(t('costAsk'))}</p>` : `<p class="big-line">${esc(t('costSchool'))}</p>`;
  return `${body}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn ghost small" data-view="apply">${esc(t('estTitle'))}</button>${ext(SOURCES.subsidy.url, t('calc'))}</div>`;
}
// Getting there: nearest O-Train station and bus stops (OpenStreetMap, worked out ahead of time by tools/build_transit.py)
function transitBox(p) {
  const x = TRANSIT[p.id]; if (!x || p.kind !== 'centre') return '';
  const q = encodeURIComponent(`${p.name} ${p.address} ${p.city} ON`);
  return `<ul class="ilist">
      <li class="${x.train ? '' : 'muted'}">${ic('train', 'sm')}${esc(x.train ? t('trainNear', x.train, fmt(x.trainM)) : t('noTrain'))}</li>
      ${x.bus != null ? `<li>${ic('bus', 'sm')}${esc(x.bus <= TRANSIT_META.busMetres ? t('stopsNear', x.stops) : t('busFar', fmt(x.bus)))}</li>` : ''}</ul>
    ${ext(`https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${q}`, t('transitDir'))}<p class="note">${esc(t('transitNote'))}</p>`;
}
function secBody(p, k) {
  if (k === 'spaces') {
    const max = Math.max(...AGES.map(a => p.spaces[a.key]), 1);
    return `<div class="bars">${AGES.map(a => `<div class="bar${state.age === a.key ? ' hi' : ''}"><span>${esc(tr(a.label))}</span><span class="track"><span class="fill" style="width:${p.spaces[a.key] ? Math.max(4, p.spaces[a.key] / max * 100) : 0}%"></span></span><span class="n">${p.spaces[a.key] || '–'}</span></div>`).join('')}</div>
      <p class="note"><b>${esc(t('licensedFor', p.capacity))}</b>: ${esc(t('spacesNote'))}</p>`;
  }
  if (k === 'transit') return transitBox(p);
  if (k === 'cost') return costBox(p);
  if (k === 'safety') {
    const s = insp(p);
    let html = `<p class="note" style="margin:0 0 10px">${esc(t('inspSnap'))}</p>`;
    if (!s.r) html += `<p>${esc(t('inspNone'))}.</p>`;
    else {
      html += `<p class="big-line">${inspBadge(p)}</p><p>${esc(t('inspSum', s.r.n2y, s.r.bad2y))}${s.r.rooms > 1 ? ` · ${s.r.rooms} ${state.lang === 'fr' ? 'locaux' : 'rooms'}` : ''}</p>
        <ul class="timeline">${s.r.list.map(i => `<li><span>${esc(dateText(i.d))} · ${esc(t(i.type))}<small>${esc(i.ok ? t('inspOkPlain') : t('inspBadPlain'))}</small></span><span class="badge ${i.ok ? 'ok' : 'bad'}">${i.ok ? ic('check', 'sm') + esc(t('inspOk')) : ic('alert', 'sm') + esc(t('inspBad'))}</span></li>`).join('')}</ul>`;
      if (s.r.issues.length) html += `<details class="more"><summary>${esc(t('inspIssues'))} (${s.r.issues.length})</summary><ul class="issues">${s.r.issues.map(i => `<li>${esc(i.t)} <span class="muted">· ${esc(dateText(i.d))}</span> ${i.c ? `<span class="crit">${esc(t('critical'))}</span>` : ''}</li>`).join('')}</ul></details>`;
    }
    return html + `<p class="note">${esc(t('source'))}: ${esc(t('ophSource'))}, ${esc(dateText(INSPECTIONS_META.feed))}.</p>
      <h4>${ic('file', 'sm')}${esc(t('licReport'))}</h4><button class="btn primary small" data-lic>${ic('clipboard', 'sm')}${esc(t('licBtn'))} ${ic('external', 'sm')}</button><p class="note">${esc(t('licHow'))}</p>`;
  }
  if (k === 'reviews') {
    const q = encodeURIComponent(`${p.name} ${p.address} ${p.city} ON`);
    return `<div id="gReviews">${CONFIG.GOOGLE_PLACES_KEY ? '…' : ''}</div>${ext(`https://www.google.com/maps/search/?api=1&query=${q}`, t('revGoogle'), 'btn primary small')}<p class="note">${esc(t('revNote'))}</p>
`;
  }
  const ages = p.kind === 'centre' ? AGES.filter(a => p.spaces[a.key] > 0) : AGES;
  const top = TOP10.slice(0, 5).map(k2 => tr(CHECKLIST.find(g => k2.startsWith(g.id)).items[+k2.replace(/\D/g, '')]));
  return `<ol class="qlist">${top.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    <button class="btn primary small" id="toChecklist" style="margin:6px 0 12px">${esc(t('startChecklist'))}${ic('arrow', 'sm')}</button>
    <h4>${esc(t('ratios'))}</h4><ul class="qlist">${ages.map(a => `<li><b>${esc(tr(a.long))}</b>: ${esc(tr(a.ratio))}</li>`).join('')}</ul><p class="note">${esc(t('source'))}: ${ext(SOURCES.ratios.url, 'Ontario', 'link')}</p>`;
}
function loadReviews(p) { if (CONFIG.GOOGLE_PLACES_KEY) loadGoogle(p).then(html => { const el = $('gReviews'); if (el && activeId === p.id) el.innerHTML = html; }); }
$('panel').addEventListener('toggle', e => { if (e.target.dataset && e.target.dataset.sec === 'reviews' && e.target.open) loadReviews(BY_ID[activeId]); }, true);
$('panel').addEventListener('click', e => {
  if (e.target.closest('#pClose')) { closePanel(); return; }
  if (e.target.closest('[data-lic]')) {   // Ontario's search cannot be opened with a name filled in: copy the name, open the search, explain where to paste
    const p = BY_ID[activeId]; window.open(SOURCES.licensing.url, '_blank', 'noopener');
    copyText(p.name).then(ok => toast(ok ? t('nameCopied') : p.name, 9000)); return;
  }
  if (e.target.closest('#copyLink')) { copyText(location.origin + location.pathname + '#p/' + activeId).then(ok => toast(ok ? t('linkCopied') : location.href)); return; }
  if (e.target.closest('#toChecklist')) { const id = activeId; if (!state.shortlist.includes(id)) toggleShortlist(id, true); state.clFor = id; save(); go('visit'); return; }
  const s = e.target.closest('[data-save]'); if (s) { toggleShortlist(s.dataset.save); openPanel(s.dataset.save); }
});
function closePanel() { if (location.hash.startsWith('#p/')) history.replaceState(null, '', location.pathname + location.search + '#' + current); $('panel').classList.remove('open'); $('panel').setAttribute('aria-hidden', 'true'); $('scrim').hidden = true; }
$('scrim').addEventListener('click', closePanel);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePanel(); hideKip(); } });

// Google reviews (only when CONFIG.GOOGLE_PLACES_KEY is set). A place is used only if every check passes.
const STOPW = new Set('the of de la le les du des and et inc ltd child children care centre center garderie daycare day nursery school preschool early learning program programme services ottawa enfance educatif'.split(' '));
const words = s => new Set(String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(w => w.length > 1 && !STOPW.has(w)));
function nameSim(a, b) { const x = words(a), y = words(b); if (!x.size || !y.size) return 0; let n = 0; x.forEach(w => y.has(w) && n++); return n / (x.size + y.size - n); }
function matchPlace(p, place, takenBy) {
  const addr = (place.formattedAddress || '').toUpperCase().replace(/\s+/g, '');
  const num = (p.address.match(/\d+/) || [''])[0];
  const checks = {
    address: !!num && new RegExp('(^|\\D)' + num + '(\\D|$)').test(place.formattedAddress || '') && addr.includes(p.postal.replace(/\s+/g, '').slice(0, 3)),
    distance: place.location ? km(p, { lat: place.location.latitude, lon: place.location.longitude }) * 1000 <= CONFIG.MATCH_MAX_METRES : false,
    name: nameSim(p.name, place.displayName ? place.displayName.text : '') >= CONFIG.MATCH_MIN_NAME,
    type: (place.types || []).some(x => x === 'child_care_agency' || x === 'preschool') || nameSim(p.name, place.displayName ? place.displayName.text : '') >= .8,
    unique: !takenBy || takenBy === p.id,
    open: place.businessStatus !== 'CLOSED_PERMANENTLY',
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
window.KG_matchPlace = matchPlace;   // exposed for testing
async function loadGoogle(p) {
  const H = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_KEY };
  try {
    let id = state.gplaces[p.id];
    if (id === undefined) {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { ...H, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus' },
        body: JSON.stringify({ textQuery: `${p.name}, ${p.address}, Ottawa ON`, maxResultCount: 5, locationBias: { circle: { center: { latitude: p.lat, longitude: p.lon }, radius: 500 } } }) });
      const places = (await res.json()).places || [];
      const owner = pid => Object.keys(state.gplaces).find(k => state.gplaces[k] === pid && k !== p.id);
      const hit = places.find(pl => matchPlace(p, pl, owner(pl.id)).ok);
      id = state.gplaces[p.id] = hit ? hit.id : null; save();
    }
    if (!id) return `<p>${esc(t('revNoMatch'))}</p>`;
    const d = await (await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=${state.lang}`, { headers: { ...H, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri' } })).json();
    const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
    return `<p class="big-line"><span class="stars">${stars(d.rating || 0)}</span> <b>${d.rating ?? '–'}</b> (${d.userRatingCount || 0}) · <a href="${esc(d.googleMapsUri)}" target="_blank" rel="noopener">Google Maps</a></p>
      ${(d.reviews || []).slice(0, 5).map(r => `<div class="review"><a href="${esc(r.authorAttribution && r.authorAttribution.uri)}" target="_blank" rel="noopener"><b>${esc(r.authorAttribution && r.authorAttribution.displayName)}</b></a> · <span class="stars">${stars(r.rating)}</span> · <span class="muted">${esc(r.relativePublishTimeDescription)}</span><p>${esc(r.text && r.text.text)}</p></div>`).join('')}
      <p class="note">${esc(t('revOrder'))}</p>`;
  } catch (e) { return ''; }
}

/* ---------- 6. Step 2: Shortlist ---------- */
function toggleShortlist(id, quiet) {
  const i = state.shortlist.indexOf(id);
  if (i >= 0) { state.shortlist.splice(i, 1); if (!quiet) toast(t('toastRemoved')); }
  else { if (state.shortlist.length >= MAX_PICKS) { toast(t('toastFull')); return; } state.shortlist.push(id); state.hints.save = true; if (!quiet) toast(t('toastSaved', state.shortlist.length)); }
  save(); renderStepper();
  if (current === 'find') { const y = $('results').scrollTop; renderList(); $('results').scrollTop = y; }
  renderDock();
  if (current === 'shortlist') renderShortlist();
}
function score(id) { const a = Object.values(state.answers[id] || {}); return { g: a.filter(x => x === 'good').length, u: a.filter(x => x === 'unsure').length, c: a.filter(x => x === 'concern').length }; }
const sharedIds = (params.get('list') || '').split(',').filter(id => BY_ID[id]).slice(0, MAX_PICKS);
let sharedOpen = sharedIds.length > 0;
const slNoteOpen = new Set();
function renderShortlist() {
  const n = state.shortlist.length;
  $('slMode').innerHTML = [['list', t('list')], ['compare', t('compare')]].map(([k, l]) => `<button data-m="${k}" class="${state.slMode === k ? 'on' : ''}">${esc(l)}</button>`).join('');
  $('sharedBanner').innerHTML = sharedOpen ? `<div class="shared"><span>${ic('link', 'sm')} ${esc(t('sharedBanner', sharedIds.length))} ${sharedIds.map(id => esc(BY_ID[id].name)).join(' · ')}</span><span style="display:flex;gap:8px"><button class="btn primary small" id="addShared">${esc(t('addShared'))}</button><button class="btn ghost small" id="dismissShared">${esc(t('dismiss'))}</button></span></div>` : '';
  $('slProgress').innerHTML = `<div class="slot-row" aria-hidden="true">${Array.from({ length: MAX_PICKS }, (_, i) => `<span class="slot${i < n ? ' full' : ''}${i === MIN_PICKS - 1 ? ' min' : ''}"></span>`).join('')}</div><b>${n} / 9</b><span class="muted">${esc(n === 0 ? '' : n < MIN_PICKS ? t('slNeed', MIN_PICKS - n) : t('slGood', MAX_PICKS - n))}</span>`;
  if (!n) { $('slBody').innerHTML = `<div class="empty glass teach">${ic('heart')}<h2>${esc(t('slEmptyT'))}</h2><p>${esc(t('slEmpty2'))}</p><button class="btn primary" data-view="find">${esc(t('goFind'))}${ic('arrow', 'sm')}</button></div>`; $('slActions').innerHTML = ''; return; }
  if (state.slMode === 'compare') renderCompare();
  else $('slBody').innerHTML = `<div class="sl" id="slList">${state.shortlist.map((id, i) => {
    const p = BY_ID[id], s = score(id), open = !!state.notes[id];
    return `<article class="si glass" draggable="true" data-id="${id}">
      <div class="rank" aria-label="Rank ${i + 1}">${i + 1}</div>
      <div><h3>${esc(p.name)}</h3><div class="meta">${esc(addr(p))}${distText(p) ? ' · ' + esc(distText(p)) : ''}</div>
        <div class="si-row">${inspBadge(p, true)}${state.visited[id] ? `<span class="badge ok">${ic('check', 'sm')}${esc(t('visited'))}</span>` : ''}
          ${s.g + s.u + s.c ? `<span class="muted" style="font-size:13.5px">${esc(t('score', s.g, s.u, s.c))}</span>` : ''}
          <button class="link" data-open="${id}">${esc(t('details'))}</button><button class="link" data-cl="${id}">${esc(t('step3'))}</button></div>
        ${open || slNoteOpen.has(id) ? `<textarea data-note="${id}" rows="2" placeholder="${esc(t('notes'))}…">${esc(state.notes[id] || '')}</textarea>` : `<button class="link add-note" data-slnote="${id}">+ ${esc(t('addNote'))}</button>`}</div>
      <div class="mini"><button data-move="-1" aria-label="${esc(t('up'))}">${ic('up', 'sm')}</button><button data-move="1" aria-label="${esc(t('down'))}">${ic('down', 'sm')}</button><button data-remove="${id}" aria-label="${esc(t('remove'))}">${ic('x', 'sm')}</button></div>
    </article>`;
  }).join('')}</div>`;
  $('slActions').innerHTML = `<button class="btn primary" id="shareBtn">${ic('link', 'sm')}${esc(t('share'))}</button><button class="btn ghost" id="copyReg">${ic('clipboard', 'sm')}${esc(t('copyReg'))}</button>${ext(SOURCES.registryApp.url, t('openReg'), 'btn ghost')}<button class="btn ghost" id="printBtn">${ic('printer', 'sm')}${esc(t('print'))}</button>`;
}
function renderCompare() {
  const ids = state.shortlist, ps = ids.map(id => BY_ID[id]);
  const dists = state.home ? ps.map(p => km(state.home, p)) : null, best = dists ? Math.min(...dists) : null;
  const sc = ids.map(score), topG = Math.max(...sc.map(x => x.g - x.c));
  const rows = [
    dists && [t('cmpDistance'), dists.map(d => [esc(kmText(d)), d === best])],
    [t('cmpAges'), ps.map(p => [p.kind === 'home' ? esc(t('agency')) : AGES.filter(a => p.spaces[a.key] > 0).map(a => esc(tr(a.label))).join(', ')])],
    state.age !== 'any' && [(x => x[0].toUpperCase() + x.slice(1))(t('stSpaces', t('storyAge')[state.age])), ps.map(p => [p.kind === 'centre' ? fmt(p.spaces[state.age] || 0) : '–', p.kind === 'centre' && p.spaces[state.age] === Math.max(...ps.map(q => q.spaces[state.age] || 0)) && p.spaces[state.age] > 0])],
    [t('cmpCap'), ps.map(p => [p.kind === 'centre' ? fmt(p.capacity) : '–'])],
    [t('cmpInsp'), ps.map(p => [inspBadge(p) || '–', insp(p).kind === 'ok'])],
    [t('cmpTrain'), ps.map(p => [trainOf(p) ? `${fmt(trainOf(p).trainM)} m` : '–', !!trainOf(p)])],
    [t('cmpFrench'), ps.map(p => [p.french ? ic('check', 'sm ok') : '–', p.french])],
    [t('cmpVisit'), sc.map(s2 => [s2.g + s2.u + s2.c ? esc(t('score', s2.g, s2.u, s2.c)) : '–', s2.g + s2.u + s2.c > 0 && s2.g - s2.c === topG])],
    [t('cmpVisited'), ids.map(id => [state.visited[id] ? ic('check', 'sm ok') : '–'])],
    [t('wStatus'), ids.map(id => [esc(t(wKey(wOf(id).s)))])],
    [t('notes'), ids.map(id => [esc(state.notes[id] || '')])],
  ].filter(Boolean);
  const plain = h => h.replace(/<[^>]+>/g, '').trim();
  const shown = state.cmpDiff ? rows.filter(([, cells]) => new Set(cells.map(([h]) => plain(h))).size > 1) : rows;
  $('slBody').innerHTML = `<div class="cmp-bar"><label class="check"><input type="checkbox" id="cmpDiff" ${state.cmpDiff ? 'checked' : ''}> ${esc(t('cmpDiff'))}</label><span class="muted">${esc(t('cmpBestNote'))}</span></div>
    <div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>${ps.map((p, i) => `<th scope="col">${i + 1}. ${esc(p.name)}</th>`).join('')}</tr></thead><tbody>
    ${shown.map(([label, cells]) => `<tr><th scope="row">${esc(label)}</th>${cells.map(([h, b]) => `<td class="${b && ps.length > 1 ? 'best' : ''}">${h}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>`;
}
$('slBody').addEventListener('change', e => { if (e.target.id === 'cmpDiff') { state.cmpDiff = e.target.checked; save(); renderCompare(); } });
$('slMode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { state.slMode = b.dataset.m; save(); renderShortlist(); } });
$('view-shortlist').addEventListener('click', async e => {
  const id = (e.target.closest('.si') || {}).dataset?.id;
  if (e.target.closest('[data-remove]')) { toggleShortlist(e.target.closest('[data-remove]').dataset.remove); return; }
  const mv = e.target.closest('[data-move]');
  if (mv && id) { const i = state.shortlist.indexOf(id), j = i + +mv.dataset.move; if (j >= 0 && j < state.shortlist.length) { [state.shortlist[i], state.shortlist[j]] = [state.shortlist[j], state.shortlist[i]]; save(); renderShortlist(); } return; }
  const sn = e.target.closest('[data-slnote]'); if (sn) { slNoteOpen.add(sn.dataset.slnote); renderShortlist(); const ta = document.querySelector(`[data-note="${sn.dataset.slnote}"]`); if (ta) ta.focus(); return; }
  const cl = e.target.closest('[data-cl]'); if (cl) { state.clFor = cl.dataset.cl; save(); go('visit'); return; }
  const op = e.target.closest('[data-open]'); if (op) { openPanel(op.dataset.open, 'overview'); return; }
  if (e.target.closest('#shareBtn')) { const url = `${location.origin}${location.pathname}?list=${state.shortlist.join(',')}&lang=${state.lang}#shortlist`; toast((await copyText(url)) ? t('shared') : url); return; }
  if (e.target.closest('#copyReg')) { const txt = state.shortlist.map((x, i) => `${i + 1}. ${BY_ID[x].name} (${addr(BY_ID[x])}, ${BY_ID[x].city})`).join('\n'); toast((await copyText(txt)) ? t('copied') : txt); return; }
  if (e.target.closest('#printBtn')) { window.print(); return; }
  if (e.target.closest('#addShared')) { sharedIds.forEach(x => { if (!state.shortlist.includes(x) && state.shortlist.length < MAX_PICKS) state.shortlist.push(x); }); sharedOpen = false; save(); renderShortlist(); renderStepper(); return; }
  if (e.target.closest('#dismissShared')) { sharedOpen = false; renderShortlist(); }
});
$('view-shortlist').addEventListener('input', e => { const n = e.target.dataset.note; if (n) { state.notes[n] = e.target.value; save(); } });
$('view-shortlist').addEventListener('change', e => { const v = e.target.dataset.visited; if (v) { state.visited[v] = e.target.checked; save(); renderStepper(); } });
// Drag and drop to rank (the ↑ ↓ buttons do the same for keyboard users)
let dragId = null;
$('view-shortlist').addEventListener('dragstart', e => { const it = e.target.closest('.si'); if (!it) return; dragId = it.dataset.id; it.classList.add('dragging'); });
$('view-shortlist').addEventListener('dragend', e => { const it = e.target.closest('.si'); if (it) it.classList.remove('dragging'); });
$('view-shortlist').addEventListener('dragover', e => { if (dragId) e.preventDefault(); });
$('view-shortlist').addEventListener('drop', e => {
  const it = e.target.closest('.si'); if (!it || !dragId || it.dataset.id === dragId) return;
  e.preventDefault(); const from = state.shortlist.indexOf(dragId), to = state.shortlist.indexOf(it.dataset.id);
  state.shortlist.splice(from, 1); state.shortlist.splice(to, 0, dragId); dragId = null; save(); renderShortlist();
});

/* ---------- 7. Step 3: Visit checklist ---------- */
const noteOpen = new Set();   // questions where the parent asked for a note box
function shownQs() { return CHECKLIST.flatMap(g => g.items.map((q, i) => [g, q, g.id + i])).filter(([, , k]) => state.clMode !== 'top' || TOP10.includes(k)); }
function visitCount(id = state.clFor) { const ans = state.answers[id] || {}, qs = shownQs(); return { a: qs.filter(([, , k]) => ans[k]).length, n: qs.length }; }
function renderVisit() {
  if (state.clFor !== 'general' && !state.shortlist.includes(state.clFor)) state.clFor = 'general';
  const ans = state.answers[state.clFor] || {}, notes = state.qnotes[state.clFor] || {}, top = state.clMode === 'top';
  $('vLeadTxt').textContent = t('vLead2');
  $('vHow').innerHTML = [t('vHow1'), t('vHow2'), t('vHow3')].map((x, i) => `<li><span class="vh-n">${i + 1}</span>${esc(x)}</li>`).join('');
  $('clFor').innerHTML = `<span class="flabel">${esc(t('vFor'))}</span>` + [['general', t('general')], ...state.shortlist.map(id => [id, BY_ID[id].name])].map(([v, l]) => { const c = visitCount(v);
    return `<button class="chip${state.clFor === v ? ' on' : ''}" data-for="${v}" aria-pressed="${state.clFor === v}">${esc(l)}${v !== 'general' ? ` <small>${c.a}/${c.n}</small>` : ''}</button>`; }).join('')
    + (state.shortlist.length ? '' : `<span class="muted vh-note">${esc(t('vNoProgram'))}</span>`);
  const qRow = (q, k, num) => `<div class="q" data-k="${k}"><span class="qt">${num ? `<span class="qn">${num}</span>` : ''}${esc(tr(q))}</span>
    <span class="ans">${['good', 'unsure', 'concern'].map(v => `<button type="button" data-v="${v}" class="${ans[k] === v ? 'on' : ''}" aria-pressed="${ans[k] === v}">${esc(t(v))}</button>`).join('')}</span>
    ${notes[k] || noteOpen.has(k) ? `<input type="text" placeholder="${esc(t('note'))}…" value="${esc(notes[k] || '')}" aria-label="${esc(t('note'))}">` : `<button type="button" class="link add-note" data-addnote="${k}">+ ${esc(t('addNote'))}</button>`}</div>`;
  const toggle = `<p class="more-q"><button class="btn ghost small" data-mode="${top ? 'all' : 'top'}">${esc(top ? t('vShowAll') : t('vShowTop'))}</button></p>`;
  if (top) {
    $('clGroups').innerHTML = `<button class="vm-start glass" id="vmGo">${ic('play')}<span><b>${esc(t('vmStart'))}</b><small>${esc(t('vmStartS'))}</small></span>${ic('arrow', 'sm')}</button><section class="group glass qcard"><div class="qcard-head"><div><h2>${esc(t('vTopTitle'))}</h2><p class="muted">${esc(t('vTopLead'))}</p></div></div>
      ${shownQs().map(([, q, k], i) => qRow(q, k, i + 1)).join('')}</section>` + toggle;
  } else {
    $('clGroups').innerHTML = CHECKLIST.map((g, gi) => `<details class="group glass"${gi === 0 ? ' open' : ''}><summary>${esc(tr(g.title))}<span class="gcount">${g.items.filter((_, i) => ans[g.id + i]).length} / ${g.items.length}</span></summary>
      ${g.items.map((q, i) => qRow(q, g.id + i)).join('')}</details>`).join('') + toggle;
  }
  const s = score(state.clFor), tot = s.g + s.u + s.c || 1, c = visitCount();
  $('clScore').innerHTML = `<h3>${esc(state.clFor === 'general' ? t('general') : BY_ID[state.clFor].name)}</h3><p class="muted" style="margin:0">${esc(t('vProgress', c.a, c.n))}</p><div class="scorebar"><i style="width:${s.g / tot * 100}%;background:var(--good)"></i><i style="width:${s.u / tot * 100}%;background:#e2b04a"></i><i style="width:${s.c / tot * 100}%;background:var(--bad)"></i></div><p class="muted" style="margin:0;font-size:14px">${esc(t('score', s.g, s.u, s.c))}</p>
    ${state.clFor !== 'general' ? `<label class="check" style="margin-top:10px"><input type="checkbox" id="vVisited" ${state.visited[state.clFor] ? 'checked' : ''}> ${esc(t('visited'))}</label>` : ''}`;
  const p = BY_ID[state.clFor];
  const ages = p && p.kind === 'centre' ? AGES.filter(a => p.spaces[a.key] > 0) : AGES;
  $('vWatchT').textContent = t('vWatch');
  $('clRatio').innerHTML = `<h4>${esc(t('ratios'))}</h4><ul class="ticks">${ages.map(a => `<li><b>${esc(tr(a.label))}</b>: ${esc(tr(a.ratio))}</li>`).join('')}</ul><p class="note">${esc(t('source'))}: ${ext(SOURCES.questions.url, 'Ontario', 'link')}</p>`;
  $('lookFor').innerHTML = LOOK_FOR.map(x => `<li>${esc(tr(x))}</li>`).join('');
  $('visitCal').hidden = !p;
  $('visitCal').innerHTML = p ? `<h3>${ic('calendar')}${esc(t('addVisit'))}</h3><input type="date" class="input" id="visitDate" aria-label="${esc(t('visitDate'))}" style="width:100%;margin-bottom:8px"><button class="btn ghost small" id="visitIcs">${esc(t('addVisit'))}</button>` : '';
  if (current === 'visit') renderDock();
}
$('view-visit').addEventListener('click', e => {
  const f = e.target.closest('[data-for]'); if (f) { state.clFor = f.dataset.for; save(); renderVisit(); return; }
  const m = e.target.closest('[data-mode]'); if (m) { state.clMode = m.dataset.mode; save(); renderVisit(); return; }
  if (e.target.closest('#vmGo')) { vmOpen(); return; }
  const nb = e.target.closest('[data-addnote]'); if (nb) { noteOpen.add(nb.dataset.addnote); renderVisit(); const i = document.querySelector(`#clGroups .q[data-k="${nb.dataset.addnote}"] input`); if (i) i.focus(); return; }
  const b = e.target.closest('[data-v]');
  if (b) {
    const k = b.closest('.q').dataset.k, a = state.answers[state.clFor] = state.answers[state.clFor] || {};
    a[k] = a[k] === b.dataset.v ? '' : b.dataset.v; save();
    const open = [...document.querySelectorAll('#clGroups details')].map(d => d.open); renderVisit(); renderStepper();
    document.querySelectorAll('#clGroups details').forEach((d, i) => { d.open = open[i]; }); return;
  }
  if (e.target.closest('#visitIcs')) {
    const d = $('visitDate').value; const p = BY_ID[state.clFor]; if (!d || !p) { $('visitDate').focus(); return; }
    downloadIcs('kinderguide-visit.ics', [{ date: new Date(d + 'T12:00:00'), title: `${state.lang === 'fr' ? 'Visite' : 'Visit'}: ${p.name}`, desc: `${p.address}, ${p.city}. KinderGuide: ${location.origin}${location.pathname}#visit` }]);
  }
});
// Visit mode: the parent holds the phone during the visit; one question per screen, tap an answer and it moves on
let vmI = 0;
function vmOpen() { vmI = 0; $('vmode').hidden = false; document.body.classList.add('vm-on'); renderVm(); }
function vmClose() { $('vmode').hidden = true; document.body.classList.remove('vm-on'); renderVisit(); const b = $('vmGo'); if (b) b.focus(); }
function renderVm() {
  const qs = shownQs(), id = state.clFor, ans = state.answers[id] || {}, name = id === 'general' ? t('general') : BY_ID[id].name;
  const head = `<div class="vm-top"><span class="vm-for">${esc(t('vmFor'))}: <b>${esc(name)}</b></span><button class="p-close" data-vm="close" aria-label="${esc(t('vmClose'))}">${ic('x')}</button></div>`;
  if (vmI >= qs.length) {
    const sc = score(id);
    $('vmode').innerHTML = `${head}<div class="vm-body vm-end"><span class="vm-check">${ic('check')}</span><h2 id="vmQ">${esc(t('vmEndT'))}</h2><p class="vm-sum">${esc(t('vmEnd', sc.g, sc.u, sc.c))}</p><p class="muted">${esc(t('vmEndS'))}</p>
      ${id !== 'general' ? `<label class="check"><input type="checkbox" data-vm="visited" ${state.visited[id] ? 'checked' : ''}> ${esc(t('vmMark'))}</label>` : ''}
      <div class="vm-actions"><button class="btn ghost" data-vm="prev">${ic('back', 'sm')}${esc(t('vmPrev'))}</button><button class="btn primary" data-vm="compare">${esc(t('vmToCompare'))}${ic('arrow', 'sm')}</button></div></div>`;
    $('vmode').querySelector('.btn.primary').focus(); return;
  }
  const [g, q, k] = qs[vmI], cur = ans[k], note = (state.qnotes[id] || {})[k] || '';
  $('vmode').innerHTML = `${head}<div class="vm-prog" aria-hidden="true"><i style="width:${vmI / qs.length * 100}%"></i></div>
    <div class="vm-body"><p class="vm-of">${esc(t('vmOf', vmI + 1, qs.length))} · ${esc(tr(g.title))}</p><h2 id="vmQ">${esc(tr(q))}</h2>
      <div class="vm-ans">${['good', 'unsure', 'concern'].map((v, i) => `<button class="vm-a ${v}${cur === v ? ' on' : ''}" data-vmv="${v}" aria-pressed="${cur === v}"><span class="vm-k">${i + 1}</span>${esc(t(v))}</button>`).join('')}</div>
      <input class="input vm-note" type="text" placeholder="${esc(t('note'))}…" value="${esc(note)}" aria-label="${esc(t('note'))}" data-vmk="${k}">
      <div class="vm-actions"><button class="btn ghost" data-vm="prev" ${vmI ? '' : 'disabled'}>${ic('back', 'sm')}${esc(t('vmPrev'))}</button><button class="btn ghost" data-vm="next">${esc(vmI === qs.length - 1 ? t('vmDone') : t('vmSkip'))}${ic('arrow', 'sm')}</button></div>
      <p class="vm-keys">${esc(t('vmKeys'))}</p></div>`;
  const on = $('vmode').querySelector('.vm-a.on') || $('vmode').querySelector('.vm-a'); on.focus();
}
function vmAnswer(v) {
  const k = shownQs()[vmI][2], a = state.answers[state.clFor] = state.answers[state.clFor] || {};
  a[k] = v; save(); renderVm(); renderStepper();
  setTimeout(() => { vmI++; renderVm(); }, 260);   // a short pause so the parent sees the answer register
}
$('vmode').addEventListener('click', e => {
  const v = e.target.closest('[data-vmv]'); if (v) { vmAnswer(v.dataset.vmv); return; }
  const b = e.target.closest('[data-vm]'); if (!b) return;
  const a = b.dataset.vm;
  if (a === 'close') vmClose();
  else if (a === 'prev') { vmI = Math.max(0, vmI - 1); renderVm(); }
  else if (a === 'next') { vmI++; renderVm(); }
  else if (a === 'compare') { vmClose(); state.slMode = 'compare'; save(); go('shortlist'); }
});
$('vmode').addEventListener('change', e => { if (e.target.dataset.vm === 'visited') { state.visited[state.clFor] = e.target.checked; save(); renderStepper(); } });
$('vmode').addEventListener('input', e => { const k = e.target.dataset.vmk; if (k) { const n = state.qnotes[state.clFor] = state.qnotes[state.clFor] || {}; n[k] = e.target.value; save(); } });
$('vmode').addEventListener('keydown', e => {
  if (e.target.classList.contains('vm-note')) { if (e.key === 'Escape') vmClose(); return; }
  if (e.key === 'Escape') vmClose();
  else if (['1', '2', '3'].includes(e.key) && vmI < shownQs().length) vmAnswer(['good', 'unsure', 'concern'][+e.key - 1]);
  else if (e.key === 'ArrowRight') { vmI = Math.min(shownQs().length, vmI + 1); renderVm(); }
  else if (e.key === 'ArrowLeft') { vmI = Math.max(0, vmI - 1); renderVm(); }
});
$('view-visit').addEventListener('change', e => { if (e.target.id === 'vVisited') { state.visited[state.clFor] = e.target.checked; save(); renderStepper(); } });
$('view-visit').addEventListener('input', e => {
  if (e.target.tagName !== 'INPUT' || !e.target.closest('.q')) return;
  const k = e.target.closest('.q').dataset.k, n = state.qnotes[state.clFor] = state.qnotes[state.clFor] || {}; n[k] = e.target.value; save();
});

/* ---------- 8. Step 4: Apply (plan + cost) ---------- */
const monthly = (perDay, days) => Math.round(perDay * days * 52 / 12);
// Four stages that follow the City's own registry screens (ottawa.ca "Apply for child care", checked Nov 2, 2026)
const APHASES = [
  { k: 'ready', label: 'phReady', items: ['r1', 'r2', 'r3', 'r4'] },
  { k: 'registry', label: 'phRegistry', items: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'] },
  { k: 'wait', label: 'phWait', items: ['w1', 'w2', 'w3'] },
  { k: 'offer', label: 'phOffer', items: ['o1', 'o2', 'o3', 'o4'] },
];
const ALL_AP = APHASES.flatMap(ph => ph.items);
if (state.tasks && Object.keys(state.tasks).length && !state.ap) {   // plans saved before the Nov 2 redesign
  state.ap = {}; [[1, ['g1']], [2, ['g6', 'g7']], [3, ['w1']], [4, ['r4']], [5, ['w3']]].forEach(([n, ks]) => { if (state.tasks[n]) ks.forEach(k => { state.ap[k] = true; }); });
}
state.ap = state.ap || {}; state.applied = state.applied || {};
const phDone = ph => ph.items.filter(k => state.ap[k]).length;
function apExtra(k) {
  const n = state.shortlist.length;
  const dateIn = (id, v, lbl) => `<label class="ap-in"><span>${esc(lbl)}</span><input type="date" class="input" id="${id}" value="${esc(v || '')}"></label>`;
  const ranked = () => n ? `<ul class="aplist">${state.shortlist.map((id, i) => `<li><label class="check"><input type="checkbox" data-applied="${id}" ${state.applied[id] ? 'checked' : ''}> <span>${i + 1}. ${esc(BY_ID[id].name)}</span></label><button class="btn ghost small" data-copyname="${id}">${ic('clipboard', 'sm')}${esc(t('copyName'))}</button></li>`).join('')}</ul>` : `<button class="btn ghost small" data-view="find">${esc(t('goFind'))}${ic('arrow', 'sm')}</button>`;
  return {
    r1: `<div class="row"><button class="btn ghost small" data-view="shortlist">${esc(t('step2'))}${ic('arrow', 'sm')}</button></div>`,
    r2: `<div class="row">${dateIn('apBirth', state.birth, t('birthL'))}</div>${state.birth ? `<p class="note">${esc(t('ageAtStart', tr(AGE[startInfo().group].label).toLowerCase(), dateText(startInfo().when)))}</p>` : ''}`,
    r3: `<div class="row">${dateIn('apNeed', state.need, t('needL'))}<div class="seg" data-est="estDays" role="group" aria-label="${esc(t('estDays'))}">${[1, 2, 3, 4, 5].map(d => `<button data-v="${d}" class="${state.estDays === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>`,
    r4: `<div class="row">${ext(SOURCES.subsidy.url, t('calc'))}</div>`,
    g1: `<div class="row">${ext(SOURCES.registryApp.url, t('openReg'), 'btn primary small')}${ext(SOURCES.registry.url, t('howReg'))}</div>`,
    g5: `<p class="ap-chose">${esc(t('yourChoice'))}: <b>${esc(state.need ? dateText(state.need) : t('notSet'))}</b> · <b>${esc(t('daysWk', state.estDays))}</b></p>`,
    g6: ranked(),
    g7: n ? `<div class="row"><button class="btn ghost small" id="copyReg2">${ic('clipboard', 'sm')}${esc(t('copyReg'))}</button></div>` : '',
    w1: `<div class="row"><button class="btn ghost small" id="icsBtn">${ic('bell', 'sm')}${esc(t('reminders'))}</button></div>`,
    w3: `<div class="row">${ext(SOURCES.earlyon.url, t('findEarlyon'))}</div>`,
    o2: `<div class="row">${ext(SOURCES.subsidyApply.url, t('subApply'), 'btn primary small')}</div><details class="more"><summary>${esc(t('subDocs'))}</summary><ul class="ilist dots">${SUBSIDY.docs.map(x => `<li>${esc(tr(x))}</li>`).join('')}<li>${esc(t('docsRR'))}</li></ul>
      <p class="flabel">${esc(t('subWho'))}</p><ul class="ilist dots">${SUBSIDY.who.map(x => `<li>${esc(tr(x))}</li>`).join('')}</ul><p class="note">${esc(t('checked', dateText(CHECKED)))}</p></details>`,
  }[k] || '';
}
function renderApply() {
  if (!APHASES.some(ph => ph.k === state.aPhase)) state.aPhase = (APHASES.find(ph => phDone(ph) < ph.items.length) || APHASES[0]).k;
  const phI = APHASES.findIndex(ph => ph.k === state.aPhase), ph = APHASES[phI];
  $('aLeadTxt').textContent = t('aLead2');
  $('aPhases').innerHTML = APHASES.map((x, i) => `<button role="tab" class="ph${x.k === ph.k ? ' on' : ''}${phDone(x) === x.items.length ? ' done' : ''}" data-aphase="${x.k}" aria-selected="${x.k === ph.k}"><span class="ph-n">${phDone(x) === x.items.length ? ic('check', 'sm') : i + 1}</span><b>${esc(t(x.label))}</b><small>${esc(t('stepsOf', phDone(x), x.items.length))}</small></button>`).join('');
  const num = k => ph.items.indexOf(k) + 1;
  $('tasks').innerHTML = ph.items.map(k => { const on = !!state.ap[k], d = t(k + 'd', state.shortlist.length);
    return `<li class="task glass${on ? ' is-done' : ''}"><button class="tn" data-ap="${k}" aria-pressed="${on}" aria-label="${esc(t('toggleDone'))}: ${esc(t(k))}">${on ? ic('check') : num(k)}</button><div><h3>${esc(t(k))}</h3><p>${esc(d)}</p>${apExtra(k)}</div></li>`; }).join('');
  $('aFoot').innerHTML = (ph.k === 'registry' ? `<p class="note ap-help">${ic('info', 'sm')}<span>${esc(t('gLimit'))} ${esc(t('gHelp'))}</span></p>` : '')
    + (phI < APHASES.length - 1 ? `<div class="ap-next"><button class="btn primary" data-aphase="${APHASES[phI + 1].k}">${esc(t('nextPhase', t(APHASES[phI + 1].label)))}${ic('arrow', 'sm')}</button></div>` : '');
  const done = ALL_AP.filter(k => state.ap[k]).length, C = 2 * Math.PI * 26, frac = done / ALL_AP.length;
  $('planRing').innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(15,107,107,.15)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="var(--good)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 32 32)"/></svg><span>${esc(t('planProgress', done, ALL_AP.length))}</span>`;
  $('cheat').innerHTML = `<h3>${ic('clipboard')}${esc(t('cheatT'))}</h3><p class="muted" style="margin:0 0 8px;font-size:14px">${esc(t('cheatS'))}</p><dl class="cheat">
    <dt>${esc(t('birthL'))}</dt><dd>${esc(state.birth ? dateText(state.birth) : t('notSet'))}</dd><dt>${esc(t('needL'))}</dt><dd>${esc(state.need ? dateText(state.need) : t('notSet'))}</dd>
    <dt>${esc(t('estDays'))}</dt><dd>${esc(String(state.estDays))}</dd><dt>${esc(t('slTitle'))}</dt><dd>${state.shortlist.length ? `<ol>${state.shortlist.map(id => `<li>${esc(BY_ID[id].name)}</li>`).join('')}</ol>` : esc(t('notSet'))}</dd></dl>`;
  $('timeline').hidden = $('estimator').hidden = ph.k !== 'ready'; $('cheat').hidden = ph.k !== 'registry';   // each card only where it is used
  $('waitlist').hidden = ph.k !== 'wait';
  renderEstimator(); renderTimeline(); renderWaitlist();
}
// Waitlist tracker: status and dates for each saved program, kept only on this device
const WSTAT = ['none', 'waiting', 'offered', 'accepted', 'declined'];
const wKey = k => 'w' + k[0].toUpperCase() + k.slice(1);
const wOf = id => Object.assign({ s: 'none', a: '', c: '' }, state.wait[id]);
function renderWaitlist() {
  const el = $('waitlist'), ids = state.shortlist;
  const head = extra => `<div class="wl-head"><div><h2 id="wlTitle">${ic('hourglass')}${esc(t('wTitle'))}</h2><p class="muted">${esc(t('wLead'))}</p></div>${extra || ''}</div>`;
  if (!ids.length) { el.innerHTML = head() + `<p>${esc(t('wEmpty'))}</p><button class="btn ghost small" data-view="find">${esc(t('goFind'))}${ic('arrow', 'sm')}</button>`; return; }
  const on = ids.filter(id => ['waiting', 'offered', 'accepted'].includes(wOf(id).s)).length;
  const offer = ids.some(id => ['offered', 'accepted'].includes(wOf(id).s));
  el.innerHTML = head(`<span class="badge city">${esc(t('wCount', on, ids.length))}</span>`)
    + (offer ? `<div class="tip warn">${ic('clock', 'sm')}<span>${esc(t('wOfferTip'))}</span>${ext(SOURCES.subsidyApply.url, t('subApply'), 'btn small primary')}</div>` : '')
    + `<div class="wl-rows">${ids.map((id, i) => { const p = BY_ID[id], w = wOf(id);
      return `<div class="wl-row s-${w.s}" data-w="${id}"><b class="wl-name">${i + 1}. ${esc(p.name)}</b>
        <label><span>${esc(t('wStatus'))}</span><select data-wf="s">${WSTAT.map(k => `<option value="${k}"${w.s === k ? ' selected' : ''}>${esc(t(wKey(k)))}</option>`).join('')}</select></label>
        ${w.s === 'none' ? '' : `<label><span>${esc(t('wAdded'))}</span><input type="date" class="input" data-wf="a" value="${esc(w.a)}"></label>
        <label><span>${esc(t('wContact'))}</span><input type="date" class="input" data-wf="c" value="${esc(w.c)}"></label>
        <button class="btn ghost small" data-wremind="${id}">${ic('bell', 'sm')}${esc(t('wRemind'))}</button>`}</div>`; }).join('')}</div>`;   // dates appear once a program is on a list
}
$('waitlist').addEventListener('change', e => {
  const f = e.target.dataset.wf, id = (e.target.closest('[data-w]') || {}).dataset?.w; if (!f || !id) return;
  state.wait[id] = Object.assign(wOf(id), { [f]: e.target.value });
  if (f === 's' && e.target.value === 'waiting' && !state.wait[id].a) state.wait[id].a = ymd(new Date());   // first time on a list: today
  save(); if (f === 's') renderWaitlist();
});
$('waitlist').addEventListener('click', e => {
  const b = e.target.closest('[data-wremind]'); if (!b) return;
  const p = BY_ID[b.dataset.wremind], w = wOf(p.id), base = w.c || w.a || ymd(new Date());
  const d = new Date(addMonths(base, 3) + 'T12:00:00'); if (d < new Date()) d.setTime(Date.now() + 7 * 864e5);
  downloadIcs('kinderguide-follow-up.ics', [{ date: d, title: t('wRemindTitle', p.name), desc: `${t('wRemindDesc')} ${location.origin}${location.pathname}#apply` }]);
  toast(t('calDone'));
});
function renderTimeline() {
  if (!state.birth) { $('timeline').innerHTML = ''; $('timeline').hidden = true; return; }   // the date is asked in "Get ready"
  const today = ymd(new Date()), by = +state.birth.slice(0, 4);
  const ev = [{ d: today, txt: t('tlRegister'), key: 'today' }];
  if (state.birth > today) ev.push({ d: state.birth, txt: t('tlBorn') });
  ev.push({ d: addMonths(state.birth, 18), txt: t('tl18') }, { d: addMonths(state.birth, 30), txt: t('tl30') }, { d: `${by + 4}-09-01`, txt: t('tlJK') });
  if (state.need) ev.push({ d: state.need, txt: `${t('tlNeed')}: ${tr(AGE[ageGroupAt(state.birth, state.need)].label)}`, key: 'need' });
  const list = ev.filter(e => e.d >= today).sort((a, b) => a.d.localeCompare(b.d));
  $('timeline').innerHTML = `<h3>${ic('calendar')}${esc(t('tlTitle'))}</h3><ol class="tl">${list.map(e => `<li class="${e.key || ''}"><b>${esc(e.key === 'today' ? t('tlToday') : dateText(e.d))}</b><span>${esc(e.txt)}</span></li>`).join('')}</ol>
`;
}
function printPlan() {
  const fr = state.lang === 'fr', si = startInfo();
  $('planPrint').innerHTML = `<h1>${esc(t('planTitle'))}</h1><p class="muted">${esc(t('planMade', dateText(ymd(new Date()))))}</p>
    ${si ? `<p><b>${esc(t('ageAtStart', tr(AGE[si.group].label).toLowerCase(), dateText(si.when)))}</b></p>` : ''}
    <h2>${esc(t('planChoices'))}</h2>${state.shortlist.length ? `<ol>${state.shortlist.map(id => { const p = BY_ID[id], sc = score(id), r = INSPECTIONS[id];
      return `<li><b>${esc(p.name)}</b>, ${esc(addr(p))}, ${esc(p.city)} ${esc(p.postal)}${state.home ? ' · ' + esc(kmText(km(state.home, p))) : ''}<br>
        ${wOf(id).s !== 'none' ? `${esc(t(wKey(wOf(id).s)))}${wOf(id).a ? ' (' + esc(dateText(wOf(id).a)) + ')' : ''} · ` : ''}${r ? `${esc(t('inspLast'))}: ${esc(dateText(r.last))} (${esc(r.ok ? t('inspOk') : t('inspBad'))}) · ` : ''}${sc.g + sc.u + sc.c ? esc(t('score', sc.g, sc.u, sc.c)) + ' · ' : ''}${state.visited[id] ? esc(t('visited')) : ''}
        ${state.notes[id] ? `<br><i>${esc(state.notes[id])}</i>` : ''}</li>`; }).join('')}</ol>` : `<p>${esc(t('planNone'))}</p>`}
    <h2>${esc(t('planNext'))}</h2>${APHASES.map(ph => `<h3>${esc(t(ph.label))}</h3><ol>${ph.items.map(k => `<li>${state.ap[k] ? '[x] ' : '[ ] '}${esc(t(k))}</li>`).join('')}</ol>`).join('')}
    ${state.birth ? `<h2>${esc(t('tlTitle'))}</h2>${$('timeline').querySelector('ol') ? $('timeline').querySelector('ol').outerHTML : ''}` : ''}
    <h2>${esc(t('planLinks'))}</h2><ul>${['registry', 'subsidy', 'cwelcc', 'licensing', 'earlyon'].map(k => `<li>${esc(SOURCES[k].label)}: ${esc(SOURCES[k].url)}</li>`).join('')}</ul>
    <p class="muted">${fr ? 'KinderGuide Ottawa est un projet étudiant, non affilié à la Ville d’Ottawa.' : 'KinderGuide Ottawa is a student project, not affiliated with the City of Ottawa.'} ${esc(location.origin + location.pathname)}</p>`;
  document.body.classList.add('print-plan');
  window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('print-plan'));
$('printPlan').addEventListener('click', () => { renderTimeline(); printPlan(); });
function renderEstimator() {
  const ages = [['infant', tr(AGE.infant.label)], ['toddler', tr(AGE.toddler.label)], ['preschool', tr(AGE.preschool.label)], ['kindergarten', tr(AGE.kindergarten.label)], ['school6', state.lang === 'fr' ? '6 ans et plus' : '6 and over']];
  const school = state.estAge === 'school6', d = state.estDays;
  $('estimator').innerHTML = `<h3>${ic('dollar')}${esc(t('estTitle'))}</h3>
    <span class="flabel">${esc(t('estAge'))}</span><div class="chips" data-est="estAge" style="margin:6px 0 12px">${ages.map(([k, l]) => `<button class="chip${state.estAge === k ? ' on' : ''}" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    ${school ? `<div class="est-out">${esc(t('estSchool'))}</div>` : `<div class="est-out">${esc(t('estOut', fmt(monthly(COSTS.cap, d))))}</div><p class="muted">${esc(t('daysWk', d))} · ${esc(t('estAvg', fmt(monthly(COSTS.average, d))))}</p>`}
    <p class="note">${esc(t('estNote'))} ${esc(tr(COSTS.checked))} · ${ext(SOURCES.cap.url, t('source'), 'link')}</p>`;
}
$('view-apply').addEventListener('change', e => {
  const a = e.target.dataset.applied; if (a) { state.applied[a] = e.target.checked; if (state.shortlist.every(id => state.applied[id]) && !state.ap.g6) { state.ap.g6 = true; save(); renderApply(); renderStepper(); const b = document.querySelector(`[data-applied="${a}"]`); if (b) b.focus(); } else save(); return; }
  if (e.target.id === 'apBirth' || e.target.id === 'apNeed') { state[e.target.id === 'apBirth' ? 'birth' : 'need'] = e.target.value || null; if (state.birth) state.age = startInfo().group; save(); renderApply(); }
});
$('view-apply').addEventListener('click', async e => {
  const tk = e.target.closest('[data-ap]'); if (tk) { const k = tk.dataset.ap; state.ap[k] = !state.ap[k]; save(); renderApply(); renderStepper(); renderDock(); const b = document.querySelector(`[data-ap="${k}"]`); if (b) b.focus(); return; }
  const ph = e.target.closest('[data-aphase]'); if (ph) { state.aPhase = ph.dataset.aphase; save(); renderApply(); $('aPhases').scrollIntoView({ block: 'nearest' }); return; }
  const cn = e.target.closest('[data-copyname]'); if (cn) { toast((await copyText(BY_ID[cn.dataset.copyname].name)) ? t('copied') : BY_ID[cn.dataset.copyname].name); return; }
  const ch = e.target.closest('[data-est] [data-v]');
  if (ch) { const k = ch.closest('[data-est]').dataset.est; state[k] = k === 'estDays' ? +ch.dataset.v : ch.dataset.v; save(); if (k === 'estDays') renderApply(); else renderEstimator(); return; }
  if (e.target.closest('#copyReg2')) { const txt = state.shortlist.map((x, i) => `${i + 1}. ${BY_ID[x].name} (${addr(BY_ID[x])}, ${BY_ID[x].city})`).join('\n'); toast((await copyText(txt)) ? t('copied') : txt); return; }
  if (e.target.closest('#icsBtn')) {
    const d = new Date(); d.setMonth(d.getMonth() + 2);   // every 2 months: our suggestion, not a City rule
    downloadIcs('child-care-registry-reminders.ics', [{ date: d, rrule: 'RRULE:FREQ=MONTHLY;INTERVAL=2;COUNT=12', title: state.lang === 'fr' ? 'Mettre à jour ma demande au registre des services de garde' : 'Update my City child care registry application', desc: `${t('task3d')} ${SOURCES.registryApp.url}` }]);
    toast(state.lang === 'fr' ? 'Fichier de calendrier téléchargé.' : 'Calendar file downloaded. Open it to add reminders.');
  }
});

/* ---------- 9. Services hub and Ask Kip ---------- */
function renderServices() {
  $('svcQuery').placeholder = t('svcSearch');
  const q = fold($('svcQuery').value.trim());
  const hit = s => !q || fold(tr(s.name) + ' ' + tr(s.what)).includes(q);
  $('svcGroups').innerHTML = SERVICE_GROUPS.map(g => {
    const items = SERVICES.filter(s => s.group === g.id && hit(s));
    return items.length ? `<section class="sgroup"><h2><span class="ico">${ic(g.icon)}</span>${esc(tr(g.title))}</h2><div class="sgrid">${items.map(serviceCard).join('')}</div></section>` : '';
  }).join('');
  const faqs = FAQ.filter(f => !q || fold(tr(f.q) + ' ' + tr(f.a)).includes(q));
  $('faqList').innerHTML = faqs.map(f => `<details class="fq glass"><summary>${esc(tr(f.q))}</summary><p>${esc(tr(f.a))}${f.src ? ` ${ext(SOURCES[f.src].url, t('source'), 'link')} <span class="muted">· ${esc(t('checked', dateText(CHECKED)))}</span>` : ''}</p></details>`).join('') || `<p class="muted">–</p>`;
}
$('svcQuery').addEventListener('input', renderServices);

/* ---------- 10. About the data ---------- */
function renderAbout() {
  const fr = state.lang === 'fr';
  const total = CENTRES.reduce((s, p) => s + p.capacity, 0);
  const sums = AGES.map(a => ({ a, n: CENTRES.reduce((s, p) => s + p.spaces[a.key], 0), c: CENTRES.filter(p => p.spaces[a.key] > 0).length }));
  const max = Math.max(...sums.map(s => s.n));
  $('about').innerHTML = `<div class="about-grid">
    <div class="glass card-pad wide"><h2>${fr ? 'Ottawa en chiffres' : 'Ottawa in numbers'}</h2>
      <div class="bars">${sums.map((s, i) => `<div class="bar${i === 0 ? ' hi' : ''}" style="grid-template-columns:130px 1fr 70px"><span>${esc(tr(s.a.label))}</span><span class="track"><span class="fill" style="width:${Math.max(2, s.n / max * 100)}%"></span></span><span class="n">${fmt(s.n)}</span></div>`).join('')}</div>
      <div class="oim"><div><b>${fr ? 'Observation' : 'Observation'}</b>${fr ? `Seulement ${fmt(sums[0].n)} des ${fmt(total)} places agréées (${(sums[0].n / total * 100).toFixed(1)} %) sont pour les poupons, dans ${sums[0].c} centres.` : `Only ${fmt(sums[0].n)} of ${fmt(total)} licensed spaces (${(sums[0].n / total * 100).toFixed(1)}%) are for babies, in ${sums[0].c} centres.`}</div>
        <div><b>${fr ? 'Interprétation' : 'Interpretation'}</b>${fr ? 'Les parents de poupons ont beaucoup moins de choix : il faut savoir tôt quels centres les accueillent.' : 'Parents of babies have far fewer choices, so it helps to know early which centres take babies.'}</div>
        <div><b>${fr ? 'Recommandation' : 'Recommendation'}</b>${fr ? 'Inscrivez-vous tôt et filtrez par âge. Les places agréées ne sont pas des places libres.' : 'Register early and filter by age. Licensed spaces are not open spots.'}</div></div></div>
    <div class="glass card-pad"><h3>${fr ? 'Les données' : 'The data'}</h3><ul>
      <li>${ext(SOURCES.data.url, SOURCES.data.label, 'link')}: ${fmt(CENTRES.length)} ${fr ? 'centres et' : 'centres and'} ${PROVIDERS.length - CENTRES.length} ${fr ? 'agences' : 'agencies'}. ${fr ? 'Téléchargé le' : 'Downloaded'} ${esc(dateText(DATA_META.downloaded))}.</li>
      <li>${esc(INSPECTIONS_META.source)} (${esc(INSPECTIONS_META.feed)}): ${fmt(INSPECTIONS_META.matched)} ${fr ? 'programmes jumelés par adresse et nom; les cas incertains sont exclus.' : 'programs matched by address and name; unsure matches are left out.'}</li>
      <li>${fr ? 'Emplacements : OpenStreetMap' : 'Locations: OpenStreetMap'}; ${PROVIDERS.filter(p => p.approx).length} ${fr ? 'sont approximatifs.' : 'are approximate.'}</li>
      <li>${fr ? 'Arrêts d’autobus et stations de l’O-Train ouvertes' : 'Bus stops and open O-Train stations'}: ${ext(SOURCES.osm.url, 'OpenStreetMap', 'link')} (${esc(dateText(TRANSIT_META.downloaded))}). ${fr ? 'Les stations en construction ne sont pas comptées.' : 'Stations under construction are not counted.'}</li>
      <li>${fr ? 'Questions et ratios : gouvernement de l’Ontario. Frais : plafond de l’Ontario' : 'Questions and ratios: Government of Ontario. Fees: Ontario’s cap'} (${ext(SOURCES.cap.url, 'CP 2026', 'link')}).</li></ul></div>
    <div class="glass card-pad"><h3>${esc(t('limits'))}</h3><ul>
      <li>${fr ? 'Aucune place libre, liste d’attente ni tarif par centre : ces données ne sont pas publiées.' : 'No open spots, waitlists or prices per centre: these are not published.'}</li>
      <li>${fr ? 'Les inspections portent sur l’hygiène, pas sur la qualité.' : 'Inspections cover hygiene, not quality.'}</li>
      <li>${fr ? 'Les distances sont à vol d’oiseau, pas des temps de trajet.' : 'Distances are straight-line, not travel times.'}</li>
      <li>${fr ? `Fichier de la Ville mis à jour le ${esc(dateText(DATA_META.cityUpdated))} (date du portail); la Ville prépare une nouvelle version.` : `City file last updated ${esc(dateText(DATA_META.cityUpdated))} (portal date); the City is preparing a new version.`}</li></ul></div>
    <div class="glass card-pad wide"><h3>${ic('refresh')}${esc(t('updTitle'))}</h3><ul class="ilist dots">
      <li>${fr ? 'Chaque semaine, une tâche automatique télécharge le fichier de la Ville, place les nouveaux programmes sur la carte, vérifie les liens officiels et republie le site. Les pages de la Ville d’Ottawa bloquent les outils automatiques : l’équipe les vérifie à la main.' : 'Every week, an automatic job downloads the City’s file, maps any new programs, checks the official links and republishes the site. City of Ottawa pages block automated tools, so the team checks those by hand.'}</li>
      <li>${fr ? 'Chaque réponse montre sa source officielle et la date de vérification.' : 'Each answer shows its official source and the date it was checked.'}</li>
      <li>${fr ? 'Chaque programme a un lien vers la recherche de l’Ontario pour confirmer son permis.' : 'Each program links to Ontario’s licensing search, to confirm its licence.'}</li>
      <li>${fr ? `Si les données ont plus de ${STALE_DAYS} jours, le site l’indique aux parents.` : `If the data is more than ${STALE_DAYS} days old, the site tells parents.`}</li>
      <li>${fr ? 'Les inspections de Santé publique sont rechargées par l’équipe (pas encore automatique).' : 'Public Health inspections are reloaded by the team (not automatic yet).'}</li></ul>
      <p class="note">${fr ? 'Code et scripts : dépôt GitHub du projet (dossier tools).' : 'Code and scripts: the project’s GitHub repository (tools folder).'}</p></div>
    <div class="glass card-pad"><h3>${esc(t('privacy'))}</h3><ul>
      <li>${fr ? 'Aucun compte, aucun témoin, aucun suivi.' : 'No account, no cookies, no tracking.'}</li>
      <li>${fr ? 'Votre liste et vos notes restent sur cet appareil.' : 'Your shortlist and notes stay on this device.'}</li>
      <li>${fr ? 'Un code postal est envoyé à OpenStreetMap seulement pour le placer sur la carte. Votre position n’est jamais envoyée.' : 'A postal code is sent to OpenStreetMap only to place it on the map. Your location is never sent.'}</li>
      <li>${fr ? 'Les noms des titulaires de permis qui sont des particuliers ne sont pas affichés.' : 'Licensees who are private persons are not named.'}</li></ul></div>
    <div class="glass card-pad"><h3>${ic('landmark')}${esc(t('forCity'))}</h3><ul>
      <li>${fr ? 'Ajouter « inscrit au système à 10 $ » et « tarif de base par âge » aux données ouvertes.' : 'Add “enrolled in the $10-a-day system” and “base fee by age” to the open data.'}</li>
      <li>${fr ? 'Ajouter un identifiant commun entre les permis et les inspections de Santé publique.' : 'Add one shared ID between licences and Public Health inspections, so no matching is needed.'}</li>
      <li>${fr ? 'Publier la date des données et une mise à jour régulière.' : 'Publish the data date and a regular update schedule.'}</li></ul></div>
    <p class="trust wide">${esc(t('trust'))} ${fr ? 'Contient des renseignements visés par la Licence du gouvernement ouvert – Ville d’Ottawa.' : 'Contains information licensed under the Open Government Licence – City of Ottawa.'}</p></div>`;
}

/* ---------- 10b. Data insights for the City ---------- */
function renderInsights() {
  const fr = state.lang === 'fr';
  const fsa = {};
  CENTRES.forEach(p => { const k = (p.postal || '').slice(0, 3).toUpperCase(); if (!/^K\d[A-Z]$/.test(k)) return; const f = fsa[k] = fsa[k] || { k, centres: 0, spaces: 0, infant: 0, infantCentres: 0 }; f.centres++; f.spaces += p.capacity; f.infant += p.spaces.infant; if (p.spaces.infant) f.infantCentres++; });
  const areas = Object.values(fsa).sort((a, b) => b.spaces - a.spaces);
  const noInfant = areas.filter(a => a.infant === 0);
  // Spotlight: the largest postal area with no infant spaces, and the distance to the nearest centre that has some
  const big = noInfant.sort((a, b) => b.spaces - a.spaces)[0];
  let spot = null;
  if (big) {
    const pts = CENTRES.filter(p => (p.postal || '').toUpperCase().startsWith(big.k));
    const c = { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length };
    const nearest = Math.min(...CENTRES.filter(p => p.spaces.infant > 0).map(p => km(c, p)));
    const area = AREAS.slice().sort((a, b) => km(c, a) - km(c, b))[0];
    spot = { ...big, nearest, name: area.name };
  }
  const maxSp = Math.max(...areas.map(a => a.spaces));
  const ins = Object.entries(INSPECTIONS).map(([id, r]) => ({ id, ...r }));
  const recent = ins.filter(r => insp(BY_ID[r.id]).kind !== 'old');
  const ok = recent.filter(r => r.ok).length;
  const issues = {}; ins.forEach(r => r.issues.forEach(i => { const k = i.t.replace(/\.$/, ''); issues[k] = (issues[k] || 0) + 1; }));
  const topIssues = Object.entries(issues).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxIss = topIssues.length ? topIssues[0][1] : 1;
  const unmatched = CENTRES.filter(p => !INSPECTIONS[p.id]).length;
  const totalInfant = CENTRES.reduce((s, p) => s + p.spaces.infant, 0), total = CENTRES.reduce((s, p) => s + p.capacity, 0);
  const nearT = p => TRANSIT[p.id] && TRANSIT[p.id].train, infC = CENTRES.filter(p => p.spaces.infant > 0);
  const tr_ = { inf: infC.length, infNear: infC.filter(nearT).length, infSpNear: infC.filter(nearT).reduce((s, p) => s + p.spaces.infant, 0),
    near: CENTRES.filter(nearT).length, bus: CENTRES.filter(p => TRANSIT[p.id] && TRANSIT[p.id].bus <= TRANSIT_META.busMetres).length };
  const bar = (label, n, max, note, hi) => `<div class="bar wide${hi ? ' hi' : ''}"><span>${esc(label)}</span><span class="track"><span class="fill" style="width:${Math.max(2, n / max * 100)}%"></span></span><span class="n">${esc(note)}</span></div>`;
  $('insights').innerHTML = `
    <div class="kpis">
      <div class="kpi glass">${ic('child')}<b>${(totalInfant / total * 100).toFixed(1)}%</b><span>${fr ? 'des places agréées sont pour les poupons' : 'of licensed spaces are for babies'} (${fmt(totalInfant)} / ${fmt(total)})</span></div>
      <div class="kpi glass">${ic('pin')}<b>${noInfant.length} / ${areas.length}</b><span>${fr ? 'zones postales avec des centres mais aucune place pour poupons' : 'postal areas with centres but no infant spaces'}</span></div>
      <div class="kpi glass">${ic('shield')}<b>${Math.round(ok / Math.max(1, recent.length) * 100)}%</b><span>${fr ? 'des centres inspectés étaient conformes à la dernière inspection' : 'of inspected centres were in compliance at their last inspection'} (${ok} / ${recent.length})</span></div>
      <div class="kpi glass">${ic('link')}<b>${unmatched}</b><span>${fr ? 'centres sans lien fiable avec les inspections (pas d’identifiant commun)' : 'centres with no reliable link to inspections (no shared ID)'}</span></div>
    </div>
    ${spot ? `<section class="spotlight glass card-pad"><h2>${ic('alert')}${fr ? 'À souligner' : 'Spotlight'}: ${esc(spot.name)} (${esc(spot.k)})</h2>
      <p>${fr ? `${spot.centres} centres agréés et ${fmt(spot.spaces)} places agréées, mais <b>aucune place pour poupons</b> dans les données de la Ville. Le centre agréé le plus proche qui accueille des poupons est à <b>${kmText(spot.nearest)}</b> du centre du secteur.` : `${spot.centres} licensed centres and ${fmt(spot.spaces)} licensed spaces, but <b>no infant spaces</b> in the City’s data. The nearest licensed centre with infant spaces is <b>${kmText(spot.nearest)}</b> from the centre of the area.`}</p>
      <p class="note">${fr ? 'À confirmer avec les données mises à jour de la Ville. Les agences de garde en milieu familial peuvent accueillir des poupons, mais leurs places ne sont pas publiées par âge.' : 'To be confirmed with the City’s updated data. Home child care agencies may care for babies, but their spaces are not published by age.'}</p></section>` : ''}
    <div class="ins-grid">
      <section class="glass card-pad"><h2>${ic('pin')}${fr ? 'Places par zone postale' : 'Spaces by postal area'}</h2>
        <p class="muted">${fr ? 'Les 3 premiers caractères du code postal (RTA). En orange : aucune place pour poupons.' : 'First 3 characters of the postal code (FSA). Orange: no infant spaces.'}</p>
        <div class="bars">${areas.slice(0, 14).map(a => bar(a.k, a.spaces, maxSp, `${fmt(a.spaces)} · ${a.infant ? fmt(a.infant) + (fr ? ' poupons' : ' infant') : (fr ? '0 poupon' : '0 infant')}`, !a.infant)).join('')}</div>
        <p class="note">${fr ? 'Zones sans place pour poupons' : 'Areas with no infant spaces'}: ${noInfant.map(a => esc(a.k)).join(', ') || '–'}</p></section>
      <section class="glass card-pad"><h2>${ic('shield')}${fr ? 'Problèmes d’inspection les plus fréquents' : 'Most common inspection issues'}</h2>
        <p class="muted">${fr ? 'Santé publique Ottawa, 2 dernières années, nombre de centres.' : 'Ottawa Public Health, last 2 years, number of centres.'}</p>
        <div class="bars">${topIssues.map(([k, n]) => bar(k, n, maxIss, String(n))).join('')}</div></section>
    </div>
    <section class="glass card-pad transit-ins"><h2>${ic('train')}${fr ? 'Accès en transport en commun' : 'Transit access'}</h2>
      <div class="kpis mini">
        <div><b>${tr_.infNear} / ${tr_.inf}</b><span>${fr ? `centres avec places pour poupons à moins de 1 km d’une station de l’O-Train ouverte (${fmt(tr_.infSpNear)} des ${fmt(totalInfant)} places)` : `centres with infant spaces within 1 km of an open O-Train station (${fmt(tr_.infSpNear)} of ${fmt(totalInfant)} spaces)`}</span></div>
        <div><b>${tr_.near} / ${CENTRES.length}</b><span>${fr ? 'centres à moins de 1 km d’une station de l’O-Train' : 'centres within 1 km of an O-Train station'}</span></div>
        <div><b>${tr_.bus} / ${CENTRES.length}</b><span>${fr ? 'centres avec un arrêt d’autobus à 5 minutes à pied (400 m)' : 'centres with a bus stop within a 5-minute walk (400 m)'}</span></div>
      </div>
      <p class="note">${fr ? 'OpenStreetMap, distances à vol d’oiseau. Les stations en construction (prolongements est, ouest et sud) ne sont pas comptées : à refaire à leur ouverture.' : 'OpenStreetMap, straight-line distances. Stations under construction (east, west and south extensions) are not counted: worth redoing when they open.'}</p></section>
    <div class="oim glass card-pad">
      <div><b>${fr ? 'Observation' : 'Observation'}</b>${fr ? `${noInfant.length} zones postales ont des centres mais aucune place pour poupons, et les poupons n’ont que ${(totalInfant / total * 100).toFixed(1)} % des places.` : `${noInfant.length} postal areas have centres but no infant spaces, and babies have only ${(totalInfant / total * 100).toFixed(1)}% of all spaces.`}</div>
      <div><b>${fr ? 'Interprétation' : 'Interpretation'}</b>${fr ? 'Les familles de poupons de ces zones doivent probablement chercher plus loin. Il faudrait comparer avec le nombre de jeunes enfants par zone (recensement) avant de conclure.' : 'Families with babies in these areas probably have to search further away. This should be compared with the number of young children per area (census) before drawing conclusions.'}</div>
      <div><b>${fr ? 'Recommandation' : 'Recommendation'}</b>${fr ? 'Publier les places par âge avec la date des données, un identifiant commun avec les inspections, et l’adhésion au système à 10 $ et les tarifs.' : 'Publish spaces by age with the data date, one ID shared with inspections, and $10-a-day enrolment and base fees.'}</div>
    </div>
    <div class="glass card-pad dl"><div><h2>${ic('download')}${esc(t('dlTitle'))}</h2><p class="muted">${esc(t('dlLead'))}</p></div><button class="btn primary" id="dlCsv">${ic('download', 'sm')}${esc(t('dlBtn'))}</button></div>
    <p class="trust">${fr ? 'Sources : Données ouvertes d’Ottawa (services de garde agréés) et Santé publique Ottawa (inspections, flux du 21 octobre 2026). Places agréées ≠ places libres.' : 'Sources: City of Ottawa Open Data (licensed child care) and Ottawa Public Health (inspections, Oct 21, 2026 feed). Licensed spaces are not open spots.'}</p>`;
}

function matchedCsv() {
  const head = ['id', 'name', 'operator', 'address', 'city', 'postal', 'postal_area', 'latitude', 'longitude', 'location_approximate', 'infant', 'toddler', 'preschool', 'kindergarten', 'school_age', 'licensed_capacity', 'french_service', 'indigenous_programming', 'oph_last_inspection', 'oph_last_result', 'oph_inspections_2y', 'oph_not_in_compliance_2y', 'nearest_bus_stop_m', 'bus_stops_within_400m', 'otrain_station_within_1km', 'otrain_station_m'];
  const q = v => { const x = String(v ?? ''); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  const rows = PROVIDERS.map(p => { const r = INSPECTIONS[p.id] || {};
    return [p.id, p.name, p.operator, p.address, p.city, p.postal, (p.postal || '').slice(0, 3), p.lat, p.lon, p.approx ? 'yes' : 'no', ...['infant', 'toddler', 'preschool', 'kindergarten', 'schoolAge'].map(k => p.spaces ? p.spaces[k] : ''), p.capacity ?? '', p.french ? 'yes' : 'no', p.indigenous ? 'yes' : 'no', r.last || '', r.last ? (r.ok ? 'in compliance' : 'not in compliance') : '', r.n2y ?? '', r.bad2y ?? '', ...(p.kind === 'centre' && TRANSIT[p.id] ? [TRANSIT[p.id].bus, TRANSIT[p.id].stops, TRANSIT[p.id].train || '', TRANSIT[p.id].trainM ?? ''] : ['', '', '', ''])].map(q).join(','); });
  return [head.join(','), ...rows].join('\r\n');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#dlCsv')) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + matchedCsv()], { type: 'text/csv;charset=utf-8' })); a.download = 'kinderguide-ottawa-licensed-child-care-matched.csv';
  document.body.appendChild(a); a.click(); a.remove();
});

/* ---------- 11. Help (one button, in the top bar) and the tour ---------- */
function showKip() {
  const k = { home: 'kipHome', find: 'kipFind', shortlist: 'kipShortlist', visit: 'kipVisit', apply: 'kipApply', services: 'kipServices', about: 'kipHome', insights: 'kipHome' }[current];
  $('kipBubble').innerHTML = `<b>${ic('help', 'sm')}${esc(t('help'))}</b>${esc(t(k))}<div style="margin-top:10px;display:flex;gap:8px"><button class="btn ghost small" id="kipTour">${ic('play', 'sm')}${esc(t('tourStart'))}</button><button class="btn ghost small" data-view="services">${esc(t('faqTitle'))}</button></div>`;
  $('kipBubble').hidden = false; $('helpTop').setAttribute('aria-expanded', 'true');
}
function hideKip() { $('kipBubble').hidden = true; $('helpTop').setAttribute('aria-expanded', 'false'); }
$('helpTop').addEventListener('click', () => $('kipBubble').hidden ? showKip() : hideKip());
document.addEventListener('click', e => {
  if (e.target.closest('#kipTour')) { hideKip(); showTour(0); return; }
  if (!e.target.closest('#kipBubble, #helpTop')) hideKip();
});
// Tour, only when asked for: a spotlight on the real controls, one at a time (keyboard: Enter, arrows, Escape)
let tourStep = 0;
const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
function tourTarget(s) { return (s.target || []).map(q => document.querySelector(q)).find(visible) || null; }
function placeTour() {
  if ($('tour').hidden) return;
  const el = tourTarget(TOUR[tourStep]), spot = $('tourSpot'), card = $('tourCard');
  $('tour').classList.toggle('centred', !el);
  if (!el) { spot.style.cssText = 'display:none'; card.style.cssText = ''; return; }
  const r = el.getBoundingClientRect(), pad = 8, vw = innerWidth, vh = innerHeight;
  spot.style.cssText = `display:block;left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  const cw = Math.min(360, vw - 32), ch = card.offsetHeight;
  const below = r.bottom + pad + 12 + ch < vh, top = below ? r.bottom + pad + 12 : Math.max(16, r.top - pad - 12 - ch);
  card.style.cssText = `position:fixed;width:${cw}px;left:${Math.max(16, Math.min(vw - cw - 16, r.left + r.width / 2 - cw / 2))}px;top:${top}px`;
}
function showTour(i) {
  tourStep = i; const s = TOUR[i];
  if (current !== 'home') go('home');
  hideHint();
  $('tourTitle').textContent = tr(s.title); $('tourText').textContent = tr(s.text);
  $('tourCount').textContent = t('tourOf', i + 1, TOUR.length);
  $('tourDots').innerHTML = TOUR.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('');
  $('tourNext').textContent = i === TOUR.length - 1 ? t('tourGo') : t('tourNext');
  $('tourSkip').textContent = i ? t('tourBack') : t('tourSkip');
  $('tour').hidden = false;
  const el = tourTarget(s);
  if (el) { const r = el.getBoundingClientRect(); if (r.top < 80 || r.bottom > innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: 'instant' }); }   // instant: a smooth scroll left the spotlight on the wrong control
  requestAnimationFrame(() => { placeTour(); $('tourNext').focus(); });
}
function endTour() { $('tour').hidden = true; state.tourDone = true; save(); go('home', { scroll: false }); const c = document.querySelector('#ageChips .chip'); if (c) c.focus(); }
$('tourNext').addEventListener('click', () => tourStep < TOUR.length - 1 ? showTour(tourStep + 1) : endTour());
$('tourSkip').addEventListener('click', () => tourStep ? showTour(tourStep - 1) : endTour());
$('tourClose').addEventListener('click', endTour);
$('tourAgain').addEventListener('click', () => showTour(0));
$('tour').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.stopPropagation(); endTour(); }
  else if (e.key === 'ArrowRight' && tourStep < TOUR.length - 1) showTour(tourStep + 1);
  else if (e.key === 'ArrowLeft' && tourStep) showTour(tourStep - 1);
});
addEventListener('resize', placeTour); addEventListener('scroll', placeTour, { passive: true });

// First time on each step: one short tip at the top of the page, closed with "Got it"
function hideHint() { const h = document.querySelector('.page-hint'); if (h) h.remove(); }
function showHint(view) {
  hideHint();
  const k = PAGE_HINTS[view]; if (!k || state.hints[view] || !$('tour').hidden) return;
  const box = document.createElement('div');
  box.className = 'page-hint'; box.setAttribute('role', 'note');
  box.innerHTML = `${ic('info')}<p><b>${esc(t('hintShow'))}</b>${esc(t(k))}</p><button class="btn small primary" data-hint="${view}">${esc(t('hintGot'))}</button>`;
  const sec = $('view-' + view); sec.insertBefore(box, sec.firstChild);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-hint]'); if (b) { state.hints[b.dataset.hint] = true; save(); hideHint(); } });

/* ---------- 12. Start-up and language ---------- */
function fillIcons(root = document) { root.querySelectorAll('[data-ic]').forEach(el => { el.innerHTML = ic(el.dataset.ic); el.removeAttribute('data-ic'); }); }
fillIcons();
function applyLang() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $('langLbl').textContent = t('lang'); $('langShort').textContent = state.lang === 'fr' ? 'EN' : 'FR'; $('langBtn').lang = state.lang === 'fr' ? 'en' : 'fr';
}
$('langBtn').addEventListener('click', () => { state.lang = state.lang === 'fr' ? 'en' : 'fr'; save(); applyLang(); go(current, { scroll: false }); });
applyLang();
const startHash = (location.hash || '').slice(1), deepId = startHash.startsWith('p/') && BY_ID[startHash.slice(2)] ? startHash.slice(2) : null;
const startView = deepId ? 'find' : startHash || (sharedIds.length ? 'shortlist' : 'home');
go(startView, { scroll: false });
if (deepId) { activeId = deepId; renderList(); openPanel(deepId); }

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
