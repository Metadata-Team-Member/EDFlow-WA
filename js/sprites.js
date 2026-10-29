/* EDFlow WA: the person markers. Drawing code is identical to OutpatientFlow WA (same faces, same shape);
   only these comments differ. OF is the shared namespace of both projects.
   Every marker has the same rounded, gender-neutral shape with a leaf sprout: no hair, no clothes, one fixed size.
   In the ED scene the ground rings show the stage of care (see scene.js RING): no ring = waiting to be seen;
   one ring = clinical care has started; two rings = ready to leave the ED (for example, waiting for a ward bed).
   Sprites are drawn once and cached. */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {});
  const S = {};
  OF.Sprites = S;
  const NB = 24; S.NB = NB;
  const SS = 2; // sprite supersampling
  const cache = new Map();

  function shade(rgb, k) { // k>0 lighten, k<0 darken
    return rgb.map((v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))));
  }
  const css = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')';
  S.hsl = function (h, s, l) { // -> rgb array
    s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  };

  S.MARKER_W = 13; S.MARKER_H = 28; // a narrow, upright, uniform marker shape: the same for every person
  S.dims = function (bucket) { // the marker shape is a fixed size; only the ring changes with the bucket (stage of care)
    const gr = bucket / (NB - 1);
    const rings = bucket <= 0 ? 0 : 1 + Math.min(2, Math.floor(gr * 3));
    const rx = bucket <= 0 ? 0 : 8.5 + 8 * Math.pow(gr, 0.8); // ring radius stays close to the marker so rings add little footprint
    return { w: S.MARKER_W, h: S.MARKER_H, rings, rx, ry: rx * 0.3, lw: 0.8 + 1.1 * gr, total: S.MARKER_H + 12 };
  };

  function rr(ctx, x, y, w, h, rt, rb) {
    ctx.beginPath();
    ctx.moveTo(x + rt, y); ctx.lineTo(x + w - rt, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rt);
    ctx.lineTo(x + w, y + h - rb); ctx.quadraticCurveTo(x + w, y + h, x + w - rb, y + h);
    ctx.lineTo(x + rb, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rb);
    ctx.lineTo(x, y + rt); ctx.quadraticCurveTo(x, y, x + rt, y); ctx.closePath();
  }

  // mood: 0 calm, 1 happy, 2 sad, 3 oops
  S.get = function (rgb, bucket, mood) {
    const key = rgb.join(',') + '|' + bucket + '|' + mood;
    let s = cache.get(key); if (s) return s;
    const d = S.dims(bucket); const gr = bucket / (NB - 1);
    const pad = 4, W = Math.max(d.w, d.rx * 2 + d.lw) + pad * 2, H = d.total + pad * 2 + d.ry;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(W * SS); cv.height = Math.ceil(H * SS);
    const ctx = cv.getContext('2d'); ctx.scale(SS, SS);
    const cx = W / 2, ground = H - pad - d.ry;
    const bw = d.w, bh = d.h, bx = cx - bw / 2, by = ground - 3 - bh;
    const rt = Math.min(bw / 2, bh * 0.5), rb = Math.min(bw / 2, bh * 0.42); // fully rounded top and base
    // ground rings: higher bucket = more and wider rings (drawn behind the marker)
    for (let k = 0; k < d.rings; k++) {
      const f = (k + 1) / d.rings; const rx = d.rx * (0.45 + 0.55 * f), ry = rx * 0.3;
      ctx.strokeStyle = css(shade(rgb, 0.1), 0.35 + 0.5 * f * 0.8); ctx.lineWidth = d.lw * (0.7 + 0.5 * f);
      ctx.beginPath(); ctx.ellipse(cx, ground - 1, rx, ry, 0, 0, 7); ctx.stroke();
    }
    // soft shadow is drawn by the scene. feet:
    ctx.fillStyle = css(shade(rgb, -0.38));
    const fw = Math.max(3.4, bw * 0.24), fo = Math.max(2.4, bw * 0.2);
    ctx.beginPath(); ctx.ellipse(cx - fo, ground - 1.8, fw * 0.6, 2.2, 0, 0, 7); ctx.ellipse(cx + fo, ground - 1.8, fw * 0.6, 2.2, 0, 0, 7); ctx.fill();
    // sprout
    const sx = cx + bw * 0.04, sy = by + 1, sl = 6 + 3 * gr;
    ctx.strokeStyle = '#4dbb77'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - 1, sy - sl * 0.6, sx + 1, sy - sl); ctx.stroke();
    const leaf = (ang, len, col) => { ctx.save(); ctx.translate(sx + 1, sy - sl); ctx.rotate(ang); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(len * 0.55, 0, len * 0.6, len * 0.3, 0, 0, 7); ctx.fill(); ctx.restore(); };
    const ll = 3.8 + 2.2 * gr; leaf(-2.5, ll, '#8be69e'); leaf(-0.45, ll * 1.05, '#52c97a');
    // marker shape
    const gdt = ctx.createLinearGradient(bx, by, bx + bw, by + bh * 0.6);
    gdt.addColorStop(0, css(shade(rgb, 0.28))); gdt.addColorStop(0.55, css(rgb)); gdt.addColorStop(1, css(shade(rgb, -0.22)));
    rr(ctx, bx, by, bw, bh, rt, rb); ctx.fillStyle = gdt; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = css(shade(rgb, -0.45), 0.55); ctx.stroke();
    // highlight
    ctx.save(); rr(ctx, bx, by, bw, bh, rt, rb); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(bx + bw * 0.32, by + bh * 0.2, bw * 0.17, bh * 0.09, -0.3, 0, 7); ctx.fill();
    ctx.restore();
    // face
    const er = Math.max(2.1, Math.min(4.8, bw * 0.17)); const ey = by + bh * 0.34; const es = Math.max(er * 1.3, bw * 0.22);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx - es, ey, er, er * 1.12, 0, 0, 7); ctx.ellipse(cx + es, ey, er, er * 1.12, 0, 0, 7); ctx.fill();
    const lookY = mood === 2 ? 0.5 : mood === 1 ? -0.2 : 0.1;
    ctx.fillStyle = '#0d2236';
    ctx.beginPath(); ctx.arc(cx - es, ey + lookY, er * 0.58, 0, 7); ctx.arc(cx + es, ey + lookY, er * 0.58, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - es + er * 0.2, ey + lookY - er * 0.22, er * 0.2, 0, 7); ctx.arc(cx + es + er * 0.2, ey + lookY - er * 0.22, er * 0.2, 0, 7); ctx.fill();
    if (mood === 2 || mood === 3) { // concerned brows
      ctx.strokeStyle = css(shade(rgb, -0.6), 0.8); ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - es - er, ey - er * 1.6 + (mood === 2 ? 1 : 0)); ctx.lineTo(cx - es + er * 0.8, ey - er * 1.9); ctx.moveTo(cx + es + er, ey - er * 1.6 + (mood === 2 ? 1 : 0)); ctx.lineTo(cx + es - er * 0.8, ey - er * 1.9); ctx.stroke();
    }
    const my = ey + er * 2.7, mw = Math.max(1.8, Math.min(6.5, bw * 0.15));
    ctx.strokeStyle = '#0d2236'; ctx.lineWidth = 1.25; ctx.lineCap = 'round'; ctx.beginPath();
    if (mood === 1) { ctx.moveTo(cx - mw, my - 0.6); ctx.quadraticCurveTo(cx, my + mw * 0.95, cx + mw, my - 0.6); }
    else if (mood === 2) { ctx.moveTo(cx - mw * 0.8, my + 1.4); ctx.quadraticCurveTo(cx, my - mw * 0.55, cx + mw * 0.8, my + 1.4); }
    else if (mood === 3) { ctx.arc(cx, my + 0.6, Math.max(1, mw * 0.32), 0, 7); }
    else { ctx.moveTo(cx - mw * 0.8, my); ctx.quadraticCurveTo(cx, my + mw * 0.45, cx + mw * 0.8, my); }
    ctx.stroke();
    if (mood === 1 && bw > 16) { ctx.fillStyle = 'rgba(255,120,150,.28)'; ctx.beginPath(); ctx.ellipse(cx - es - er * 0.9, my - 1, er * 0.9, er * 0.55, 0, 0, 7); ctx.ellipse(cx + es + er * 0.9, my - 1, er * 0.9, er * 0.55, 0, 0, 7); ctx.fill(); }
    s = { cv, w: W, h: H, cx, ground, bw, bh, topY: H - d.total - pad - d.ry };
    cache.set(key, s);
    if (cache.size > 2500) cache.clear();
    return s;
  };

  S.palette = {
    prio: [[255, 107, 107], [247, 185, 74], [79, 209, 197]],
    stage: [[132, 150, 186], [246, 196, 83], [90, 209, 154], [64, 170, 255]],
  };
  S.specColor = (hue) => S.hsl(hue, 70, 62);
  S.regionColor = (i) => S.hsl((i * 47 + 20) % 360, 62, 64);
  S.rgbCss = css;
})(window);
