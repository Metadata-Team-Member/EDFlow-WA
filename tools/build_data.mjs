#!/usr/bin/env node
/**
 * Builds the compact file the website loads (data/synthetic.json) from a CSV extract whose columns use the
 * EDDC Data Dictionary 2026 field names (see docs/DATA-DICTIONARY-MAPPING.md). Header names are matched case-insensitively.
 *
 *   node tools/build_data.mjs                                    # reads data/csv/ed_episodes.csv (synthetic)
 *   node tools/build_data.mjs --in my_extract.csv --out data/real.json --real [--start 2026-06-01 --days 28 --sim-start 2026-06-08T08:00]
 *
 * --real never overwrites data/synthetic.json. Datetimes are 'YYYY-MM-DD HH:MM:SS' (Specification 2026); 'DD/MM/YYYY HH:MM[:SS]' is also read.
 * Rows that cannot be used are counted and listed at the end, never dropped silently. Codes not in config/dimensions.json are
 * added with their code as the label (auto:true).
 *
 * Output columns, one value per attendance, sorted by arrival:
 *   a  minutes since the previous arrival (the first is minutes since the period start)
 *   t  triage datetime - arrival (min)          s  clinical care commenced - arrival, -1 if none (the earlier of
 *                                                  doctor_seen_datetime and nurse_seen; OBM KPI manual 2025-26, DD pp.30, 66)
 *   r  departure ready - arrival, -1 if none    d  discharge_datetime - arrival (length of stay in the ED)
 *   p  index into dims.complaintCodes
 *   k  site | (triage-1)<<7 | complaintGroup<<10 | mode<<14 | visitType<<18 | departureStatus<<23 | ageGroup<<28  (indexes into the dims lists)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEstablishments } from './lib_ref.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = {};
{ const a = process.argv.slice(2); for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); if (k === 'real') args.real = true; else { if (a[i + 1] === undefined || a[i + 1].startsWith('--')) die('Missing value for --' + k); args[k] = a[++i]; } } }
function die(msg) { console.error('build_data: ' + msg); process.exit(1); }
const dims = JSON.parse(fs.readFileSync(path.resolve(ROOT, args.dims || 'config/dimensions.json'), 'utf8'));
const inFile = path.resolve(args.in || path.join(ROOT, 'data/csv/ed_episodes.csv'));
const outFile = path.resolve(args.out || path.join(ROOT, 'data/synthetic.json'));
const isReal = !!args.real;
if (isReal && path.basename(outFile) === 'synthetic.json') die('--real must not overwrite data/synthetic.json; use --out data/real.json (git-ignored)');
if (!fs.existsSync(inFile)) die('File not found: ' + inFile);
const { est, hspNames, raw } = loadEstablishments(ROOT, dims);

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
const rows = parseCsv(fs.readFileSync(inFile, 'utf8'));
if (!rows.length) die('No rows in ' + inFile);
const REQUIRED = ['est_code', 'arrival_datetime', 'discharge_datetime', 'triage_category', 'departure_status'];
{ const have = new Set(Object.keys(rows[0])); const miss = REQUIRED.filter((c) => !have.has(c)); if (miss.length) die('Missing column(s): ' + miss.join(', ')); }

// datetimes are read as wall-clock WA time (no daylight saving) and kept as minutes
const parseDt = (s) => {
  let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) / 60000;
  if ((m = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)) / 60000;
  return NaN;
};
const parseDob = (s) => { let m; if ((m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1]); if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]); return NaN; };

let startMin;
if (args.start) startMin = Date.parse(args.start + 'T00:00:00Z') / 60000;
else if (isReal) { const ts = rows.map((r) => parseDt(r.arrival_datetime)).filter(Number.isFinite); if (!ts.length) die('No readable arrival_datetime'); const d = new Date(Math.min(...ts) * 60000); startMin = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 60000; }
else startMin = Date.parse(dims.start + 'T00:00:00Z') / 60000;
if (!Number.isFinite(startMin)) die('Bad --start (use YYYY-MM-DD)');
let days = args.days ? +args.days : dims.days;
if (isReal && !args.days) { const ts = rows.map((r) => parseDt(r.arrival_datetime)).filter(Number.isFinite); days = Math.min(92, Math.ceil((Math.max(...ts) - startMin + 1) / 1440)); }
if (!(days >= 8 && days <= 92)) die('Period must be 8 to 92 days (got ' + days + '); the site holds every attendance in memory.');
const startIso = new Date(startMin * 60000).toISOString().slice(0, 10);
let simStart = args['sim-start'] || (isReal ? new Date((startMin + 7 * 1440 + 8 * 60) * 60000).toISOString().slice(0, 16) : dims.simStart);

const autoAdded = [];
const idx = (list, name, limit) => { const m = new Map(list.map((x, i) => [x.code, i])); return (code) => { if (!m.has(code)) { if (list.length >= limit) die('More than ' + limit + ' distinct ' + name + ' codes (cannot encode ' + code + ')'); list.push({ code, label: code, auto: true }); m.set(code, list.length - 1); autoAdded.push(name + ' ' + code); } return m.get(code); }; };
const iMode = idx(dims.modes, 'mode_of_arrival', 16), iVisit = idx(dims.visitTypes, 'visit_type', 32), iDep = idx(dims.departure, 'departure_status', 32), iDest = idx(dims.destinations, 'destination_on_departure', 64), iRef = idx(dims.referralSources, 'referral_source', 64);
for (const d of dims.departure) { d.group ||= 'other'; d.gate ||= 'home'; }
const iSite = new Map(est.map((e, i) => [e.code, i]));
// presenting complaint -> group: an exact code listed in config, else the heading letter of a confirmed group, else 'Other / not yet mapped'
const OTH = dims.complaintGroups.findIndex((g) => g.key === 'OTH');
const exact = new Map(); dims.complaintGroups.forEach((g, gi) => g.codes.forEach((c) => exact.set(c, gi)));
const byPrefix = new Map(); dims.complaintGroups.forEach((g, gi) => { if (g.prefix) byPrefix.set(g.prefix, gi); });
const groupOf = (c) => exact.get(c) ?? byPrefix.get(c[0]) ?? OTH;
const pcCodes = [], pcIndex = new Map(), unmappedLetters = new Map();
const iPc = (c) => { if (!pcIndex.has(c)) { pcIndex.set(c, pcCodes.length); pcCodes.push({ code: c, group: groupOf(c) }); } return pcIndex.get(c); };
const ageIdx = (a) => (!Number.isFinite(a) ? 2 : a < 15 ? 0 : a < 35 ? 1 : a < 65 ? 2 : a < 85 ? 3 : 4);

const skip = { badArrival: 0, badDischarge: 0, outside: 0, notEd: new Map(), unknownSite: new Map(), negative: 0, capped: 0, fixedOrder: 0 };
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const list = [];
const endMin = startMin + days * 1440;
for (const r of rows) {
  const arr = parseDt(r.arrival_datetime);
  if (!Number.isFinite(arr)) { skip.badArrival++; continue; }
  if (arr < startMin || arr >= endMin) { skip.outside++; continue; }
  const site = r.est_code.padStart(4, '0');
  if (!iSite.has(site)) { bump(skip.unknownSite, r.est_code); continue; }
  const ats = +r.triage_category;
  if (!(ats >= 1 && ats <= 5)) { bump(skip.notEd, r.triage_category || '(blank)'); continue; } // 6 dead on arrival, 7 direct admission, 8 inpatient
  let dep = parseDt(r.discharge_datetime);
  if (!Number.isFinite(dep)) { skip.badDischarge++; continue; }
  if (dep < arr) { skip.negative++; continue; }
  if (dep - arr >= dims.maxStayMin) { dep = arr + dims.maxStayMin - 1; skip.capped++; }
  const off = (v) => { const t = parseDt(v || ''); if (!Number.isFinite(t)) return -1; const o = Math.round(t - arr); if (o < 0 || o > dep - arr) { skip.fixedOrder++; return Math.max(0, Math.min(o, dep - arr)); } return o; };
  let tri = off(r.triage_datetime); if (tri < 0) tri = 0;
  // Commencement of clinical care = the earlier of doctor_seen_datetime and nurse_seen. This is the rule in the WA Health
  // 2025-26 OBM KPI Data Definition Manual (7.1.0, "seen within recommended times"). DD 2026 p.30 says Doctor Seen covers
  // any authorised clinician, and DD p.66 says Nurse Seen is used for this at WACHS sites (open question 6).
  // If an extract has no doctor_seen_datetime, derive it as DD p.30 does: the earlier of treat_doc_date and snr_doc_date.
  const earliest = (...v) => v.filter((x) => x >= 0).reduce((m, x) => (m < 0 || x < m ? x : m), -1);
  let seen = r.doctor_seen_datetime ? off(r.doctor_seen_datetime) : earliest(off(r.treat_doc_date || ''), off(r.snr_doc_date || ''));
  const ready = off(r.departure_ready_datetime);
  { const nu = off(r.nurse_seen); if (nu >= 0 && (seen < 0 || nu < seen)) seen = nu; }
  const pc = (r.presenting_complaint || '').toUpperCase() || 'BLANK';
  const pi = iPc(pc); if (pcCodes[pi].group === OTH && !exact.has(pc)) bump(unmappedLetters, pc[0]);
  const dob = parseDob(r.date_of_birth || ''); const age = (arr * 60000 - dob) / (365.25 * 864e5);
  const k = iSite.get(site) | ((ats - 1) << 7) | (pcCodes[pi].group << 10) | (iMode(r.mode_of_arrival || '9') << 14) | (iVisit(r.visit_type || '1') << 18) | (iDep(r.departure_status) << 23) | (ageIdx(age) << 28);
  iRef(r.referral_source || '7'); iDest(r.destination_on_departure || '9');
  list.push({ arr: Math.round(arr - startMin), tri, seen, ready, los: Math.round(dep - arr), k, pi, ref: r.referral_source || '7', dest: r.destination_on_departure || '9' });
}
if (!list.length) die('No usable attendances. Check est_code (4 digits, see docs/ESTABLISHMENTS.md) and the period.');
list.sort((a, b) => a.arr - b.arr);
const cols = { a: [], t: [], s: [], r: [], d: [], p: [], k: [], f: [], x: [] };
let prev = 0;
for (const e of list) {
  cols.a.push(e.arr - prev); prev = e.arr; cols.t.push(e.tri); cols.s.push(e.seen); cols.r.push(e.ready); cols.d.push(e.los); cols.p.push(e.pi); cols.k.push(e.k);
  cols.f.push(iRef(e.ref)); cols.x.push(iDest(e.dest));
}
const out = {
  meta: {
    synthetic: !isReal,
    banner: isReal ? 'Real extract (approved use only)' : 'SYNTHETIC EXAMPLE DATA · not real WA Health data',
    generatedBy: 'tools/build_data.mjs', attendances: list.length, start: startIso, days, simStart, maxStayMin: dims.maxStayMin,
    encoding: 'k = site | (triage-1)<<7 | complaintGroup<<10 | mode<<14 | visitType<<18 | departureStatus<<23 | ageGroup<<28; a = minutes since previous arrival; t,s,r,d = minutes after arrival (-1 = none); p = complaint code; f = referral source; x = destination',
  },
  dims: {
    hsps: Object.entries(hspNames).map(([code, name]) => ({ code, name })),
    regions: dims.regionOrder.map((name) => ({ name, hsp: dims.regionHsp[name] || 'WACHS' })),
    establishments: est.map((e) => ({ code: e.code, short: e.short, name: e.name, hsp: e.hspI, region: e.regionI, district: e.district, kind: e.kind, type: e.type, typeLabel: e.typeLabel, tier: e.tier, beds: e.beds, lat: e.lat, lon: e.lon, category: e.category, area: e.area, hspBasis: e.hspBasis, locationStatus: e.locationStatus, locationNote: e.locationNote })),
    triage: dims.triage, triageSources: dims.triageSources, accessTargets: dims.accessTargets,
    modes: dims.modes, modeGroups: dims.modeGroups, visitTypes: dims.visitTypes, referralSources: dims.referralSources,
    departure: dims.departure, departureGroups: dims.departureGroups, destinations: dims.destinations,
    complaintGroups: dims.complaintGroups.map(({ key, label, confirmed, hue, prefix, basis }) => ({ key, label, confirmed, hue, prefix, basis })), complaintCodes: pcCodes,
    treatmentAreas: dims.treatmentAreas, ageGroups: dims.ageGroups, attribution: raw._attribution,
  },
  cols,
};
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`Wrote ${path.relative(ROOT, outFile)}: ${list.length} attendances, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB; period ${startIso} + ${days} days, simulation starts ${simStart}`);
const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${JSON.stringify(k)} x${v}`).join(', ');
const notes = [];
if (skip.badArrival) notes.push(`${skip.badArrival} row(s) skipped: unreadable arrival_datetime`);
if (skip.outside) notes.push(`${skip.outside} row(s) skipped: arrival outside the period (use --start / --days)`);
if (skip.unknownSite.size) notes.push(`rows skipped for est_code not in data/reference/establishments.json: ${top(skip.unknownSite)}`);
if (skip.notEd.size) notes.push(`rows skipped for triage_category outside 1-5 (6 dead on arrival, 7 direct admission, 8 inpatient are not ED waits): ${top(skip.notEd)}`);
if (skip.badDischarge) notes.push(`${skip.badDischarge} row(s) skipped: unreadable discharge_datetime`);
if (skip.negative) notes.push(`${skip.negative} row(s) skipped: discharge before arrival`);
if (skip.capped) notes.push(`${skip.capped} stay(s) longer than ${dims.maxStayMin / 60} h were capped for display`);
if (skip.fixedOrder) notes.push(`${skip.fixedOrder} timestamp(s) outside arrival..discharge were clamped`);
if (unmappedLetters.size) notes.push(`presenting complaint codes shown as 'Other / not yet mapped', by first letter: ${top(unmappedLetters)}`);
if (autoAdded.length) notes.push(`codes not in config/dimensions.json were added with their code as the label (auto:true): ${[...new Set(autoAdded)].join(', ')}`);
if (notes.length) console.log('Notes:\n  - ' + notes.join('\n  - '));
