#!/usr/bin/env python3
"""Build the simplified WA health-region / district geometry used by the map.

Input  : raw SLIP "Health Districts (HEALTH-002)" polygons (fetched by tools/fetch_reference.mjs
         into data/reference/raw/, git-ignored).
Output : data/reference/wa_regions.geojson   (10 Health Regions + 34 Districts, state scale)
         data/reference/perth_metro.geojson   (metro districts, at a more detailed scale, for the inset)

Districts are simplified together with shapely.coverage_simplify so shared borders stay shared,
then dissolved into regions, so the hierarchy has no gaps or slivers.
Needs shapely >= 2.1 (coverage_simplify).
"""
import json, sys, os
from shapely.geometry import shape, mapping, MultiPolygon, Polygon
from shapely.ops import unary_union
import shapely
from shapely import coverage_simplify

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'reference', 'raw')
OUT = os.path.join(ROOT, 'data', 'reference')
METRO = {'East Metro', 'North Metro', 'South Metro'}

def load(name):
    return json.load(open(os.path.join(RAW, name)))['features']

def polys(g):
    return list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]

def clean(g, min_area):
    keep = [p for p in polys(g) if p.area >= min_area]
    if not keep:
        keep = [max(polys(g), key=lambda p: p.area)]
    return MultiPolygon(keep) if len(keep) > 1 else keep[0]

def rnd(g, nd):
    return shapely.set_precision(g, 10 ** -nd) if False else g

def coords(geom, nd):
    def r(c):
        return [round(c[0], nd), round(c[1], nd)]
    out = []
    for p in polys(geom):
        out.append([[r(c) for c in p.exterior.coords]] + [[r(c) for c in i.coords] for i in p.interiors])
    return {'type': 'MultiPolygon', 'coordinates': out}

def build(feats, tol, min_area, nd, only=None):
    items = []
    for f in feats:
        g = shape(f['geometry']).buffer(0)
        items.append((f['properties'], g))
    if only:
        items = [(p, g) for p, g in items if p['hr'] in only]
    geoms = shapely.GeometryCollection([g for _, g in items])
    simp = coverage_simplify([g for _, g in items], tol)
    res = []
    for (p, _), g in zip(items, simp):
        g = clean(g, min_area)
        res.append((p, g))
    return res

def feature(props, g, nd):
    return {'type': 'Feature', 'properties': props, 'geometry': coords(g, nd)}

def main():
    dist = load('slip_health_poly2.geojson')
    # --- state scale ---
    st = build(dist, tol=0.02, min_area=0.0004, nd=3)
    regions = {}
    for p, g in st:
        regions.setdefault(p['hr'], []).append((p, g))
    feats = []
    for hr, lst in regions.items():
        u = unary_union([g for _, g in lst])
        u = clean(u, 0.0004)
        rp = max(polys(u), key=lambda q: q.area).representative_point()
        feats.append(feature({'level': 'region', 'name': hr, 'hsp_op': lst[0][0]['hs'],
                              'hr_id': lst[0][0]['hr_id'], 'cx': round(rp.x, 3), 'cy': round(rp.y, 3)}, u, 3))
    for p, g in st:
        feats.append(feature({'level': 'district', 'name': p['hd'], 'region': p['hr'], 'hsp_op': p['hs'],
                              'hd_id': p['hd_id'], 'health_code': p['health_code']}, g, 3))
    fc = {'type': 'FeatureCollection', 'name': 'wa_health_regions_simplified',
          'attribution': '© Government of Western Australia, Department of Health (HEALTH-002 Health Districts, via SLIP / data.wa.gov.au). Simplified for display; not for analysis.',
          'features': feats}
    json.dump(fc, open(os.path.join(OUT, 'wa_regions.geojson'), 'w'), separators=(',', ':'))
    print('wa_regions', os.path.getsize(os.path.join(OUT, 'wa_regions.geojson')) // 1024, 'KB')
    # --- Perth metro inset ---
    me = build(dist, tol=0.0012, min_area=0.00002, nd=4, only=METRO)
    feats = []
    for p, g in me:
        # crop to the populated metro box so the inset is not dominated by far-flung rural parts
        box = Polygon([(115.55, -32.75), (116.55, -32.75), (116.55, -31.35), (115.55, -31.35)])
        c = g.intersection(box)
        if c.is_empty:
            continue
        c = clean(c, 0.00002)
        feats.append(feature({'level': 'district', 'name': p['hd'], 'region': p['hr'], 'health_code': p['health_code']}, c, 4))
    fc = {'type': 'FeatureCollection', 'name': 'perth_metro_districts_simplified',
          'attribution': '© Government of Western Australia, Department of Health (HEALTH-002 Health Districts, via SLIP / data.wa.gov.au). Simplified for display; clipped to a display box.',
          'features': feats}
    json.dump(fc, open(os.path.join(OUT, 'perth_metro.geojson'), 'w'), separators=(',', ':'))
    print('perth_metro', os.path.getsize(os.path.join(OUT, 'perth_metro.geojson')) // 1024, 'KB', len(feats))

main()
