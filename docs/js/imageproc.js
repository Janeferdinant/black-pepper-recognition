/*
 * Generic image-processing helpers for the illustrative demo.
 *
 * Everything here is a textbook technique (HSV conversion, colour thresholding,
 * binary morphology, connected components) applied to SYNTHETIC images that are
 * generated in code. It is not the implementation from the paper and it uses no
 * data from the paper.
 *
 * Works in the browser (window.ImageProc) and in Node (module.exports).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ImageProc = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- colour conversion ---------- */

  /** r,g,b in 0..255 -> { h: 0..360 (exclusive), s: 0..1, v: 0..1 } */
  function rgbToHsv(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === rn) h = 60 * (((gn - bn) / d) % 6);
      else if (max === gn) h = 60 * ((bn - rn) / d + 2);
      else h = 60 * ((rn - gn) / d + 4);
      if (h < 0) h += 360;
      if (h >= 360) h -= 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }

  /** h 0..360, s,v 0..1 -> [r,g,b] integers 0..255 */
  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  /* ---------- thresholding ---------- */

  function hueInRange(h, hMin, hMax) {
    return hMin <= hMax ? (h >= hMin && h <= hMax) : (h >= hMin || h <= hMax); // wraps past 360
  }

  /**
   * data: RGBA array (Uint8ClampedArray or similar). Returns Uint8Array mask (1 = inside range).
   * t: { hMin, hMax, sMin, sMax, vMin, vMax }. If hMin > hMax the hue range wraps through 0.
   */
  function hsvThreshold(data, w, h, t) {
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const p = rgbToHsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (p.s >= t.sMin && p.s <= t.sMax && p.v >= t.vMin && p.v <= t.vMax && hueInRange(p.h, t.hMin, t.hMax)) out[i] = 1;
    }
    return out;
  }

  /* ---------- binary morphology (square structuring element, side 2r+1) ----------
   * Out-of-image pixels are ignored (neutral), as in OpenCV's default border handling,
   * so objects touching the border are not eroded away from the border side.
   */

  function slide(src, w, h, r, pickMin) {
    // separable min/max filter: horizontal pass, then vertical pass
    const tmp = new Uint8Array(w * h);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
        let v = pickMin ? 1 : 0;
        for (let k = x0; k <= x1; k++) {
          const s = src[y * w + k];
          if (pickMin ? s < v : s > v) { v = s; break; }
        }
        tmp[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      for (let x = 0; x < w; x++) {
        let v = pickMin ? 1 : 0;
        for (let k = y0; k <= y1; k++) {
          const s = tmp[k * w + x];
          if (pickMin ? s < v : s > v) { v = s; break; }
        }
        out[y * w + x] = v;
      }
    }
    return out;
  }

  function erode(mask, w, h, r) {
    if (!r || r < 1) return Uint8Array.from(mask);
    return slide(mask, w, h, r | 0, true);
  }
  function dilate(mask, w, h, r) {
    if (!r || r < 1) return Uint8Array.from(mask);
    return slide(mask, w, h, r | 0, false);
  }
  /** erosion then dilation: removes specks smaller than the element */
  function open(mask, w, h, r) { return dilate(erode(mask, w, h, r), w, h, r); }
  /** dilation then erosion: fills holes smaller than the element */
  function close(mask, w, h, r) { return erode(dilate(mask, w, h, r), w, h, r); }

  /* ---------- connected components (4-connectivity) ---------- */

  function connectedComponents(mask, w, h) {
    const labels = new Int32Array(w * h);
    const components = [];
    const stack = [];
    let next = 0;
    for (let start = 0; start < w * h; start++) {
      if (!mask[start] || labels[start]) continue;
      next++;
      let area = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
      labels[start] = next;
      stack.push(start);
      while (stack.length) {
        const p = stack.pop();
        const x = p % w, y = (p - x) / w;
        area++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = next; stack.push(p - 1); }
        if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = next; stack.push(p + 1); }
        if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = next; stack.push(p - w); }
        if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = next; stack.push(p + w); }
      }
      components.push({ id: next, area, bbox: { x0, y0, x1, y1 }, cx: sx / area, cy: sy / area });
    }
    return { labels, components };
  }

  function filterByArea(mask, w, h, minArea) {
    const { labels, components } = connectedComponents(mask, w, h);
    const keep = new Uint8Array(components.length + 1);
    components.forEach((c) => { if (c.area >= minArea) keep[c.id] = 1; });
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (labels[i] && keep[labels[i]]) out[i] = 1;
    return out;
  }

  function countForeground(mask) {
    let n = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
    return n;
  }

  /* ---------- synthetic scene generator ---------- */

  /** mulberry32: small seeded PRNG, returns floats in [0,1) */
  function createRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Draws an abstract, cartoon-like pepper-vine scene: soft background, a brown branch,
   * green leaves, one reddish dry leaf (a colour look-alike), hanging spikes of green
   * berries and a few red-orange berries, plus specular highlights and speckle noise.
   * Pure function of (w, h, seed). Returns { width, height, data (RGBA), seed }.
   */
  function generateScene(w, h, seed) {
    const rnd = createRng(seed);
    const rr = (a, b) => a + (b - a) * rnd();
    const data = new Uint8ClampedArray(w * h * 4);

    function put(x, y, rgb) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
    }
    function ellipse(cx, cy, rx, ry, ang, color, shade) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const R = Math.ceil(Math.max(rx, ry)) + 1;
      for (let y = Math.floor(cy) - R; y <= Math.ceil(cy) + R; y++) {
        for (let x = Math.floor(cx) - R; x <= Math.ceil(cx) + R; x++) {
          const dx = x - cx, dy = y - cy;
          const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
          const d2 = u * u + v * v;
          if (d2 > 1) continue;
          const c = color();
          // darker toward the rim, lighter toward the top-left, to look rounded
          const light = 1 - shade * d2 + shade * 0.5 * (-(u + v) * 0.5);
          put(x, y, hsvToRgb(c[0], c[1], Math.max(0, Math.min(1, c[2] * light))));
        }
      }
    }
    function thickLine(x0, y0, x1, y1, width, color) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(2, Math.ceil(len * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
        const R = Math.ceil(width / 2);
        for (let y = Math.round(cy) - R; y <= Math.round(cy) + R; y++) {
          for (let x = Math.round(cx) - R; x <= Math.round(cx) + R; x++) {
            if (Math.hypot(x - cx, y - cy) <= width / 2) put(x, y, hsvToRgb(...color()));
          }
        }
      }
    }
    const jitter = (h0, s0, v0, dh, ds, dv) => () => [h0 + rr(-dh, dh), s0 + rr(-ds, ds), v0 + rr(-dv, dv)];

    // 1. soft, low-saturation background (out-of-focus scene)
    const bgHue = rr(190, 215);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gy = y / h;
        put(x, y, hsvToRgb(bgHue + rr(-4, 4), 0.1 + rr(-0.03, 0.03), 0.66 - 0.2 * gy + rr(-0.03, 0.03)));
      }
    }

    // 2. branch: a gently curved dark-brown band
    const by = (x) => h * 0.26 + Math.sin(x / w * Math.PI * 1.3 + seed) * h * 0.05;
    const bw = Math.max(3, h * 0.05);
    for (let x = 0; x < w - 1; x += 1) thickLine(x, by(x), x + 1, by(x + 1), bw, jitter(24, 0.55, 0.38, 3, 0.04, 0.03));

    // 3. green leaves
    const nLeaves = 8 + Math.floor(rnd() * 4);
    for (let i = 0; i < nLeaves; i++) {
      const cx = rr(0.05, 0.95) * w, cy = rr(0.12, 0.92) * h;
      ellipse(cx, cy, rr(0.07, 0.11) * w, rr(0.035, 0.055) * w, rr(0, Math.PI), jitter(rr(95, 130), 0.65, 0.48, 6, 0.1, 0.1), 0.35);
    }

    // 4. a reddish dry leaf: similar colour to ripe berries, but leaf-shaped
    ellipse(rr(0.62, 0.88) * w, rr(0.7, 0.88) * h, 0.09 * w, 0.04 * w, rr(0, Math.PI), jitter(12, 0.62, 0.6, 3, 0.05, 0.04), 0.3);

    // 5. hanging spikes of berries
    const br = Math.max(3, Math.round(w * 0.028));
    const nSpikes = 3;
    const ripeSpike = Math.floor(rnd() * nSpikes); // at least one spike carries coloured berries
    for (let s = 0; s < nSpikes; s++) {
      const sx = ((s + 0.5) / nSpikes) * w + rr(-0.05, 0.05) * w;
      const sy = by(sx) + bw / 2;
      const nb = 6 + Math.floor(rnd() * 3);
      const ripe = s === ripeSpike || rnd() < 0.3;
      const nRipe = ripe ? 2 + Math.floor(rnd() * 2) : 0;
      const spacing = br * 1.75;
      const sway = rr(-0.35, 0.35);
      thickLine(sx, sy, sx + sway * nb * spacing * 0.5, sy + nb * spacing, 1.2, jitter(70, 0.5, 0.45, 5, 0.05, 0.05));
      for (let k = 0; k < nb; k++) {
        const px = sx + sway * (k + 1) * spacing * 0.5 + (k % 2 ? br * 0.55 : -br * 0.55);
        const py = sy + (k + 1) * spacing;
        const isRipe = k >= nb - nRipe;
        const col = isRipe ? jitter(rr(358, 372) % 360, 0.82, 0.82, 6, 0.06, 0.05) : jitter(rr(70, 100), 0.7, 0.66, 5, 0.08, 0.06);
        ellipse(px, py, br, br, 0, col, 0.35);
        // specular highlight (a small near-white spot)
        put(Math.round(px - br * 0.4), Math.round(py - br * 0.4), hsvToRgb(0, 0.04, 0.97));
        if (br >= 4) put(Math.round(px - br * 0.4) + 1, Math.round(py - br * 0.4), hsvToRgb(0, 0.04, 0.97));
      }
    }

    // 6. sensor-like speckle: a few isolated red-ish pixels
    const nSpeckle = Math.round(w * h * 0.004);
    for (let i = 0; i < nSpeckle; i++) put(Math.floor(rnd() * w), Math.floor(rnd() * h), hsvToRgb(rr(0, 10), 0.85, 0.85));

    return { width: w, height: h, data, seed };
  }

  /* ---------- demo pipeline: threshold -> clean-up -> filter blobs ---------- */

  const DEFAULT_THRESHOLDS = { hMin: 340, hMax: 25, sMin: 0.55, sMax: 1, vMin: 0.5, vMax: 1 };
  const DEFAULT_PARAMS = Object.assign({}, DEFAULT_THRESHOLDS, { op: 'open', radius: 1, minArea: 12 });

  function applyOp(mask, w, h, op, radius) {
    if (op === 'open') return open(mask, w, h, radius);
    if (op === 'close') return close(mask, w, h, radius);
    if (op === 'open+close') return close(open(mask, w, h, radius), w, h, radius);
    return Uint8Array.from(mask);
  }

  function runPipeline(scene, p) {
    const { width: w, height: h, data } = scene;
    const raw = hsvThreshold(data, w, h, p);
    const cleaned = applyOp(raw, w, h, p.op, p.radius);
    const final = filterByArea(cleaned, w, h, p.minArea);
    const candidates = connectedComponents(final, w, h).components;
    return { raw, cleaned, final, candidates };
  }

  return {
    rgbToHsv, hsvToRgb, hsvThreshold, erode, dilate, open, close,
    connectedComponents, filterByArea, countForeground,
    createRng, generateScene, runPipeline,
    DEFAULT_THRESHOLDS, DEFAULT_PARAMS,
  };
}));
