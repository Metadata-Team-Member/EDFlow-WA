// Fetch the open reference data used for the establishment list and the map.
// Source: Government of Western Australia, Department of Health, via SLIP (Landgate) public MapServer
// https://public-services.slip.wa.gov.au/public/rest/services/SLIP_Public_Services/Health/MapServer
// Layers: 7 Hospitals, 6 Nursing Posts (HEALTH-001), 2 Health Districts (HEALTH-002).
// Output goes to data/reference/raw/ (git-ignored). Then run: python tools/build_geo.py ; node tools/build_establishments.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = 'https://public-services.slip.wa.gov.au/public/rest/services/SLIP_Public_Services/Health/MapServer';
const out = new URL('../data/reference/raw/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
async function q(layer, extra = '') {
  const url = `${BASE}/${layer}/query?where=1%3D1&outFields=*&outSR=4326&f=json${extra}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${layer}: HTTP ${r.status}`);
  return r.json();
}
for (const [layer, file] of [[7, 'slip_health_L7_all.json'], [6, 'slip_health_L6_all.json']]) {
  const j = await q(layer, '&returnGeometry=true');
  writeFileSync(out + file, JSON.stringify(j.features));
  console.log(file, j.features.length);
}
// Districts as GeoJSON (already generalised server-side to ~200 m) - simplified further by build_geo.py
const g = await (await fetch(`${BASE}/2/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&maxAllowableOffset=0.002`)).json();
writeFileSync(out + 'slip_health_poly2.geojson', JSON.stringify(g));
console.log('districts', g.features.length);
