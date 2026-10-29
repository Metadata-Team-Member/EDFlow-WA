/* EDFlow WA: the animated scene. One marker = one ED attendance (or one in every N, see "Density").
   Panel 1  Where people arrive: the WA health regions with the Perth metro inset and one dot per EDDC site.
   Panel 2  Waiting to be seen: one lane per triage category (ATS). Position = time waited as a share of the
            category's time-to-treatment target (dashed line, Business Rules Jul 2026 §7.4 Table 1).
   Panel 3  In the ED: one block per Health Service Provider. Doors are treatment areas (illustrative, not in EDDC);
            on the floor people drift left to right with time since arrival, past the 4-hour line, and leave
            through a gate (ward, home, transfer). The sixth block is a site spotlight.
   Rings under a marker show the stage: none = waiting, one = in clinical care, two = ready to leave the ED.
   Time model: Scene.t is minutes since dims.start. Events (arrive / seen / ready / depart) are pre-sorted and
   replayed while playing; seeking rebuilds every marker at its correct place. */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {});
  const D = OF.Data, SP = OF.Sprites;
  const Scene = {}; OF.Scene = Scene;

  let cv, ctx, wrap, dpr = 1, cssW = 800, sc = 1, L = null, bg = null, K = 1;
  let agents = new Map(), list = [], popups = [];
  let ev = null, ptr = 0;
  let stats = null, selected = -1, hover = -1, hoverSite = -1;
  let geo = null, ests = null;
  Scene.t = 0; Scene.colorBy = 'ats'; Scene.density = 1; Scene.animF = 1; Scene.onPick = null; Scene.onSite = null;
  Scene.hspCol = { NMHS: '#6fb1ff', EMHS: '#c58bff', SMHS: '#ffb86b', CAHS: '#ff8fb8', WACHS: '#5ad19a' };
  // Conventional Australasian Triage Scale colours (red, orange, green, blue, white), softened for a dark background.
  const ATS_RGB = [[236, 84, 84], [245, 150, 60], [80, 196, 120], [86, 150, 235], [214, 222, 236]];
  const MODE_RGB = [[150, 200, 255], [255, 120, 120], [255, 210, 110], [200, 160, 255], [170, 180, 195]];
  const GREY = '#4b586d'; // filtered-out sites are drawn grey (never faded with transparency)
  const RING = [0, 0, 5, 12]; // sprite bucket per stage: 1 waiting (no ring), 2 in care (1 ring), 3 ready to leave (2 rings)
  const H4 = 240;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hcol = (h) => Scene.hspCol[D.dims.hsps[h].code] || '#9db0cf';
  const hexRgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const fmtN = (n) => Math.round(n).toLocaleString('en-AU');
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  Scene.setGeo = function (regions, metro) { geo = { regions, metro }; bg = null; };

  /* ---------- geometry helpers ---------- */
  function polysOf(f) { return f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; }
  function bbox(features) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; features.forEach((f) => polysOf(f).forEach((p) => p[0].forEach((q) => { a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); }))); return { x0: a, x1: b, y0: c, y1: d }; }
  function pathOf(feat, proj) { const p = new Path2D(); polysOf(feat).forEach((poly) => poly.forEach((ring) => { ring.forEach((q, i) => { const xy = proj(q[0], q[1]); i ? p.lineTo(xy[0], xy[1]) : p.moveTo(xy[0], xy[1]); }); p.closePath(); })); return p; }

  /* ---------- layout (logical units; the canvas is scaled to fit) ---------- */
  function computeLayout() {
    const dm = D.dims, portrait = cssW < 760;
    const W = portrait ? 640 : 1600; K = portrait ? 1.3 : 1;
    const Lo = { portrait, W };
    const cosφ = Math.cos(25 * Math.PI / 180), LON0 = 112.9, LON1 = 129.1, LAT0 = -13.6, LAT1 = -35.3;
    let mapPanel, mapH, yardPanel, cw, ch, gx0, gy0, gap;
    if (!portrait) {
      mapPanel = { x: 16, y: 54, w: 470, h: 830 }; yardPanel = { x: 498, y: 54, w: 330, h: 830 }; mapH = 540;
      gx0 = 842; gy0 = 54; gap = 14; cw = (W - 16 - gx0 - gap) / 2; ch = (830 - gap * 2) / 3; Lo.H = 900;
    } else {
      mapPanel = { x: 10, y: 38, w: 620, h: 560 }; yardPanel = { x: 10, y: 630, w: 620, h: 600 }; mapH = 490;
      gx0 = 10; gy0 = 1266; gap = 10; cw = (W - 20 - gap) / 2; ch = 300; Lo.H = gy0 + 3 * ch + 2 * gap + 12; Lo.hospTitleY = gy0 - 12;
    }
    Lo.map = mapPanel; Lo.yard = yardPanel;
    // WA map: equirectangular projection at 25°S
    const s = (mapH - 28) / (LAT0 - LAT1), sx = s * cosφ;
    const ox = mapPanel.x + 10, oy = mapPanel.y + 26;
    Lo.proj = (lon, lat) => [ox + (lon - LON0) * sx, oy + (LAT0 - lat) * s];
    Lo.mapBottom = oy + (LAT0 - LAT1) * s;
    const mapRight = ox + (LON1 - LON0) * sx;
    // Perth metro inset
    const metroBB = geo ? bbox(geo.metro) : { x0: 115.5, x1: 116.5, y0: -32.9, y1: -31.4 };
    const ib = portrait ? { x: mapRight + 16, y: mapPanel.y + 26, w: mapPanel.x + mapPanel.w - (mapRight + 16) - 10, h: 235 } : { x: mapPanel.x + 10, y: Lo.mapBottom + 16, w: 176, h: mapPanel.y + mapPanel.h - Lo.mapBottom - 26 };
    const isc = Math.min(ib.w / ((metroBB.x1 - metroBB.x0) * cosφ), ib.h / (metroBB.y1 - metroBB.y0));
    const iox = ib.x + (ib.w - (metroBB.x1 - metroBB.x0) * cosφ * isc) / 2, ioy = ib.y + (ib.h - (metroBB.y1 - metroBB.y0) * isc) / 2;
    Lo.inset = ib; Lo.insetProj = (lon, lat) => [iox + (lon - metroBB.x0) * cosφ * isc, ioy + (metroBB.y1 - lat) * isc];
    Lo.insetBox = { x: iox, y: ioy, w: (metroBB.x1 - metroBB.x0) * cosφ * isc, h: (metroBB.y1 - metroBB.y0) * isc };
    Lo.perth = Lo.proj(115.86, -31.95);
    // the virtual ED has no place on the map: it gets its own badge in the top-right corner of the map panel
    Lo.virtual = portrait ? { x: ib.x, y: ib.y + ib.h + 18, w: ib.w, h: 30 } : { x: mapPanel.x + mapPanel.w - 176, y: mapPanel.y + 30, w: 164, h: 32 };
    Lo.regList = portrait ? { x: ib.x, y: Lo.virtual.y + Lo.virtual.h + 30, w: ib.w, rowH: 19 } : { x: ib.x + ib.w + 18, y: ib.y + 18, w: mapPanel.x + mapPanel.w - (ib.x + ib.w + 18) - 12, rowH: 21 };
    ests = dm.establishments.map((e, i) => {
      if (e.tier === 'VIRT') return { i, x: Lo.virtual.x + 14, y: Lo.virtual.y + Lo.virtual.h / 2, inset: false, r: 6, pulse: 0, virtual: true };
      if (e.tier === 'ALIAS') return null; // 0645 shares Peel Health Campus with 0145 and has no activity (docs/ESTABLISHMENTS.md)
      const metro = e.region <= 2; const p = (metro ? Lo.insetProj : Lo.proj)(e.lon, e.lat);
      // dot size is uniform per tier (not by beds): Hedland, for example, has 0 beds in the List
      const r = { TERT: 6, PAED: 6, WOMN: 5, METR: 5, REGL: 4.6, DIST: 3, POST: 2.2 }[e.tier] || 3;
      return { i, x: p[0], y: p[1], inset: metro, r, pulse: 0 };
    });
    Lo.ests = ests;
    // waiting lanes, one per triage category
    const y = Lo.yard, nT = dm.triage.length, top = portrait ? 14 : 44, lg = 8, foot = 22;
    const lh = (y.h - top - foot - lg * (nT - 1)) / nT;
    Lo.lanes = dm.triage.map((p, i) => ({ k: i, x: y.x + 12, y: y.y + top + i * (lh + lg), w: y.w - 24, h: lh }));
    // horizontal position: 0..1 of the target uses the left 45%; beyond the target, a log scale up to 12x the target
    Lo.laneU = (u) => (u <= 1 ? clamp(u, 0, 1) * 0.45 : 0.45 + 0.55 * Math.min(1, Math.log(u) / Math.log(12)));
    Lo.laneX = (lane, u) => lane.x + 22 + (lane.w - 36) * Lo.laneU(u);
    // HSP blocks + spotlight
    Lo.cells = [];
    for (let n = 0; n < 6; n++) Lo.cells.push({ n, x: gx0 + (n % 2) * (cw + gap), y: gy0 + Math.floor(n / 2) * (ch + gap), w: cw, h: ch });
    const used = D.dims.hsps.map(() => new Set());
    for (let i = 0; i < D.N; i++) used[D.hspOfSite[D.site[i]]].add(D.area[i]);
    Lo.cells.forEach((c) => {
      if (c.n >= dm.hsps.length) { c.spot = true; return; }
      c.hsp = c.n; const bt = c.y + (portrait ? 26 : 30);
      c.bld = { x: c.x + 10, y: bt, w: c.w - 20, h: portrait ? 40 : 38 };
      c.floor = { x: c.x + 8, y: c.bld.y + c.bld.h + 8, w: c.w - 16, h: c.y + c.h - 8 - (c.bld.y + c.bld.h + 8) };
      c.areas = dm.treatmentAreas.map((a, k) => k).filter((k) => used[c.hsp].has(k));
      const nA = c.areas.length, f = c.floor;
      c.labW = portrait ? 46 : 54; c.gateW = portrait ? 40 : 46;
      c.rowH = (f.h - 18) / nA; c.rowOf = {};
      c.rows = c.areas.map((k, r) => { const row = { k, y: f.y + 4 + r * c.rowH, h: c.rowH }; c.rowOf[k] = row; return row; });
      c.x0 = f.x + c.labW + 9 * K; c.x1 = f.x + f.w - c.gateW; // the time-in-ED track
      c.timeX = (min) => c.x0 + (c.x1 - c.x0) * (min <= H4 ? (min / H4) * 0.5 : 0.5 + 0.5 * Math.min(1, (min - H4) / (720 - H4)));
      const step = (c.bld.w - 16) / nA, dw = Math.min(26, step - 6);
      c.doors = c.areas.map((k, n) => ({ k, w: dw, h: Math.min(22, c.bld.h * 0.6), x: c.bld.x + 8 + step * (n + 0.5), y: c.bld.y + c.bld.h, glow: 0 }));
      c.doorOf = {}; c.doors.forEach((d) => { c.doorOf[d.k] = d; });
      const gx = f.x + f.w - c.gateW / 2;
      c.gates = { ward: { x: gx, y: f.y + f.h * 0.2, label: 'Ward' }, home: { x: gx, y: f.y + f.h * 0.52, label: 'Home' }, transfer: { x: gx, y: f.y + f.h * 0.84, label: 'Transfer' } };
    });
    Lo.spot = Lo.cells[5];
    return Lo;
  }

  function fz(n) { const px = Math.max(9, n * Math.min(1, cssW / 1000)); return px / sc; }
  const FONT = '"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif';
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // the longest of several candidate labels that fits in `room`
  function fit(c, opts, room) { return opts.find((o) => c.measureText(o).width <= room) || opts[opts.length - 1]; }

  /* ---------- static background (drawn once per layout) ---------- */
  function drawBg(c) {
    const dm = D.dims;
    const gradBg = c.createLinearGradient(0, 0, 0, L.H); gradBg.addColorStop(0, '#0c1626'); gradBg.addColorStop(1, '#09111d');
    c.fillStyle = gradBg; c.fillRect(0, 0, L.W, L.H);
    const zone = (z, title) => {
      rrect(c, z.x, z.y, z.w, z.h, 14); c.fillStyle = 'rgba(20,34,58,.55)'; c.fill(); c.strokeStyle = 'rgba(140,170,220,.14)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#9db0cf'; c.font = '700 ' + fz(11) + 'px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText(fit(c, title, z.w - 8), z.x + 4, z.y - (L.portrait ? 8 : 12));
    };
    zone(L.map, ['1 · WHERE PEOPLE ARRIVE  (EDDC sites by WA health region)', '1 · WHERE PEOPLE ARRIVE']);
    zone(L.yard, ['2 · WAITING TO BE SEEN, by triage category', '2 · WAITING TO BE SEEN']);
    c.fillStyle = '#9db0cf'; c.font = '700 ' + fz(11) + 'px ' + FONT; c.textAlign = 'left';
    const nSites = dm.establishments.length;
    c.fillText(L.portrait ? '3 · IN THE ED  (5 HSPs · ' + nSites + ' EDDC codes)' : '3 · IN THE ED  (5 Health Service Providers · ' + nSites + ' establishment codes with Reports to EDDC = Y)', L.portrait ? 14 : L.cells[0].x + 4, L.portrait ? L.hospTitleY : 42);
    if (geo) drawMap(c);
    // virtual ED badge
    const v = L.virtual; rrect(c, v.x, v.y, v.w, v.h, 9); c.fillStyle = 'rgba(8,15,27,.7)'; c.fill(); c.setLineDash([3, 3]); c.strokeStyle = Scene.hspCol.WACHS + '99'; c.stroke(); c.setLineDash([]);
    c.fillStyle = '#d5e0f3'; c.font = '700 ' + fz(9.5) + 'px ' + FONT; c.textAlign = 'left'; c.fillText('WA Virtual ED (WAVED)', v.x + 26, v.y + v.h / 2 - 1);
    c.fillStyle = '#8ea1c2'; c.font = fz(8.5) + 'px ' + FONT; c.fillText('statewide · video / phone', v.x + 26, v.y + v.h / 2 + 10);
    drawLanes(c);
    drawCells(c);
  }

  function drawMap(c) {
    const dm = D.dims;
    const regF = geo.regions.filter((f) => f.properties.level === 'region'), disF = geo.regions.filter((f) => f.properties.level === 'district');
    const hspOf = (name) => { const r = dm.regions.find((q) => q.name === name); return r ? r.hsp : 'WACHS'; };
    const col = (code) => Scene.hspCol[code];
    c.lineJoin = 'round';
    disF.forEach((f) => { const cc = col(hspOf(f.properties.region)); const p = pathOf(f, L.proj); c.fillStyle = cc + '1f'; c.fill(p, 'evenodd'); c.strokeStyle = cc + '40'; c.lineWidth = 0.5; c.stroke(p); });
    regF.forEach((f) => { const cc = col(hspOf(f.properties.name)); const p = pathOf(f, L.proj); c.strokeStyle = cc + 'aa'; c.lineWidth = 1.2; c.stroke(p); });
    c.font = '700 ' + fz(9) + 'px ' + FONT; c.fillStyle = 'rgba(200,220,255,.55)';
    const lab = (t, x, y, al) => { c.textAlign = al || 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(9,17,29,.85)'; c.strokeText(t, x, y); c.fillText(t, x, y); };
    const k = Math.max(0.7, Math.min(1.3, L.map.w / 360));
    regF.forEach((f) => {
      if (hspOf(f.properties.name) !== 'WACHS') return; const q = L.proj(f.properties.cx, f.properties.cy); const nm = f.properties.name;
      if (nm === 'South West') lab('SW', q[0] - 16 * k, q[1] + 14 * k); // abbreviated: the full name is in the list
      else if (nm === 'Great Southern') lab('Great Southern', q[0] + 34 * k, q[1] + 4 * k, 'left');
      else if (nm === 'Wheatbelt') lab(nm, q[0] + 22 * k, q[1] - 14 * k);
      else lab(nm, q[0], q[1]);
    });
    c.lineWidth = 1;
    const pr = L.perth, ib = L.insetBox;
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(pr[0], pr[1], 9, 0, 7); c.stroke();
    c.setLineDash([3, 4]); c.beginPath(); c.moveTo(pr[0] - 4, pr[1] + 8); c.lineTo(ib.x + ib.w * 0.5, ib.y); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '700 ' + fz(9) + 'px ' + FONT; c.textAlign = 'right'; c.fillText('Perth', pr[0] - 12, pr[1] - 2);
    const ins = L.inset; rrect(c, ins.x - 2, ins.y - 2, ins.w + 4, ins.h + 4, 8); c.fillStyle = 'rgba(8,15,27,.6)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.stroke();
    c.save(); rrect(c, ins.x - 2, ins.y - 2, ins.w + 4, ins.h + 4, 8); c.clip();
    geo.metro.forEach((f) => { const cc = col(hspOf(f.properties.region)); const p = pathOf(f, L.insetProj); c.fillStyle = cc + '30'; c.fill(p, 'evenodd'); c.strokeStyle = cc + '99'; c.lineWidth = 0.8; c.stroke(p); });
    c.restore();
    c.fillStyle = '#9db0cf'; c.font = '700 ' + fz(9) + 'px ' + FONT; c.textAlign = 'left'; c.fillText('PERTH METRO (inset)', ins.x, ins.y - 6);
    c.fillStyle = 'rgba(150,175,215,.5)'; c.font = fz(8.5) + 'px ' + FONT; c.fillText('Dots: EDDC sites, coloured by HSP', L.map.x + 12, L.map.y + 16);
  }

  function drawLanes(c) {
    const dm = D.dims;
    L.lanes.forEach((ln) => {
      const p = dm.triage[ln.k];
      rrect(c, ln.x, ln.y, ln.w, ln.h, 10); c.fillStyle = 'rgba(8,15,27,.7)'; c.fill(); c.strokeStyle = 'rgba(140,170,220,.12)'; c.stroke();
      const bx = L.laneX(ln, 1);
      const rg = c.createLinearGradient(bx, 0, ln.x + ln.w, 0); rg.addColorStop(0, 'rgba(255,90,90,.05)'); rg.addColorStop(1, 'rgba(255,90,90,.22)');
      c.save(); rrect(c, ln.x, ln.y, ln.w, ln.h, 10); c.clip(); c.fillStyle = rg; c.fillRect(bx, ln.y, ln.x + ln.w - bx, ln.h);
      // faint guides at 2x, 4x and 8x the target
      c.strokeStyle = 'rgba(140,170,220,.06)'; [0.5, 2, 4, 8].forEach((u) => { const x = L.laneX(ln, u); c.beginPath(); c.moveTo(x, ln.y + 38); c.lineTo(x, ln.y + ln.h); c.stroke(); });
      c.restore();
      c.setLineDash([5, 4]); c.strokeStyle = 'rgba(255,107,107,.8)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(bx, ln.y + 38); c.lineTo(bx, ln.y + ln.h - 4); c.stroke(); c.setLineDash([]); c.lineWidth = 1;
      c.fillStyle = 'rgb(' + ATS_RGB[ln.k].join(',') + ')'; rrect(c, ln.x + 8, ln.y + 7, 18, 14, 4); c.fill();
      c.fillStyle = '#0b1424'; c.font = '800 ' + fz(10) + 'px ' + FONT; c.textAlign = 'center'; c.fillText(p.code, ln.x + 17, ln.y + 18);
      c.fillStyle = '#d5e0f3'; c.font = '700 ' + fz(11) + 'px ' + FONT; c.textAlign = 'left'; c.fillText(p.label, ln.x + 32, ln.y + 18);
      c.font = '600 ' + fz(9.5) + 'px ' + FONT; c.fillStyle = 'rgba(255,140,140,.95)'; c.textAlign = 'right';
      c.fillText('≤' + p.targetMin + ' min', bx - 4, ln.y + ln.h - 6);
      c.fillStyle = 'rgba(255,150,150,.6)'; c.font = fz(9) + 'px ' + FONT; c.fillText('past target', ln.x + ln.w - 8, ln.y + ln.h - 6);
      c.fillStyle = 'rgba(150,175,215,.55)'; c.textAlign = 'left'; c.fillText('arrived', ln.x + 8, ln.y + ln.h - 6);
    });
    c.fillStyle = 'rgba(150,175,215,.55)'; c.font = fz(9) + 'px ' + FONT; c.textAlign = 'left';
    c.fillText(fit(c, ['Dashed line: time-to-treatment target, Business Rules (Jul 2026) §7.4 Table 1.', 'Dashed line: BR (Jul 2026) §7.4 Table 1 target.', 'Dashed: BR §7.4 target'], L.yard.w - 20), L.yard.x + 12, L.yard.y + L.yard.h - 7);
  }

  function drawCells(c) {
    const dm = D.dims;
    L.cells.forEach((cell) => {
      rrect(c, cell.x, cell.y, cell.w, cell.h, 14); c.fillStyle = 'rgba(18,31,54,.6)'; c.fill(); c.strokeStyle = 'rgba(140,170,220,.14)'; c.stroke();
      if (cell.spot) return;
      const hp = dm.hsps[cell.hsp], col = hcol(cell.hsp), f = cell.floor;
      c.fillStyle = col; rrect(c, cell.x, cell.y + 8, 4, 18, 2); c.fill();
      // floor
      rrect(c, f.x, f.y, f.w, f.h, 10);
      const gg = c.createLinearGradient(0, f.y, 0, f.y + f.h); gg.addColorStop(0, '#16304a'); gg.addColorStop(1, '#112538'); c.fillStyle = gg; c.fill();
      cell.rows.forEach((r, n) => {
        if (n % 2) { c.fillStyle = 'rgba(255,255,255,.025)'; c.fillRect(f.x + 2, r.y, f.w - 4, r.h); }
        c.fillStyle = '#8ea1c2'; c.font = '600 ' + fz(8.5) + 'px ' + FONT; c.textAlign = 'left';
        const a = dm.treatmentAreas[r.k]; c.fillText(fit(c, [a.label, a.key], cell.labW - 8), f.x + 6, r.y + Math.min(r.h - 4, 13));
      });
      // time-in-ED track: hour ticks and the 4-hour line
      c.font = fz(8) + 'px ' + FONT; c.textAlign = 'center';
      [[60, '1 h'], [120, '2 h'], [H4, '4 h'], [480, '8 h'], [720, '12 h+']].forEach(([m, t]) => {
        const x = cell.timeX(m); c.strokeStyle = m === H4 ? 'rgba(245,185,74,.85)' : 'rgba(140,170,220,.1)'; c.lineWidth = m === H4 ? 1.4 : 1;
        if (m === H4) c.setLineDash([5, 4]); c.beginPath(); c.moveTo(x, f.y + 3); c.lineTo(x, f.y + f.h - 14); c.stroke(); c.setLineDash([]);
        c.fillStyle = m === H4 ? '#f5b94a' : 'rgba(150,175,215,.6)'; c.fillText(t, x, f.y + f.h - 4);
      });
      c.lineWidth = 1;
      c.textAlign = 'left'; c.fillStyle = 'rgba(150,175,215,.6)'; c.fillText('time in ED →', f.x + 6, f.y + f.h - 4);
      // exit gates
      Object.keys(cell.gates).forEach((k) => {
        const gt = cell.gates[k]; rrect(c, gt.x - cell.gateW / 2 + 4, gt.y - 11, cell.gateW - 8, 22, 6); c.fillStyle = 'rgba(8,15,27,.65)'; c.fill(); c.strokeStyle = 'rgba(140,170,220,.25)'; c.stroke();
        c.fillStyle = '#b8c7e0'; c.font = '600 ' + fz(8.5) + 'px ' + FONT; c.textAlign = 'center'; c.fillText(gt.label, gt.x, gt.y + 3);
      });
      // building with one door per treatment area
      const b = cell.bld; rrect(c, b.x, b.y, b.w, b.h, 8);
      const bgd = c.createLinearGradient(0, b.y, 0, b.y + b.h); bgd.addColorStop(0, '#2a4068'); bgd.addColorStop(1, '#1a2b49'); c.fillStyle = bgd; c.fill(); c.strokeStyle = col + '77'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(b.x + 6, b.y + 4, b.w - 12, 4);
      const nE = dm.establishments.filter((e) => e.hsp === cell.hsp && e.tier !== 'ALIAS').length;
      c.fillStyle = '#e8f0ff'; c.font = '700 ' + fz(12) + 'px ' + FONT; c.textAlign = 'left'; c.fillText(hp.code, cell.x + 12, cell.y + (L.portrait ? 17 : 21));
      if (!L.portrait) { const hw = c.measureText(hp.code).width; c.fillStyle = '#8ea1c2'; c.font = fz(9.5) + 'px ' + FONT; c.fillText(nE + (nE === 1 ? ' site' : ' sites'), cell.x + 12 + hw + 8, cell.y + 21); }
      cell.doors.forEach((d) => {
        c.fillStyle = '#3f5f8f'; c.beginPath(); c.moveTo(d.x - d.w / 2, d.y); c.lineTo(d.x - d.w / 2, d.y - d.h + d.w / 2); c.arc(d.x, d.y - d.h + d.w / 2, d.w / 2, Math.PI, 0); c.lineTo(d.x + d.w / 2, d.y); c.closePath(); c.fill();
        c.fillStyle = '#0d1a2e'; c.beginPath(); c.moveTo(d.x - d.w / 2 + 2.5, d.y); c.lineTo(d.x - d.w / 2 + 2.5, d.y - d.h + d.w / 2); c.arc(d.x, d.y - d.h + d.w / 2, d.w / 2 - 2.5, Math.PI, 0); c.lineTo(d.x + d.w / 2 - 2.5, d.y); c.closePath(); c.fill();
        c.fillStyle = '#dce8ff'; c.font = '700 ' + fz(7.5) + 'px ' + FONT; c.textAlign = 'center'; c.fillText(dm.treatmentAreas[d.k].key, d.x, d.y - d.h - 2);
      });
    });
  }

  /* ---------- colours ---------- */
  function colorOf(i) {
    switch (Scene.colorBy) {
      case 'grp': return SP.specColor(D.dims.complaintGroups[D.grp[i]].hue);
      case 'hsp': return hexRgb(hcol(D.hspOfSite[D.site[i]]));
      case 'mode': return MODE_RGB[D.modeGrp[D.mode[i]]] || MODE_RGB[4];
      default: return ATS_RGB[D.ats[i]];
    }
  }
  Scene.colorLegend = function () {
    const dm = D.dims;
    switch (Scene.colorBy) {
      case 'grp': return dm.complaintGroups.map((q) => [q.label, SP.specColor(q.hue)]);
      case 'hsp': return dm.hsps.map((h, i) => [h.code, hexRgb(hcol(i))]);
      case 'mode': return dm.modeGroups.map((m, i) => [m, MODE_RGB[i] || MODE_RGB[4]]);
      default: return dm.triage.map((p, i) => ['ATS ' + p.code + ' ' + p.label, ATS_RGB[i]]);
    }
  };
  Scene.atsRgb = ATS_RGB;

  /* ---------- agents ---------- */
  function laneOf(i) { return L.lanes[D.ats[i]]; }
  function waitTarget(a, t) {
    const ln = laneOf(a.i), u = (t - D.arr[a.i]) / D.target(a.i); a.u = u;
    // keep the whole marker (about 40 px tall with its sprout) below the two header lines of the lane
    const top = 26 + 40 * K, room = Math.max(4, ln.h - top - 18);
    return [L.laneX(ln, u) + (a.jx - 0.5) * 10, ln.y + top + 8 + a.jy * room];
  }
  // In the ED: x follows time since arrival (so people drift right and cross the 4-hour line), y stays in the treatment-area row.
  function floorBase(a, t) {
    const c = L.cells[a.cell], row = c.rowOf[D.area[a.i]] || c.rows[0];
    const x = c.timeX(t - D.arr[a.i]) + (a.jx - 0.5) * 8;
    const y = row.y + Math.min(row.h - 2, 8 + 28 * K * 0.55 + a.jy * Math.max(2, row.h - 10 - 28 * K * 0.55));
    return [x, Math.max(y, c.floor.y + 36 * K)]; // never let a sprout poke into the door bar above the floor
  }
  function makeAgent(i, st, t) {
    const a = { i, x: 0, y: 0, stage: st, jx: (0.5 + i * 0.7548776662) % 1, jy: (0.5 + i * 0.569840291) % 1, /* evenly spread offsets so markers do not pile up */
      ph: D.hash(i, 9) * 9, alpha: 1, vis: 1, script: [], si: 0, mood: -1, mt: 0, moving: false, dead: false, u: 0, cell: D.hspOfSite[D.site[i]] };
    const p = st === 1 ? waitTarget(a, t) : floorBase(a, t); a.x = p[0]; a.y = p[1];
    return a;
  }
  function flush(a) {
    for (; a.si < a.script.length; a.si++) { const s = a.script[a.si]; if (s.t === 'walk') { a.x = s.x; a.y = s.y; } else if (s.t === 'call') s.f(a); else if (s.t === 'fade') a.dead = true; }
    a.script = []; a.si = 0; a.vis = 1;
  }
  function run(a, steps) { if (a.script.length) flush(a); a.script = steps; a.si = 0; }
  const walk = (x, y, sp) => ({ t: 'walk', x, y, sp: sp || 140 });
  const hold = (d) => ({ t: 'hold', d, el: 0 });
  const call = (f) => ({ t: 'call', f });
  function pop(x, y, text, color) {
    if (popups.length >= 14) return; // keep the scene readable when many things happen at once
    for (let k = 0; k < popups.length; k++) { const q = popups[k]; if (Math.abs(q.x - x) < 70 && Math.abs(q.y - y) < 12) return; }
    popups.push({ x, y, text, color, life: 1.6, age: 0 });
  }

  function onArrive(i) {
    if (agents.has(i)) return;
    const a = makeAgent(i, 1, Scene.t); const e = ests[D.site[i]];
    // The marker appears (fades in) directly in its triage lane; the site dot on the map flashes to show where
    // the person arrived. Walking from the map made ATS 1 markers cut across the other lanes on their way to Resus.
    if (e) e.pulse = 1;
    a.alpha = 0.25; a.spawn = 1;
    agents.set(i, a); list.push(a);
  }
  function onSeen(i) {
    const a = agents.get(i); if (!a) return;
    const c = L.cells[a.cell], d = c.doorOf[D.area[i]] || c.doors[0], steps = [];
    if (L.portrait) steps.push(walk(a.x, L.yard.y + L.yard.h + 8));
    else steps.push(walk(L.yard.x + L.yard.w + 6, a.y));
    steps.push(walk(d.x, d.y - 2), call((q) => { q.vis = 0; d.glow = 1; }), hold(0.25), call((q) => { q.vis = 1; q.stage = 2; q.y = d.y + 6; q.mt = 1.4; q.mo = 1; }), { t: 'home' });
    run(a, steps);
  }
  function onReady(i) {
    const a = agents.get(i); if (!a) return;
    a.stage = 3; const key = D.depGroupKeys[D.depGrp[D.dep[i]]];
    if (key === 'admitted' && !L.portrait) pop(a.x, a.y - 36 * K, 'ready to be admitted', '#9cc4ff');
  }
  function onDepart(i) {
    const a = agents.get(i); if (!a) return;
    const key = D.depGroupKeys[D.depGrp[D.dep[i]]], c = L.cells[a.cell];
    if (a.stage === 1 || key === 'dnw' || key === 'triage') { // left from the waiting lane
      const txt = key === 'dnw' ? 'did not wait' : key === 'triage' ? 'referred at triage' : 'left';
      run(a, [call((q) => { q.mt = 1.6; q.mo = 3; pop(q.x, q.y - 36 * K, txt, '#f5b94a'); }), walk(a.x - 30, a.y, 60), { t: 'fade', rate: 1.4 }]);
      return;
    }
    if (key === 'other') { run(a, [{ t: 'fade', rate: 0.8 }]); return; } // quiet exit, no label (includes deaths; see LANGUAGE-GUIDE)
    if (key === 'virtual') { run(a, [call((q) => { q.mt = 1.2; q.mo = 1; pop(q.x, q.y - 36 * K, 'care completed at home', '#7ff0b0'); }), hold(0.3), { t: 'fade', rate: 1.2 }]); return; }
    const gate = key === 'admitted' ? c.gates.ward : key === 'transfer' ? c.gates.transfer : c.gates.home;
    const txt = key === 'admitted' ? 'admitted' : key === 'transfer' ? 'transferred' : key === 'laor' ? 'left at own risk' : 'home';
    const colr = key === 'admitted' ? '#9cc4ff' : key === 'transfer' ? '#c9a6ff' : key === 'laor' ? '#f5b94a' : '#7ff0b0';
    run(a, [walk(gate.x - 14, gate.y + 8, 110), call((q) => { q.mt = 1; q.mo = key === 'laor' ? 0 : 1; pop(gate.x - 10, gate.y - 16, txt, colr); }), { t: 'fade', rate: 1.6 }]);
  }

  function updateAgent(a, dt) {
    a.ph += dt * 9; a.moving = false;
    if (a.mt > 0) { a.mt -= dt; if (a.mt <= 0) a.mo = -1; }
    if (a.si < a.script.length) {
      for (let n = 0; n < 6 && a.si < a.script.length; n++) {
        const s = a.script[a.si];
        if (s.t === 'call') { s.f(a); a.si++; continue; }
        if (s.t === 'hold') { s.el += dt * Scene.animF; if (s.el >= s.d) { a.si++; continue; } break; }
        if (s.t === 'fade') { a.alpha -= dt * s.rate * Scene.animF; if (a.alpha <= 0) a.dead = true; break; }
        if (s.t === 'home') { const p = floorBase(a, Scene.t); s.x = p[0]; s.y = p[1]; s.t = 'walk'; s.sp = 120; }
        if (s.t === 'walk') {
          const dx = s.x - a.x, dy = s.y - a.y, dist = Math.hypot(dx, dy), stp = s.sp * dt * Scene.animF;
          if (dist <= stp) { a.x = s.x; a.y = s.y; a.si++; continue; }
          a.x += (dx / dist) * stp; a.y += (dy / dist) * stp; a.moving = true; break;
        }
      }
      if (a.si >= a.script.length) { a.script = []; a.si = 0; }
      return;
    }
    // idle: glide toward the current target. The target moves smoothly with the clock, so motion is steady and does not jitter.
    const p = a.stage === 1 ? waitTarget(a, Scene.t) : floorBase(a, Scene.t);
    const dx = p[0] - a.x, dy = p[1] - a.y, dist = Math.hypot(dx, dy);
    if (dist > 0.4) { const k = Math.min(1, dt * Scene.animF * 4); const stp = Math.min(dist, Math.max(dist * k, 30 * dt)); a.x += (dx / dist) * stp; a.y += (dy / dist) * stp; a.moving = dist > 4 && stp / dt > 20; }
  }

  /* ---------- events and seeking ---------- */
  const sampled = (i) => D.pass[i] && D.hash(i, 1) < 1 / Scene.density;
  Scene.setup = function () {
    const T = [], Ty = [], P = [];
    for (let n = 0; n < D.idx.length; n++) {
      const i = D.idx[n]; if (!sampled(i)) continue;
      const a = D.arr[i]; T.push(a); Ty.push(0); P.push(i);
      if (D.seen[i] >= 0) { T.push(a + D.seen[i] + 0.01); Ty.push(1); P.push(i); }
      if (D.ready[i] >= 0 && D.seen[i] >= 0 && D.ready[i] < D.los[i]) { T.push(a + D.ready[i] + 0.02); Ty.push(2); P.push(i); }
      T.push(a + D.los[i] + 0.03); Ty.push(3); P.push(i);
    }
    const ord = Array.from(T.keys()).sort((x, y) => T[x] - T[y]);
    ev = { t: Float64Array.from(ord.map((o) => T[o])), ty: Uint8Array.from(ord.map((o) => Ty[o])), p: Int32Array.from(ord.map((o) => P[o])) };
    Scene.seek(Scene.t);
  };
  Scene.seek = function (t) {
    if (!L || !ev) return;
    Scene.t = t; agents = new Map(); popups = [];
    let lo = 0, hi = ev.t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev.t[m] <= t) lo = m + 1; else hi = m; } ptr = lo;
    for (let n = D.lower(t - D.meta.maxStayMin); n < D.idx.length; n++) {
      const i = D.idx[n]; if (D.arr[i] > t) break; if (!sampled(i)) continue;
      const st = D.stage(i, t); if (st >= 1 && st <= 3) agents.set(i, makeAgent(i, st, t));
    }
    L.cells.forEach((c) => c.doors && c.doors.forEach((d) => { d.glow = 0; }));
    ests.forEach((e) => { if (e) e.pulse = 0; });
    list = Array.from(agents.values());
  };

  Scene.advance = function (dt, minPerSec, playing) {
    Scene.animF = clamp(0.8 + minPerSec / 40, 1, 3);
    if (!ev) return;
    if (playing) {
      const t1 = Math.min(D.MIN - 1, Scene.t + dt * minPerSec);
      if (t1 >= D.MIN - 1.5) Scene.finished = true;
      Scene.t = t1;
      while (ptr < ev.t.length && ev.t[ptr] <= Scene.t) {
        const i = ev.p[ptr], ty = ev.ty[ptr];
        if (ty === 0) onArrive(i); else if (ty === 1) onSeen(i); else if (ty === 2) onReady(i); else onDepart(i);
        ptr++;
      }
    }
    let dead = false;
    for (let n = 0; n < list.length; n++) { const a = list[n]; updateAgent(a, dt); if (a.spawn) { a.alpha = Math.min(1, a.alpha + dt * 2); if (a.alpha >= 1) a.spawn = 0; } if (a.dead) dead = true; }
    if (dead) { list = list.filter((a) => !a.dead); agents.forEach((a, i) => { if (a.dead) agents.delete(i); }); }
    for (let n = popups.length - 1; n >= 0; n--) { const p = popups[n]; p.age += dt; p.y -= dt * 14; if (p.age > p.life) popups.splice(n, 1); }
    L.cells.forEach((c) => c.doors && c.doors.forEach((d) => { if (d.glow > 0) d.glow = Math.max(0, d.glow - dt * 1.5); }));
    ests.forEach((e) => { if (e && e.pulse > 0) e.pulse = Math.max(0, e.pulse - dt * 1.2); });
  };

  /* ---------- render ---------- */
  function spriteFor(a) {
    const past = a.stage === 1 && a.u > 1;
    const mood = a.mo >= 0 && a.mt > 0 ? a.mo : past ? 2 : a.stage === 1 ? 0 : 1;
    return SP.get(colorOf(a.i), RING[a.stage] || 0, mood);
  }
  Scene.siteInfo = function (si) { const e = D.dims.establishments[si], st = stats; return { e, waiting: st ? st.siteWait[si] : 0, inCare: st ? st.siteIn[si] : 0, arr24: st ? st.site24[si] : 0 }; };
  function siteActive(si) { const f = D.filter, e = D.dims.establishments[si]; if (f.site >= 0 && f.site !== si) return false; if (f.hsp >= 0 && f.hsp !== e.hsp) return false; if (f.region >= 0 && f.region !== e.region) return false; return true; }

  Scene.render = function () {
    if (!L) return;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0);
    if (!bg) { bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height; const b = bg.getContext('2d'); b.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0); drawBg(b); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0); ctx.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0);
    ctx.textBaseline = 'alphabetic';
    L.cells.forEach((c) => c.doors && c.doors.forEach((d) => { if (d.glow > 0) { const gr = ctx.createRadialGradient(d.x, d.y - d.h / 2, 2, d.x, d.y - d.h / 2, 22 * d.glow + 8); gr.addColorStop(0, 'rgba(90,209,154,.8)'); gr.addColorStop(1, 'rgba(90,209,154,0)'); ctx.fillStyle = gr; ctx.fillRect(d.x - 40, d.y - 50, 80, 70); } }));
    drawSites();
    if (stats) { drawLaneStats(); drawCellStats(); drawRegions(); drawSpotlight(); }
    // markers, drawn back to front
    const arr = list.slice().sort((p, q) => p.y - q.y);
    for (let n = 0; n < arr.length; n++) {
      const a = arr[n]; if (!a.vis || (a.dead && a.alpha <= 0)) continue;
      const s = spriteFor(a), bob = a.moving ? Math.abs(Math.sin(a.ph)) * 2.4 * K : 0;
      const fade = clamp(a.alpha, 0, 1); // only used while appearing or leaving, never to rank importance
      ctx.globalAlpha = fade * 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(a.x, a.y, s.bw * 0.5 * K, 2.4 * K, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = fade;
      if (!a.moving) {
        if (a.stage === 1 && a.u > 1) { ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(a.x, a.y, s.bw * 0.5 * K + 3, 3.8 * K, 0, 0, 7); ctx.stroke(); }
        else if (a.stage >= 2 && !D.virt[D.site[a.i]] && Scene.t - D.arr[a.i] > H4) { ctx.strokeStyle = '#f5b94a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(a.x, a.y, s.bw * 0.5 * K + 3, 3.8 * K, 0, 0, 7); ctx.stroke(); }
      }
      ctx.drawImage(s.cv, a.x - s.cx * K, a.y - bob - s.ground * K, s.w * K, s.h * K);
      if (a.i === selected || a.i === hover) { ctx.globalAlpha = 1; ctx.strokeStyle = a.i === selected ? '#fff' : '#9cc4ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(a.x, a.y - (s.bh * K) / 2 - 3, s.bw * K * 0.5 + 6, s.bh * K * 0.5 + 10, 0, 0, 7); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.font = '700 ' + fz(10.5) + 'px ' + FONT;
    popups.forEach((p) => { const f = 1 - p.age / p.life, tw = ctx.measureText(p.text).width; p.x = clamp(p.x, tw / 2 + 4, L.W - tw / 2 - 4); ctx.globalAlpha = clamp(f * 1.8, 0, 1); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,10,20,.9)'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y); });
    ctx.globalAlpha = 1;
  };

  function drawSites() {
    const dm = D.dims;
    ests.forEach((p) => {
      if (!p) return; const e = dm.establishments[p.i], act = siteActive(p.i), col = act ? hcol(e.hsp) : GREY;
      if (p.pulse > 0 && act) { ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.globalAlpha = p.pulse * 0.9; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + (1 - p.pulse) * 10, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(5,10,20,.8)'; ctx.lineWidth = 0.8; ctx.stroke();
      if (p.i === D.filter.site || p.i === hoverSite) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 3, 0, 7); ctx.stroke(); }
    });
    // names of the larger metro sites in the inset, skipping any that would overlap
    ctx.font = '600 ' + fz(8) + 'px ' + FONT; ctx.textAlign = 'left'; const placed = [];
    ests.filter((p) => p && p.inset && ['TERT', 'PAED', 'METR'].includes(dm.establishments[p.i].tier)).sort((a, b) => dm.establishments[b.i].beds - dm.establishments[a.i].beds).forEach((p) => {
      const t = dm.establishments[p.i].short, w = ctx.measureText(t).width, bx = { x: p.x + p.r + 2, y: p.y - 8, w, h: 10 };
      if (bx.x + w > L.inset.x + L.inset.w + 2) bx.x = p.x - p.r - 2 - w;
      if (placed.some((q) => bx.x < q.x + q.w && bx.x + bx.w > q.x && bx.y < q.y + q.h && bx.y + bx.h > q.y)) return;
      placed.push(bx); ctx.fillStyle = 'rgba(230,240,255,.85)'; ctx.fillText(t, bx.x, bx.y + 8);
    });
  }

  function drawLaneStats() {
    const dm = D.dims;
    L.lanes.forEach((ln) => {
      const k = ln.k, n = stats.wait[k], over = stats.over[k], p = dm.triage[k];
      ctx.textAlign = 'right'; ctx.font = '700 ' + fz(11) + 'px ' + FONT; ctx.fillStyle = '#e3ecfb'; ctx.fillText(fmtN(n) + ' waiting', ln.x + ln.w - 8, ln.y + 18);
      let rw = 0;
      if (over) { ctx.font = fz(9.5) + 'px ' + FONT; ctx.fillStyle = '#ff9a9a'; const t = fmtN(over) + ' past target'; rw = ctx.measureText(t).width; ctx.fillText(t, ln.x + ln.w - 8, ln.y + 33); }
      // seen on time in the last 7 days against the external KPI threshold for the category
      const den = stats.seenDen[k], ok = stats.seenOk[k], v = pct(ok, den);
      ctx.textAlign = 'left'; ctx.font = '600 ' + fz(9.5) + 'px ' + FONT;
      ctx.fillStyle = !den ? '#6f819e' : v >= p.kpiPct ? '#7fe0b4' : v >= p.kpiPct - 10 ? '#f5b94a' : '#ff8b8b';
      const room = ln.w - 16 - rw - 10;
      const txt = den ? fit(ctx, ['Seen on time (7 d): ' + v + '% · KPI ' + p.kpiPct + '%', 'On time (7 d): ' + v + '% · KPI ' + p.kpiPct + '%', 'On time: ' + v + '%', v + '%'], room) : fit(ctx, ['No one seen in the last 7 days', 'None seen (7 d)'], room);
      ctx.fillText(txt, ln.x + 8, ln.y + 33);
    });
  }

  function drawCellStats() {
    const dm = D.dims;
    L.cells.forEach((c) => {
      if (c.spot || !c.doors) return;
      ctx.textAlign = 'right'; ctx.font = '600 ' + fz(10) + 'px ' + FONT;
      const yy = c.y + (L.portrait ? 17 : 21), wTxt = fmtN(stats.hspWait[c.hsp]) + ' waiting', tail = ' in care · ', nIn = fmtN(stats.hspIn[c.hsp]);
      ctx.fillStyle = '#e3ecfb'; ctx.fillText(wTxt, c.x + c.w - 12, yy); const w2 = ctx.measureText(wTxt).width;
      ctx.fillStyle = '#8ea1c2'; ctx.fillText(tail, c.x + c.w - 12 - w2, yy); const wT = ctx.measureText(tail).width;
      ctx.fillStyle = '#7fe0b4'; ctx.fillText(nIn, c.x + c.w - 12 - w2 - wT, yy);
      // count per treatment-area row, under the row label
      ctx.textAlign = 'left'; ctx.font = '700 ' + fz(9) + 'px ' + FONT; ctx.fillStyle = '#c6d4ec';
      c.rows.forEach((r) => { if (r.h >= 24) ctx.fillText(fmtN(stats.area[c.hsp][r.k]), c.floor.x + 6, r.y + Math.min(r.h - 3, 25)); });
    });
  }

  function drawRegions() {
    const rl = L.regList, rs = D.dims.regions; let mx = 1; rs.forEach((r, i) => { mx = Math.max(mx, stats.regIn[i]); });
    ctx.font = fz(9.5) + 'px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#7f93b4'; ctx.fillText('In the ED now, by region of the site', rl.x, rl.y - 8);
    ctx.font = fz(10) + 'px ' + FONT;
    const name = (r) => (r.name === 'Statewide (virtual)' ? 'Virtual (WAVED)' : r.name);
    const lw = rs.reduce((m, q) => Math.max(m, ctx.measureText(name(q)).width), 0) + 8, nw = ctx.measureText('8,888').width + 4;
    rs.forEach((r, i) => {
      const y = rl.y + i * rl.rowH, n = stats.regIn[i], bx = rl.x + lw, bw = Math.max(10, rl.w - lw - nw);
      ctx.fillStyle = D.filter.region === i ? '#fff' : '#c6d4ec'; ctx.textAlign = 'left'; ctx.fillText(name(r), rl.x, y + 11);
      rrect(ctx, bx, y + 3, bw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
      if (n) { rrect(ctx, bx, y + 3, Math.max(3, (bw * n) / mx), 8, 4); ctx.fillStyle = Scene.hspCol[r.hsp]; ctx.fill(); }
      ctx.fillStyle = '#e3ecfb'; ctx.textAlign = 'right'; ctx.fillText(fmtN(n), rl.x + rl.w, y + 11);
    });
  }

  /* site spotlight + ranking (sixth block) */
  function drawSpotlight() {
    const c = L.spot, dm = D.dims, pad = 12, P = L.portrait; let y = c.y + (P ? 18 : 22);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8f0ff'; ctx.font = '700 ' + fz(12) + 'px ' + FONT; ctx.fillText('Site spotlight', c.x + pad, y);
    const si = hoverSite >= 0 ? hoverSite : D.filter.site; y += P ? 16 : 20;
    const room = c.w - 2 * pad;
    if (si >= 0) {
      const inf = Scene.siteInfo(si), e = inf.e;
      ctx.fillStyle = hcol(e.hsp); ctx.font = '700 ' + fz(11.5) + 'px ' + FONT; ctx.fillText(fit(ctx, [e.name, e.short], room), c.x + pad, y); y += P ? 14 : 16;
      ctx.fillStyle = '#9db0cf'; ctx.font = fz(9.5) + 'px ' + FONT;
      ctx.fillText(fit(ctx, ['Code ' + e.code + ' · ' + dm.hsps[e.hsp].code + ' · ' + (e.typeLabel || 'type not in List'), 'Code ' + e.code + ' · ' + dm.hsps[e.hsp].code], room), c.x + pad, y); y += P ? 13 : 14;
      ctx.font = '600 ' + fz(10) + 'px ' + FONT; ctx.fillStyle = '#e3ecfb';
      ctx.fillText(fit(ctx, [fmtN(inf.waiting) + ' waiting · ' + fmtN(inf.inCare) + ' in care · ' + fmtN(inf.arr24) + ' arrivals (24 h)', fmtN(inf.waiting) + ' waiting · ' + fmtN(inf.inCare) + ' in care'], room), c.x + pad, y); y += P ? 14 : 18;
    } else {
      ctx.fillStyle = '#7f93b4'; ctx.font = fz(9.5) + 'px ' + FONT; ctx.fillText(fit(ctx, ['Hover or click a dot on the map to see a site.', 'Tap a dot or a name below.'], room), c.x + pad, y); y += P ? 16 : 20;
    }
    ctx.fillStyle = '#9db0cf'; ctx.font = '700 ' + fz(10) + 'px ' + FONT; ctx.fillText(fit(ctx, ['Busiest sites, arrivals in the last 24 hours', 'Arrivals, last 24 h'], room), c.x + pad, y); y += P ? 6 : 8;
    const idx = stats.site24.map((v, i) => i).sort((a, b) => stats.site24[b] - stats.site24[a]);
    const rows = Math.max(5, Math.floor((c.y + c.h - 8 - y) / (P ? 17 : 17))), rh = (c.y + c.h - 8 - y) / rows, mx = Math.max(1, stats.site24[idx[0]]);
    ctx.font = fz(9.5) + 'px ' + FONT; const lw = Math.min(P ? 100 : 130, idx.slice(0, rows).reduce((m, i) => Math.max(m, ctx.measureText(dm.establishments[i].short).width), 0) + 8);
    const nw = ctx.measureText('8,888').width + 6;
    L.rankHits = [];
    for (let r = 0; r < rows; r++) {
      const i = idx[r], v = stats.site24[i], yy = y + r * rh, e = dm.establishments[i]; if (!v) break;
      ctx.fillStyle = D.filter.site === i ? '#fff' : '#c6d4ec'; ctx.textAlign = 'left'; ctx.fillText(fit(ctx, [e.short, short(e.short, 12)], lw - 6), c.x + pad, yy + rh * 0.72);
      const bw = ((c.w - 2 * pad - lw - nw) * v) / mx; ctx.fillStyle = hcol(e.hsp); rrect(ctx, c.x + pad + lw, yy + rh * 0.18, Math.max(2, bw), rh * 0.56, 3); ctx.fill();
      ctx.fillStyle = '#e3ecfb'; ctx.fillText(fmtN(v), c.x + pad + lw + Math.max(2, bw) + 5, yy + rh * 0.72);
      L.rankHits.push({ x: c.x, y: yy, w: c.w, h: rh, i });
    }
  }

  /* ---------- sizing and interaction ---------- */
  Scene.resize = function () {
    const w = Math.max(300, wrap.clientWidth);
    cssW = w; dpr = Math.min(2, window.devicePixelRatio || 1);
    const Lo = computeLayout(), h = Math.round((w * Lo.H) / Lo.W); sc = w / Lo.W;
    cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    L = Lo; bg = null; Scene.portrait = L.portrait;
    if (ev) Scene.seek(Scene.t);
  };
  Scene.tipHtml = function (r) {
    const st = ['', 'waiting ' + D.fmtDur(Scene.t - r.arr) + ' (target ≤' + r.triage.targetMin + ' min)', 'in care · ' + D.fmtDur(Scene.t - r.arr) + ' in the ED', 'ready to leave · ' + D.fmtDur(Scene.t - r.arr) + ' in the ED', 'left the ED'][r.st];
    return '<b>ATS ' + r.ats + ' ' + r.triage.label + '</b> · ' + r.grp.label + '<br>' + r.e.short + ' · ' + r.age + ' years<br>' + st;
  };
  Scene.init = function (canvas, wrapEl) {
    cv = canvas; ctx = cv.getContext('2d'); wrap = wrapEl;
    const toLogical = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / sc, (e.clientY - r.top) / sc]; };
    const nearest = (x, y, rad) => { let best = -1, bd = rad * rad; for (const a of list) { if (!a.vis) continue; const d = (a.x - x) ** 2 + (a.y - 14 * K - y) ** 2; if (d < bd) { bd = d; best = a.i; } } return best; };
    const nearSite = (x, y) => { let best = -1, bd = 1e9; ests.forEach((p) => { if (!p) return; const d = (p.x - x) ** 2 + (p.y - y) ** 2, rad = Math.max(p.r + 4, L.portrait ? 11 : 7); if (d < rad * rad && d < bd) { bd = d; best = p.i; } }); return best; };
    const rankAt = (x, y) => { if (!L.rankHits) return -1; const h = L.rankHits.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y < r.y + r.h); return h ? h.i : -1; };
    const tip = document.getElementById('tip');
    const place = (e) => { const wr = wrap.getBoundingClientRect(); tip.hidden = false; tip.style.left = Math.max(4, Math.min(e.clientX - wr.left + 14, wr.width - 240)) + 'px'; tip.style.top = e.clientY - wr.top + 14 + 'px'; };
    cv.addEventListener('mousemove', (e) => {
      const [x, y] = toLogical(e), h = nearest(x, y, 18 * K); hover = h; hoverSite = -1; let cur = 'default';
      if (h >= 0) { cur = 'pointer'; place(e); tip.innerHTML = Scene.tipHtml(D.record(h, Scene.t)); }
      else {
        const s = nearSite(x, y), rs = s < 0 ? rankAt(x, y) : -1;
        if (s >= 0) { hoverSite = s; cur = 'pointer'; const inf = Scene.siteInfo(s), q = inf.e; place(e); tip.innerHTML = '<b>' + q.name + '</b><br>Code ' + q.code + ' · ' + D.dims.hsps[q.hsp].code + ' · ' + D.dims.regions[q.region].name + '<br>' + fmtN(inf.waiting) + ' waiting · ' + fmtN(inf.inCare) + ' in care'; }
        else { tip.hidden = true; if (rs >= 0) { cur = 'pointer'; hoverSite = rs; } }
      }
      cv.style.cursor = cur;
    });
    cv.addEventListener('mouseleave', () => { hover = -1; hoverSite = -1; tip.hidden = true; });
    cv.addEventListener('click', (e) => {
      const [x, y] = toLogical(e), h = nearest(x, y, 22 * K);
      if (h >= 0) { selected = h; if (Scene.onPick) Scene.onPick(h); return; }
      const s = nearSite(x, y), r = s < 0 ? rankAt(x, y) : -1, pick = s >= 0 ? s : r;
      if (pick >= 0) { if (Scene.onSite) Scene.onSite(pick); return; }
      selected = -1; if (Scene.onPick) Scene.onPick(-1);
    });
  };
  Scene.select = (i) => { selected = i; };
  Scene.setStats = (s) => { stats = s; };
  Scene.agentCount = () => list.length;
  Scene.invalidate = () => { bg = null; };
  // logical rectangles of the main areas, used by the guided tour to place its highlight
  Scene.rects = () => (L ? { map: L.map, yard: L.yard, cells: L.cells, sc } : null);
})(window);
