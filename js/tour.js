/* EDFlow WA: guided tour (7 steps). Every number in the tour text is computed from the loaded data at that moment. */
(function () {
  'use strict';
  const OF = window.OF, D = OF.Data;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-AU');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  let step = -1, timer = null, panel = null, hl = [], token = 0;
  const at = (dayOff, hh) => Math.floor(OF.UI.simStart() / 1440) * 1440 + dayOff * 1440 + hh * 60; // a clock time relative to the first playback day
  const sumOver = (S) => S.over.reduce((a, b) => a + b, 0);

  // Each step: title, a time (or a short play), optional filter, highlight selectors, and text(S) built from live stats.
  const STEPS = [
    {
      title: 'Meet the markers', t: () => OF.UI.simStart(), hl: ['#sceneWrap', '#legend'],
      text: (S) => 'Every marker is one <b>invented</b> emergency department attendance. All markers are the same shape and size. The <b>rings</b> on the ground show the stage: no ring while waiting to be seen, one ring in clinical care, two rings when ready to leave the ED. Colour shows the triage category (ATS). The map, regions and the ' + D.dims.establishments.length + ' EDDC establishment codes are real reference data; the people and times are synthetic. At ' + D.fmtWhen(S.t) + ' the simulation holds <b>' + fmt(S.inEd) + '</b> people in its EDs.',
    },
    {
      title: 'Arriving and waiting to be seen', play: { to: () => at(0, 11), speed: 60 }, hl: ['#sceneWrap', '#cSeen'],
      text: (S) => 'Markers appear at their site on the map and join the lane for their triage category. Their position along the lane is the time waited, compared with the time-to-treatment target in the ED Business Rules (July 2026) §7.4: ATS 1 within 2 minutes, ATS 2 within 10, ATS 3 within 30, ATS 4 within 60 and ATS 5 within 120. At ' + D.fmtClock(S.t) + ', <b>' + fmt(S.waiting) + '</b> people are waiting to be seen and <b>' + fmt(sumOver(S)) + '</b> are past their target (red outline). In the last 7 days <b>' + pct(S.seenAllOk, S.seenAllDen) + '%</b> were seen within the target (synthetic).',
    },
    {
      title: 'In the ED: time since arrival', t: () => at(0, 14), hl: ['#sceneWrap', '#k4'],
      text: (S) => 'Once seen, a marker goes through a door into its HSP block and drifts right with its time since arrival. The amber dashed line is <b>4 hours</b>; anyone in the ED longer gets an amber outline. ' + fmt(S.over4) + ' people are past 4 hours at ' + D.fmtClock(S.t) + '. Over the last 7 days <b>' + pct(S.le4, S.phys) + '%</b> left within 4 hours. The 4-hour reference (WA Emergency Access Target) is <b>not</b> in the EDDC documents and is shown as an external reference to be confirmed (open question 1). The doors (Resus, Acute, Fast track…) are illustrative: EDDC has no treatment-area field.',
    },
    {
      title: 'Leaving the ED', t: () => at(0, 18), hl: ['#k5', '#k6', '#cDep'],
      text: (S) => 'Markers leave through a gate: admitted to a ward, home, or transferred. In the last 7 days ' + fmt(S.adm) + ' people were admitted (' + pct(S.adm6, S.adm) + '% within 6 hours) and ' + fmt(S.dis) + ' went home (' + pct(S.dis4, S.dis) + '% within 4 hours). ' + fmt(S.dnw) + ' did not wait to be seen and leave from the waiting lane; ' + fmt(S.laor) + ' left at their own risk. The reasons people leave are recorded in the data and are not assumed here. Departure statuses follow the Data Dictionary 2026 (p.24).',
    },
    {
      title: 'Presenting complaint', t: () => at(1, 10), filter: { grp: () => D.gi('CHE') }, hl: ['#fGrp', '#cPc'],
      text: (S, S0) => 'The markers now shown have a chest pain presenting complaint (code BEA00 is the Data Dictionary\'s own example, p.57). Across all complaints (before the filter) ' + fmt(S0.grpN.reduce((a, b) => a + b, 0)) + ' people arrived in the last 7 days. The EDDC documents do <b>not</b> contain the presenting complaint code list, so only some groups are confirmed (marked without *); the rest are placeholders until the custodian supplies the list (open question 2). Click a row in the chart below to filter by group. The filter returns to "all" when you move on.',
    },
    {
      title: 'Busy hours and the week', t: () => at(4, 20), hl: ['#cTime', '#cHeat'],
      text: (S) => 'The week chart shows arrivals per hour (bars), people in the ED (line), and the same hour last week (dashed). In the last 24 hours ' + fmt(S.arr24) + ' people arrived' + (S.prevOk && S.arrPrev ? ' (' + (S.arr24 >= S.arrPrev ? '+' : '') + pct(S.arr24 - S.arrPrev, S.arrPrev) + '% on the same 24 hours last week)' : '') + '. The heatmap averages arrivals by weekday and hour: the late-morning peak and quiet early hours come from the synthetic generator and are a design check, not a finding.',
    },
    {
      title: 'What is real and what is not', t: () => OF.UI.simStart(), hl: ['#btnEst'], end: true,
      text: () => 'Real: the <b>' + D.dims.establishments.length + '</b> establishment codes with “Reports to EDDC” = Y in the WA Health Establishment List (May 2026); the EDDC field names and code sets (Data Dictionary 2026, Data Specifications July 2026); the triage targets (Business Rules July 2026 §7.4). External and to be confirmed: the 4-hour and admission references and the seen-on-time thresholds. Not official: the HSP grouping, regions and map positions (from SLIP / OpenStreetMap). Synthetic: every person, time and outcome. The questions for the data custodian are in docs/OPEN-QUESTIONS.md on GitHub.',
    },
  ];

  function clearHl() { hl.forEach((el) => { el.classList.remove('tour-hl'); delete el.dataset.hl; }); hl = []; }
  function setHl(sels) {
    clearHl(); let first = null;
    sels.forEach((s) => { const el = document.querySelector(s); if (el) { el.classList.add('tour-hl'); el.dataset.hl = '1'; hl.push(el); if (!first) first = el; } });
    if (first) first.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function stopTimer() { if (timer) { cancelAnimationFrame(timer); timer = null; } }
  function statsAt(t) { const S = OF.UI.statsAt(t); S.t = t; return S; }

  function render(i, S, busy, S0) {
    const st = STEPS[i];
    panel.querySelector('.t-step').textContent = 'Step ' + (i + 1) + ' of ' + STEPS.length;
    panel.querySelector('h3').textContent = st.title;
    panel.querySelector('.t-body').innerHTML = busy ? '<span class="t-wait">Playing the simulation forward…</span>' : st.text(S, S0);
    panel.querySelector('.t-back').disabled = i === 0;
    panel.querySelector('.t-next').textContent = st.end ? 'Finish' : 'Next ▸';
    panel.querySelector('.t-dots').innerHTML = STEPS.map((_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('');
  }

  function go(i) {
    token++; const my = token; stopTimer(); step = i; const st = STEPS[i];
    OF.UI.setPlaying(false); OF.UI.resetFilters();
    let S0 = null;
    if (st.filter) { S0 = statsAt(st.t()); const f = {}; Object.keys(st.filter).forEach((k) => { f[k] = st.filter[k](); }); OF.UI.filters(f); }
    setHl(st.hl || []);
    const finish = (t) => { if (my !== token) return; OF.UI.setPlaying(false); OF.UI.seekTo(t); render(i, statsAt(t), false, S0); };
    if (st.play) {
      const to = st.play.to(); OF.UI.seekTo(OF.UI.simStart()); OF.UI.setSpeed(st.play.speed); render(i, null, true); OF.UI.setPlaying(true);
      const poll = () => { if (my !== token) return; if (OF.Scene.t >= to - 1 || !OF.UI.isPlaying()) { finish(Math.min(to, Math.floor(OF.Scene.t))); return; } timer = requestAnimationFrame(poll); };
      timer = requestAnimationFrame(poll);
    } else { const t = st.t(); OF.UI.seekTo(t); render(i, statsAt(t), false, S0); }
    panel.querySelector('.t-next').focus({ preventScroll: true });
  }

  function end() {
    token++; stopTimer(); clearHl(); OF.UI.resetFilters(); OF.UI.setPlaying(false); OF.UI.setSpeed(10);
    panel.hidden = true; step = -1; document.removeEventListener('keydown', onKey, true);
    const b = $('btnTour'); if (b) b.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (panel.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); end(); } else if (e.key === 'ArrowRight') { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); if (step > 0) go(step - 1); }
  }
  function next() { if (STEPS[step].end) end(); else go(step + 1); }

  OF.Tour = {
    init() {
      panel = document.createElement('section'); panel.id = 'tour'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Guided tour'); panel.setAttribute('aria-live', 'polite');
      panel.innerHTML = '<div class="t-head"><span class="t-step"></span><button class="t-x" aria-label="Close tour (Esc)">×</button></div><h3></h3><p class="t-body"></p><div class="t-foot"><div class="t-dots" aria-hidden="true"></div><span class="t-hint">← → keys, Esc closes</span><button class="btn ghost t-back">◂ Back</button><button class="btn primary t-next">Next ▸</button></div><p class="t-syn">SYNTHETIC EXAMPLE DATA</p>';
      document.body.appendChild(panel);
      panel.querySelector('.t-x').addEventListener('click', end);
      panel.querySelector('.t-back').addEventListener('click', () => { if (step > 0) go(step - 1); });
      panel.querySelector('.t-next').addEventListener('click', next);
    },
    start() { if (!panel) return; $('intro').classList.add('gone'); panel.hidden = false; document.addEventListener('keydown', onKey, true); go(0); },
    get step() { return step; },
  };
})();
