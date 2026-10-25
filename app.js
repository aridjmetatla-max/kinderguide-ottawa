/* ==================================================================
   KinderGuide Ottawa: Prototype 1
   1. Helpers and saved state       6. Shortlist
   2. Navigation                    7. Visit checklist
   3. Home (finder + fact)          8. Guide, numbers, about
   4. Find care (filters, list, map) 9. Tour (tutorial)
   5. Centre details drawer         10. Start-up
   ================================================================== */

/* ---------- 1. Helpers and saved state ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = n => n.toLocaleString('en-CA');
const BY_ID = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));
const CENTRES = PROVIDERS.filter(p => p.kind === 'centre');
const AGE = Object.fromEntries(AGES.map(a => [a.key, a]));
const MAX_PICKS = 9, MIN_PICKS = 5;

function km(a, b) {
  const r = x => x * Math.PI / 180, R = 6371;
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ }
    ta.remove(); return ok;
  }
}

// Everything the parent does is saved on this device only (localStorage)
const KEY = 'kinderguide.v1';
const state = Object.assign({
  age: 'any', center: null, radius: 5, french: false, indigenous: false, home: true, query: '',
  shortlist: [], notes: {}, visited: {}, answers: {}, qnotes: {}, tourDone: false, clFor: 'general',
  registered: false, clMode: 'top', estAge: 'toddler', estDays: 5, estEnrolled: 'unknown',
}, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: still works, just not saved */ }
}

/* ---------- 2. Navigation ---------- */
let current = 'home';
function go(tab, { scroll = true } = {}) {
  if (!$('view-' + tab)) tab = 'home';
  current = tab;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + tab));
  document.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === tab && b.closest('nav')));
  if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
  if (scroll) window.scrollTo({ top: 0 });
  if (tab === 'find') { renderFind(); setTimeout(() => map && map.invalidateSize(), 60); }
  if (tab === 'shortlist') renderShortlist();
  if (tab === 'checklist') renderChecklist();
  if (tab === 'costs') renderCosts();
  if (tab === 'tools') renderTools();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) { e.preventDefault(); closeDrawer(); go(b.dataset.go); }
});

/* ---------- 3. Home ---------- */
function renderAgeChips() {
  const opts = [...AGES.map(a => [a.key, a.label]), ['any', 'Not sure / any age']];
  $('ageChips').innerHTML = opts.map(([k, l]) => `<button type="button" class="chip${state.age === k ? ' on' : ''}" data-age="${k}">${esc(l)}</button>`).join('');
}
$('ageChips').addEventListener('click', e => {
  const b = e.target.closest('[data-age]'); if (!b) return;
  state.age = b.dataset.age; save(); renderAgeChips(); renderHomeFact();
});
function renderAreaChips() {
  $('areaChips').innerHTML = AREAS.map((a, i) => `<button type="button" class="chip${state.center && state.center.label === a.name ? ' on' : ''}" data-area="${i}">${esc(a.name)}</button>`).join('');
}
$('areaChips').addEventListener('click', e => {
  const b = e.target.closest('[data-area]'); if (!b) return;
  const a = AREAS[+b.dataset.area];
  setCenter({ lat: a.lat, lon: a.lon, label: a.name, approx: true });
});
function setCenter(c) {
  state.center = c; save(); renderAreaChips(); renderHomeFact();
  $('nearStatus').textContent = c ? `Showing options near ${c.label}.` : '';
}
async function lookupPostal(code) {
  const clean = code.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(clean)) { $('nearStatus').textContent = 'Please enter a full postal code, like K2K 2W9.'; return false; }
  $('nearStatus').textContent = 'Finding that postal code…';
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&country=Canada&postalcode=' + encodeURIComponent(clean.slice(0, 3) + ' ' + clean.slice(3));
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const hit = (await res.json())[0];
    if (!hit) throw new Error('not found');
    setCenter({ lat: +hit.lat, lon: +hit.lon, label: clean.slice(0, 3) + ' ' + clean.slice(3) });
    return true;
  } catch (e) {
    $('nearStatus').textContent = 'We couldn’t find that postal code. Try choosing an area below instead.';
    return false;
  }
}
$('locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { $('nearStatus').textContent = 'Your browser can’t share your location. Choose an area below.'; return; }
  $('nearStatus').textContent = 'Asking your browser for your location…';
  navigator.geolocation.getCurrentPosition(
    pos => setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'your location' }),
    () => { $('nearStatus').textContent = 'Location not shared. You can type a postal code or choose an area instead.'; },
    { timeout: 10000 });
});
function renderHomeFact() {
  const a = AGE[state.age];
  const total = CENTRES.reduce((s, p) => s + p.capacity, 0);
  const sums = AGES.map(x => ({ ...x, n: CENTRES.reduce((s, p) => s + p.spaces[x.key], 0) }));
  const max = Math.max(...sums.map(s => s.n));
  let big, what;
  if (a) {
    const n = CENTRES.filter(p => p.spaces[a.key] > 0).length;
    big = `${n} of ${CENTRES.length}`;
    what = `licensed centres in Ottawa have spaces for ${a.who}.`;
  } else {
    big = fmt(total);
    what = `licensed child care spaces in ${CENTRES.length} centres across Ottawa. Choose an age to see your options.`;
  }
  $('homeFact').innerHTML = `
    <div class="big">${big}</div>
    <p class="what">${esc(what)}</p>
    <div class="bars" aria-label="Licensed spaces by age group">
      ${sums.map(s => `<div class="bar-row${a && s.key === a.key ? ' hi' : ''}"><span>${esc(s.label)}</span><span class="track"><span class="fill" style="width:${Math.max(2, s.n / max * 100)}%"></span></span><span class="n">${fmt(s.n)}</span></div>`).join('')}
    </div>
    <p class="note">Licensed spaces by age group, all centres. Licensed spaces are not open spots. Source: City of Ottawa Open Data.</p>`;
}
$('finder').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('postalInput').value.trim();
  if (code && !(state.center && state.center.label.replace(' ', '') === code.toUpperCase().replace(/\s+/g, ''))) {
    if (!(await lookupPostal(code))) return;
  }
  state.french = $('mFrench').checked; state.indigenous = $('mIndigenous').checked; state.home = $('mHome').checked;
  save(); go('find');
});

/* ---------- 4. Find care ---------- */
let map, markerLayer, centerMarker, radiusCircle;
const markers = {};
function initFindControls() {
  $('fAge').innerHTML = `<option value="any">Any age</option>` + AGES.map(a => `<option value="${a.key}">${esc(a.long)}</option>`).join('');
  $('fArea').innerHTML = `<option value="">All of Ottawa</option>` + AREAS.map((a, i) => `<option value="${i}">${esc(a.name)}</option>`).join('') + `<option value="custom" hidden>Custom</option>`;
  const sync = () => {
    state.age = $('fAge').value; state.radius = +$('fRadius').value; state.query = $('fQuery').value.trim();
    state.french = $('fFrench').checked; state.indigenous = $('fIndigenous').checked; state.home = $('fHome').checked;
    save(); renderFind(); renderAgeChips(); renderHomeFact();
  };
  ['fAge', 'fRadius', 'fFrench', 'fIndigenous', 'fHome'].forEach(id => $(id).addEventListener('change', sync));
  $('fQuery').addEventListener('input', sync);
  $('fArea').addEventListener('change', () => {
    const v = $('fArea').value;
    if (v === '') state.center = null;
    else if (v !== 'custom') { const a = AREAS[+v]; state.center = { lat: a.lat, lon: a.lon, label: a.name, approx: true }; }
    save(); renderAreaChips(); renderFind();
  });
}
function syncFindControls() {
  $('fAge').value = state.age; $('fRadius').value = String(state.radius); $('fQuery').value = state.query;
  $('fFrench').checked = state.french; $('fIndigenous').checked = state.indigenous; $('fHome').checked = state.home;
  const idx = state.center ? AREAS.findIndex(a => a.name === state.center.label) : -1;
  const custom = $('fArea').querySelector('[value=custom]');
  if (state.center && idx < 0) { custom.hidden = false; custom.textContent = 'Near ' + state.center.label; $('fArea').value = 'custom'; }
  else { custom.hidden = true; $('fArea').value = idx >= 0 ? String(idx) : ''; }
}
function matches(p) {
  if (p.kind === 'home' && !state.home) return false;
  if (state.french && !p.french) return false;
  if (state.indigenous && !p.indigenous) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    if (![p.name, p.address, p.operator, p.city].join(' ').toLowerCase().includes(q)) return false;
  }
  if (p.kind === 'centre' && state.age !== 'any' && !(p.spaces[state.age] > 0)) return false;
  if (state.center && state.radius > 0 && km(state.center, p) > state.radius) return false;
  return true;
}
function ageTags(p) {
  if (p.kind === 'home') return `<span class="tag homet">Home child care agency · ages vary</span>`;
  return AGES.filter(a => p.spaces[a.key] > 0).map(a => `<span class="tag${state.age === a.key ? ' match' : ''}">${esc(a.label)}</span>`).join('');
}
function extraTags(p) {
  return (p.french ? '<span class="tag fr">French service</span>' : '') + (p.indigenous ? '<span class="tag ind">Indigenous programming</span>' : '');
}
function distText(p) {
  if (!state.center) return '';
  const d = km(state.center, p);
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} km${p.approx ? ' (approx.)' : ''}`;
}
let activeId = null;
function renderFind() {
  syncFindControls();
  let list = PROVIDERS.filter(matches);
  if (state.center) list.sort((a, b) => km(state.center, a) - km(state.center, b));
  else list.sort((a, b) => a.name.localeCompare(b.name));
  const nCentres = list.filter(p => p.kind === 'centre').length, nHomes = list.length - nCentres;
  $('resultCount').textContent = `${nCentres} centre${nCentres === 1 ? '' : 's'}${nHomes ? ` · ${nHomes} home agenc${nHomes === 1 ? 'y' : 'ies'}` : ''}`;
  $('results').innerHTML = list.length ? list.map(p => {
    const saved = state.shortlist.includes(p.id);
    return `<article class="pcard${p.id === activeId ? ' active' : ''}" data-id="${p.id}">
      <h3>${esc(p.name)}</h3>
      <div class="where">${esc(p.address)}, ${esc(p.city)}${state.center ? ' · ' + distText(p) : ''}</div>
      <div class="tags">${ageTags(p)}${extraTags(p)}</div>
      <div class="row"><span>${p.kind === 'centre' ? 'Licensed for ' + fmt(p.capacity) + ' children' : 'Contact the agency for homes near you'}</span>
        <span class="btns"><button class="btn ghost small" data-open="${p.id}">Details</button>
        <button class="btn ${saved ? 'warm' : 'ghost'} small" data-save="${p.id}">${saved ? '✓ Saved' : '+ Shortlist'}</button></span></div>
    </article>`;
  }).join('') : `<div class="empty card">No programs match these choices. Try a bigger distance, another age, or fewer must-haves.</div>`;
  renderMap(list);
}
$('results').addEventListener('click', e => {
  const s = e.target.closest('[data-save]'); if (s) { toggleShortlist(s.dataset.save); return; }
  const o = e.target.closest('[data-open]') || e.target.closest('.pcard');
  if (o) openDrawer(o.dataset.open || o.dataset.id);
});
function markerStyle(p) {
  const saved = state.shortlist.includes(p.id);
  return { radius: p.id === activeId ? 10 : 7, weight: 2, color: '#fff', fillOpacity: .95,
    fillColor: saved ? getComputedStyle(document.documentElement).getPropertyValue('--warm').trim() : p.kind === 'home' ? '#7b5ea7' : '#0f6b6b' };
}
function initMap() {
  if (map || typeof L === 'undefined') return;
  map = L.map('map', { zoomControl: true }).setView([45.38, -75.72], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  PROVIDERS.forEach(p => {
    markers[p.id] = L.circleMarker([p.lat, p.lon], markerStyle(p))
      .bindTooltip(esc(p.name), { direction: 'top', offset: [0, -6] })
      .on('click', () => openDrawer(p.id));
  });
}
function renderMap(list) {
  initMap(); if (!map) return;
  markerLayer.clearLayers();
  list.forEach(p => { markers[p.id].setStyle(markerStyle(p)); markerLayer.addLayer(markers[p.id]); });
  if (centerMarker) { centerMarker.remove(); centerMarker = null; }
  if (radiusCircle) { radiusCircle.remove(); radiusCircle = null; }
  if (state.center) {
    centerMarker = L.marker([state.center.lat, state.center.lon], { title: state.center.label }).addTo(map).bindTooltip('Near ' + state.center.label);
    if (state.radius > 0) radiusCircle = L.circle([state.center.lat, state.center.lon], { radius: state.radius * 1000, color: '#0f6b6b', weight: 1, fillOpacity: .05 }).addTo(map);
  }
  const pts = list.map(p => [p.lat, p.lon]);
  if (radiusCircle) map.fitBounds(radiusCircle.getBounds(), { padding: [20, 20] });
  else if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
}

/* ---------- 5. Centre details drawer ---------- */
let rtab = 'safety';
function openDrawer(id) {
  const p = BY_ID[id]; if (!p) return;
  activeId = id;
  const saved = state.shortlist.includes(id);
  const q = encodeURIComponent(`${p.name} ${p.address} ${p.city} ON`);
  const spaces = p.kind === 'centre' ? (() => {
    const max = Math.max(...AGES.map(a => p.spaces[a.key]), 1);
    return `<section class="d-sec card"><h3>Licensed spaces by age</h3><div class="bars">
      ${AGES.map(a => `<div class="bar-row${p.spaces[a.key] > 0 && state.age === a.key ? ' hi' : ''}"><span>${esc(a.label)}</span><span class="track"><span class="fill" style="width:${p.spaces[a.key] ? Math.max(3, p.spaces[a.key] / max * 100) : 0}%"></span></span><span class="n">${p.spaces[a.key] || '—'}</span></div>`).join('')}
    </div><p class="d-note">Licensed for ${fmt(p.capacity)} children in total. This is the maximum the centre may care for, <strong>not the number of open spots</strong>. Waits in Ottawa are often around 2 years, so get on the City’s waitlist early and ask the centre about availability.</p></section>`;
  })() : `<section class="d-sec card"><h3>Licensed home child care agency</h3><p class="d-note" style="margin:0">Home child care takes place in a caregiver’s own home, overseen by this licensed agency. The City’s data does not list ages or spaces for agencies. Contact the agency to find homes near you and ask which ages they accept.</p></section>`;
  $('drawer').innerHTML = `
    <div class="d-head">
      <button class="d-close" id="dClose" aria-label="Close">✕</button>
      <h2 id="dTitle">${esc(p.name)}</h2>
      <div class="d-sub">${esc(p.address)}, ${esc(p.city)} ${esc(p.postal)}${state.center ? ' · ' + distText(p) + ' from ' + esc(state.center.label) : ''}</div>
      ${p.operator ? `<div class="d-sub">Operated by ${esc(p.operator)}</div>` : ''}
      <div class="tags">${ageTags(p)}${extraTags(p)}</div>
      <div class="d-actions">
        <button class="btn ${saved ? 'warm' : 'primary'}" data-save="${id}">${saved ? '✓ On my shortlist' : '+ Add to shortlist'}</button>
        <a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${q}">Directions ↗</a>
        <a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(p.name + ' Ottawa child care')}">Phone &amp; website ↗</a>
      </div>
      ${p.approx ? '<p class="d-note">Map location is approximate (based on the postal code or street).</p>' : ''}
    </div>
    <div class="d-body">
      ${spaces}
      ${costSection(p)}
      <section class="d-sec card">
        <h3>Reviews and reports</h3>
        <div class="rtabs" role="tablist">
          ${[['safety', 'Safety and inspections'], ['reviews', 'Parent reviews'], ['tips', 'Parent tips'], ['ask', 'Questions to ask']].map(([k, l]) => `<button role="tab" data-rtab="${k}" class="${rtab === k ? 'on' : ''}">${l}</button>`).join('')}
        </div>
        <div class="rpanel" id="rpanel"></div>
      </section>
    </div>`;
  renderRpanel(p);
  $('drawer').classList.add('open'); $('drawer').setAttribute('aria-hidden', 'false'); $('scrim').hidden = false;
  $('dClose').focus();
  if (current === 'find') { document.querySelectorAll('.pcard').forEach(c => c.classList.toggle('active', c.dataset.id === id)); renderMapStylesOnly(); }
}
function renderMapStylesOnly() { if (map) PROVIDERS.forEach(p => markers[p.id] && markers[p.id].setStyle(markerStyle(p))); }
function renderRpanel(p) {
  const panel = $('rpanel'); if (!panel) return;
  const q = encodeURIComponent(`${p.name} ${p.address} ${p.city} ON`);
  if (rtab === 'safety') {
    panel.innerHTML = `
      <p>The Government of Ontario licenses and inspects child care programs. Its public search shows each program’s licence and inspection information.</p>
      <div class="btns"><a class="btn primary small" target="_blank" rel="noopener" href="${SOURCES.licensing.url}">Open Ontario’s licensing search ↗</a>
      <button class="btn ghost small" id="copyName">Copy the name to search</button></div>
      <p class="d-note">Search for “${esc(p.name)}”. Look at the licence and any inspection findings, and how recent they are.</p>`;
    $('copyName').onclick = async () => toast((await copyText(p.name)) ? 'Name copied. Paste it in Ontario’s search.' : 'Could not copy. Type the name instead.');
  } else if (rtab === 'reviews') {
    panel.innerHTML = `
      <p>KinderGuide does not copy or rate reviews. Read them where parents posted them, so they are always current.</p>
      <div class="btns"><a class="btn primary small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${q}">Read Google reviews ↗</a>
      <a class="btn ghost small" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent('"' + p.name + '" Ottawa daycare reviews')}">Search other parents’ experiences ↗</a></div>
      <p class="d-note">Reviews are opinions. Check the dates, look for patterns rather than one comment, and confirm anything important on your visit.</p>`;
  } else if (rtab === 'tips') {
    panel.innerHTML = `
      <div class="example-banner">Preview of the parents’ space. These are <strong>example tips written by our team</strong>, not real reviews of this centre.</div>
      <div class="chips small" id="tipTopics">${['All', ...TIP_TOPICS].map((t, i) => `<button class="chip${i === 0 ? ' on' : ''}" data-topic="${t}">${t}</button>`).join('')}</div>
      <div id="tipList"></div>
      <p class="d-note">In a future version, parents could share tips by topic. They would be moderated, with no star ratings.</p>`;
    const show = topic => { $('tipList').innerHTML = EXAMPLE_TIPS.filter(t => topic === 'All' || t.topic === topic).map(t => `<div class="tip"><b>${esc(t.topic)} · example</b>${esc(t.text)}</div>`).join('') || '<p class="d-note">No example tips for this topic yet.</p>'; };
    show('All');
    $('tipTopics').onclick = e => { const b = e.target.closest('[data-topic]'); if (!b) return; $('tipTopics').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b)); show(b.dataset.topic); };
  } else {
    const ages = p.kind === 'centre' ? AGES.filter(a => p.spaces[a.key] > 0) : AGES;
    panel.innerHTML = `
      <p>Ontario sets how many staff must be with each group of children. For the ages here:</p>
      <ul class="ratio">${ages.map(a => `<li><strong>${esc(a.long)}:</strong> ${esc(a.ratio)}</li>`).join('')}</ul>
      <div class="btns"><button class="btn primary small" id="toChecklist">Open the visit checklist for this program</button></div>
      <p class="d-note">Source: ${esc(SOURCES.ratios.label)}.</p>`;
    $('toChecklist').onclick = () => { if (!state.shortlist.includes(p.id)) toggleShortlist(p.id, true); state.clFor = p.id; save(); closeDrawer(); go('checklist'); };
  }
}
$('drawer').addEventListener('click', e => {
  if (e.target.id === 'dClose') { closeDrawer(); return; }
  const t = e.target.closest('[data-rtab]');
  if (t) { rtab = t.dataset.rtab; $('drawer').querySelectorAll('[data-rtab]').forEach(b => b.classList.toggle('on', b === t)); renderRpanel(BY_ID[activeId]); return; }
  const s = e.target.closest('[data-save]');
  if (s) { toggleShortlist(s.dataset.save); openDrawer(s.dataset.save); }
});
function closeDrawer() {
  $('drawer').classList.remove('open'); $('drawer').setAttribute('aria-hidden', 'true'); $('scrim').hidden = true;
}
$('scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); } });

/* ---------- 6. Shortlist ---------- */
function toggleShortlist(id, quiet) {
  const i = state.shortlist.indexOf(id);
  if (i >= 0) { state.shortlist.splice(i, 1); if (!quiet) toast('Removed from your shortlist.'); }
  else {
    if (state.shortlist.length >= MAX_PICKS) { toast('You already have 9. The City’s registry accepts up to 9; remove one first.'); return; }
    state.shortlist.push(id);
    if (!quiet) toast(`Saved. ${state.shortlist.length} of ${MAX_PICKS} on your shortlist.`);
  }
  save(); updateCounts();
  if (current === 'find') renderFind();
  if (current === 'shortlist') renderShortlist();
}
function updateCounts() {
  [$('navCount'), $('navCount2')].forEach(c => { c.textContent = state.shortlist.length; c.classList.toggle('zero', !state.shortlist.length); });
}
function checklistTotal() { return CHECKLIST.reduce((s, g) => s + g.items.length, 0); }
function answeredCount(forId) { return Object.values(state.answers[forId] || {}).filter(Boolean).length; }
function renderShortlist() {
  const n = state.shortlist.length;
  const msg = n === 0 ? 'Start by saving programs from Find care.'
    : n < MIN_PICKS ? `${n} saved. Add ${MIN_PICKS - n} more to reach the minimum of ${MIN_PICKS}.`
    : `${n} saved. That’s enough for the registry${n < MAX_PICKS ? `, and you can add up to ${MAX_PICKS - n} more` : ''}.`;
  $('slProgress').innerHTML = `<div class="slots" aria-hidden="true">${Array.from({ length: MAX_PICKS }, (_, i) => `<span class="slot${i < n ? ' full' : ''}${i === MIN_PICKS - 1 ? ' min' : ''}"></span>`).join('')}</div><div>${esc(msg)}</div>`;
  $('slList').innerHTML = n ? state.shortlist.map((id, i) => {
    const p = BY_ID[id]; if (!p) return '';
    const done = answeredCount(id), total = checklistTotal();
    return `<article class="sitem card" data-id="${id}">
      <div class="rank">${i + 1}</div>
      <div>
        <h3>${esc(p.name)}</h3>
        <div class="meta">${esc(p.address)}, ${esc(p.city)}${state.center ? ' · ' + distText(p) : ''}</div>
        <div class="tags">${ageTags(p)}${extraTags(p)}</div>
        <label class="check"><input type="checkbox" data-visited="${id}" ${state.visited[id] ? 'checked' : ''}> Visited</label>
        <div class="cl-progress">Checklist: ${done} of ${total} answered <button class="link" data-cl="${id}">${done ? 'Continue' : 'Start'} checklist</button> · <button class="link" data-open="${id}">Details</button></div>
        <textarea data-note="${id}" placeholder="My notes (what I liked, questions, waitlist info…)">${esc(state.notes[id] || '')}</textarea>
      </div>
      <div class="side">
        <div class="mini"><button data-move="-1" aria-label="Move up">↑</button><button data-move="1" aria-label="Move down">↓</button></div>
        <button class="btn ghost small" data-remove="${id}">Remove</button>
      </div>
    </article>`;
  }).join('') : `<div class="empty card">Your shortlist is empty. <button class="link" data-go="find">Find care</button> and tap “+ Shortlist” on the programs you like.</div>`;
  $('slActions').hidden = !n;
  $('registryLink').href = SOURCES.registry.url;
}
$('slList').addEventListener('click', e => {
  const item = e.target.closest('.sitem'); const id = item && item.dataset.id;
  if (e.target.closest('[data-remove]')) { toggleShortlist(id); return; }
  const mv = e.target.closest('[data-move]');
  if (mv) {
    const i = state.shortlist.indexOf(id), j = i + +mv.dataset.move;
    if (j < 0 || j >= state.shortlist.length) return;
    [state.shortlist[i], state.shortlist[j]] = [state.shortlist[j], state.shortlist[i]]; save(); renderShortlist(); return;
  }
  const cl = e.target.closest('[data-cl]'); if (cl) { state.clFor = cl.dataset.cl; save(); go('checklist'); return; }
  const op = e.target.closest('[data-open]'); if (op) openDrawer(op.dataset.open);
});
$('slList').addEventListener('input', e => { const n = e.target.dataset.note; if (n) { state.notes[n] = e.target.value; save(); } });
$('slList').addEventListener('change', e => { const v = e.target.dataset.visited; if (v) { state.visited[v] = e.target.checked; save(); } });
$('copyList').addEventListener('click', async () => {
  const lines = state.shortlist.map((id, i) => { const p = BY_ID[id]; return `${i + 1}. ${p.name} (${p.address}, ${p.city})`; });
  const ok = await copyText(`My child care choices, ranked:\n${lines.join('\n')}`);
  toast(ok ? 'Copied! Paste it next to the City’s registry while you fill it in.' : 'Could not copy. Try Print instead.');
});
$('printList').addEventListener('click', () => window.print());

/* ---------- 7. Visit checklist ---------- */
function renderChecklist() {
  const opts = [['general', 'General checklist (not linked to a program)'], ...state.shortlist.map(id => [id, BY_ID[id].name])];
  if (!opts.some(o => o[0] === state.clFor)) state.clFor = 'general';
  $('clFor').innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  $('clFor').value = state.clFor;
  const p = BY_ID[state.clFor];
  const ages = p && p.kind === 'centre' ? AGES.filter(a => p.spaces[a.key] > 0) : AGES;
  $('clRatio').innerHTML = `<strong>Staff-to-child ratios set by Ontario${p ? ' for this program’s ages' : ''}:</strong><ul class="ratio">${ages.map(a => `<li>${esc(a.long)}: ${esc(a.ratio)}</li>`).join('')}</ul>`;
  const ans = state.answers[state.clFor] || {}, notes = state.qnotes[state.clFor] || {};
  const top = state.clMode === 'top';
  $('clMode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mode === state.clMode));
  $('clGroups').innerHTML = CHECKLIST.map(g => {
    const shown = g.items.map((q, i) => [q, i]).filter(([, i]) => !top || TOP10.includes(g.id + i));
    if (!shown.length) return '';
    const done = shown.filter(([, i]) => ans[g.id + i]).length;
    return `<details class="group card" open><summary>${esc(g.title)} <span class="gcount">${done} of ${shown.length}</span></summary>
      ${shown.map(([q, i]) => { const k = g.id + i; return `<div class="q" data-k="${k}"><span>${TOP10.includes(k) && !top ? '<span class="star" title="Top 10">★</span>' : ''}${esc(q)}</span>
        <span class="ans">${[['good', 'Good'], ['unsure', 'Unsure'], ['concern', 'Concern']].map(([v, l]) => `<button type="button" data-v="${v}" class="${ans[k] === v ? 'on' : ''}" aria-pressed="${ans[k] === v}">${l}</button>`).join('')}</span>
        <input type="text" placeholder="Their answer or my note" value="${esc(notes[k] || '')}" aria-label="Note"></div>`; }).join('')}
    </details>`;
  }).join('');
  $('lookFor').innerHTML = LOOK_FOR.map(x => `<li>${esc(x)}</li>`).join('');
  $('clSource').innerHTML = `Questions adapted from <a href="${SOURCES.questions.url}" target="_blank" rel="noopener">${esc(SOURCES.questions.label)}</a>. Ratios from <a href="${SOURCES.ratios.url}" target="_blank" rel="noopener">Ontario’s licensing manual</a>. Your answers are saved on this device only.`;
}
$('clFor').addEventListener('change', () => { state.clFor = $('clFor').value; save(); renderChecklist(); });
$('clMode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; state.clMode = b.dataset.mode; save(); renderChecklist(); });
$('clGroups').addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  const k = b.closest('.q').dataset.k, a = state.answers[state.clFor] = state.answers[state.clFor] || {};
  a[k] = a[k] === b.dataset.v ? '' : b.dataset.v; save();
  const open = [...document.querySelectorAll('#clGroups details')].map(d => d.open);
  renderChecklist();
  document.querySelectorAll('#clGroups details').forEach((d, i) => { d.open = open[i]; });
});
$('clGroups').addEventListener('input', e => {
  if (e.target.tagName !== 'INPUT') return;
  const k = e.target.closest('.q').dataset.k, n = state.qnotes[state.clFor] = state.qnotes[state.clFor] || {};
  n[k] = e.target.value; save();
});
$('clPrint').addEventListener('click', () => window.print());

/* ---------- 8. Guide, numbers, about ---------- */
function renderGuide() {
  $('guideSteps').innerHTML = GUIDE.map(s => `<li class="card"><div>
    <h3>${esc(s.title)}</h3>${s.body.map(b => `<p>${esc(b)}</p>`).join('')}
    <div class="btns">${(s.links || []).map(k => `<a class="btn ghost small" target="_blank" rel="noopener" href="${SOURCES[k].url}">${esc(SOURCES[k].label.split(': ')[1] || SOURCES[k].label)} ↗</a>`).join('')}
    ${s.action ? `<button class="btn primary small" data-go="${s.action.tab}">${esc(s.action.label)}</button>` : ''}</div></div></li>`).join('');
}
function renderNumbers() {
  const total = CENTRES.reduce((s, p) => s + p.capacity, 0);
  const sums = AGES.map(a => ({ ...a, n: CENTRES.reduce((s, p) => s + p.spaces[a.key], 0), c: CENTRES.filter(p => p.spaces[a.key] > 0).length }));
  const max = Math.max(...sums.map(s => s.n));
  const infant = sums[0];
  const byCity = {};
  CENTRES.forEach(p => { const c = byCity[p.city] = byCity[p.city] || { all: 0, inf: 0 }; c.all++; if (p.spaces.infant > 0) c.inf++; });
  const cities = Object.entries(byCity).sort((a, b) => b[1].all - a[1].all);
  const cmax = cities[0][1].all;
  const french = CENTRES.filter(p => p.french).length, ind = CENTRES.filter(p => p.indigenous).length;
  $('numbers').innerHTML = `
    <div class="ngrid">
      <div class="stat card"><div class="big">${CENTRES.length}</div><div class="small">licensed child care centres, plus ${PROVIDERS.length - CENTRES.length} licensed home child care agencies</div></div>
      <div class="stat card"><div class="big">${fmt(total)}</div><div class="small">licensed spaces in centres (how many children they are licensed for)</div></div>
      <div class="stat card"><div class="big">${(infant.n / total * 100).toFixed(1)}%</div><div class="small">of those spaces are for babies under 18 months (${fmt(infant.n)} spaces in ${infant.c} centres)</div></div>
    </div>
    <div class="npanel card"><h3>Licensed spaces by age group</h3>
      <div class="bars">${sums.map(s => `<div class="bar-row${s.key === 'infant' ? ' hi' : ''}"><span>${esc(s.long.split(' (')[0])}</span><span class="track"><span class="fill" style="width:${Math.max(1.5, s.n / max * 100)}%"></span></span><span class="n">${fmt(s.n)}</span></div>`).join('')}</div>
      <div class="oim">
        <div><b>What the data shows</b>Infant spaces are the smallest group: ${fmt(infant.n)} of ${fmt(total)} licensed spaces, in ${infant.c} of ${CENTRES.length} centres.</div>
        <div><b>What it could mean</b>Parents of babies have far fewer programs to choose from, so it helps to know early which ones are licensed for infants.</div>
        <div><b>What it does not tell us</b>How many spots are open, waitlist lengths, fees or quality. Licensed spaces are not vacancies.</div>
      </div></div>
    <div class="npanel card"><h3>Centres by community (as listed in the data)</h3>
      <div class="bars">${cities.map(([c, v]) => `<div class="bar-row"><span>${esc(c)}</span><span class="track"><span class="fill" style="width:${Math.max(1.5, v.all / cmax * 100)}%"></span></span><span class="n">${v.all} · ${v.inf} for babies</span></div>`).join('')}</div>
      <p class="d-note">“Ottawa” in the data covers most of the urban area, so it is not a neighbourhood. Use the map in Find care to see where programs are near you.</p></div>
    <div class="ngrid">
      <div class="stat card"><div class="big">${french}</div><div class="small">centres offer French service</div></div>
      <div class="stat card"><div class="big">${ind}</div><div class="small">centres offer Indigenous programming</div></div>
      <div class="stat card"><div class="big">5–9</div><div class="small">programs to rank on the City’s registry</div></div>
    </div>
    <p class="source">Source: <a href="${SOURCES.data.url}" target="_blank" rel="noopener">${esc(SOURCES.data.label)}</a>, downloaded ${esc(DATA_META.downloaded)}. Data date ${esc(DATA_META.dataDate)}.</p>`;
}
function renderAbout() {
  $('about').innerHTML = `
    <p>KinderGuide Ottawa helps parents who are starting their child care search understand which licensed programs fit their child, and what to check before choosing, so they can make their 5 to 9 registry choices with confidence.</p>
    <h3>What KinderGuide can and cannot do</h3>
    <ul><li>It shows licensed programs from the City of Ottawa’s open data, and links to official and public sources.</li>
    <li>It does <strong>not</strong> show open spots, fees or waitlist lengths, and it cannot get you a space or shorten a wait.</li>
    <li>It does not rate programs. Reviews and inspection information stay on the sites where they are published.</li></ul>
    <h3>The data</h3>
    <ul><li><a href="${SOURCES.data.url}" target="_blank" rel="noopener">${esc(SOURCES.data.label)}</a>: names, addresses, licensed spaces by age, French service and Indigenous programming. The City says it comes from the Ontario Ministry of Education and is updated once a year.</li>
    <li>Downloaded ${esc(DATA_META.downloaded)}. The date the data reflects is ${esc(DATA_META.dataDate)}.</li>
    <li>Map locations were found from the addresses with OpenStreetMap. ${PROVIDERS.filter(p => p.approx).length} are approximate (postal code or street only).</li>
    <li>Questions to ask: <a href="${SOURCES.questions.url}" target="_blank" rel="noopener">Government of Ontario</a>. Staff ratios: <a href="${SOURCES.ratios.url}" target="_blank" rel="noopener">Ontario licensing manual</a>.</li></ul>
    <h3>Your privacy</h3>
    <ul><li>There is no account, no cookies, no ads and no tracking or analytics.</li>
    <li>Your shortlist, notes and checklist answers are saved only in this browser, on this device. Clearing your browser’s data for this site erases them.</li>
    <li>“Use my location” stays in your browser: it is only used to sort programs by distance and is never sent anywhere.</li>
    <li>A postal code you type is sent to OpenStreetMap’s search service only to place it on the map.</li>
    <li>Like most websites, the page loads the map from OpenStreetMap, the map tool from cdnjs and the fonts from Google Fonts, so those services see a normal web request (such as your IP address).</li>
    <li>Where the licensee in the City’s data is a private person rather than an organisation, KinderGuide does not show their name.</li></ul>
    <h3>Not an official City service</h3>
    <p>KinderGuide is a University of Ottawa SED3111 student project. It is not affiliated with or endorsed by the City of Ottawa. Contains information licensed under the Open Government Licence – City of Ottawa.</p>`;
}

/* ---------- 8b. Costs, official tools, start banner ---------- */
const monthly = (perDay, days) => Math.round(perDay * days * 52 / 12);
function costSection(p) {
  const v = VERIFIED_PRICES[p.id];
  const under6 = p.kind === 'home' || ['infant', 'toddler', 'preschool', 'kindergarten'].some(k => p.spaces[k] > 0);
  let body;
  if (v) body = `<p class="cost-line"><strong>Confirmed price:</strong> ${esc(v.text)} <span class="muted">(${esc(v.how)}, ${esc(v.date)})</span></p>`;
  else if (under6) body = `<p class="cost-line">This program’s exact fee is <strong>not published</strong> in the City’s data, so KinderGuide does not guess it.</p>
    <p class="cost-line">The official rule: if this program is in the <strong>$10-a-day (Canada-wide) system</strong> and your child is <strong>under 6</strong>, the fee cannot be more than <strong>$${COSTS.cap} a day</strong> (about $${monthly(COSTS.cap, 5)} a month full time), until at least ${COSTS.until}. Programs that did not join set their own fee.</p>
    <p class="cost-line muted">Ask: “Are you in the Canada-wide system? What is your daily fee for my child’s age? Are there extra fees?”</p>`;
  else body = `<p class="cost-line">Fees for school-age care (6 and over) are set by each program and are not capped. This program’s fee is not published in the City’s data. Ask the program, and check whether you qualify for the City’s fee subsidy.</p>`;
  return `<section class="d-sec card"><h3>What it may cost</h3>${body}
    <div class="btns" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost small" data-go="costs">Estimate my cost</button>
    <a class="btn ghost small" target="_blank" rel="noopener" href="${SOURCES.subsidy.url}">Fee subsidy calculator ↗</a></div>
    <p class="d-note">Sources: Government of Ontario fee cap (Canadian Press, Sept 2026); City of Ottawa. Checked ${esc(COSTS.checked)}.</p></section>`;
}
function renderCosts() {
  const ageOpts = [['infant', 'Baby'], ['toddler', 'Toddler'], ['preschool', 'Preschool'], ['kindergarten', 'Kindergarten age'], ['school6', 'School age, 6 or older']];
  $('estAge').innerHTML = ageOpts.map(([k, l]) => `<button type="button" class="chip${state.estAge === k ? ' on' : ''}" data-v="${k}">${l}</button>`).join('');
  $('estDays').innerHTML = [1, 2, 3, 4, 5].map(d => `<button type="button" class="chip${state.estDays === d ? ' on' : ''}" data-v="${d}">${d} day${d > 1 ? 's' : ''}</button>`).join('');
  const enrolledOpts = [['yes', 'Yes'], ['unknown', 'I don’t know'], ['no', 'No']];
  $('estEnrolled').innerHTML = enrolledOpts.map(([k, l]) => `<button type="button" class="chip${state.estEnrolled === k ? ' on' : ''}" data-v="${k}">${l}</button>`).join('');
  $('estEnrolled').closest('fieldset').hidden = state.estAge === 'school6';
  const d = state.estDays, cap = monthly(COSTS.cap, d), avg = monthly(COSTS.average, d);
  let html;
  if (state.estAge === 'school6') {
    html = `<div class="big">Set by the program</div><div class="per">Children 6 and over are not covered by the $${COSTS.cap}-a-day cap.</div>
      <p>There is no published average fee for Ottawa, so KinderGuide does not guess one. ${esc(COSTS.schoolAgeExample)}</p>`;
  } else if (state.estEnrolled === 'no') {
    html = `<div class="big">Set by the program</div><div class="per">Programs that did not join the Canada-wide system are not capped.</div>
      <p>There is no published average fee for these programs in Ottawa, so KinderGuide does not guess one. Ask the program for its daily fee and any extra fees.</p>`;
  } else {
    html = `<div class="big">Up to $${fmt(cap)}<span style="font-size:20px"> / month</span></div>
      <div class="per">$${COSTS.cap} a day (Ontario’s maximum) × ${d} day${d > 1 ? 's' : ''} a week${state.estEnrolled === 'unknown' ? ', if the program is in the Canada-wide system' : ''}</div>
      <p>Ontario’s average in these programs is about $${COSTS.average} a day, so many families pay less: about <strong>$${fmt(avg)} a month</strong>. Fees are held at this level until at least ${COSTS.until}.</p>
      ${state.estEnrolled === 'unknown' ? `<p class="warn">Not sure if the program joined? Most did (${esc(COSTS.optedIn)}). Programs must say whether they are enrolled in their parent handbook. If a program is not enrolled, it sets its own fee, which can be much higher.</p>` : ''}`;
  }
  html += `<p style="margin-top:12px"><strong>Lower income?</strong> The City’s fee subsidy can lower your cost further. <a href="${SOURCES.subsidy.url}" target="_blank" rel="noopener">Use the City’s subsidy calculator ↗</a></p>
    <p class="d-note">An estimate based on official rules, not a quote. Months are counted as 52 weeks ÷ 12. Checked ${esc(COSTS.checked)}.</p>`;
  $('estOut').innerHTML = html;
  $('costFacts').innerHTML = `<h3 style="margin-top:0">The facts behind this estimate</h3><ul>
    <li><strong>“$10 a day” is the goal, not today’s price.</strong> In Ontario, fees in the Canada-wide system are capped at $${COSTS.cap} a day, with an average of about $${COSTS.average}. Ontario committed to keep them at this level until ${COSTS.until}. (<a href="${SOURCES.cap.url}" target="_blank" rel="noopener">The Canadian Press, Sept 29, 2026</a>)</li>
    <li><strong>Only children under 6</strong> in programs that joined the system get the reduced fee. You don’t apply for it: the program applies it. (<a href="${SOURCES.cwelcc.url}" target="_blank" rel="noopener">City of Ottawa</a>)</li>
    <li><strong>Most Ottawa programs joined:</strong> ${esc(COSTS.optedIn)}. (<a href="${SOURCES.cwelcc.url}" target="_blank" rel="noopener">City of Ottawa</a>)</li>
    <li><strong>The City’s open data does not include fees</strong>, and the large operators we checked do not publish them online. That is why KinderGuide shows the official rules and tells you what to ask, instead of a price per program.</li>
    <li><strong>Fee subsidy:</strong> based on family income, for children 12 and under. (<a href="${SOURCES.subsidy.url}" target="_blank" rel="noopener">City of Ottawa</a>)</li></ul>`;
}
['estAge', 'estDays', 'estEnrolled'].forEach(id => $(id).addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  if (id === 'estAge') state.estAge = b.dataset.v; else if (id === 'estDays') state.estDays = +b.dataset.v; else state.estEnrolled = b.dataset.v;
  save(); renderCosts();
}));
function renderTools() {
  const badge = who => who.startsWith('City') ? '<span class="badge">Official · City of Ottawa</span>' : who.startsWith('Government') ? '<span class="badge prov">Official · Ontario</span>' : `<span class="badge other">${esc(who)}</span>`;
  $('toolsList').innerHTML = OFFICIAL_TOOLS.map((t, i) => `<article class="tool card">
    <span class="need">${i + 1}. ${esc(t.need)}</span><h3>${esc(t.name)}</h3><p>${esc(t.what)}</p>
    ${t.tip ? `<span class="tip">💡 ${esc(t.tip)}</span>` : ''}
    <div class="row">${badge(t.who)}<a class="btn primary small" target="_blank" rel="noopener" href="${SOURCES[t.src].url}">Open ↗</a></div>
  </article>`).join('') + `<p class="source" style="grid-column:1/-1">Links checked ${esc(COSTS.checked)}. KinderGuide is a student project and is not affiliated with these organizations.</p>`;
}
function renderStart() {
  $('startRegistry').href = SOURCES.registry.url;
  const b = $('startBanner');
  b.classList.toggle('done', state.registered);
  b.querySelector('b').textContent = state.registered ? 'You’re on the City’s waitlist. Remember to log in at least every 60 days.' : 'Start here, before anything else: get on the City’s waitlist.';
  b.querySelector('.start-text span').hidden = state.registered;
  $('startDone').textContent = state.registered ? 'Not registered yet?' : 'I’m already registered';
}
$('startDone').addEventListener('click', () => { state.registered = !state.registered; save(); renderStart(); });
$('startIcs').addEventListener('click', () => {
  const d = new Date(); d.setDate(d.getDate() + 55);   // a few days before the 60-day limit
  const ymd = x => x.toISOString().slice(0, 10).replace(/-/g, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KinderGuide Ottawa//EN', 'BEGIN:VEVENT',
    'UID:kinderguide-registry-' + Date.now() + '@kinderguide', 'DTSTAMP:' + ymd(new Date()) + 'T000000Z',
    'DTSTART;VALUE=DATE:' + ymd(d), 'RRULE:FREQ=DAILY;INTERVAL=55;COUNT=12',
    'SUMMARY:Log in to the City of Ottawa child care registry',
    'DESCRIPTION:Log in at least every 60 days to keep your child care application active. ' + SOURCES.registry.url,
    'BEGIN:VALARM', 'TRIGGER:PT9H', 'ACTION:DISPLAY', 'DESCRIPTION:Child care registry login', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'child-care-registry-reminders.ics';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Calendar file downloaded. Open it to add reminders every 55 days.');
});

/* ---------- 9. Tour (tutorial) ---------- */
let tourStep = 0;
function showTour(i) {
  tourStep = i; const s = TOUR[i];
  if (s.tab) go(s.tab, { scroll: true });
  $('tourTitle').textContent = s.title; $('tourText').textContent = s.text;
  $('tourDots').innerHTML = TOUR.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('');
  $('tourNext').textContent = i === TOUR.length - 1 ? 'Let’s start!' : 'Next';
  $('tour').hidden = false;
}
function endTour() { $('tour').hidden = true; state.tourDone = true; save(); go('home'); }
$('tourNext').addEventListener('click', () => tourStep < TOUR.length - 1 ? showTour(tourStep + 1) : endTour());
$('tourSkip').addEventListener('click', endTour);
$('tourAgain').addEventListener('click', () => showTour(0));

/* ---------- 10. Start-up ---------- */
renderAgeChips(); renderAreaChips(); renderHomeFact(); initFindControls(); renderGuide(); renderNumbers(); renderAbout(); renderStart(); updateCounts();
$('mFrench').checked = state.french; $('mIndigenous').checked = state.indigenous; $('mHome').checked = state.home;
if (state.center) $('nearStatus').textContent = `Showing options near ${state.center.label}.`;
go((location.hash || '#home').slice(1), { scroll: false });
if (!state.tourDone && !new URLSearchParams(location.search).has('notour')) setTimeout(() => showTour(0), 700);
