/* EDFlow WA: wiring. Filters, KPIs, play controls, clock, narration, click card, legend and dialogs.
   Time is in minutes since dims.start (WA local time, AWST, no daylight saving). */
(function () {
  'use strict';
  const OF = window.OF, D = OF.Data, Scene = OF.Scene, Charts = OF.Charts, SP = OF.Sprites;
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const fmt = (n) => Math.round(n).toLocaleString('en-AU');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // speed = simulated minutes per real second: Slow 1, Normal 10, Fast 60, Turbo 240
  let playing = false, speed = 10, last = 0, statAcc = 99, S = null, selectedI = -1, dirty = true;
  const FILTERS = { hsp: 'fHsp', site: 'fSite', region: 'fRegion', ats: 'fAts', grp: 'fGrp', modeGrp: 'fMode' };
  const UI = {};

  function fillSelect(el, items, allLabel) { el.innerHTML = '<option value="-1">' + esc(allLabel) + '</option>' + items.map((x, i) => '<option value="' + i + '">' + esc(x) + '</option>').join(''); }

  /* ---------- filters ---------- */
  function buildFilters() {
    const dm = D.dims, E = dm.establishments;
    fillSelect($('fHsp'), dm.hsps.map((h) => h.code + ' · ' + h.name), 'All Health Service Providers');
    let h = '<option value="-1">All EDDC sites (' + E.filter((e) => e.tier !== 'ALIAS').length + ')</option>';
    dm.hsps.forEach((hp, hi) => { h += '<optgroup label="' + esc(hp.code) + '">' + E.map((e, i) => (e.hsp === hi && e.tier !== 'ALIAS' ? '<option value="' + i + '">' + esc(e.short + ' · ' + e.name) + '</option>' : '')).join('') + '</optgroup>'; });
    $('fSite').innerHTML = h;
    fillSelect($('fRegion'), dm.regions.map((r) => (r.name === 'Statewide (virtual)' ? 'Virtual (WAVED)' : r.name)), 'All regions');
    fillSelect($('fAts'), dm.triage.map((p) => 'ATS ' + p.code + ' ' + p.label + ' · ≤' + p.targetMin + ' min'), 'All triage categories');
    fillSelect($('fGrp'), dm.complaintGroups.map((q) => q.label + (q.confirmed === true ? '' : ' *')), 'All presenting complaint groups');
    fillSelect($('fMode'), dm.modeGroups, 'All modes of arrival');
    const onChange = () => { Object.keys(FILTERS).forEach((k) => { D.filter[k] = +$(FILTERS[k]).value; }); refilter(); };
    UI.onChange = onChange;
    Object.values(FILTERS).forEach((id) => $(id).addEventListener('change', () => {
      if (id === 'fSite' && +$('fSite').value >= 0) { $('fHsp').value = '-1'; $('fRegion').value = '-1'; } // a site already implies its HSP and region
      onChange();
    }));
    $('fColor').addEventListener('change', () => { Scene.colorBy = $('fColor').value; buildLegend(); });
    $('fDensity').addEventListener('change', () => { Scene.density = +$('fDensity').value; Scene.setup(); });
    $('btnReset').addEventListener('click', () => { Object.values(FILTERS).forEach((id) => ($(id).value = '-1')); onChange(); });
    $('btnFilters').addEventListener('click', () => { const o = $('filterGrid').classList.toggle('open'); $('btnFilters').setAttribute('aria-expanded', o); $('btnFilters').textContent = o ? 'Filters ▴' : 'Filters ▾'; });
    Charts.onGroup = (gi) => { $('fGrp').value = D.filter.grp === gi ? '-1' : String(gi); onChange(); };
    Scene.onSite = (si) => { $('fSite').value = D.filter.site === si ? '-1' : String(si); $('fHsp').value = '-1'; $('fRegion').value = '-1'; onChange(); };
  }
  function refilter() { D.applyFilter(); Scene.setup(); Scene.invalidate(); closeCard(); statAcc = 99; dirty = true; }

  /* ---------- KPI cards ---------- */
  function buildKpis() {
    $('kpis').innerHTML = [
      ['k1', 'Arrivals, last 24 hours'], ['k2', 'In the ED now'], ['k3', 'Seen within the triage target (7 days)'],
      ['k4', 'Left the ED within 4 hours (7 days)'], ['k5', 'Admitted within 6 hours (7 days)'], ['k6', 'Did not wait (7 days)'],
    ].map(([id, lab]) => '<div class="kpi" id="' + id + '"><div class="lab">' + lab + '</div><div class="val">–</div><div class="note"></div></div>').join('');
  }
  function setK(id, val, note, cls) { const el = $(id); el.querySelector('.val').textContent = val; el.querySelector('.note').textContent = note || ''; el.className = 'kpi' + (cls ? ' ' + cls : '') + (el.dataset.hl ? ' tour-hl' : ''); }
  function updateKpis() {
    const s = S, A = D.dims.accessTargets;
    const d = s.arrPrev ? (s.arr24 - s.arrPrev) / s.arrPrev : 0;
    setK('k1', fmt(s.arr24), s.prevOk && s.arrPrev ? (d >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d * 100)) + '% on the same 24 hours last week' : 'no week-earlier data to compare');
    setK('k2', fmt(s.inEd), fmt(s.waiting) + ' waiting to be seen · ' + fmt(s.inCare) + ' in care · ' + fmt(s.readyN) + ' ready to leave');
    const sv = s.seenAllDen ? s.seenAllOk / s.seenAllDen : null;
    setK('k3', sv == null ? '–' : Math.round(sv * 100) + '%', D.dims.triage.map((p, k) => 'ATS' + p.code + ' ' + (s.seenDen[k] ? pct(s.seenOk[k], s.seenDen[k]) + '%' : '–')).join(' · '), sv == null ? '' : sv < 0.6 ? 'bad' : sv < 0.75 ? 'warn' : 'good');
    const l4 = s.phys ? s.le4 / s.phys : null;
    setK('k4', l4 == null ? '–' : Math.round(l4 * 100) + '%', 'reference ' + A.weat.pct + '% (external, to confirm) · median stay ' + D.fmtDur(s.medLos), l4 == null ? '' : l4 * 100 >= A.weat.pct ? 'good' : l4 * 100 >= A.weat.pct - 15 ? 'warn' : 'bad');
    const a6 = s.adm ? s.adm6 / s.adm : null;
    setK('k5', a6 == null ? '–' : Math.round(a6 * 100) + '%', 'reference ' + A.admitted.pct + '% (external) · discharged within 4 h ' + pct(s.dis4, s.dis) + '%', a6 == null ? '' : a6 * 100 >= A.admitted.pct ? 'good' : a6 * 100 >= A.admitted.pct - 15 ? 'warn' : 'bad');
    setK('k6', s.n7 ? ((s.dnw / s.n7) * 100).toFixed(1) + '%' : '–', fmt(s.dnw) + ' did not wait · ' + fmt(s.laor) + ' left at own risk, of ' + fmt(s.n7) + ' departures', s.n7 && s.dnw / s.n7 > 0.06 ? 'warn' : '');
  }

  /* ---------- narration (screen readers read it on demand; it is not live) ---------- */
  function filterText() {
    const f = D.filter, dm = D.dims, p = [];
    if (f.hsp >= 0) p.push(dm.hsps[f.hsp].code); if (f.site >= 0) p.push(dm.establishments[f.site].short); if (f.region >= 0) p.push(dm.regions[f.region].name);
    if (f.ats >= 0) p.push('ATS ' + dm.triage[f.ats].code); if (f.grp >= 0) p.push(dm.complaintGroups[f.grp].label); if (f.modeGrp >= 0) p.push(dm.modeGroups[f.modeGrp]);
    return p.length ? 'Showing: ' + p.join(' · ') + '. ' : '';
  }
  function narrate(t) {
    const s = S, dm = D.dims; let top = '', bv = 0, bi = -1;
    s.site24.forEach((v, i) => { if (v > bv) { bv = v; bi = i; } });
    if (bi >= 0) top = ' Busiest site in the last 24 hours: ' + dm.establishments[bi].short + ' (' + fmt(bv) + ' arrivals).';
    const ov = s.over.reduce((a, b) => a + b, 0);
    $('narr').innerHTML = '<b>' + D.fmtWhen(t) + '</b> (AWST, ' + (D.meta.synthetic ? 'synthetic' : 'real extract') + '). ' + filterText() + fmt(s.inEd) + ' people in the ED: ' + fmt(s.waiting) + ' waiting to be seen (' + fmt(ov) + ' past their triage target), ' + fmt(s.inCare) + ' in care and ' + fmt(s.readyN) + ' ready to leave. ' + fmt(s.over4) + ' have been in the ED for more than 4 hours.' + top;
    $('scene').setAttribute('aria-label', 'Synthetic emergency department flow scene. ' + $('narr').textContent);
  }

  /* ---------- legend ---------- */
  function buildLegend() {
    const items = Scene.colorLegend();
    let html = '<div class="grp"><b>Colour = ' + esc($('fColor').selectedOptions[0].textContent) + '</b>' + items.map(([n, rgb]) => '<span class="sw"><i style="background:' + SP.rgbCss(rgb) + '"></i>' + esc(n) + '</span>').join('') + '</div>';
    html += '<div class="grp"><b>Rings = stage in the ED</b><div class="sizes" id="sizes" role="img" aria-label="Marker examples: no ring while waiting to be seen, one ring in clinical care, two rings ready to leave"></div></div>';
    html += '<div class="grp"><b>Outlines and moments</b><span class="sw"><i style="background:#ff6b6b"></i>red outline: waiting past the triage target</span><span class="sw"><i style="background:#f5b94a"></i>amber outline: in the ED more than 4 hours</span><span class="sw"><i style="background:#f5b94a;border-radius:0;height:2px;margin-top:6px"></i>dashed amber line: 4 hours</span><span class="sw"><i style="background:#9fb0cb"></i>labels: did not wait · referred at triage · ready to be admitted</span></div>';
    html += '<div class="grp"><b>Map dots (one size per site type)</b>' + D.dims.hsps.map((h) => '<span class="sw"><i style="background:' + Scene.hspCol[h.code] + '"></i>' + h.code + '</span>').join('') + '<span class="sw"><i style="background:#4b586d"></i>outside the filter</span></div>';
    $('legend').innerHTML = html;
    const host = $('sizes');
    [[0, 0, 'waiting'], [5, 1, 'in care'], [12, 1, 'ready to leave']].forEach(([b, mood, lab]) => {
      const s = SP.get(Scene.atsRgb[2], b, mood), fig = document.createElement('figure'), cv = document.createElement('canvas');
      cv.width = s.w * 2; cv.height = s.h * 2; cv.style.width = s.w * 1.1 + 'px'; cv.style.height = s.h * 1.1 + 'px';
      cv.getContext('2d').drawImage(s.cv, 0, 0, cv.width, cv.height); fig.appendChild(cv);
      const cap = document.createElement('figcaption'); cap.textContent = lab; fig.appendChild(cap); host.appendChild(fig);
    });
  }

  /* ---------- click card: one synthetic attendance ---------- */
  function openCard(i) { selectedI = i; Scene.select(i); if (i < 0) { $('card').hidden = true; return; } $('card').hidden = false; renderCard(); }
  function closeCard() { selectedI = -1; Scene.select(-1); $('card').hidden = true; }
  function renderCard() {
    if (selectedI < 0) return;
    const t = Scene.t, r = D.record(selectedI, t), el = t - r.arr;
    const status = ['Not arrived yet', 'Waiting to be seen: ' + D.fmtDur(el) + ' (target ≤' + r.triage.targetMin + ' min)', 'In clinical care: ' + D.fmtDur(el) + ' in the ED', 'Ready to leave the ED: ' + D.fmtDur(el) + ' in the ED', 'Left the ED after ' + D.fmtDur(r.los)][r.st];
    const steps = [['Arrived', 0], ['Triaged', r.tri], ['Seen by a doctor or nurse', r.seen], [r.depGroup.key === 'admitted' ? 'Ready for the ward' : 'Ready to leave', r.ready], ['Left the ED', r.los]]
      .filter(([, m]) => m != null && m >= 0)
      .map(([lab, m]) => '<li class="' + (r.arr + m <= t ? 'done' : '') + '"><span>' + esc(lab) + '</span><b>' + D.fmtClock(r.arr + m) + '</b><small>' + (m ? '+' + D.fmtDur(m) : '') + '</small></li>').join('');
    const left = r.st === 4;
    $('card').innerHTML = '<h4><span>Attendance ' + esc(r.rec) + '</span><button class="x" aria-label="Close" id="cardX">×</button></h4>' + (D.meta.synthetic ? '<div class="syn">SYNTHETIC RECORD · NOT A REAL PERSON</div>' : '') + '<dl>' +
      '<dt>Status</dt><dd>' + esc(status) + '</dd><dt>Site</dt><dd>' + esc(r.e.name) + ' (' + r.e.code + ') · ' + r.hsp.code + '</dd>' +
      '<dt>Triage category</dt><dd>ATS ' + r.ats + ' · ' + esc(r.triage.dictLabel) + '</dd>' +
      '<dt>Presenting complaint</dt><dd>' + esc(r.grp.label) + ' <small class="dim">(' + esc(r.pc ? r.pc.code : '') + (r.grp.confirmed === true ? '' : ', placeholder code') + ')</small></dd>' +
      '<dt>Mode of arrival</dt><dd>' + esc(r.mode.label) + '</dd><dt>Visit type</dt><dd>' + esc(r.visit.label) + '</dd><dt>Referral source</dt><dd>' + esc(r.ref ? r.ref.label : '–') + '</dd>' +
      '<dt>Age group</dt><dd>' + esc(r.age) + ' years</dd><dt>Treatment area</dt><dd>' + esc(r.area.label) + ' <small class="dim">(illustrative, not in EDDC)</small></dd>' +
      (left ? '<dt>Departure status</dt><dd>' + esc(r.dep.label) + '</dd>' : '<dt>Departure</dt><dd class="dim">not yet known at this time</dd>') + '</dl>' +
      '<ol class="steps">' + steps + '</ol><div class="cap">Times are AWST (Perth). Fields follow the EDDC Data Dictionary 2026; values are invented.</div>';
    $('cardX').addEventListener('click', closeCard);
  }

  /* ---------- establishments dialog ---------- */
  function buildEstTable() {
    const dm = D.dims, E = dm.establishments, cnt = new Int32Array(E.length); for (let i = 0; i < D.N; i++) cnt[D.site[i]]++;
    const approx = (e) => ['not-found', 'nearest-town', 'osm-similar-name'].includes(e.locationStatus);
    const sites = new Set(E.filter((e) => e.tier !== 'ALIAS').map((e) => e.name)).size;
    $('estNote').innerHTML = '<b>' + E.length + '</b> establishment codes (<b>' + sites + '</b> distinct sites), <b>exactly those with “Reports to EDDC” = Y</b> in the WA Health Establishment List, May 2026. One code is an alias of another site and carries no activity here (marked “alias”); the WA Virtual ED (WAVED) has no physical location and appears as the “Virtual” badge on the map. Codes, names and types are from the List. The List has <b>no</b> Health Service Provider, region or coordinates: those come from the WA Government SLIP layers and OpenStreetMap and are this project\'s mapping (' + E.filter((e) => e.hspBasis !== 'slip').length + ' HSP assignments not from SLIP, marked *; ' + E.filter(approx).length + ' positions approximate, marked ⚑). Activity is synthetic and scales with site size, so small nursing posts have few rows by design. ' + esc(dm.attribution || '');
    const rows = E.map((e, i) => ({ i, e, n: cnt[i], t: (e.code + ' ' + e.short + ' ' + e.name + ' ' + dm.hsps[e.hsp].code + ' ' + dm.regions[e.region].name + ' ' + (e.type || '') + ' ' + (e.typeLabel || '')).toLowerCase() }));
    const draw = (q) => {
      q = (q || '').toLowerCase().trim();
      $('estBody').innerHTML = rows.filter((r) => !q || r.t.includes(q)).map((r) => '<tr data-i="' + r.i + '" tabindex="0"><td>' + esc(r.e.code) + '</td><td>' + esc(r.e.name) +
        (r.e.tier === 'ALIAS' ? ' <small class="warnk">alias</small>' : '') + (r.e.tier === 'VIRT' ? ' <small>(virtual)</small>' : '') + (approx(r.e) ? ' <small class="warnk" title="' + esc(r.e.locationNote || 'Map position approximate') + '">⚑</small>' : '') +
        '</td><td>' + dm.hsps[r.e.hsp].code + (r.e.hspBasis !== 'slip' ? '*' : '') + '</td><td>' + esc(dm.regions[r.e.region].name) + '</td><td>' + esc(r.e.type ? r.e.type + ' ' + r.e.typeLabel : '–') + '</td><td>' + (r.n ? fmt(r.n) : '<span class="dim">none</span>') + '</td></tr>').join('');
    };
    draw(''); $('estSearch').addEventListener('input', () => draw($('estSearch').value));
    const pick = (tr) => { if (!tr) return; const i = +tr.dataset.i; if (E[i].tier === 'ALIAS') return; $('dlgEst').close(); Scene.onSite(i); };
    $('estBody').addEventListener('click', (e) => pick(e.target.closest('tr')));
    $('estBody').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pick(e.target.closest('tr')); } });
    $('estForm').addEventListener('submit', (e) => { if (document.activeElement === $('estSearch')) e.preventDefault(); });
  }

  /* ---------- clock and controls ---------- */
  function setPlaying(p) {
    playing = p; $('playIcon').textContent = p ? '❚❚' : '▶'; $('playText').textContent = p ? 'Pause' : Scene.finished ? 'Replay' : 'Play';
    if (p) $('intro').classList.add('gone');
  }
  function seekTo(t) { Scene.finished = false; Scene.seek(t); statAcc = 99; dirty = true; if (!playing) $('playText').textContent = 'Play'; }
  function setSpeed(v) { speed = v; document.querySelectorAll('.speed button').forEach((x) => { const on = +x.dataset.speed === v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); }
  function buildTicks() {
    const el = $('ticks'), a = D.simStart, b = D.MIN - 1; el.innerHTML = '';
    for (let d = Math.ceil(a / 1440); d * 1440 <= b; d++) {
      if (D.weekday(d * 1440) !== 1) continue; // label each Monday
      const s = document.createElement('span'); s.style.left = (((d * 1440 - a) / (b - a)) * 100) + '%'; s.textContent = D.fmtDay(d * 1440).replace(/^\w+ /, 'Mon '); el.appendChild(s);
    }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    Scene.advance(dt, speed, playing);
    if (playing && Scene.finished) setPlaying(false);
    statAcc += dt;
    if (statAcc > (playing ? 0.25 : 0.5) || dirty) {
      statAcc = 0; const t = Scene.t; S = D.stats(t); Scene.setStats(S); updateKpis(); Charts.draw(S, t); narrate(t); if (selectedI >= 0) renderCard(); dirty = false;
      $('dateLabel').textContent = D.fmtWhen(t); if (document.activeElement !== $('slider')) $('slider').value = Math.round(t);
    }
    Scene.render(now);
    requestAnimationFrame(frame);
  }

  async function main() {
    try {
      const base = /^[\w.-]+\.json$/.test(qs.get('data') || '') ? qs.get('data') : 'synthetic.json';
      const [, g1, g2] = await Promise.all([D.load('data/' + base), fetch('data/reference/wa_regions.geojson').then((r) => r.json()), fetch('data/reference/perth_metro.geojson').then((r) => r.json())]);
      Scene.setGeo(g1.features, g2.features);
    } catch (e) { $('loading').textContent = 'Could not load data: ' + e.message; throw e; }
    if (!D.meta.synthetic) document.querySelectorAll('.badge-syn,.foot-badge,.intro-badge').forEach((b) => { b.textContent = D.meta.banner; });
    buildFilters(); buildKpis(); Charts.init(); buildEstTable();
    const dens = [...$('fDensity').options].map((x) => +x.value), want = +(qs.get('density') || (innerWidth < 760 ? 3 : 2));
    Scene.density = dens.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a)); $('fDensity').value = String(Scene.density);
    if (qs.get('color')) { Scene.colorBy = qs.get('color'); $('fColor').value = Scene.colorBy; }
    Scene.init($('scene'), $('sceneWrap'));
    Scene.t = D.simStart;
    Scene.resize(); Scene.setup(); buildLegend();
    const sl = $('slider'); sl.min = D.simStart; sl.max = D.MIN - 1; sl.step = 10; sl.value = D.simStart; buildTicks();
    let pend = null; sl.addEventListener('input', () => { if (pend) return; pend = requestAnimationFrame(() => { pend = null; seekTo(+sl.value); }); });
    $('btnPlay').addEventListener('click', () => { if (Scene.finished) seekTo(D.simStart); setPlaying(!playing); });
    $('introPlay').addEventListener('click', () => setPlaying(true));
    $('btnRestart').addEventListener('click', () => { seekTo(D.simStart); setPlaying(false); });
    document.querySelectorAll('.speed button').forEach((b) => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
    setSpeed(qs.get('speed') ? +qs.get('speed') : 10);
    Scene.onPick = (i) => { if (i >= 0) openCard(i); else closeCard(); };
    $('btnPrint').addEventListener('click', () => window.print());
    [['btnHow', 'dlgHow'], ['btnData', 'dlgData'], ['btnRules', 'dlgRules'], ['btnEst', 'dlgEst']].forEach(([b, d]) => $(b).addEventListener('click', () => $(d).showModal()));
    document.addEventListener('keydown', (e) => {
      const tg = e.target; if (['SELECT', 'INPUT', 'TR', 'A', 'BUTTON'].includes(tg.tagName) || tg.closest('#tour')) return;
      if (e.code === 'Space' && !document.querySelector('dialog[open]')) { e.preventDefault(); $('btnPlay').click(); }
      if (e.key === 'Escape') closeCard();
    });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { Scene.resize(); dirty = true; }, 120); });
    window.addEventListener('beforeprint', () => { Scene.render(performance.now()); });
    $('loading').style.display = 'none';
    if (qs.get('autoplay')) setPlaying(true);
    last = performance.now(); requestAnimationFrame(frame);
    OF.UI = {
      setPlaying, seekTo, setSpeed, simStart: () => D.simStart, isPlaying: () => playing, statsAt: (t) => D.stats(t),
      filters: (o) => { Object.keys(FILTERS).forEach((k) => { if (k in o) $(FILTERS[k]).value = String(o[k]); }); UI.onChange(); },
      resetFilters: () => { const any = Object.values(FILTERS).some((id) => $(id).value !== '-1'); if (any) $('btnReset').click(); },
    };
    if (OF.Tour) { OF.Tour.init(); $('btnTour').addEventListener('click', () => OF.Tour.start()); $('introTour').addEventListener('click', () => OF.Tour.start()); if (qs.get('tour')) OF.Tour.start(); }
    window.__ed = { D, Scene, get playing() { return playing; } };
  }
  main();
})();
