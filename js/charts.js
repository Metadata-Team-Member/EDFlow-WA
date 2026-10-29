/* EDFlow WA: small dependency-free canvas charts that follow the clock and the filters.
   Every chart measures its own label space with measureText before placing bars, so labels never overlap the plot. */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {}); const D = OF.Data; const C = {}; OF.Charts = C;
  const FONT = '"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif';
  const TXT2 = '#6f819e', GRID = 'rgba(150,180,220,.12)', TEAL = '#4fd1c5', AMB = '#f5b94a', RED = '#ff6b6b', BLUE = '#7aa7ff', INK = '#e3ecfb';
  const fmt = (n) => Math.round(n).toLocaleString('en-AU');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  let grpHits = []; C.onGroup = null;

  function prep(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h); c.textBaseline = 'alphabetic'; return { c, w, h };
  }
  const font = (c, px, weight) => { c.font = (weight || 400) + ' ' + px + 'px ' + FONT; };
  function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // text helpers: never let a label run past the space it was given
  function fitText(c, str, maxW) { str = String(str); if (c.measureText(str).width <= maxW) return str; while (str.length > 1 && c.measureText(str + '…').width > maxW) str = str.slice(0, -1); return str.trim() + '…'; }
  function pickText(c, opts, maxW) { for (const o of opts) if (c.measureText(o).width <= maxW) return o; return fitText(c, opts[opts.length - 1], maxW); }
  // legend that wraps to a new row instead of running off the card; returns the height used
  function legendRows(c, items, x0, y0, maxX, lh, dry) {
    let x = x0, y = y0; c.textAlign = 'left';
    items.forEach(([tx, col, dash]) => {
      const tw = c.measureText(tx).width + 15; if (x > x0 && x + tw > maxX) { x = x0; y += lh; }
      if (!dry) {
        if (dash) { c.strokeStyle = col; c.lineWidth = 2; c.setLineDash(dash === 1 ? [] : [3, 2]); c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 11, y - 4); c.stroke(); c.setLineDash([]); c.lineWidth = 1; }
        else { c.fillStyle = col; c.fillRect(x, y - 8.5, 9, 9); }
        c.fillStyle = '#c4d1e6'; c.fillText(fitText(c, tx, Math.max(30, maxX - x - 15)), x + 15, y);
      }
      x += tw + 12;
    });
    return y - y0 + lh;
  }
  const atsCss = (k) => 'rgb(' + OF.Scene.atsRgb[k].join(',') + ')';

  /* 1. This week, hour by hour: arrivals (bars), people in the ED (line), arrivals one week earlier (dashed) */
  function timeChart(cv, S, t) {
    const { c, w, h } = prep(cv), hr = D.hourly;
    const items = [['Arrivals per hour', 'rgba(122,167,255,.75)'], ['Same hour last week', '#c6d4ec', 2], ['People in the ED', TEAL, 1]];
    font(c, 10.5, 600); const lgH = legendRows(c, items, 0, 0, w - 50, 14, true);
    font(c, 10); const yl = c.measureText('8,888').width + 8;
    const L = yl, R = 8, T = 6 + lgH + 4, B = 22, pw = w - L - R, ph = h - T - B;
    const day0 = Math.floor(t / 1440), wd = D.weekday(day0 * 1440), mon = day0 - ((wd + 6) % 7); // Monday of this week
    const h0 = mon * 24, nowH = Math.floor(t / 60), H = hr.arrivals.length;
    let mx = 10; for (let k = 0; k < 168; k++) { const q = h0 + k; if (q >= 0 && q < H) mx = Math.max(mx, hr.inEd[q], hr.arrivals[q]); if (q - 168 >= 0 && q - 168 < H) mx = Math.max(mx, hr.arrivals[q - 168]); }
    const step = mx > 400 ? 200 : mx > 100 ? 50 : mx > 40 ? 10 : 5; mx = Math.ceil(mx / step) * step;
    c.textAlign = 'right'; c.fillStyle = TXT2;
    for (let k = 0; k <= 4; k++) { const y = T + ph - (ph * k) / 4; c.strokeStyle = GRID; c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); c.fillText(fmt((mx * k) / 4), L - 5, y + 3); }
    const bw = pw / 168, X = (k) => L + k * bw, Y = (v) => T + ph - (v / mx) * ph;
    c.fillStyle = 'rgba(122,167,255,.55)';
    for (let k = 0; k < 168; k++) { const q = h0 + k; if (q < 0 || q >= H || q > nowH) continue; const v = q === nowH ? D.lower(t + 1e-6) - D.lower(q * 60) : hr.arrivals[q]; const hh = (v / mx) * ph; c.fillRect(X(k) + bw * 0.1, T + ph - hh, Math.max(0.8, bw * 0.8), hh); }
    const line = (get, col, dash, upto) => { c.strokeStyle = col; c.lineWidth = dash ? 1.2 : 2; c.setLineDash(dash ? [3, 2] : []); c.beginPath(); let on = false; for (let k = 0; k < 168; k++) { const q = h0 + k; if (q > upto) break; const v = get(q); if (v == null) { on = false; continue; } const x = X(k + 0.5), y = Y(v); on ? c.lineTo(x, y) : c.moveTo(x, y); on = true; } c.stroke(); c.setLineDash([]); c.lineWidth = 1; };
    line((q) => (q - 168 >= 0 && q - 168 < H ? hr.arrivals[q - 168] : null), '#c6d4ec', true, h0 + 167);
    line((q) => (q >= 0 && q < H ? hr.inEd[q] : null), TEAL, false, nowH);
    font(c, 9.5); c.fillStyle = TXT2; c.textAlign = 'center';
    for (let d = 0; d < 7; d++) { c.strokeStyle = GRID; c.beginPath(); c.moveTo(X(d * 24), T); c.lineTo(X(d * 24), T + ph); c.stroke(); c.fillText(pw < 420 ? D.WD[(d + 1) % 7] : D.fmtDay((mon + d) * 1440), X(d * 24 + 12), h - 8); }
    const nx = X((t - h0 * 60) / 60); c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(nx, T); c.lineTo(nx, T + ph); c.stroke(); c.setLineDash([]); c.lineWidth = 1;
    font(c, 10.5, 600); legendRows(c, items, L, 12, w - 4, 14);
  }

  /* 2. Seen on time, last 7 days, by triage category, against the external KPI threshold */
  function seenChart(cv, S) {
    const { c, w, h } = prep(cv), tr = D.dims.triage, T = 22, B = 18;
    font(c, 11, 600); let lw = 0; tr.forEach((p) => { lw = Math.max(lw, c.measureText('ATS ' + p.code + ' ' + p.label).width); });
    lw = Math.min(lw + 12, w * 0.42); font(c, 10); const vw = c.measureText('100% of 8,888').width + 8;
    const pw = Math.max(30, w - lw - vw), rowH = (h - T - B) / tr.length;
    font(c, 9.5); c.fillStyle = TXT2; c.textAlign = 'left'; c.fillText(pickText(c, ['Share seen within the target, people who left in the last 7 days', 'Seen within target, last 7 days', 'Seen on time (7 d)'], w - 4), 0, 12);
    tr.forEach((p, k) => {
      const y = T + k * rowH + rowH * 0.18, bh = rowH * 0.5, den = S.seenDen[k], v = den ? S.seenOk[k] / den : 0;
      font(c, 11, 600); c.fillStyle = '#d5e0f3'; c.textAlign = 'right'; c.fillText(fitText(c, 'ATS ' + p.code + ' ' + p.label, lw - 10), lw - 8, y + bh * 0.75);
      font(c, 9); c.fillStyle = TXT2; c.fillText('≤' + p.targetMin + ' min', lw - 8, y + bh * 0.75 + 11);
      rr(c, lw, y, pw, bh, 4); c.fillStyle = 'rgba(255,255,255,.05)'; c.fill();
      if (den) { rr(c, lw, y, Math.max(2, pw * v), bh, 4); c.fillStyle = atsCss(k); c.fill(); }
      const kx = lw + (pw * p.kpiPct) / 100; c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(kx, y - 3); c.lineTo(kx, y + bh + 3); c.stroke(); c.lineWidth = 1;
      font(c, 10, 600); c.textAlign = 'left'; c.fillStyle = !den ? TXT2 : v * 100 >= p.kpiPct ? '#7fe0b4' : '#ff9a9a';
      c.fillText(den ? Math.round(v * 100) + '% of ' + fmt(den) : '–', lw + pw + 6, y + bh * 0.75);
    });
    font(c, 9.5); c.fillStyle = TXT2; c.textAlign = 'left'; c.fillText(pickText(c, ['White tick = performance threshold (external, to be confirmed)', 'Tick = threshold (external)'], w - 4), 0, h - 4);
  }

  /* 3. People waiting now, split by how long they have waited compared with their target */
  function waitChart(cv, S) {
    const { c, w, h } = prep(cv), tr = D.dims.triage;
    const cols = ['#3fcf9d', '#8fd36b', '#e3c251', '#f2994a', '#ff7b5c', '#ff5d6c', '#e0405e', '#b8304f'];
    const labs = ['≤0.5×', '≤1×', '≤2×', '≤3×', '≤4×', '≤6×', '≤10×', '>10×'];
    font(c, 10, 600); const lgH = legendRows(c, labs.map((l, k) => [l, cols[k]]), 0, 0, w - 4, 14, true);
    const T = 8 + lgH, B = 16;
    font(c, 11, 600); let lw = 0; tr.forEach((p) => { lw = Math.max(lw, c.measureText('ATS ' + p.code).width); }); lw += 12;
    font(c, 10); const vw = c.measureText('888 · 88% past').width + 8;
    const pw = Math.max(30, w - lw - vw), rowH = (h - T - B) / tr.length;
    tr.forEach((p, k) => {
      const y = T + k * rowH + rowH * 0.2, bh = rowH * 0.6, a = S.band[k]; let n = 0; for (let q = 0; q < 8; q++) n += a[q];
      font(c, 11, 600); c.fillStyle = '#d5e0f3'; c.textAlign = 'right'; c.fillText('ATS ' + p.code, lw - 8, y + bh * 0.72);
      rr(c, lw, y, pw, bh, 4); c.fillStyle = 'rgba(255,255,255,.05)'; c.fill();
      let x = lw; if (n) for (let q = 0; q < 8; q++) { const bw = (pw * a[q]) / n; c.fillStyle = cols[q]; c.fillRect(x, y, bw, bh); x += bw; }
      const over = S.over[k]; font(c, 10); c.textAlign = 'left'; c.fillStyle = n && over / n > 0.3 ? '#ff9a9a' : INK;
      c.fillText(n ? fmt(n) + ' · ' + pct(over, n) + '% past' : 'none waiting', lw + pw + 6, y + bh * 0.72);
    });
    font(c, 10, 600); legendRows(c, labs.map((l, k) => [l, cols[k]]), 0, 12, w - 4, 14);
    font(c, 9.5); c.fillStyle = TXT2; c.textAlign = 'left'; c.fillText(pickText(c, ['Time waited as a multiple of the ATS target', 'Wait ÷ target'], w - 4), 0, h - 3);
  }

  /* 4. Presenting complaint groups: arrivals in the last 7 days and median time to be seen */
  function pcChart(cv, S) {
    const { c, w, h } = prep(cv), gs = D.dims.complaintGroups;
    const idx = gs.map((q, i) => i).sort((a, b) => S.grpN[b] - S.grpN[a]);
    const T = 24, B = 18, rowH = (h - T - B) / gs.length;
    const name = (q) => q.label + (q.confirmed === true ? '' : ' *');
    font(c, 10.5); let lw = 0; gs.forEach((q) => { lw = Math.max(lw, c.measureText(name(q)).width); }); lw = Math.min(lw + 12, w * 0.4);
    font(c, 10); const v1 = c.measureText('8,888').width + 8, v2 = c.measureText('888 min').width + 8;
    const colW = (w - lw - 14) / 2, b1 = Math.max(10, colW - v1), b2 = Math.max(10, colW - v2), x1 = lw, x2 = lw + colW + 14;
    const mx1 = Math.max(1, S.grpN[idx[0]]), mx2 = Math.max(10, ...S.grpMed);
    font(c, 10, 600); c.textAlign = 'left'; c.fillStyle = BLUE; c.fillText(pickText(c, ['Arrivals, last 7 days', 'Arrivals (7 d)'], colW), x1, 14);
    c.fillStyle = AMB; c.fillText(pickText(c, ['Median time to be seen', 'Median wait', 'Wait'], colW), x2, 14);
    grpHits = [];
    idx.forEach((gi, r) => {
      const q = gs[gi], y = T + r * rowH + rowH * 0.16, bh = rowH * 0.62, v = S.grpN[gi], m = S.grpMed[gi];
      font(c, 10.5); c.textAlign = 'right'; c.fillStyle = D.filter.grp === gi ? '#fff' : '#c6d4ec'; c.fillText(fitText(c, name(q), lw - 8), lw - 6, y + bh * 0.8);
      const col = 'rgb(' + OF.Sprites.specColor(q.hue).join(',') + ')';
      const l1 = Math.max(2, (b1 * v) / mx1); c.fillStyle = col; rr(c, x1, y, l1, bh, 3); c.fill();
      font(c, 10); c.textAlign = 'left'; c.fillStyle = INK; c.fillText(fmt(v), x1 + l1 + 4, y + bh * 0.8);
      const l2 = Math.max(2, (b2 * m) / mx2); c.fillStyle = 'rgba(245,185,74,.85)'; rr(c, x2, y, l2, bh, 3); c.fill();
      c.fillStyle = INK; c.fillText(m ? Math.round(m) + ' min' : '–', x2 + l2 + 4, y + bh * 0.8);
      grpHits.push({ y0: y - 2, y1: y + bh + 2, gi });
    });
    font(c, 9.5); c.fillStyle = TXT2; c.textAlign = 'left';
    c.fillText(pickText(c, ['* grouping not confirmed: the complaint code list is not in the EDDC documents (OPEN-QUESTIONS Q2). Click a row to filter.', '* grouping not confirmed (Q2). Click a row to filter.', '* not confirmed (Q2)'], w - 4), 0, h - 4);
  }

  /* 5. Arrivals heatmap: average arrivals per hour by weekday, from all complete hours before now */
  function heatChart(cv, S, t) {
    const { c, w, h } = prep(cv), m = D.heat(t);
    font(c, 10); const lw = c.measureText('Wed').width + 10, T = 6, B = 30;
    const cw = (w - lw - 4) / 24, ch = (h - T - B) / 7; let mx = 1; m.forEach((r) => r.forEach((v) => { if (v != null) mx = Math.max(mx, v); }));
    const order = [1, 2, 3, 4, 5, 6, 0];
    order.forEach((d, r) => {
      c.fillStyle = '#c6d4ec'; c.textAlign = 'right'; c.fillText(D.WD[d], lw - 6, T + r * ch + ch * 0.68);
      for (let hr = 0; hr < 24; hr++) {
        const v = m[d][hr], x = lw + hr * cw, y = T + r * ch;
        if (v == null) { c.strokeStyle = 'rgba(150,180,220,.15)'; c.strokeRect(x + 1, y + 1, cw - 2, ch - 2); continue; }
        const f = v / mx; c.fillStyle = 'hsl(' + (210 - 170 * f) + ',70%,' + (22 + 38 * f) + '%)'; rr(c, x + 0.75, y + 0.75, cw - 1.5, ch - 1.5, 2); c.fill();
      }
    });
    c.fillStyle = TXT2; c.textAlign = 'center'; font(c, 9.5);
    const every = cw < 14 ? 6 : 3; for (let hr = 0; hr < 24; hr += every) c.fillText(String(hr).padStart(2, '0'), lw + hr * cw + cw / 2, h - 18);
    c.textAlign = 'left'; c.fillText(pickText(c, ['Hour of arrival · deep teal = fewer, orange = more (max ' + mx.toFixed(0) + ' per hour)', 'Hour of arrival · max ' + mx.toFixed(0) + '/h'], w - 4), 0, h - 3);
  }

  /* 6. Regions: median time to be seen (7 days) and people in the ED now */
  function regChart(cv, S) {
    const { c, w, h } = prep(cv), rs = D.dims.regions, nm = (r) => (r.name === 'Statewide (virtual)' ? 'Virtual (WAVED)' : r.name);
    const T = 24, B = 4, rowH = (h - T - B) / rs.length;
    font(c, 10.5); let lw = 0; rs.forEach((r) => { lw = Math.max(lw, c.measureText(nm(r)).width); }); lw = Math.min(lw + 12, Math.max(70, w * 0.32));
    font(c, 10); const v1 = c.measureText('888 min').width + 6, v2 = c.measureText('8,888').width + 6;
    const colW = (w - lw - 14) / 2, b1 = Math.max(10, colW - v1), b2 = Math.max(10, colW - v2), x1 = lw, x2 = lw + colW + 14;
    let m1 = 10, m2 = 5; rs.forEach((r, i) => { m1 = Math.max(m1, S.regMed[i]); m2 = Math.max(m2, S.regIn[i]); });
    font(c, 10, 600); c.textAlign = 'left'; c.fillStyle = AMB; c.fillText(pickText(c, ['Median time to be seen (7 d)', 'Median wait (7 d)', 'Wait'], colW), x1, 14);
    c.fillStyle = TEAL; c.fillText(pickText(c, ['In the ED now', 'In ED'], colW), x2, 14);
    rs.forEach((r, i) => {
      const y = T + i * rowH + rowH * 0.18, bh = rowH * 0.6;
      font(c, 10.5); c.fillStyle = D.filter.region === i ? '#fff' : '#c6d4ec'; c.textAlign = 'right'; c.fillText(fitText(c, nm(r), lw - 8), lw - 8, y + bh * 0.8);
      const a = S.regMed[i], l1 = Math.max(2, (b1 * a) / m1); c.fillStyle = 'rgba(245,185,74,.85)'; rr(c, x1, y, l1, bh, 3); c.fill();
      font(c, 10); c.fillStyle = INK; c.textAlign = 'left'; c.fillText(S.regN[i] ? Math.round(a) + ' min' : 'n/a', x1 + l1 + 4, y + bh * 0.8);
      const b = S.regIn[i], l2 = Math.max(2, (b2 * b) / m2); c.fillStyle = OF.Scene.hspCol[r.hsp]; rr(c, x2, y, l2, bh, 3); c.fill();
      c.fillStyle = INK; c.fillText(fmt(b), x2 + l2 + 4, y + bh * 0.8);
    });
  }

  /* 7. How people left the ED, last 7 days, by HSP, with the share that left within 4 hours */
  const DEP_COL = { admitted: '#7aa7ff', home: '#5ad19a', virtual: '#4fd1c5', transfer: '#c58bff', dnw: '#f5b94a', laor: '#ff9f6b', triage: '#e3c251', other: '#9aa7bd' };
  function depChart(cv, S) {
    const { c, w, h } = prep(cv), hs = D.dims.hsps, gs = D.dims.departureGroups;
    font(c, 10, 600); const items = gs.map((q) => [q.label.replace(/ \(.*\)/, ''), DEP_COL[q.key] || '#9aa7bd']);
    const lgH = legendRows(c, items, 0, 0, w - 4, 14, true);
    const T = 8 + lgH, B = 16, rowH = (h - T - B) / hs.length;
    font(c, 11, 700); const lw = hs.reduce((m, q) => Math.max(m, c.measureText(q.code).width), 0) + 12;
    const tot = hs.map((_, i) => S.depByHsp[i].reduce((a, b) => a + b, 0)), mx = Math.max(1, ...tot);
    const labs = hs.map((_, i) => fmt(tot[i]) + (S.hspPhys[i] ? ' · ' + pct(S.hspLe4[i], S.hspPhys[i]) + '% ≤4 h' : ''));
    // reserve room for the widest real label so the longest bar never pushes its label off the canvas
    font(c, 10); const vw = labs.reduce((m, t) => Math.max(m, c.measureText(t).width), 0) + 10, pw = Math.max(20, w - lw - vw);
    hs.forEach((hp, i) => {
      const y = T + i * rowH + rowH * 0.18, bh = rowH * 0.6;
      font(c, 11, 700); c.textAlign = 'right'; c.fillStyle = D.filter.hsp === i ? '#fff' : OF.Scene.hspCol[hp.code]; c.fillText(hp.code, lw - 8, y + bh * 0.75);
      let x = lw; S.depByHsp[i].forEach((v, k) => { const bw = (pw * v) / mx; c.fillStyle = DEP_COL[gs[k].key] || '#9aa7bd'; c.fillRect(x, y, bw, bh); x += bw; });
      font(c, 10); c.textAlign = 'left'; c.fillStyle = INK; c.fillText(labs[i], x + 5, y + bh * 0.75);
    });
    font(c, 10, 600); legendRows(c, items, 0, 12, w - 4, 14);
    font(c, 9.5); c.fillStyle = TXT2; c.textAlign = 'left'; c.fillText(pickText(c, ['≤4 h share excludes the virtual ED (OPEN-QUESTIONS Q11)', '≤4 h excludes WAVED'], w - 4), 0, h - 3);
  }

  C.draw = function (S, t) {
    const $ = (id) => document.getElementById(id);
    timeChart($('cTime'), S, t); seenChart($('cSeen'), S); waitChart($('cWait'), S); pcChart($('cPc'), S); heatChart($('cHeat'), S, t); regChart($('cReg'), S); depChart($('cDep'), S);
  };
  C.init = function () {
    const cv = document.getElementById('cPc');
    cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(), y = e.clientY - r.top, hit = grpHits.find((q) => y >= q.y0 && y <= q.y1); if (hit && C.onGroup) C.onGroup(hit.gi); });
    cv.style.cursor = 'pointer';
  };
})(window);
