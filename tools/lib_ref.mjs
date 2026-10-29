// Shared loader for the establishment reference data, used by the generator and the data builder.
import fs from 'node:fs';
import path from 'node:path';

/**
 * Model tier of an establishment. NOT official: it only sets the synthetic volume and case mix.
 * The official establishment type from the Establishment List (Appendix A) is kept separately in e.type.
 *   TERT teaching hospital (SLIP category "Teaching") · PAED Perth Children's · WOMN King Edward Memorial (women's)
 *   METR other metropolitan hospital · REGL regional hospital · DIST district hospital or MPS
 *   POST nursing post · VIRT WA Virtual Emergency Department · ALIAS a second code assumed to be the same site (no activity)
 */
export function tierOf(e) {
  if (e.code === '0123') return 'VIRT';
  if (e.code === '0645') return 'ALIAS'; // Peel 0645: not in the List's HMS table, type blank; assumed the same ED as 0145 (open question)
  if (e.code === '0107') return 'PAED';
  if (e.code === '0104') return 'WOMN';
  if (e.kind === 'nursing_post' || e.type === 'NP') return 'POST';
  if (e.category === 'Teaching') return 'TERT';
  if (e.area === 'Metro') return 'METR';
  if (e.category === 'Regional') return 'REGL';
  return 'DIST';
}

export const METRO_REGIONS = ['North Metro', 'East Metro', 'South Metro'];

export function loadEstablishments(root, dims) {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/establishments.json'), 'utf8'));
  const hspIndex = Object.keys(j.hspNames);
  const regionIdx = Object.fromEntries(dims.regionOrder.map((r, i) => [r, i]));
  const order = { TERT: 0, PAED: 1, WOMN: 2, METR: 3, REGL: 4, DIST: 5, POST: 6, VIRT: 7, ALIAS: 8 };
  const est = j.establishments
    .map((e) => ({ ...e, tier: tierOf(e), hspI: hspIndex.indexOf(e.hsp), regionI: regionIdx[e.region] }))
    .sort((a, b) => hspIndex.indexOf(a.hsp) - hspIndex.indexOf(b.hsp) || order[a.tier] - order[b.tier] || b.beds - a.beds || a.code.localeCompare(b.code));
  for (const e of est) if (e.regionI === undefined) throw new Error('Region "' + e.region + '" of ' + e.code + ' is not in config regionOrder');
  return { est, hspIndex, hspNames: j.hspNames, raw: j };
}
