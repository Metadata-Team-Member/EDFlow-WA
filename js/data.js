/* EDFlow WA: data layer.
   Loads the compact columnar JSON written by tools/build_data.mjs and answers, cheaply,
   "where is attendance i at minute t?" plus the rolling measures shown in the KPIs and charts.
   Time is in minutes since meta.start (00:00, local WA time). Every code and label comes from data/synthetic.json (dims),
   which in turn comes from config/dimensions.json; nothing about the code sets is hard-coded here.

   Stages of an ED attendance (EDDC Data Dictionary 2026):
     0 not arrived yet
     1 waiting to be seen      arrival_datetime → commencement of clinical care (or departure if never seen)
     2 in clinical care        commencement of clinical care → departure_ready_datetime
                               (commencement = earlier of doctor_seen_datetime and nurse_seen: OBM KPI manual 2025-26; DD pp.30, 66)
     3 ready to leave          departure_ready_datetime → discharge_datetime (for example waiting for a ward bed)
     4 departed                after discharge_datetime ("ED departure"; DD p.28) */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {});
  const D = {};
  OF.Data = D;

  let raw, N, MIN;
  let arr, tri, seen, ready, los, site, ats, grp, mode, visit, dep, ageG, pcode, refS, dest, area, hspOfSite, regOfSite, tierOf, modeGrp, depGrp, virt;
  D.filter = { hsp: -1, site: -1, region: -1, ats: -1, grp: -1, modeGrp: -1 };
  D.pass = null; D.idx = null;

  // Small integer hash in [0,1): deterministic per attendance, used for sampling and layout jitter.
  D.hash = function (i, salt) { let h = (i * 2654435761 + (salt || 0) * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

  D.load = async function (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Could not load ' + url + ' (' + r.status + ')');
    raw = await r.json();
    prepare();
    return raw;
  };

  function prepare() {
    const c = raw.cols, dm = raw.dims; N = c.a.length; MIN = raw.meta.days * 1440;
    arr = new Int32Array(N); let p = 0; for (let i = 0; i < N; i++) { p += c.a[i]; arr[i] = p; } // a is stored as the gap from the previous arrival
    tri = Int32Array.from(c.t); seen = Int32Array.from(c.s); ready = Int32Array.from(c.r); los = Int32Array.from(c.d);
    pcode = Int16Array.from(c.p); refS = Int8Array.from(c.f); dest = Int8Array.from(c.x);
    site = new Uint8Array(N); ats = new Uint8Array(N); grp = new Uint8Array(N); mode = new Uint8Array(N); visit = new Uint8Array(N); dep = new Uint8Array(N); ageG = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const k = c.k[i]; site[i] = k & 127; ats[i] = (k >>> 7) & 7; grp[i] = (k >>> 10) & 15; mode[i] = (k >>> 14) & 15; visit[i] = (k >>> 18) & 31; dep[i] = (k >>> 23) & 31; ageG[i] = (k >>> 28) & 7; }
    hspOfSite = Int8Array.from(dm.establishments.map((e) => e.hsp));
    regOfSite = Int8Array.from(dm.establishments.map((e) => e.region));
    tierOf = dm.establishments.map((e) => e.tier);
    modeGrp = Int8Array.from(dm.modes.map((m) => dm.modeGroups.indexOf(m.group)));
    D.depGroupKeys = dm.departureGroups.map((q) => q.key);
    depGrp = Int8Array.from(dm.departure.map((q) => D.depGroupKeys.indexOf(q.group)));
    virt = Uint8Array.from(dm.establishments.map((e) => (e.tier === 'VIRT' ? 1 : 0)));
    D.gi = (key) => dm.complaintGroups.findIndex((q) => q.key === key);
    D.ai = (key) => dm.treatmentAreas.findIndex((q) => q.key === key);
    area = new Uint8Array(N); for (let i = 0; i < N; i++) area[i] = areaOf(i);
    Object.assign(D, { N, MIN, DAYS: raw.meta.days, dims: dm, meta: raw.meta, arr, tri, seen, ready, los, site, ats, grp, mode, visit, dep, ageG, pcode, area, hspOfSite, regOfSite, modeGrp, depGrp, virt });
    D.simStart = Math.round((Date.parse(raw.meta.simStart + ':00Z') - Date.parse(raw.meta.start + 'T00:00:00Z')) / 60000);
    D.applyFilter();
  }

  /* Treatment area (illustrative only). EDDC has no treatment-area field; the area is derived from triage category,
     complaint group, age and the size of the site so the scene can show "doors". See docs/OPEN-QUESTIONS.md. */
  function areaOf(i) {
    const T = tierOf[site[i]], big = T === 'TERT' || T === 'METR' || T === 'PAED' || T === 'WOMN';
    if (T === 'VIRT') return D.ai('VIR');
    if (ats[i] === 0 || (ats[i] === 1 && D.hash(i, 21) < 0.35)) return D.ai('RES');
    if (big && (grp[i] === D.gi('SOC') || (grp[i] === D.gi('AOD') && D.hash(i, 22) < 0.5)) && ats[i] >= 2) return D.ai('MHA');
    if (T === 'PAED' || (big && ageG[i] === 0)) return D.ai('PAE');
    if (ats[i] >= 3 && T !== 'DIST' && T !== 'POST') return D.ai('FTR');
    return D.ai('ACU');
  }

  /* ---------- time helpers (all WA local time, no daylight saving) ---------- */
  const D0 = () => Date.parse(raw.meta.start + 'T00:00:00Z');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  D.WD = WD;
  D.toDate = (m) => new Date(D0() + Math.floor(m) * 60000);
  D.weekday = (m) => D.toDate(m).getUTCDay();
  const pad = (n) => String(n).padStart(2, '0');
  D.fmtClock = (m) => { const t = D.toDate(m); return pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()); };
  D.fmtDay = (m) => { const t = D.toDate(m); return WD[t.getUTCDay()] + ' ' + t.getUTCDate() + ' ' + MON[t.getUTCMonth()]; };
  D.fmtDate = (m) => D.fmtDay(m) + ' ' + D.toDate(m).getUTCFullYear();
  D.fmtWhen = (m) => D.fmtDay(m) + ', ' + D.fmtClock(m);
  D.fmtDur = (min) => { min = Math.max(0, Math.round(min)); if (min < 60) return min + ' min'; const h = Math.floor(min / 60), r = min % 60; return h + ' h' + (r ? ' ' + pad(r) : ''); };

  /* ---------- filters ---------- */
  D.applyFilter = function () {
    const f = D.filter, pass = new Uint8Array(N), idx = [];
    for (let i = 0; i < N; i++) {
      const s = site[i];
      if (f.hsp >= 0 && hspOfSite[s] !== f.hsp) continue;
      if (f.site >= 0 && s !== f.site) continue;
      if (f.region >= 0 && regOfSite[s] !== f.region) continue;
      if (f.ats >= 0 && ats[i] !== f.ats) continue;
      if (f.grp >= 0 && grp[i] !== f.grp) continue;
      if (f.modeGrp >= 0 && modeGrp[mode[i]] !== f.modeGrp) continue;
      pass[i] = 1; idx.push(i);
    }
    D.pass = pass; D.idx = Int32Array.from(idx); buildHourly();
  };
  // first position in D.idx whose arrival is >= m
  D.lower = function (m) { const ix = D.idx; let lo = 0, hi = ix.length; while (lo < hi) { const md = (lo + hi) >> 1; if (arr[ix[md]] < m) lo = md + 1; else hi = md; } return lo; };

  // Hourly arrivals and "people in the ED at the top of each hour", for the time chart and the heatmap.
  function buildHourly() {
    const H = raw.meta.days * 24, a = new Int32Array(H), occ = new Int32Array(H + 1);
    const ix = D.idx;
    for (let n = 0; n < ix.length; n++) {
      const i = ix[n], h0 = Math.floor(arr[i] / 60); a[h0]++;
      const h1 = Math.ceil(arr[i] / 60), h2 = Math.min(H, Math.floor((arr[i] + los[i]) / 60));
      if (h2 >= h1) { occ[h1]++; occ[h2 + 1 > H ? H : h2 + 1]--; }
    }
    for (let h = 1; h <= H; h++) occ[h] += occ[h - 1];
    D.hourly = { arrivals: a, inEd: occ };
  }

  /* ---------- one attendance at minute t ---------- */
  D.stage = function (i, t) {
    const a = arr[i]; if (t < a) return 0;
    if (t >= a + los[i]) return 4;
    if (seen[i] < 0 || t < a + seen[i]) return 1;
    if (ready[i] >= 0 && t >= a + ready[i]) return 3;
    return 2;
  };
  D.target = (i) => raw.dims.triage[ats[i]].targetMin;

  // Is the time to be seen measured for this attendance? Only when a commencement time is recorded (the OBM KPI manual excludes a
  // null commencement), so 'did not wait' is out; 'referred at triage' is also left out (Q7), and so is the virtual ED (Q11).
  D.waitMeasured = (i) => seen[i] >= 0 && !virt[site[i]];

  /* ---------- statistics at minute t ---------- */
  const median = (a) => { if (!a.length) return 0; a.sort((x, y) => x - y); return a[a.length >> 1]; };
  D.median = median;
  D.stats = function (t) {
    const dm = raw.dims, nS = dm.establishments.length, nH = dm.hsps.length, nR = dm.regions.length, nG = dm.complaintGroups.length, nA = dm.treatmentAreas.length, nT = dm.triage.length, nDG = dm.departureGroups.length;
    const S = { t };
    const z = (n) => new Int32Array(n);
    S.wait = z(nT); S.over = z(nT); S.band = []; for (let k = 0; k < nT; k++) S.band.push(z(8));
    S.inCare = 0; S.readyN = 0; S.waiting = 0; S.over4 = 0; S.inEd = 0;
    S.siteWait = z(nS); S.siteIn = z(nS); S.hspWait = z(nH); S.hspIn = z(nH); S.regIn = z(nR); S.regWaitNow = z(nR);
    S.area = []; for (let h = 0; h < nH; h++) S.area.push(z(nA));
    const ix = D.idx, maxS = raw.meta.maxStayMin;
    // people in the ED now
    for (let n = D.lower(t - maxS); n < ix.length; n++) {
      const i = ix[n]; if (arr[i] > t) break;
      const st = D.stage(i, t); if (st === 0 || st === 4) continue;
      const s = site[i], h = hspOfSite[s]; S.inEd++;
      if (!virt[s] && t - arr[i] > 240) S.over4++;
      if (st === 1) {
        const w = t - arr[i], u = w / dm.triage[ats[i]].targetMin; S.waiting++; S.wait[ats[i]]++; if (u > 1) S.over[ats[i]]++;
        S.band[ats[i]][u <= 0.5 ? 0 : u <= 1 ? 1 : u <= 2 ? 2 : u <= 3 ? 3 : u <= 4 ? 4 : u <= 6 ? 5 : u <= 10 ? 6 : 7]++;
        S.siteWait[s]++; S.hspWait[h]++; S.regWaitNow[regOfSite[s]]++;
      } else { S.inCare++; if (st === 3) S.readyN++; S.siteIn[s]++; S.hspIn[h]++; S.area[h][area[i]]++; }
      S.regIn[regOfSite[s]]++;
    }
    // arrivals in the last 24 hours, and in the same 24 hours one week earlier
    S.arr24 = D.lower(t + 1e-6) - D.lower(t - 1440); S.arrPrev = D.lower(t - 10080 + 1e-6) - D.lower(t - 11520); S.prevOk = t - 11520 >= 0;
    S.site24 = z(nS); for (let n = D.lower(t - 1440); n < ix.length && arr[ix[n]] <= t; n++) S.site24[site[ix[n]]]++;
    // attendances that left the ED in the last 7 days (departure in (t-7d, t])
    const w0 = t - 10080; S.week = w0 >= 0;
    let n7 = 0, phys = 0, le4 = 0, adm = 0, adm6 = 0, dis = 0, dis4 = 0, dnw = 0, laor = 0, le12 = 0;
    S.seenDen = z(nT); S.seenOk = z(nT); const losArr = [], regWait = [], grpWait = []; S.grpN = z(nG); S.depByHsp = [];
    for (let r = 0; r < nR; r++) regWait.push([]); for (let k = 0; k < nG; k++) grpWait.push([]); for (let h = 0; h < nH; h++) S.depByHsp.push(z(nDG));
    S.hspPhys = z(nH); S.hspLe4 = z(nH);
    for (let n = D.lower(w0 - maxS); n < ix.length; n++) {
      const i = ix[n]; if (arr[i] > t) break;
      if (arr[i] > w0) S.grpN[grp[i]]++; // complaint mix: arrivals in the last 7 days
      const d = arr[i] + los[i]; if (d <= w0 || d > t) continue;
      n7++; const s = site[i], dg = depGrp[dep[i]], key = D.depGroupKeys[dg];
      S.depByHsp[hspOfSite[s]][dg]++;
      if (key === 'dnw') dnw++; if (key === 'laor') laor++;
      if (D.waitMeasured(i) && key !== 'triage') { S.seenDen[ats[i]]++; if (seen[i] <= dm.triage[ats[i]].targetMin) S.seenOk[ats[i]]++; regWait[regOfSite[s]].push(seen[i]); grpWait[grp[i]].push(seen[i]); }
      if (virt[s]) continue; // the virtual ED is kept out of the length-of-stay measures (OPEN-QUESTIONS Q11)
      phys++; losArr.push(los[i]); S.hspPhys[hspOfSite[s]]++; if (los[i] <= 240) { le4++; S.hspLe4[hspOfSite[s]]++; } if (los[i] <= 720) le12++;
      if (key === 'admitted') { adm++; if (los[i] <= 360) adm6++; } else if (key === 'home') { dis++; if (los[i] <= 240) dis4++; }
    }
    Object.assign(S, { n7, phys, le4, le12, adm, adm6, dis, dis4, dnw, laor });
    S.medLos = median(losArr); S.regMed = regWait.map(median); S.regN = regWait.map((a) => a.length); S.grpMed = grpWait.map(median);
    let sd = 0, so = 0; for (let k = 0; k < nT; k++) { sd += S.seenDen[k]; so += S.seenOk[k]; } S.seenAllDen = sd; S.seenAllOk = so;
    return S;
  };

  /* average arrivals per hour by weekday, over every complete hour before t */
  D.heat = function (t) {
    const a = D.hourly.arrivals, H = Math.min(a.length, Math.floor(t / 60)), sum = [], cnt = [];
    for (let d = 0; d < 7; d++) { sum.push(new Float64Array(24)); cnt.push(new Int32Array(24)); }
    const wd0 = D.weekday(0);
    for (let h = 0; h < H; h++) { const d = (wd0 + Math.floor(h / 24)) % 7, hr = h % 24; sum[d][hr] += a[h]; cnt[d][hr]++; }
    return sum.map((row, d) => Array.from(row, (v, hr) => (cnt[d][hr] ? v / cnt[d][hr] : null)));
  };

  /* details for the click card (no sequence number or date of birth is kept in the browser) */
  D.record = function (i, t) {
    const dm = raw.dims, e = dm.establishments[site[i]];
    return {
      i, rec: 'EX-' + String(100000 + i), st: D.stage(i, t), e, hsp: dm.hsps[e.hsp], region: dm.regions[e.region], triage: dm.triage[ats[i]], ats: ats[i] + 1,
      grp: dm.complaintGroups[grp[i]], pc: dm.complaintCodes[pcode[i]], mode: dm.modes[mode[i]], visit: dm.visitTypes[visit[i]], ref: dm.referralSources[refS[i]],
      dep: dm.departure[dep[i]], depGroup: dm.departureGroups[depGrp[dep[i]]], dest: dm.destinations[dest[i]], age: dm.ageGroups[ageG[i]], area: dm.treatmentAreas[area[i]],
      arr: arr[i], tri: tri[i], seen: seen[i], ready: ready[i], los: los[i], measured: D.waitMeasured(i),
    };
  };
})(window);
