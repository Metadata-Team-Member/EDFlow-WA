#!/usr/bin/env node
/**
 * Checks tools/build_data.mjs --real against a small FAKE extract in the EDDC Data Dictionary 2026 column format.
 * The fake CSV (with a BOM and CRLF line ends on purpose) goes to the OS temp folder; the output goes to
 * data/real_test.json (git-ignored by data/real*.json). Run: npm run test:real. Open index.html?data=real_test.json to look at it.
 * Nothing here is real data.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edw-real-'));
const estab = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/reference/establishments.json'), 'utf8')).establishments;
const METRO = estab.find((e) => e.hsp === 'SMHS' && e.kind === 'hospital').code; // a metropolitan ED
const WACHS = estab.find((e) => e.hsp === 'WACHS' && e.kind === 'hospital').code; // a country ED (DD p.66 names nurse_seen for WACHS)
const H = ['est_code', 'sequence_number', 'arrival_datetime', 'triage_datetime', 'doctor_seen_datetime', 'nurse_seen', 'departure_ready_datetime',
  'discharge_datetime', 'date_of_birth', 'triage_category', 'presenting_complaint', 'mode_of_arrival', 'visit_type', 'referral_source', 'departure_status', 'destination_on_departure'];
const rows = [
  // est, seq, arrival, triage, doctor seen, nurse seen, departure ready, discharge, dob, ATS, complaint, mode, visit, referral, departure, destination
  [METRO, 1, '2026-06-01 10:00:00', '2026-06-01 10:05:00', '2026-06-01 10:30:00', '2026-06-01 10:20:00', '2026-06-01 13:00:00', '2026-06-01 13:20:00', '1960-01-01', '3', 'BEA00', '1', '1', '7', '2', '8'],
  [WACHS, 2, '2026-06-01 11:00:00', '2026-06-01 11:04:00', '2026-06-01 12:00:00', '2026-06-01 11:20:00', '', '2026-06-01 13:00:00', '2001-05-05', '4', 'K0000', '9', '1', '7', '2', '8'], // nurse seen earlier: s = 20
  [METRO.replace(/^0+/, ''), 3, '2026-06-02 09:00:00', '2026-06-02 09:02:00', '2026-06-02 09:10:00', '', '', '2026-06-02 11:00:00', '1990-01-01', '2', 'T0000', '1', '1', '7', '1', '3'], // code without leading zeros
  ['9999', 4, '2026-06-02 09:00:00', '', '', '', '', '2026-06-02 10:00:00', '', '3', 'BEA00', '1', '1', '7', '2', '8'], // unknown establishment
  [METRO, 5, 'not-a-date', '', '', '', '', '2026-06-02 10:00:00', '', '3', 'BEA00', '1', '1', '7', '2', '8'], // unreadable arrival
  [METRO, 6, '2026-06-03 09:00:00', '2026-06-03 09:00:00', '', '', '', '2026-06-03 09:10:00', '', '6', 'BEA00', '1', '1', '7', '7', '5'], // ATS 6 dead on arrival: not an ED wait
  [METRO, 7, '2026-06-03 09:00:00', '', '', '', '', '2026-06-03 08:00:00', '', '3', 'BEA00', '1', '1', '7', '2', '8'], // discharge before arrival
  [METRO, 8, '2026-06-04 09:00:00', '2026-06-04 09:05:00', '2026-06-04 09:40:00', '', '', '2026-06-04 12:00:00', '', '5', 'ZQ123', '1', '1', '7', '2', '8'], // unmapped complaint code
  [METRO, 9, '2026-06-05 09:00:00', '2026-06-05 09:05:00', '', '', '', '2026-06-05 10:00:00', '', '4', 'BEA00', 'X9', '1', '7', '4', '1'], // new mode code, did not wait (no seen)
  [WACHS, 10, '06/06/2026 09:00', '06/06/2026 09:03', '06/06/2026 09:30', '', '', '06/06/2026 10:30', '', '3', 'BEA00', '1', '1', '7', '2', '8'], // DD/MM/YYYY datetimes
  [METRO, 11, '2026-06-07 09:00:00', '2026-06-07 09:01:00', '2026-06-07 09:20:00', '', '2026-06-07 20:00:00', '2026-06-09 10:00:00', '', '2', 'BEA00', '1', '1', '7', '11', '2'], // 49 h stay: capped for display
  [METRO, 12, '2026-06-10 09:00:00', '2026-06-10 09:01:00', '2026-06-10 09:20:00', '', '', '2026-06-10 10:00:00', '', '3', 'BEA00', '1', '1', '7', '2', '8'], // sets the end of the period
];
const csv = (h, rs) => '\uFEFF' + [h, ...rs].map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(',')).join('\r\n') + '\r\n'; // BOM + CRLF on purpose
fs.writeFileSync(path.join(dir, 'ed.csv'), csv(H, rows));

const out = path.join(ROOT, 'data/real_test.json');
const run = (extra, o = out) => execFileSync('node', [path.join(ROOT, 'tools/build_data.mjs'), '--in', path.join(dir, 'ed.csv'), '--out', o, '--real', ...extra], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

const log = run([]);
const j = JSON.parse(fs.readFileSync(out, 'utf8'));
const E = j.dims.establishments, siteOf = (code) => E.findIndex((e) => e.code === code);
// decode the columns like js/data.js
let t = 0; const recs = j.cols.a.map((a, i) => { t += a; const k = j.cols.k[i]; return { arr: t, s: j.cols.s[i], d: j.cols.d[i], site: k & 127, ats: ((k >> 7) & 7) + 1, grp: (k >> 10) & 15, mode: (k >> 14) & 15 }; });
ok(j.meta.synthetic === false && /Real extract/.test(j.meta.banner), 'banner and synthetic flag for --real');
ok(recs.length === 8, `8 usable attendances (rows 1, 2, 3, 8, 9, 10, 11, 12); got ${recs.length}`);
ok(j.meta.start === '2026-06-01' && j.meta.days === 10, `period taken from the data (got ${j.meta.start} + ${j.meta.days} days)`);
ok(/9999/.test(log), 'unknown establishment is reported');
ok(/unreadable arrival_datetime/.test(log), 'unreadable arrival is reported');
ok(/triage_category outside 1-5/.test(log) && /"6"/.test(log), 'ATS 6 (dead on arrival) is reported and left out');
ok(/discharge before arrival/.test(log), 'discharge before arrival is reported');
ok(/capped/.test(log) && recs.some((r) => r.d === j.meta.maxStayMin - 1), 'a stay over the display cap is capped and reported');
ok(/by first letter: "Z"/.test(log) && recs.some((r) => j.dims.complaintGroups[r.grp].key === 'OTH'), "unmapped complaint ZQ123 goes to 'Other / not yet mapped' and is reported");
ok(j.dims.modes.some((m) => m.code === 'X9' && m.auto), 'new mode code X9 is auto-added');
const wachs = recs.find((r) => r.site === siteOf(WACHS) && r.ats === 4);
ok(wachs && wachs.s === 20, `WACHS: care commenced = earlier of doctor seen and nurse seen (expect 20 min, got ${wachs && wachs.s})`);
const metro = recs.find((r) => r.site === siteOf(METRO) && r.ats === 3 && r.arr === 600);
ok(metro && metro.s === 20, `metro: care commenced = earlier of doctor and nurse seen (expect 20 min, got ${metro && metro.s})`);
ok(recs.filter((r) => r.site === siteOf(METRO)).length === 6, 'establishment code without leading zeros is matched (6 metro rows)');
ok(recs.some((r) => r.site === siteOf(WACHS) && r.arr === 5 * 1440 + 540), 'DD/MM/YYYY datetimes are read');
const xi = j.dims.modes.findIndex((m) => m.code === 'X9');
ok(recs.some((r) => r.mode === xi && r.s === -1), 'did-not-wait row (no doctor or nurse seen) keeps s = -1');
// --real must never overwrite the synthetic file
let refused = '';
try { run([], path.join(ROOT, 'data/synthetic.json')); } catch (e) { refused = String(e.stderr || e.message); }
ok(/must not overwrite data\/synthetic.json/.test(refused), '--real refuses to write data/synthetic.json');
fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
