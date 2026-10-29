#!/usr/bin/env node
// Build data/reference/establishments.json: EXACTLY the establishments with "Reports to EDDC" = Y in the
// WA Health Establishment List, May 2026 (v0.1) - see data/reference/official_eddc_reporting_2026-05.json.
// Official code, name, Est type and MPS flag come from that List. The List has NO Health Service Provider (HSP),
// region or coordinates, so those are joined from SLIP (HEALTH-001 layers 7 Hospitals and 6 Nursing Posts) by code,
// or set by hand below, and are labelled as non-official (hspBasis, locationStatus).
// Run: node tools/build_establishments.mjs   (needs data/reference/raw/ from tools/fetch_reference.mjs)
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../data/reference/', import.meta.url).pathname;
const L7 = JSON.parse(readFileSync(root + 'raw/slip_health_L7_all.json'));
const L6 = JSON.parse(readFileSync(root + 'raw/slip_health_L6_all.json'));
const OFF = JSON.parse(readFileSync(root + 'official_eddc_reporting_2026-05.json'));

const HSP_NAMES = {
  NMHS: 'North Metropolitan Health Service', SMHS: 'South Metropolitan Health Service',
  EMHS: 'East Metropolitan Health Service', CAHS: 'Child and Adolescent Health Service',
  WACHS: 'WA Country Health Service',
};
// Establishment List 2026, Appendix A
const TYPE_LABEL = { AH: 'Acute Hospital', NP: 'Nursing Post', OH: 'Other Health Care Accommodation' };
const SLIP_HS = { 'North Metro': 'NMHS', 'South Metro': 'SMHS', 'East Metro': 'EMHS', WACHS: 'WACHS' };
const clean = (s) => (s ?? '').toString().trim();
const yes = (s) => clean(s) === 'Y';

// SLIP rows by estab_id (layer 7 hospitals, layer 6 nursing posts).
const slip = new Map();
for (const [layer, rows] of [[7, L7], [6, L6]]) for (const r of rows) slip.set(Math.trunc(r.attributes.estab_id), { a: r.attributes, g: r.geometry, layer });

// Official code -> SLIP estab_id where SLIP uses another id.
const SLIP_ID = { 145: 645 };
// Official codes with no SLIP row.
const PLACE = {
  4058: { lat: -30.30541, lon: 115.04405, status: 'osm-similar-name', district: 'Coastal Wheatbelt', region: 'Wheatbelt', note: 'Not in SLIP. OpenStreetMap has "Jurien Bay Health Centre", 23 Whitfield Road, Jurien Bay, but no "Jurien Bay Hospital"; assumed to be the same site (not verified). District and region by point-in-polygon on the SLIP HEALTH-002 boundaries.' },
  123: { lat: -31.9523, lon: 115.8613, status: 'virtual', district: '', region: 'Statewide (virtual)', note: 'WA Virtual Hospital: a virtual service (WA Virtual Emergency Department, WAVED) with no physical emergency department. Not in SLIP. Shown at a placeholder point in the Perth CBD.' },
};
// HSP is NOT in the Establishment List. Default: SLIP "hs_operati" (geographic service). Overrides:
const HSP_OVERRIDE = {
  107: { hsp: 'CAHS', basis: 'crs', note: "Perth Children's Hospital is part of CAHS (SLIP lists it under the North Metro geographic service)." },
  642: { hsp: 'NMHS', basis: 'crs', contracted: true, note: 'Joondalup Health Campus: public services operated by Ramsay Health Care under a public-private arrangement; NMHS catchment.' },
  6007: { hsp: 'EMHS', basis: 'crs', contracted: true, note: 'St John of God Midland Public Hospital: operated by St John of God Health Care under a public-private arrangement; EMHS catchment. Uses Midland webPAS (EDDC Data Dictionary, abbreviations SJOGM).' },
  145: { hsp: 'SMHS', basis: 'crs', note: 'Peel Health Campus returned to public operation (SMHS) on 13 Aug 2024. The Establishment List has Peel under both 0145 and 0645 with Reports to EDDC = Y; SLIP uses 645.' },
  645: { hsp: 'SMHS', basis: 'slip', note: 'Second Peel Health Campus code. In the List 0645 reports to EDDC, MHDC and SANADC only, and is not in the Hospital Morbidity System Codes table. Assumed to be the same physical site as 0145 (not verified).' },
  4058: { hsp: 'WACHS', basis: 'assumed', note: 'HSP not stated in the documents; Jurien Bay is in a WA Country Health Service area; display grouping.' },
  123: { hsp: 'WACHS', basis: 'agreement', note: 'WAVED is described in the WACHS 2025-26 Service Agreement (s 3.1.1), with its functions performed by the Department CEO through the State Health Operations Centre (SHOC) during a transfer period. Shown under WACHS as a display grouping only.' },
};
const SHORT = {
  101: 'RPH', 104: 'KEMH', 105: 'SCGH', 106: 'FSH', 107: 'PCH', 203: 'Armadale', 277: 'Rockingham', 642: 'Joondalup', 145: 'Peel', 645: 'Peel (0645)',
  6007: 'SJOG Midland', 131: 'Hedland', 132: 'Karratha', 201: 'Albany', 208: 'Bunbury', 226: 'Kalgoorlie', 220: 'Geraldton', 206: 'Broome', 257: 'Kununurra',
  438: 'Wyalkatchem', 123: 'WAVED', 426: 'North Midlands', 432: 'Boyup Brook', 4058: 'Jurien Bay', 238: 'Onslow',
};
const shortName = (code, name) => SHORT[code] || name
  .replace(/ (Memorial |Soldiers Memorial |and District )?(Hospital|Health Campus|Health Service|Health Centre|Nursing Post)$/i, '').replace(/ Memorial$/i, '').replace(/ Hospital$/i, '').trim();
const dist = (la1, lo1, la2, lo2) => { const r = Math.PI / 180, x = (lo2 - lo1) * r * Math.cos((la1 + la2) * r / 2), y = (la2 - la1) * r; return Math.hypot(x, y); };
const slipList = [...slip.values()];
const nearest = (lat, lon) => slipList.map((s) => ({ s, d: dist(lat, lon, s.a.latitude ?? s.g.y, s.a.longitude ?? s.g.x) })).sort((p, q) => p.d - q.d)[0].s;

const out = [];
for (const o of OFF.establishments) {
  const code = +o.code;
  const sid = SLIP_ID[code] ?? code;
  const hit = slip.get(sid);
  const place = PLACE[code];
  let lat, lon, status, locNote = null, base = hit;
  if (hit) {
    lat = hit.a.latitude ?? hit.g.y; lon = hit.a.longitude ?? hit.g.x;
    status = SLIP_ID[code] ? 'slip-other-id' : 'slip';
    if (SLIP_ID[code]) locNote = `SLIP lists this site as estab_id ${sid} "${clean(hit.a.establishm)}".`;
  } else {
    if (!place) throw new Error('No SLIP row and no PLACE entry for ' + o.code + ' ' + o.name);
    lat = place.lat; lon = place.lon; status = place.status; locNote = place.note; base = nearest(lat, lon);
  }
  const a = base.a;
  const ov = HSP_OVERRIDE[code];
  const hsp = ov ? ov.hsp : SLIP_HS[clean(a.hs_operati)] || null;
  out.push({
    code: o.code, name: o.name, type: o.type, typeLabel: o.type ? TYPE_LABEL[o.type] : null, mps: o.mps, pdfPage: o.pdfPage, alsoReports: o.alsoReports,
    short: shortName(code, o.name),
    kind: code === 123 ? 'virtual' : o.type === 'AH' ? 'hospital' : o.type === 'NP' ? 'nursing_post' : code === 645 ? 'alias' : 'other',
    slipName: hit ? clean(a.establishm) : null, slipEstabId: hit ? sid : null,
    ownership: hit ? clean(a.est) : null, category: hit ? clean(a.esy) : null, area: code === 123 ? 'Virtual' : clean(a.esa), beds: hit ? Math.trunc(a.no_of_beds || 0) : 0,
    lat: +(+lat).toFixed(5), lon: +(+lon).toFixed(5), locationStatus: status, locationNote: locNote,
    suburb: hit ? clean(a.suburb) : null,
    district: place && place.district != null ? place.district : clean(a.hd_operati), region: place && place.region ? place.region : clean(a.hr_operati), slipService: hit ? clean(a.hs_operati) : null,
    hsp, hspBasis: ov ? ov.basis : 'slip', contracted: !!(ov && ov.contracted), hspNote: ov ? ov.note : null,
    slipEdFlag: hit ? yes(a.ed_reporti) : null,
    slipLayer: hit ? hit.layer : null,
  });
}
out.sort((a, b) => a.code.localeCompare(b.code));
if (new Set(out.map((e) => e.code)).size !== out.length) throw new Error('duplicate codes');
if (out.length !== OFF.count) throw new Error('count mismatch');
for (const e of out) if (!e.hsp || !e.region) throw new Error('no hsp/region ' + e.code);
// Cross-check: SLIP's own "ed_reporti" flag against the official List (reported in docs/ESTABLISHMENTS.md).
const official = new Set(out.map((e) => +e.code));
const slipEdOnly = slipList.filter((s) => yes(s.a.ed_reporti) && !official.has(Math.trunc(s.a.estab_id)) && Math.trunc(s.a.estab_id) !== 645)
  .map((s) => ({ estabId: Math.trunc(s.a.estab_id), name: clean(s.a.establishm) }));
const byHsp = {};
for (const e of out) byHsp[e.hsp] = (byHsp[e.hsp] || 0) + 1;
const doc = {
  _about: 'The 84 establishment codes with "Reports to EDDC" = Y in the WA Health Establishment List, May 2026 v0.1 (official code, name, Est type, MPS). HSP, region, district, beds and coordinates are NOT in that List: they are joined from SLIP / OpenStreetMap and labelled by hspBasis and locationStatus. See docs/ESTABLISHMENTS.md.',
  _attribution: '© Government of Western Australia, Department of Health (Establishment List, May 2026; SLIP / data.wa.gov.au HEALTH-001). OpenStreetMap contributors (ODbL) for the coordinate marked osm-similar-name.',
  _retrieved: '2026-10-29', hspNames: HSP_NAMES, count: out.length, byHsp,
  slipCrossCheck: { slipEdFlagY: slipList.filter((s) => yes(s.a.ed_reporti)).length, inSlipNotInList: slipEdOnly, inListNotSlipEd: out.filter((e) => !e.slipEdFlag && e.code !== '0645').map((e) => e.code) },
  establishments: out,
};
writeFileSync(root + 'establishments.json', JSON.stringify(doc, null, 0));
console.log(out.length, byHsp);
console.log('location', out.reduce((m, e) => (m[e.locationStatus] = (m[e.locationStatus] || 0) + 1, m), {}));
console.log('hsp basis', out.reduce((m, e) => (m[e.hspBasis] = (m[e.hspBasis] || 0) + 1, m), {}));
console.log('SLIP cross-check', JSON.stringify(doc.slipCrossCheck));
console.log('long short names', out.filter((e) => e.short.length > 13).map((e) => e.short));
