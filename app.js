/* ==================================================================
   KinderGuide Ottawa: Prototype 2
   1. Helpers, language, saved state     7. Step 3: Visit checklist
   2. Navigation and stepper             8. Step 4: Apply (plan + cost)
   3. Home                               9. Services hub and Ask Kip
   4. Step 1: Find (filters, list, map) 10. About the data
   5. Details panel (+ Google reviews)  11. Kip helper and tour
   6. Step 2: Shortlist (compare, share) 12. Start-up
   ================================================================== */

/* ---------- 1. Helpers, language, saved state ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BY_ID = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));
const CENTRES = PROVIDERS.filter(p => p.kind === 'centre');
const AGE = Object.fromEntries(AGES.map(a => [a.key, a]));
const MAX_PICKS = 9, MIN_PICKS = 5;
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
}, (() => {
  try {
    const v2 = JSON.parse(localStorage.getItem(KEY));
    if (v2) return v2;
    const v1 = JSON.parse(localStorage.getItem('kinderguide.v1'));   // keep a Prototype 1 shortlist
    return v1 ? { shortlist: v1.shortlist || [], notes: v1.notes || {}, visited: v1.visited || {}, answers: v1.answers || {}, qnotes: v1.qnotes || {}, age: v1.age || 'any', home: v1.center || null, tourDone: !!v1.tourDone } : {};
  } catch (e) { return {}; }
})());
state.shortlist = state.shortlist.filter(id => BY_ID[id]);
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
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
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

/* ---------- 2. Navigation and stepper ---------- */
let current = 'home';
function stepDone(s) {
  if (s === 'find') return !!state.home || state.shortlist.length > 0;
  if (s === 'shortlist') return state.shortlist.length >= MIN_PICKS;
  if (s === 'visit') return Object.values(state.visited).some(Boolean) || Object.keys(state.answers).some(k => Object.values(state.answers[k] || {}).some(Boolean));
  if (s === 'apply') return [1, 2, 3, 4].every(i => state.tasks[i]);
  return false;
}
function renderStepper() {
  $('stepper').innerHTML = STEPS.map((s, i) => `${i ? '<span class="sep" aria-hidden="true"></span>' : ''}<button class="step${current === s ? ' on' : ''}${stepDone(s) ? ' done' : ''}" data-view="${s}" ${current === s ? 'aria-current="step"' : ''}>
      <span class="num">${stepDone(s) && current !== s ? ic('check', 'sm') : i + 1}</span><span class="lbl">${esc(t('step' + (i + 1)))}</span>${s === 'shortlist' && state.shortlist.length ? `<span class="badge-n">${state.shortlist.length}</span>` : ''}</button>`).join('');
  $('bottomNav').innerHTML = [...STEPS.map((s, i) => `<button data-view="${s}" class="${current === s ? 'on' : ''}"><span class="num">${stepDone(s) && current !== s ? ic('check', 'sm') : i + 1}</span>${esc(t('step' + (i + 1)))}</button>`),
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
  renderStepper();
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
function nextBar(id, back, next, label) {
  $(id).innerHTML = `${back ? `<button class="btn ghost" data-view="${back}">${ic('back', 'sm')}${esc(t('back'))}</button>` : ''}${next ? `<button class="btn primary" data-view="${next}">${esc(t('next'))}: ${esc(label)}${ic('arrow', 'sm')}</button>` : ''}`;
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
function renderHome() {
  renderAgeChips($('ageChips'));
  $('postalInput').placeholder = t('postal');
  if (state.home && !$('postalInput').value) $('postalInput').value = state.home.label === 'GPS' ? '' : state.home.label;
  $('nearStatus').textContent = state.home ? t('nearX', state.home.label === 'GPS' ? t('yourLoc') : state.home.label) : '';
  $('birthInput').value = state.birth || ''; $('needInput').value = state.need || '';
  if (state.birth) { $('datesBox').open = true; applyDates(); }
  const icons4 = ['search', 'heart', 'clipboard', 'file'];
  $('steps4').innerHTML = STEPS.map((s, i) => `<button class="s4 glass" data-view="${s}"><span class="n">${ic(icons4[i])}<i>${i + 1}</i></span><b>${esc(t('step' + (i + 1)))}</b><span>${esc(t('s' + (i + 1) + 'sub'))}</span></button>`).join('');
  const spaces = CENTRES.reduce((s, p) => s + p.capacity, 0);
  $('stats').innerHTML = `<div><b>${fmt(PROVIDERS.length)}</b><span>${esc(t('statPrograms'))}</span></div><div><b>${fmt(spaces)}</b><span>${esc(t('statSpaces'))}</span></div><div><b>${fmt(Object.keys(INSPECTIONS).length)}</b><span>${esc(t('statInspected'))}</span></div>`;
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
const COLORS = { centre: '#0f6b6b', home: '#7b5ea7', saved: '#e07a5f' };
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
  const n = [state.french, state.indigenous, !state.agencies, state.okOnly, state.route].filter(Boolean).length;
  $('fCount').hidden = !n; $('fCount').textContent = n;
  $('filterPop').innerHTML = [['french', 'french'], ['indigenous', 'indigenous'], ['agencies', 'homeAg'], ['okOnly', 'okOnly']]
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
function ageTags(p) {
  if (p.kind === 'home') return `<span class="tag home">${esc(t('agency'))}</span>`;
  return AGES.filter(a => p.spaces[a.key] > 0).map(a => `<span class="tag${state.age === a.key ? ' match' : ''}">${esc(tr(a.label))}</span>`).join('');
}
const extraTags = p => (p.french ? `<span class="tag fr">FR</span>` : '') + (p.indigenous ? `<span class="tag ind">${esc(t('indigenous'))}</span>` : '');
function distText(p) {
  if (routeOn()) return detour(p) < .15 ? t('onWay') : `+${kmText(detour(p))} ${t('detour')}`;
  return state.home ? kmText(km(state.home, p)) + (p.approx ? ' ~' : '') : '';
}
function heartBtn(id) { const on = state.shortlist.includes(id); return `<button class="heart${on ? ' on' : ''}" data-save="${id}" aria-pressed="${on}">${ic('heart', 'sm')}${esc(on ? t('saved') : t('save'))}</button>`; }
function renderFind() { renderFindControls(); renderList(); nextBar('nextFind', null, 'shortlist', `${t('step2')} (${state.shortlist.length})`); }
let lastList = [];
function renderList() {
  const list = lastList = sortedList();
  $('resultCount').textContent = t('results', list.length);
  renderTip(list);
  $('results').innerHTML = list.length ? list.slice(0, 160).map(p => `<article class="pc glass${p.id === activeId ? ' active' : ''}" data-id="${p.id}" tabindex="0" aria-label="${esc(p.name)}">
      <div class="pc-top"><div><h3>${esc(p.name)}</h3><div class="where">${esc(p.address)}${distText(p) ? ' · <b>' + esc(distText(p)) + '</b>' : ''}</div></div>${heartBtn(p.id)}</div>
      <div class="tags">${ageTags(p)}${extraTags(p)}${inspBadge(p, true)}</div></article>`).join('') + (list.length > 160 ? `<p class="empty">+${list.length - 160}…</p>` : '')
    : `<div class="empty glass">${esc(t('noResults'))}</div>`;
  $('results').insertAdjacentHTML('beforeend', `<p class="data-date">${ic('info', 'sm')}${esc(t('dataDate', dateText(DATA_META.downloaded), dateText(INSPECTIONS_META.feed)))} <button class="link" data-view="about">${esc(t('footerAbout'))}</button></p>`);
  renderMap(list);
}
function countAt(r) { const keep = state.radius; state.radius = r; const n = PROVIDERS.filter(matches).length; state.radius = keep; return n; }
function renderTip(list) {
  let html = '';
  const si = startInfo();
  if (si && state.age === si.group) html += `<div class="tip info">${ic('calendar', 'sm')}<span>${esc(t('ageAtStart', tr(AGE[si.group].label).toLowerCase(), dateText(si.when)))}</span></div>`;
  if (state.home && !routeOn() && state.radius > 0 && list.length < MIN_PICKS) {
    const next = [5, 10, 0].find(r => (r === 0 || r > state.radius) && countAt(r) >= MIN_PICKS);
    html += `<div class="tip warn">${ic('info', 'sm')}<span>${esc(t('tipFew', list.length, '', state.radius))}</span>${next !== undefined ? `<button class="btn small primary" data-r="${next}">${esc(next ? t('tipWiden', next, countAt(next)) : t('tipAll', countAt(0)))}</button>` : ''}</div>`;
  }
  $('tipBox').innerHTML = html;
}
$('tipBox').addEventListener('click', e => { const r = e.target.closest('[data-r]'); if (r) { state.radius = +r.dataset.r; save(); renderFind(); } });
$('results').addEventListener('click', e => {
  const s = e.target.closest('[data-save]'); if (s) { e.stopPropagation(); toggleShortlist(s.dataset.save); return; }
  const c = e.target.closest('.pc'); if (c) openPanel(c.dataset.id);
});
$('results').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('pc')) openPanel(e.target.dataset.id); });
function markerStyle(p) {
  return { radius: p.id === activeId ? 10 : 7, weight: 2, color: '#fff', fillOpacity: .95,
    fillColor: state.shortlist.includes(p.id) ? COLORS.saved : p.kind === 'home' ? COLORS.home : COLORS.centre };
}
function initMap() {
  if (map || typeof window.L === 'undefined') return;
  map = window.L.map('map', { zoomControl: true }).setView([45.38, -75.72], 11);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  markerLayer = window.L.layerGroup().addTo(map);
  PROVIDERS.forEach(p => { markers[p.id] = window.L.circleMarker([p.lat, p.lon], markerStyle(p)).bindTooltip(esc(p.name), { direction: 'top', offset: [0, -6] }).on('click', () => openPanel(p.id)); });
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
let ptab = 'overview';
function openPanel(id, tab) {
  const p = BY_ID[id]; if (!p) return;
  activeId = id; if (tab) ptab = tab;
  history.replaceState(null, '', location.pathname + location.search + '#p/' + id);
  const q = encodeURIComponent(`${p.name} ${p.address} ${p.city} ON`);
  $('panel').innerHTML = `
    <div class="p-head">
      <button class="p-close" id="pClose" aria-label="Close">${ic('x')}</button>
      <h2 id="pTitle">${esc(p.name)}</h2>
      <div class="p-sub">${esc(p.address)}, ${esc(p.city)} ${esc(p.postal)}${distText(p) ? ' · ' + esc(distText(p)) : ''}${p.approx ? ' · ' + esc(t('approx')) : ''}</div>
      <div class="tags" style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">${ageTags(p)}${extraTags(p)}${inspBadge(p, true)}</div>
      <div class="p-actions">${heartBtn(id)}${ext(`https://www.google.com/maps/dir/?api=1&destination=${q}`, t('directions'))}${ext(`https://www.google.com/search?q=${encodeURIComponent(p.name + ' Ottawa')}`, t('contact'))}<button class="btn ghost small" id="copyLink">${ic('link', 'sm')}${esc(t('copyLink'))}</button></div>
      <div class="tabs" role="tablist">${[['overview', 'tOverview'], ['safety', 'tSafety'], ['reviews', 'tReviews'], ['ask', 'tAsk']].map(([k, l]) => `<button role="tab" data-ptab="${k}" aria-selected="${ptab === k}" class="${ptab === k ? 'on' : ''}">${esc(t(l))}</button>`).join('')}</div>
    </div>
    <div class="p-body" id="pBody"></div>`;
  renderPanelBody(p);
  $('panel').classList.add('open'); $('panel').setAttribute('aria-hidden', 'false'); $('scrim').hidden = false;
  $('pClose').focus();
  if (current === 'find') { document.querySelectorAll('.pc').forEach(c => c.classList.toggle('active', c.dataset.id === id)); Object.values(markers).forEach((m, i) => m.setStyle(markerStyle(PROVIDERS[i]))); }
}
function costBox(p) {
  const v = VERIFIED_PRICES[p.id];
  const under6 = p.kind === 'home' || ['infant', 'toddler', 'preschool', 'kindergarten'].some(k => p.spaces[k] > 0);
  const body = v ? `<p class="big-line"><b>${esc(t('confirmed'))}:</b> ${esc(v.text)} <span class="muted">(${esc(v.how)}, ${esc(v.date)})</span></p>`
    : under6 ? `<p class="big-line">${esc(t('costCap', COSTS.cap))}</p><p class="note">${esc(t('costAsk'))}</p>` : `<p class="big-line">${esc(t('costSchool'))}</p>`;
  return `<div class="box"><h3>${ic('dollar')}${esc(t('costTitle'))}</h3>${body}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn ghost small" data-view="apply">${esc(t('estTitle'))}</button>${ext(SOURCES.subsidy.url, t('calc'))}</div></div>`;
}
function renderPanelBody(p) {
  const body = $('pBody'); if (!body) return;
  if (ptab === 'overview') {
    const max = Math.max(...AGES.map(a => p.spaces[a.key]), 1);
    body.innerHTML = (p.kind === 'centre' ? `<div class="box"><h3>${ic('child')}${esc(t('spacesByAge'))}</h3><div class="bars">${AGES.map(a => `<div class="bar${state.age === a.key ? ' hi' : ''}"><span>${esc(tr(a.label))}</span><span class="track"><span class="fill" style="width:${p.spaces[a.key] ? Math.max(4, p.spaces[a.key] / max * 100) : 0}%"></span></span><span class="n">${p.spaces[a.key] || '–'}</span></div>`).join('')}</div>
        <p class="note"><b>${esc(t('licensedFor', p.capacity))}</b>: ${esc(t('spacesNote'))}</p></div>`
      : `<div class="box"><h3>${ic('home')}${esc(t('agency'))}</h3><p>${state.lang === 'fr' ? 'Garde dans la maison d’une éducatrice, supervisée par cette agence agréée. Contactez l’agence pour connaître les maisons près de chez vous.' : 'Care in a provider’s home, overseen by this licensed agency. Contact the agency to find homes near you.'}</p></div>`)
      + costBox(p) + (p.operator ? `<p class="note">${state.lang === 'fr' ? 'Exploitant' : 'Operator'}: ${esc(p.operator)}</p>` : '');
  } else if (ptab === 'safety') {
    const s = insp(p);
    let html = `<div class="box"><h3>${ic('shield')}${esc(t('inspTitle'))}</h3><p class="note" style="margin:0 0 10px">${esc(t('inspBy'))}</p>`;
    if (!s.r) html += `<p>${esc(t('inspNone'))}.</p>`;
    else {
      html += `<p class="big-line">${inspBadge(p)}</p><p>${esc(t('inspSum', s.r.n2y, s.r.bad2y))}${s.r.rooms > 1 ? ` · ${s.r.rooms} ${state.lang === 'fr' ? 'locaux' : 'rooms'}` : ''}</p>
        <ul class="timeline">${s.r.list.map(i => `<li><span>${esc(dateText(i.d))} · ${esc(t(i.type))}</span><span class="badge ${i.ok ? 'ok' : 'bad'}">${i.ok ? ic('check', 'sm') + esc(t('inspOk')) : ic('alert', 'sm') + esc(t('inspBad'))}</span></li>`).join('')}</ul>`;
      if (s.r.issues.length) html += `<details class="more"><summary>${esc(t('inspIssues'))} (${s.r.issues.length})</summary><ul class="issues">${s.r.issues.map(i => `<li>${esc(i.t)} <span class="muted">· ${esc(dateText(i.d))}</span> ${i.c ? `<span class="crit">${esc(t('critical'))}</span>` : ''}</li>`).join('')}</ul></details>`;
    }
    html += `<p class="note">${esc(t('source'))}: ${esc(t('ophSource'))}, ${esc(dateText(INSPECTIONS_META.feed))}.</p></div>
      <div class="box"><h3>${ic('file')}${esc(t('licReport'))}</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${ext(SOURCES.licensing.url, t('licReport'), 'btn primary small')}<button class="btn ghost small" id="copyName">${esc(t('copyName'))}</button></div></div>`;
    body.innerHTML = html;
    $('copyName').onclick = async () => toast((await copyText(p.name)) ? t('nameCopied') : p.name);
  } else if (ptab === 'reviews') {
    const q = encodeURIComponent(`${p.name} ${p.address} ${p.city} ON`);
    body.innerHTML = `<div class="box" id="gBox"><h3>${ic('star')}${esc(t('revLive'))}</h3><div id="gReviews">${CONFIG.GOOGLE_PLACES_KEY ? '…' : ''}</div>
        ${ext(`https://www.google.com/maps/search/?api=1&query=${q}`, t('revGoogle'), 'btn primary small')}<p class="note">${esc(t('revNote'))}</p></div>
      <details class="box more"><summary>${esc(t('tipsPreview'))}</summary><div class="example" style="margin-top:8px">${state.lang === 'fr' ? 'Exemples écrits par notre équipe, pas de vrais avis.' : 'Examples written by our team, not real reviews.'}</div><ul class="qlist">${EXAMPLE_TIPS.map(x => `<li>${esc(tr(x))}</li>`).join('')}</ul></details>`;
    if (CONFIG.GOOGLE_PLACES_KEY) loadGoogle(p).then(html => { const el = $('gReviews'); if (el && activeId === p.id) el.innerHTML = html; });
  } else {
    const ages = p.kind === 'centre' ? AGES.filter(a => p.spaces[a.key] > 0) : AGES;
    const top = TOP10.slice(0, 5).map(k => tr(CHECKLIST.find(g => k.startsWith(g.id)).items[+k.replace(/\D/g, '')]));
    body.innerHTML = `<div class="box"><h3>${ic('question')}${esc(t('askTop'))}</h3><ol class="qlist">${top.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        <button class="btn primary small" id="toChecklist" style="margin-top:6px">${esc(t('startChecklist'))}${ic('arrow', 'sm')}</button></div>
      <div class="box"><h3>${ic('school')}${esc(t('ratios'))}</h3><ul class="qlist">${ages.map(a => `<li><b>${esc(tr(a.long))}</b>: ${esc(tr(a.ratio))}</li>`).join('')}</ul><p class="note">${esc(t('source'))}: ${ext(SOURCES.ratios.url, 'Ontario', 'link')}</p></div>`;
    $('toChecklist').onclick = () => { if (!state.shortlist.includes(p.id)) toggleShortlist(p.id, true); state.clFor = p.id; save(); go('visit'); };
  }
}
$('panel').addEventListener('click', e => {
  if (e.target.closest('#pClose')) { closePanel(); return; }
  if (e.target.closest('#copyLink')) { copyText(location.origin + location.pathname + '#p/' + activeId).then(ok => toast(ok ? t('linkCopied') : location.href)); return; }
  const tb = e.target.closest('[data-ptab]'); if (tb) { ptab = tb.dataset.ptab; openPanel(activeId); return; }
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
  else { if (state.shortlist.length >= MAX_PICKS) { toast(t('toastFull')); return; } state.shortlist.push(id); if (!quiet) toast(t('toastSaved', state.shortlist.length)); }
  save(); renderStepper();
  if (current === 'find') { renderList(); nextBar('nextFind', null, 'shortlist', `${t('step2')} (${state.shortlist.length})`); }
  if (current === 'shortlist') renderShortlist();
}
function score(id) { const a = Object.values(state.answers[id] || {}); return { g: a.filter(x => x === 'good').length, u: a.filter(x => x === 'unsure').length, c: a.filter(x => x === 'concern').length }; }
const sharedIds = (params.get('list') || '').split(',').filter(id => BY_ID[id]).slice(0, MAX_PICKS);
let sharedOpen = sharedIds.length > 0;
function renderShortlist() {
  const n = state.shortlist.length;
  $('slMode').innerHTML = [['list', t('list')], ['compare', t('compare')]].map(([k, l]) => `<button data-m="${k}" class="${state.slMode === k ? 'on' : ''}">${esc(l)}</button>`).join('');
  $('sharedBanner').innerHTML = sharedOpen ? `<div class="shared"><span>${ic('link', 'sm')} ${esc(t('sharedBanner', sharedIds.length))} ${sharedIds.map(id => esc(BY_ID[id].name)).join(' · ')}</span><span style="display:flex;gap:8px"><button class="btn primary small" id="addShared">${esc(t('addShared'))}</button><button class="btn ghost small" id="dismissShared">${esc(t('dismiss'))}</button></span></div>` : '';
  $('slProgress').innerHTML = `<div class="slot-row" aria-hidden="true">${Array.from({ length: MAX_PICKS }, (_, i) => `<span class="slot${i < n ? ' full' : ''}${i === MIN_PICKS - 1 ? ' min' : ''}"></span>`).join('')}</div><b>${n} / 9</b><span class="muted">${esc(n === 0 ? '' : n < MIN_PICKS ? t('slNeed', MIN_PICKS - n) : t('slGood', MAX_PICKS - n))}</span>`;
  if (!n) { $('slBody').innerHTML = `<div class="empty glass">${esc(t('slEmpty'))}<br><br><button class="btn primary" data-view="find">${esc(t('goFind'))}${ic('arrow', 'sm')}</button></div>`; $('slActions').innerHTML = ''; nextBar('nextShortlist', 'find', null); return; }
  if (state.slMode === 'compare') renderCompare();
  else $('slBody').innerHTML = `<div class="sl" id="slList">${state.shortlist.map((id, i) => {
    const p = BY_ID[id], s = score(id), open = !!state.notes[id];
    return `<article class="si glass" draggable="true" data-id="${id}">
      <div class="rank" aria-label="Rank ${i + 1}">${i + 1}</div>
      <div><h3>${esc(p.name)}</h3><div class="meta">${esc(p.address)}${distText(p) ? ' · ' + esc(distText(p)) : ''}</div>
        <div class="si-row">${inspBadge(p, true)}<label class="check"><input type="checkbox" data-visited="${id}" ${state.visited[id] ? 'checked' : ''}> ${esc(t('visited'))}</label>
          ${s.g + s.u + s.c ? `<span class="muted" style="font-size:13.5px">${esc(t('score', s.g, s.u, s.c))}</span>` : ''}
          <button class="link" data-open="${id}">${esc(t('details'))}</button><button class="link" data-cl="${id}">${esc(t('step3'))}</button></div>
        <textarea data-note="${id}" rows="${open ? 2 : 1}" placeholder="${esc(t('notes'))}…">${esc(state.notes[id] || '')}</textarea></div>
      <div class="mini"><button data-move="-1" aria-label="${esc(t('up'))}">${ic('up', 'sm')}</button><button data-move="1" aria-label="${esc(t('down'))}">${ic('down', 'sm')}</button><button data-remove="${id}" aria-label="${esc(t('remove'))}">${ic('x', 'sm')}</button></div>
    </article>`;
  }).join('')}</div>`;
  $('slActions').innerHTML = `<button class="btn primary" id="shareBtn">${ic('link', 'sm')}${esc(t('share'))}</button><button class="btn ghost" id="copyReg">${ic('clipboard', 'sm')}${esc(t('copyReg'))}</button>${ext(SOURCES.registry.url, t('openReg'), 'btn ghost')}<button class="btn ghost" id="printBtn">${ic('printer', 'sm')}${esc(t('print'))}</button>`;
  nextBar('nextShortlist', 'find', 'visit', t('step3'));
}
function renderCompare() {
  const ids = state.shortlist, ps = ids.map(id => BY_ID[id]);
  const dists = state.home ? ps.map(p => km(state.home, p)) : null, best = dists ? Math.min(...dists) : null;
  const row = (label, cells) => `<tr><th scope="row">${esc(label)}</th>${cells.join('')}</tr>`;
  $('slBody').innerHTML = `<div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>${ps.map((p, i) => `<th scope="col">${i + 1}. ${esc(p.name)}</th>`).join('')}</tr></thead><tbody>
    ${dists ? row(t('cmpDistance'), dists.map(d => `<td class="${d === best ? 'best' : ''}">${esc(kmText(d))}</td>`)) : ''}
    ${row(t('cmpAges'), ps.map(p => `<td>${p.kind === 'home' ? esc(t('agency')) : AGES.filter(a => p.spaces[a.key] > 0).map(a => esc(tr(a.label))).join(', ')}</td>`))}
    ${row(t('cmpCap'), ps.map(p => `<td>${p.kind === 'centre' ? fmt(p.capacity) : '–'}</td>`))}
    ${row(t('cmpFrench'), ps.map(p => `<td>${p.french ? ic('check', 'sm ok') : '–'}</td>`))}
    ${row(t('cmpInsp'), ps.map(p => `<td class="${insp(p).kind === 'ok' ? 'best' : ''}">${inspBadge(p) || '–'}</td>`))}
    ${row(t('cmpVisit'), ids.map(id => { const s = score(id); return `<td>${s.g + s.u + s.c ? esc(t('score', s.g, s.u, s.c)) : '–'}</td>`; }))}
    ${row(t('cmpVisited'), ids.map(id => `<td>${state.visited[id] ? ic('check', 'sm ok') : '–'}</td>`))}
    ${row(t('notes'), ids.map(id => `<td>${esc(state.notes[id] || '')}</td>`))}
  </tbody></table></div>`;
}
$('slMode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { state.slMode = b.dataset.m; save(); renderShortlist(); } });
$('view-shortlist').addEventListener('click', async e => {
  const id = (e.target.closest('.si') || {}).dataset?.id;
  if (e.target.closest('[data-remove]')) { toggleShortlist(e.target.closest('[data-remove]').dataset.remove); return; }
  const mv = e.target.closest('[data-move]');
  if (mv && id) { const i = state.shortlist.indexOf(id), j = i + +mv.dataset.move; if (j >= 0 && j < state.shortlist.length) { [state.shortlist[i], state.shortlist[j]] = [state.shortlist[j], state.shortlist[i]]; save(); renderShortlist(); } return; }
  const cl = e.target.closest('[data-cl]'); if (cl) { state.clFor = cl.dataset.cl; save(); go('visit'); return; }
  const op = e.target.closest('[data-open]'); if (op) { openPanel(op.dataset.open, 'overview'); return; }
  if (e.target.closest('#shareBtn')) { const url = `${location.origin}${location.pathname}?list=${state.shortlist.join(',')}&lang=${state.lang}#shortlist`; toast((await copyText(url)) ? t('shared') : url); return; }
  if (e.target.closest('#copyReg')) { const txt = state.shortlist.map((x, i) => `${i + 1}. ${BY_ID[x].name} (${BY_ID[x].address}, ${BY_ID[x].city})`).join('\n'); toast((await copyText(txt)) ? t('copied') : txt); return; }
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
function renderVisit() {
  if (state.clFor !== 'general' && !state.shortlist.includes(state.clFor)) state.clFor = 'general';
  $('clMode').innerHTML = [['top', t('top10')], ['all', t('allQ')]].map(([k, l]) => `<button data-mode="${k}" class="${state.clMode === k ? 'on' : ''}">${esc(l)}</button>`).join('');
  $('clFor').innerHTML = `<span class="flabel" style="align-self:center;margin-right:4px">${esc(t('vFor'))}</span>` + [['general', t('general')], ...state.shortlist.map(id => [id, BY_ID[id].name])].map(([v, l]) => `<button class="chip${state.clFor === v ? ' on' : ''}" data-for="${v}" style="white-space:nowrap">${esc(l)}</button>`).join('');
  const ans = state.answers[state.clFor] || {}, notes = state.qnotes[state.clFor] || {}, top = state.clMode === 'top';
  $('clGroups').innerHTML = CHECKLIST.map(g => {
    const shown = g.items.map((q, i) => [q, i]).filter(([, i]) => !top || TOP10.includes(g.id + i));
    if (!shown.length) return '';
    return `<details class="group glass" open><summary>${esc(tr(g.title))}<span class="gcount">${shown.filter(([, i]) => ans[g.id + i]).length} / ${shown.length}</span></summary>
      ${shown.map(([q, i]) => { const k = g.id + i; return `<div class="q" data-k="${k}"><span class="qt">${TOP10.includes(k) && !top ? ic('star', 'sm star') : ''}${esc(tr(q))}</span>
        <span class="ans">${['good', 'unsure', 'concern'].map(v => `<button type="button" data-v="${v}" class="${ans[k] === v ? 'on' : ''}" aria-pressed="${ans[k] === v}">${esc(t(v))}</button>`).join('')}</span>
        <input type="text" placeholder="${esc(t('note'))}…" value="${esc(notes[k] || '')}" aria-label="${esc(t('note'))}"></div>`; }).join('')}</details>`;
  }).join('');
  const s = score(state.clFor), tot = s.g + s.u + s.c || 1;
  $('clScore').innerHTML = `<h3>${esc(state.clFor === 'general' ? t('general') : BY_ID[state.clFor].name)}</h3><div class="scorebar"><i style="width:${s.g / tot * 100}%;background:var(--good)"></i><i style="width:${s.u / tot * 100}%;background:#e2b04a"></i><i style="width:${s.c / tot * 100}%;background:var(--bad)"></i></div><p class="muted" style="margin:0">${esc(t('score', s.g, s.u, s.c))}</p>
    ${state.clFor !== 'general' ? `<label class="check" style="margin-top:10px"><input type="checkbox" id="vVisited" ${state.visited[state.clFor] ? 'checked' : ''}> ${esc(t('visited'))}</label>` : ''}`;
  const p = BY_ID[state.clFor];
  const ages = p && p.kind === 'centre' ? AGES.filter(a => p.spaces[a.key] > 0) : AGES;
  $('clRatio').innerHTML = `<h3>${esc(t('ratios'))}</h3><ul class="ticks">${ages.map(a => `<li><b>${esc(tr(a.label))}</b>: ${esc(tr(a.ratio))}</li>`).join('')}</ul>`;
  $('lookFor').innerHTML = LOOK_FOR.map(x => `<li>${esc(tr(x))}</li>`).join('');
  $('visitCal').innerHTML = p ? `<h3>${ic('calendar')}${esc(t('addVisit'))}</h3><input type="date" class="input" id="visitDate" aria-label="${esc(t('visitDate'))}" style="width:100%;margin-bottom:8px"><button class="btn ghost small" id="visitIcs">${esc(t('addVisit'))}</button>` : `<p class="note" style="margin:0">${esc(t('source'))}: ${ext(SOURCES.questions.url, 'Ontario', 'link')}</p>`;
  nextBar('nextVisit', 'shortlist', 'apply', t('step4'));
}
$('view-visit').addEventListener('click', e => {
  const f = e.target.closest('[data-for]'); if (f) { state.clFor = f.dataset.for; save(); renderVisit(); return; }
  const m = e.target.closest('[data-mode]'); if (m) { state.clMode = m.dataset.mode; save(); renderVisit(); return; }
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
$('view-visit').addEventListener('change', e => { if (e.target.id === 'vVisited') { state.visited[state.clFor] = e.target.checked; save(); renderStepper(); } });
$('view-visit').addEventListener('input', e => {
  if (e.target.tagName !== 'INPUT' || !e.target.closest('.q')) return;
  const k = e.target.closest('.q').dataset.k, n = state.qnotes[state.clFor] = state.qnotes[state.clFor] || {}; n[k] = e.target.value; save();
});

/* ---------- 8. Step 4: Apply (plan + cost) ---------- */
const monthly = (perDay, days) => Math.round(perDay * days * 52 / 12);
function renderApply() {
  const list = state.shortlist.map((id, i) => `${i + 1}. ${BY_ID[id].name}`).join('\n');
  const tasks = [
    { n: 1, h: t('task1'), d: t('task1d'), act: ext(SOURCES.registry.url, t('openReg'), 'btn primary small') },
    { n: 2, h: t('task2'), d: t('task2d'), act: state.shortlist.length ? `<button class="btn ghost small" id="copyReg2">${ic('clipboard', 'sm')}${esc(t('copyReg'))}</button>` : `<button class="btn ghost small" data-view="find">${esc(t('goFind'))}</button>`, extra: list ? `<pre>${esc(list)}</pre>` : '' },
    { n: 3, h: t('task3'), d: t('task3d'), act: `<button class="btn ghost small" id="icsBtn">${ic('bell', 'sm')}${esc(t('reminders'))}</button>` },
    { n: 4, h: t('task4'), d: t('task4d'), act: ext(SOURCES.subsidy.url, t('calc')) },
    { n: 5, h: t('task5'), d: t('task5d'), act: ext(SOURCES.earlyon.url, t('findEarlyon')) },
  ];
  const done = tasks.filter(x => state.tasks[x.n]).length;
  $('tasks').innerHTML = tasks.map(x => `<li class="task glass${state.tasks[x.n] ? ' is-done' : ''}"><span class="tn">${state.tasks[x.n] ? ic('check') : x.n}</span><div><h3>${esc(x.h)}</h3><p>${esc(x.d)}</p>${x.extra || ''}
    <div class="row">${x.act}<button class="btn small ${state.tasks[x.n] ? 'done' : 'ghost'}" data-task="${x.n}" aria-pressed="${!!state.tasks[x.n]}">${state.tasks[x.n] ? ic('check', 'sm') + esc(t('done')) : esc(t('markDone'))}</button></div></div></li>`).join('');
  const C = 2 * Math.PI * 26, frac = done / tasks.length;
  $('planRing').innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(15,107,107,.15)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="var(--good)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 32 32)"/></svg><span>${esc(t('planProgress', done, tasks.length))}</span>`;
  renderEstimator(); renderTimeline();
}
function renderTimeline() {
  if (!state.birth) { $('timeline').innerHTML = `<h3>${ic('calendar')}${esc(t('tlTitle'))}</h3><p class="muted">${esc(t('tlEmpty'))}</p><button class="btn ghost small" data-view="home">${esc(t('tlEdit'))}</button>`; return; }
  const today = ymd(new Date()), by = +state.birth.slice(0, 4);
  const ev = [{ d: today, txt: t('tlRegister'), key: 'today' }];
  if (state.birth > today) ev.push({ d: state.birth, txt: t('tlBorn') });
  ev.push({ d: addMonths(state.birth, 18), txt: t('tl18') }, { d: addMonths(state.birth, 30), txt: t('tl30') }, { d: `${by + 4}-09-01`, txt: t('tlJK') });
  if (state.need) ev.push({ d: state.need, txt: `${t('tlNeed')}: ${tr(AGE[ageGroupAt(state.birth, state.need)].label)}`, key: 'need' });
  const list = ev.filter(e => e.d >= today).sort((a, b) => a.d.localeCompare(b.d));
  $('timeline').innerHTML = `<h3>${ic('calendar')}${esc(t('tlTitle'))}</h3><ol class="tl">${list.map(e => `<li class="${e.key || ''}"><b>${esc(e.key === 'today' ? t('tlToday') : dateText(e.d))}</b><span>${esc(e.txt)}</span></li>`).join('')}</ol>
    <button class="link" data-view="home">${esc(t('tlEdit'))}</button>`;
}
function printPlan() {
  const fr = state.lang === 'fr', si = startInfo();
  $('planPrint').innerHTML = `<h1>${esc(t('planTitle'))}</h1><p class="muted">${esc(t('planMade', dateText(ymd(new Date()))))}</p>
    ${si ? `<p><b>${esc(t('ageAtStart', tr(AGE[si.group].label).toLowerCase(), dateText(si.when)))}</b></p>` : ''}
    <h2>${esc(t('planChoices'))}</h2>${state.shortlist.length ? `<ol>${state.shortlist.map(id => { const p = BY_ID[id], sc = score(id), r = INSPECTIONS[id];
      return `<li><b>${esc(p.name)}</b>, ${esc(p.address)}, ${esc(p.city)} ${esc(p.postal)}${state.home ? ' · ' + esc(kmText(km(state.home, p))) : ''}<br>
        ${r ? `${esc(t('inspLast'))}: ${esc(dateText(r.last))} (${esc(r.ok ? t('inspOk') : t('inspBad'))}) · ` : ''}${sc.g + sc.u + sc.c ? esc(t('score', sc.g, sc.u, sc.c)) + ' · ' : ''}${state.visited[id] ? esc(t('visited')) : ''}
        ${state.notes[id] ? `<br><i>${esc(state.notes[id])}</i>` : ''}</li>`; }).join('')}</ol>` : `<p>${esc(t('planNone'))}</p>`}
    <h2>${esc(t('planNext'))}</h2><ol>${[1, 2, 3, 4, 5].map(n => `<li>${state.tasks[n] ? '[x] ' : '[ ] '}${esc(t('task' + n))}: ${esc(t('task' + n + 'd'))}</li>`).join('')}</ol>
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
    <span class="flabel">${esc(t('estDays'))}</span><div class="seg" data-est="estDays" style="margin:6px 0 12px">${[1, 2, 3, 4, 5].map(n => `<button data-v="${n}" class="${d === n ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${school ? `<div class="est-out">${esc(t('estSchool'))}</div>` : `<div class="est-out">${esc(t('estOut', fmt(monthly(COSTS.cap, d))))}</div><p class="muted">${esc(t('estAvg', fmt(monthly(COSTS.average, d))))}</p>`}
    <p class="note">${esc(t('estNote'))} ${esc(tr(COSTS.checked))} · ${ext(SOURCES.cap.url, t('source'), 'link')}</p>`;
}
$('view-apply').addEventListener('click', async e => {
  const tk = e.target.closest('[data-task]'); if (tk) { const n = tk.dataset.task; state.tasks[n] = !state.tasks[n]; save(); renderApply(); renderStepper(); return; }
  const ch = e.target.closest('[data-est] [data-v]');
  if (ch) { const k = ch.closest('[data-est]').dataset.est; state[k] = k === 'estDays' ? +ch.dataset.v : ch.dataset.v; save(); renderEstimator(); return; }
  if (e.target.closest('#copyReg2')) { const txt = state.shortlist.map((x, i) => `${i + 1}. ${BY_ID[x].name} (${BY_ID[x].address}, ${BY_ID[x].city})`).join('\n'); toast((await copyText(txt)) ? t('copied') : txt); return; }
  if (e.target.closest('#icsBtn')) {
    const d = new Date(); d.setDate(d.getDate() + 55);
    downloadIcs('child-care-registry-reminders.ics', [{ date: d, rrule: 'RRULE:FREQ=DAILY;INTERVAL=55;COUNT=12', title: state.lang === 'fr' ? 'Se connecter au registre des services de garde' : 'Log in to the City child care registry', desc: `${t('task3d')} ${SOURCES.registry.url}` }]);
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
  $('faqList').innerHTML = faqs.map(f => `<details class="fq glass"><summary>${esc(tr(f.q))}</summary><p>${esc(tr(f.a))}${f.src ? ` ${ext(SOURCES[f.src].url, t('source'), 'link')}` : ''}</p></details>`).join('') || `<p class="muted">–</p>`;
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
      <li>${ext(SOURCES.data.url, SOURCES.data.label, 'link')}: ${fmt(CENTRES.length)} ${fr ? 'centres et' : 'centres and'} ${PROVIDERS.length - CENTRES.length} ${fr ? 'agences' : 'agencies'}. ${fr ? 'Téléchargé le' : 'Downloaded'} ${esc(DATA_META.downloaded)}.</li>
      <li>${esc(INSPECTIONS_META.source)} (${esc(INSPECTIONS_META.feed)}): ${fmt(INSPECTIONS_META.matched)} ${fr ? 'programmes jumelés par adresse et nom; les cas incertains sont exclus.' : 'programs matched by address and name; unsure matches are left out.'}</li>
      <li>${fr ? 'Emplacements : OpenStreetMap' : 'Locations: OpenStreetMap'}; ${PROVIDERS.filter(p => p.approx).length} ${fr ? 'sont approximatifs.' : 'are approximate.'}</li>
      <li>${fr ? 'Questions et ratios : gouvernement de l’Ontario. Frais : plafond de l’Ontario' : 'Questions and ratios: Government of Ontario. Fees: Ontario’s cap'} (${ext(SOURCES.cap.url, 'CP 2026', 'link')}).</li></ul></div>
    <div class="glass card-pad"><h3>${esc(t('limits'))}</h3><ul>
      <li>${fr ? 'Aucune place libre, liste d’attente ni tarif par centre : ces données ne sont pas publiées.' : 'No open spots, waitlists or prices per centre: these are not published.'}</li>
      <li>${fr ? 'Les inspections portent sur l’hygiène, pas sur la qualité.' : 'Inspections cover hygiene, not quality.'}</li>
      <li>${fr ? 'La date des données de la Ville est à confirmer; une mise à jour est en préparation.' : 'The date of the City data is being confirmed; the City is preparing an update.'}</li></ul></div>
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
    <div class="oim glass card-pad">
      <div><b>${fr ? 'Observation' : 'Observation'}</b>${fr ? `${noInfant.length} zones postales ont des centres mais aucune place pour poupons, et les poupons n’ont que ${(totalInfant / total * 100).toFixed(1)} % des places.` : `${noInfant.length} postal areas have centres but no infant spaces, and babies have only ${(totalInfant / total * 100).toFixed(1)}% of all spaces.`}</div>
      <div><b>${fr ? 'Interprétation' : 'Interpretation'}</b>${fr ? 'Les familles de poupons de ces zones doivent probablement chercher plus loin. Il faudrait comparer avec le nombre de jeunes enfants par zone (recensement) avant de conclure.' : 'Families with babies in these areas probably have to search further away. This should be compared with the number of young children per area (census) before drawing conclusions.'}</div>
      <div><b>${fr ? 'Recommandation' : 'Recommendation'}</b>${fr ? 'Publier les places par âge avec la date des données, un identifiant commun avec les inspections, et l’adhésion au système à 10 $ et les tarifs.' : 'Publish spaces by age with the data date, one ID shared with inspections, and $10-a-day enrolment and base fees.'}</div>
    </div>
    <div class="glass card-pad dl"><div><h2>${ic('download')}${esc(t('dlTitle'))}</h2><p class="muted">${esc(t('dlLead'))}</p></div><button class="btn primary" id="dlCsv">${ic('download', 'sm')}${esc(t('dlBtn'))}</button></div>
    <p class="trust">${fr ? 'Sources : Données ouvertes d’Ottawa (services de garde agréés) et Santé publique Ottawa (inspections, flux du 21 octobre 2026). Places agréées ≠ places libres.' : 'Sources: City of Ottawa Open Data (licensed child care) and Ottawa Public Health (inspections, Oct 21, 2026 feed). Licensed spaces are not open spots.'}</p>`;
}

function matchedCsv() {
  const head = ['id', 'name', 'operator', 'address', 'city', 'postal', 'postal_area', 'latitude', 'longitude', 'location_approximate', 'infant', 'toddler', 'preschool', 'kindergarten', 'school_age', 'licensed_capacity', 'french_service', 'indigenous_programming', 'oph_last_inspection', 'oph_last_result', 'oph_inspections_2y', 'oph_not_in_compliance_2y'];
  const q = v => { const x = String(v ?? ''); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  const rows = PROVIDERS.map(p => { const r = INSPECTIONS[p.id] || {};
    return [p.id, p.name, p.operator, p.address, p.city, p.postal, (p.postal || '').slice(0, 3), p.lat, p.lon, p.approx ? 'yes' : 'no', ...['infant', 'toddler', 'preschool', 'kindergarten', 'schoolAge'].map(k => p.spaces ? p.spaces[k] : ''), p.capacity ?? '', p.french ? 'yes' : 'no', p.indigenous ? 'yes' : 'no', r.last || '', r.last ? (r.ok ? 'in compliance' : 'not in compliance') : '', r.n2y ?? '', r.bad2y ?? ''].map(q).join(','); });
  return [head.join(','), ...rows].join('\r\n');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#dlCsv')) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + matchedCsv()], { type: 'text/csv;charset=utf-8' })); a.download = 'kinderguide-ottawa-licensed-child-care-matched.csv';
  document.body.appendChild(a); a.click(); a.remove();
});

/* ---------- 11. Kip helper and tour ---------- */
function showKip() {
  const k = { home: 'kipHome', find: 'kipFind', shortlist: 'kipShortlist', visit: 'kipVisit', apply: 'kipApply', services: 'kipServices', about: 'kipHome', insights: 'kipHome' }[current];
  $('kipBubble').innerHTML = `<b>${ic('help', 'sm')}${esc(t('help'))}</b>${esc(t(k))}<div style="margin-top:10px;display:flex;gap:8px"><button class="btn ghost small" data-view="services">${esc(t('faqTitle'))}</button><button class="btn ghost small" id="kipTour">${esc(t('footerTour'))}</button></div>`;
  $('kipBubble').hidden = false; $('kipFab').setAttribute('aria-expanded', 'true');
}
function hideKip() { $('kipBubble').hidden = true; $('kipFab').setAttribute('aria-expanded', 'false'); }
$('kipFab').addEventListener('click', () => $('kipBubble').hidden ? showKip() : hideKip());
$('helpTop').addEventListener('click', () => $('kipBubble').hidden ? showKip() : hideKip());
document.addEventListener('click', e => {
  if (e.target.closest('[data-kip]')) { showKip(); return; }
  if (e.target.closest('#kipTour')) { hideKip(); showTour(0); return; }
  if (!e.target.closest('#kipBubble, #kipFab, #helpTop')) hideKip();
});
let tourStep = 0;
function showTour(i) {
  tourStep = i; const s = TOUR[i];
  if (s.view) go(s.view);
  $('tourTitle').textContent = tr(s.title); $('tourText').textContent = tr(s.text);
  $('tourDots').innerHTML = TOUR.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('');
  $('tourNext').textContent = i === TOUR.length - 1 ? t('tourGo') : t('tourNext'); $('tourSkip').textContent = t('tourSkip');
  $('tour').hidden = false; $('tourNext').focus();
}
function endTour() { $('tour').hidden = true; state.tourDone = true; save(); go('home'); }
$('tourNext').addEventListener('click', () => tourStep < TOUR.length - 1 ? showTour(tourStep + 1) : endTour());
$('tourSkip').addEventListener('click', endTour);
$('tourAgain').addEventListener('click', () => showTour(0));

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
if (!state.tourDone && !sharedIds.length && !deepId && !params.has('notour')) setTimeout(() => showTour(0), 600);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
