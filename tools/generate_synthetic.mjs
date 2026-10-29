#!/usr/bin/env node
/**
 * Seeded generator of SYNTHETIC emergency department attendances for the 84 establishments that report to the EDDC.
 * Nothing here is real WA Health data: volumes, case mix, waits and outcomes are invented shapes chosen to look plausible.
 *
 *   node tools/generate_synthetic.mjs [--seed 20260601]
 *
 * Writes data/csv/ed_episodes.csv (git-ignored) with columns named after the EDDC Data Dictionary 2026 field names,
 * which tools/build_data.mjs then turns into data/synthetic.json.
 *
 * Model in one paragraph: arrivals follow a site volume x weekday x hour-of-day profile. Each person gets an age,
 * a presenting complaint group (depends on age and hour), a triage category (depends on complaint and site tier),
 * an arrival mode, visit type and referral source. Time to clinical care = triage target x lognormal x
 * busy-hour load x site factor. People whose wait exceeds their patience leave as 'did not wait'. After care starts,
 * the departure status (admission, home, transfer, left at own risk ...) depends on triage, age and site tier,
 * and the length of stay depends on that pathway (admitted people also wait for a bed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEstablishments } from './lib_ref.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const SEED = +(argv[argv.indexOf('--seed') + 1] || 0) || 20260601;
const dims = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/dimensions.json'), 'utf8'));
const M = dims.model;
const { est } = loadEstablishments(ROOT, dims);

// ---------- seeded random numbers (mulberry32) ----------
let s = SEED >>> 0;
const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
const logn = (median, sigma) => median * Math.exp(sigma * gauss());
const pick = (w) => { const tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return w.length - 1; };
const poisson = (lam) => { if (lam > 40) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss())); let L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
const siteNoise = (code, k) => { let h = 2166136261; for (const c of code + k) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

// ---------- case-mix tables (all invented) ----------
// complaint group weights by age band 0-14, 15-34, 35-64, 65-84, 85+
const groupByAge = {
  INJ: [0.27, 0.25, 0.20, 0.17, 0.21], ABD: [0.08, 0.13, 0.13, 0.11, 0.09], CHE: [0.01, 0.06, 0.12, 0.12, 0.09],
  BRE: [0.16, 0.05, 0.07, 0.12, 0.15], FEV: [0.16, 0.06, 0.06, 0.08, 0.09], NEU: [0.05, 0.05, 0.07, 0.09, 0.11],
  SOC: [0.03, 0.10, 0.06, 0.02, 0.015], AOD: [0.002, 0.06, 0.04, 0.01, 0.002], POI: [0.015, 0.015, 0.008, 0.003, 0.002],
  OTH: [0.22, 0.22, 0.25, 0.29, 0.29],
};
const NIGHT_GROUPS = new Set(['SOC', 'AOD', 'POI']);
// triage category weights (ATS 1..5) by complaint group
const atsByGroup = {
  CHE: [0.01, 0.45, 0.42, 0.10, 0.02], NEU: [0.04, 0.25, 0.40, 0.25, 0.06], AOD: [0.02, 0.18, 0.42, 0.30, 0.08],
  POI: [0.03, 0.30, 0.42, 0.20, 0.05], SOC: [0.005, 0.15, 0.40, 0.35, 0.095], BRE: [0.02, 0.20, 0.45, 0.27, 0.06],
  ABD: [0.002, 0.10, 0.48, 0.35, 0.068], FEV: [0.003, 0.08, 0.35, 0.42, 0.147], INJ: [0.005, 0.06, 0.25, 0.50, 0.185],
  OTH: [0.005, 0.08, 0.30, 0.45, 0.165],
};
const atsTierShift = { DIST: [1, 0.8, 0.8, 1.2, 1.6], POST: [0.8, 0.6, 0.7, 1.3, 1.9], REGL: [1, 0.95, 0.95, 1.05, 1.15] };
const ageBandsByTier = { PAED: [1, 0, 0, 0, 0], WOMN: [0, 0.7, 0.3, 0, 0], VIRT: [0.12, 0.22, 0.32, 0.25, 0.09], TERT: [0.06, 0.29, 0.35, 0.22, 0.08] };
const ageBandsDefault = [0.17, 0.27, 0.31, 0.18, 0.07];
const AGE_RANGE = [[0, 15], [15, 35], [35, 65], [65, 85], [85, 101]];
// time to clinical care, as a fraction of the triage target: median and spread (metro baseline)
const waitShape = [[0.35, 0.6], [0.6, 0.75], [0.85, 0.9], [0.75, 1.0], [0.5, 1.1]];
const waitLoad = [0.75, 0.7, 0.65, 0.6, 0.55, 0.55, 0.6, 0.7, 0.85, 1.0, 1.1, 1.2, 1.25, 1.3, 1.3, 1.3, 1.3, 1.3, 1.25, 1.2, 1.1, 1.0, 0.9, 0.8];
const tierWait = { TERT: 1.05, METR: 1.15, PAED: 0.85, WOMN: 0.6, REGL: 0.75, DIST: 0.4, POST: 0.5, VIRT: 0.6 };
const admitByAts = [0.8, 0.55, 0.36, 0.14, 0.05];
const admitByAge = [0.5, 0.6, 1.0, 1.5, 1.9];
const metroTier = (t) => t === 'TERT' || t === 'METR' || t === 'PAED' || t === 'WOMN';

const pad = (n) => String(n).padStart(2, '0');
const D0 = Date.parse(dims.start + 'T00:00:00Z');
const fmt = (min) => { if (min == null) return ''; const d = new Date(D0 + Math.round(min) * 60000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`; };
const fmtDob = (min, ageYears) => { const d = new Date(D0 + min * 60000 - ageYears * 365.25 * 864e5 - rnd() * 360 * 864e5); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };

// ---------- generate ----------
const COLS = ['est_code', 'sequence_number', 'arrival_datetime', 'triage_datetime', 'doctor_seen_datetime', 'nurse_seen', 'departure_ready_datetime', 'bed_req_date_time',
  'ward_ready_date', 'admission_datetime', 'short_stay_unit_admission_date', 'discharge_datetime', 'date_of_birth', 'triage_category', 'presenting_complaint',
  'mode_of_arrival', 'visit_type', 'referral_source', 'departure_status', 'destination_on_departure'];
const rows = [];
let seq = 1000000;
const pre = 2; // generate two extra days before the period so the first morning already has people in the ED; they are dropped later
for (const e of est) {
  const daily = M.siteDailyArrivals[e.code] ?? M.defaultDailyByTier[e.tier] ?? 4;
  if (!daily) continue;
  const busy = 0.85 + 0.35 * siteNoise(e.code, 'busy'); // some EDs are busier than others relative to capacity
  for (let day = -pre; day < dims.days; day++) {
    const dow = new Date(D0 + day * 864e5).getUTCDay();
    const prof = dow === 0 || dow === 6 ? M.hourWeekend : M.hourWeekday;
    const tot = prof.reduce((a, b) => a + b, 0);
    for (let h = 0; h < 24; h++) {
      const n = poisson(daily * M.weekday[dow] * prof[h] / tot * (0.95 + 0.1 * rnd()));
      for (let k = 0; k < n; k++) rows.push(person(e, day * 1440 + h * 60 + rnd() * 60, dow, h, busy));
    }
  }
}

function person(e, arr, dow, hour, busy) {
  const T = e.tier, virt = T === 'VIRT';
  const band = pick(ageBandsByTier[T] || ageBandsDefault);
  const age = AGE_RANGE[band][0] + Math.floor(Math.pow(rnd(), band === 0 ? 1.6 : 1) * (AGE_RANGE[band][1] - AGE_RANGE[band][0]));
  const night = hour >= 21 || hour < 4;
  const gw = dims.complaintGroups.map((g) => {
    let w = groupByAge[g.key][band];
    if (night && NIGHT_GROUPS.has(g.key)) w *= 2.2;
    if (T === 'WOMN') w = g.key === 'OTH' ? 0.7 : g.key === 'ABD' ? 0.2 : w * 0.3;
    if (virt && (g.key === 'INJ' || g.key === 'CHE')) w *= 0.5;
    return w;
  });
  const grp = dims.complaintGroups[pick(gw)];
  const code = grp.codes[Math.floor(rnd() * grp.codes.length)];
  let atsW = atsByGroup[grp.key].slice();
  const shift = atsTierShift[T]; if (shift) atsW = atsW.map((w, i) => w * shift[i]);
  if (virt) atsW = [0, 0.03, 0.35, 0.45, 0.17];
  let ats = pick(atsW) + 1;

  // arrival mode, visit type, referral source
  const amb = [0.85, 0.6, 0.35, 0.15, 0.06][ats - 1] * (band >= 3 ? 1.5 : band === 0 ? 0.5 : 1);
  let mode = '1', visit = '1', src = '4';
  const r = rnd();
  if (virt) { mode = '8'; visit = ['26', '27', '12', '29', '1'][pick([0.3, 0.25, 0.15, 0.1, 0.2])]; src = { 12: '2', 26: '7', 27: '7', 29: '7', 1: '4' }[visit]; }
  else {
    if (r < Math.min(0.92, amb)) mode = '3';
    else if (grp.key === 'SOC' || grp.key === 'AOD' ? rnd() < 0.12 : rnd() < 0.006) mode = '5';
    else { const q = rnd(); mode = q < 0.04 ? '10' : q < 0.07 ? '2' : q < 0.085 ? '4' : q < 0.095 ? '8' : q < 0.1 ? '9' : '1'; }
    if ((T === 'TERT' || T === 'REGL') && ats <= 2 && rnd() < (T === 'TERT' ? 0.06 : 0.04)) { mode = rnd() < 0.85 ? '7' : '6'; visit = '15'; src = '6'; } // retrieval by air
    else if (T === 'TERT' && rnd() < 0.03) { visit = '15'; src = '6'; mode = '3'; }
    else { const q = rnd(); if (q < 0.06) { visit = '12'; src = rnd() < 0.8 ? '2' : '3'; } else if (q < 0.1) visit = '3'; else if (q < 0.12) { visit = '2'; src = '1'; } else if (q < 0.125) { visit = '4'; src = '5'; } else if (q < 0.135 && metroTier(T)) { visit = '28'; src = '7'; } }
    if (mode === '5') src = '7';
  }

  // triage and the wait for clinical care
  const triage = arr + (ats === 1 ? rnd() * 1.5 : 1 + logn(4, 0.6));
  const tgt = dims.triage[ats - 1].targetMin;
  const load = waitLoad[hour] * (dow === 1 ? 1.12 : 1) * (tierWait[T] || 1) * (metroTier(T) ? busy : 0.8 + 0.4 * busy);
  let wait = ats === 1 ? (rnd() < 0.96 ? rnd() * 2 : 2 + logn(3, 0.6)) : tgt * logn(waitShape[ats - 1][0] * load, waitShape[ats - 1][1]);
  wait = Math.max(triage - arr + 0.5, wait);
  const out = { e, arr, triage, seen: null, nurse: null, ready: null, bed: null, ward: null, admit: null, ssu: null, dep: 0, ats, code, mode, visit, src, status: '2', dest: '8', age };

  // referred at triage to another service (DD p.98 example: such people are triaged '5 Non-urgent')
  if (!virt && ats >= 4 && metroTier(T) && rnd() < 0.03) { out.ats = 5; out.status = '8'; out.dest = '10'; out.dep = triage + 5 + rnd() * 25; return out; }
  // did not wait: patience is a lognormal draw that grows with urgency
  const patience = logn([900, 700, 480, 330, 300][ats - 1], 0.8) * (metroTier(T) ? 1 : 1.4);
  if (ats >= 2 && wait > patience) { out.status = '4'; out.dest = '1'; out.dep = Math.max(arr + patience, triage + 1); return out; }

  out.seen = arr + wait;
  out.nurse = Math.max(triage, out.seen - rnd() * 15);
  const tm = metroTier(T);
  if (virt) { // WA Virtual ED: most care is completed at home, some are sent to a physical ED
    const q = rnd(); out.dep = out.seen + logn(45, 0.6);
    if (q < 0.76) { out.status = '21'; out.dest = '8'; } else if (q < 0.96) { out.status = '22'; out.dest = '7'; } else { out.status = '2'; out.dest = '8'; }
    out.ready = out.dep - rnd() * 5; return out;
  }
  const pAdmit = Math.min(0.95, admitByAts[ats - 1] * admitByAge[band] * (T === 'PAED' ? 0.9 : T === 'POST' ? 0.6 : 1));
  const work = logn(tm ? 165 : 95, 0.55) * (ats <= 2 ? 1.15 : ats >= 4 ? 0.75 : 1); // assessment and treatment time
  if (rnd() < pAdmit) {
    const transfer = T === 'POST' || (T === 'DIST' && rnd() < (ats <= 2 ? 0.6 : 0.25)) || (T === 'REGL' && ats === 1 && rnd() < 0.3);
    out.bed = out.seen + work; out.ready = out.bed + rnd() * 20;
    if (transfer) { out.status = '3'; out.dest = '4'; out.dep = out.ready + logn(T === 'POST' ? 200 : 150, 0.7); return out; }
    const q = rnd();
    if (tm && q < 0.24 && ats >= 2) { out.status = '10'; out.dest = '11'; out.dep = out.ready + logn(25, 0.6); out.ssu = out.dep; }
    else if (q < 0.26 && tm) { out.status = '11'; out.dest = '6'; out.dep = out.ready + logn(60, 0.6); }
    else {
      out.status = '1'; out.dest = grp.key === 'SOC' && rnd() < 0.5 ? '12' : '6';
      const block = tm ? logn(150, 0.95) * (0.8 + 0.5 * busy) : logn(45, 0.8); // waiting for a ward bed
      out.dep = out.ready + block; out.ward = Math.max(out.ready, out.dep - 5 - rnd() * 20);
    }
    out.admit = out.bed + 5 + rnd() * 10; if (out.admit > out.dep) out.admit = out.dep;
    return out;
  }
  // not admitted
  const q = rnd();
  if (ats <= 2 && band >= 3 && q < 0.004) { out.status = '6'; out.dest = '5'; out.dep = out.seen + logn(120, 0.6); return out; }
  if (q < 0.025) { out.status = '5'; out.dest = '2'; out.dep = out.seen + logn(70, 0.7); return out; }
  out.dep = out.seen + work * (0.7 + 0.3 * rnd());
  out.ready = Math.max(out.seen, out.dep - 5 - rnd() * 20); // ready to leave never before clinical care started
  if (band === 4 && rnd() < 0.12) { out.status = '13'; out.dest = '3'; out.dep += logn(60, 0.6); }
  else if (rnd() < 0.003) { out.status = '14'; out.dest = '8'; }
  else if (rnd() < 0.001) { out.status = '9'; out.dest = '9'; }
  return out;
}

// keep people who arrive inside the period; the earlier ones only existed to warm up the first day
const kept = rows.filter((p) => p.arr >= 0 && Math.round(p.arr) < dims.days * 1440).sort((a, b) => a.arr - b.arr);
for (const p of kept) { // very long stays are capped for display; keep every timestamp inside arrival..departure
  p.dep = Math.min(p.dep, p.arr + dims.maxStayMin - 1);
  for (const f of ['seen', 'nurse', 'ready', 'bed', 'ward', 'admit', 'ssu']) if (p[f] != null && p[f] > p.dep) p[f] = p.dep;
}
const esc = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
const lines = [COLS.join(',')];
for (const p of kept) {
  lines.push([p.e.code, String(seq++), fmt(p.arr), fmt(p.triage), fmt(p.seen), fmt(p.nurse), fmt(p.ready), fmt(p.bed), fmt(p.ward), fmt(p.admit), fmt(p.ssu), fmt(p.dep),
    fmtDob(p.arr, p.age), String(p.ats), p.code, p.mode, p.visit, p.src, p.status, p.dest].map(esc).join(','));
}
fs.mkdirSync(path.join(ROOT, 'data/csv'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/csv/ed_episodes.csv'), lines.join('\n') + '\n');
console.log(`Wrote data/csv/ed_episodes.csv: ${kept.length} synthetic attendances at ${new Set(kept.map((p) => p.e.code)).size} sites over ${dims.days} days from ${dims.start} (seed ${SEED})`);
