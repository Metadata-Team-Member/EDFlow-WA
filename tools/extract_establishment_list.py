#!/usr/bin/env python3
"""Extract the establishments with "Reports to EDDC" = Y from the WA Health Establishment List (May 2026, v0.1).

The PDF itself is NOT committed (it was supplied to the project by its user). Run:

    python3 tools/extract_establishment_list.py path/to/Establishment-List-May-2026.pdf

Output: data/reference/official_eddc_reporting_2026-05.json

Two independent reads of the "Reports to ..." table are made and must agree, otherwise the script stops:
  1. `pdftotext -layout`: each "Y" is assigned to the column whose header word (EDDC, HMDC, NADC, ESWLDC, MHDC,
     SANADC) is nearest on that page.
  2. `pdftotext -bbox`: the x-centre of each "Y" word is compared with the x-centres of the EDDC and HMDC header
     words on the same page (EDDC is the first column, so nearer EDDC than HMDC means EDDC = Y).
The Est type and MPS flag come from the "Hospital Morbidity System Codes" table of the same PDF.
The same method reproduces the 125 NADC establishments used by the sister project OutpatientFlow-WA.
Needs poppler-utils (pdftotext).
"""
import html, json, os, re, subprocess, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'reference', 'official_eddc_reporting_2026-05.json')
COLS = ['EDDC', 'HMDC', 'NADC', 'ESWLDC', 'MHDC', 'SANADC']


def layout_read(pdf):
    txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True, check=True).stdout
    rows = []
    pages = txt.split('\f')
    for pi, p in enumerate(pages):
        # The reporting table ends where the Hospital Morbidity System Codes table starts.
        # (Page 3, the contents page, also names that table, hence pi > 5.)
        if pi > 5 and 'Hospital Morbidity System Codes' in p and 'Reports to' not in p:
            break
        lines = p.split('\n')
        hdr = [l for l in lines if 'EDDC' in l and 'HMDC' in l and 'NADC' in l]
        if not hdr:
            continue
        centres = []
        for c in COLS:
            m = re.search(r'\b' + c + r'\b', hdr[0])
            centres.append(m.start() + len(c) / 2)
        for l in lines:
            m = re.match(r'^\s*(\d{3,4})\s{2,}(\S.*?)(\s{2,}.*)?$', l)
            if not m:
                continue
            flags = {c: False for c in COLS}
            for ym in re.finditer(r'\bY\b', l[m.end(2):]):
                x = ym.start() + m.end(2)
                d = [abs(x - c) for c in centres]
                if min(d) > 4:
                    sys.exit('Y too far from any column header: %s %s' % (m.group(1), l))
                flags[COLS[d.index(min(d))]] = True
            rows.append(dict(code=m.group(1), name=m.group(2).strip(), page=pi + 1, **flags))
    return rows, txt


def bbox_read(pdf, last_page):
    s = subprocess.run(['pdftotext', '-bbox', '-f', '1', '-l', str(last_page), pdf, '-'], capture_output=True, text=True, check=True).stdout
    ed, n = set(), 0
    for p in s.split('<page ')[1:]:
        words = [(float(a), float(b), float(c), html.unescape(t)) for a, b, c, t in
                 re.findall(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)</word>', p)]
        hd = [w for w in words if w[3] == 'EDDC']
        hm = [w for w in words if w[3] == 'HMDC']
        if not hd or not hm:
            continue
        edx, hmx, hy = (hd[0][0] + hd[0][2]) / 2, (hm[0][0] + hm[0][2]) / 2, hd[0][1]
        lines = defaultdict(list)
        for w in words:
            if w[1] > hy + 3:
                lines[round(w[1])].append(w)
        for ws in lines.values():
            ws.sort()
            if not re.fullmatch(r'\d{3,4}', ws[0][3]) or ws[0][0] > 120:
                continue
            n += 1
            for w in ws:
                if w[3] == 'Y' and abs((w[0] + w[2]) / 2 - edx) < abs((w[0] + w[2]) / 2 - hmx):
                    ed.add(ws[0][3])
    return ed, n


def hms_table(txt):
    lines = txt.split('\n')
    st = [i for i, l in enumerate(lines) if l.strip() == 'Establishment List, Hospital Morbidity System Codes'][0]
    out = {}
    for l in lines[st:]:
        if 'Appendix A' in l and 'Establishment Type' in l:
            break
        m = re.match(r'^\s*(\d{3,4})\s{2,}(\S.*?)\s{2,}([A-Z][A-Z0-9])\s+(\d)\s+([\d/]+)\s*(Y)?\s*$', l)
        if m:
            out[m.group(1)] = dict(name=m.group(2), type=m.group(3), sorl=m.group(4), mos=m.group(5), mps=bool(m.group(6)))
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf = sys.argv[1]
    rows, txt = layout_read(pdf)
    last = max(r['page'] for r in rows)
    ed_bbox, n_bbox = bbox_read(pdf, last)
    ed_layout = {r['code'] for r in rows if r['EDDC']}
    if len(rows) != n_bbox or ed_layout != ed_bbox:
        sys.exit('The two reads disagree: layout %d rows / %d EDDC, bbox %d rows / %d EDDC, differing codes %s'
                 % (len(rows), len(ed_layout), n_bbox, len(ed_bbox), sorted(ed_layout ^ ed_bbox)))
    hms = hms_table(txt)
    est = []
    for r in rows:
        if not r['EDDC']:
            continue
        h = hms.get(r['code'])
        est.append(dict(code=r['code'].zfill(4), name=r['name'], type=h and h['type'], mps=bool(h and h['mps']),
                        hmsName=h and h['name'], pdfPage=r['page'],
                        alsoReports={k: r[k] for k in COLS[1:]}))
    est.sort(key=lambda e: e['code'])
    doc = dict(
        _about='Establishments with "Reports to EDDC" = Y in the WA Health Establishment List, May 2026 (v0.1), '
               'read from the "Reports to" table (two independent text reads that agree). Est type and MPS flag from the '
               'Hospital Morbidity System Codes table of the same document. Produced by tools/extract_establishment_list.py.',
        source='WA Health Establishment List, May 2026, version 0.1 (Department of Health WA)',
        count=len(est), reportingRows=len(rows),
        totals={c: sum(r[c] for r in rows) for c in COLS},
        byType=dict(Counter(e['type'] or 'none' for e in est)),
        establishments=est)
    json.dump(doc, open(OUT, 'w'), indent=1)
    print('reporting rows', len(rows), '| EDDC = Y:', len(est), '| totals', doc['totals'], '| types', doc['byType'])


if __name__ == '__main__':
    main()
