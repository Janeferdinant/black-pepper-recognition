'use strict';
// Tests for the generic image-processing helpers used by the illustrative demo.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const IP = require('../docs/js/imageproc.js');

// ---------- helpers ----------
function maskFrom(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const m = new Uint8Array(w * h);
  rows.forEach((row, y) => [...row].forEach((c, x) => { m[y * w + x] = c === '#' ? 1 : 0; }));
  return { m, w, h };
}
function maskToRows(m, w, h) {
  const out = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) s += m[y * w + x] ? '#' : '.';
    out.push(s);
  }
  return out;
}
function rgba(w, h, pixels) {
  const d = new Uint8ClampedArray(w * h * 4);
  pixels.forEach((p, i) => { d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; d[i * 4 + 3] = 255; });
  return d;
}
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

// ---------- rgbToHsv ----------
test('rgbToHsv: primary colours', () => {
  let c = IP.rgbToHsv(255, 0, 0);
  close(c.h, 0); close(c.s, 1); close(c.v, 1);
  c = IP.rgbToHsv(0, 255, 0);
  close(c.h, 120); close(c.s, 1); close(c.v, 1);
  c = IP.rgbToHsv(0, 0, 255);
  close(c.h, 240); close(c.s, 1); close(c.v, 1);
});

test('rgbToHsv: greys have zero saturation and hue 0', () => {
  const c = IP.rgbToHsv(128, 128, 128);
  close(c.h, 0); close(c.s, 0); close(c.v, 128 / 255);
  const k = IP.rgbToHsv(0, 0, 0);
  close(k.v, 0); close(k.s, 0);
});

test('rgbToHsv: secondary colours and hue range', () => {
  close(IP.rgbToHsv(255, 255, 0).h, 60);
  close(IP.rgbToHsv(0, 255, 255).h, 180);
  close(IP.rgbToHsv(255, 0, 255).h, 300);
  // magenta-ish red just below 360 stays in [0,360)
  const c = IP.rgbToHsv(255, 0, 10);
  assert.ok(c.h > 350 && c.h < 360);
});

test('hsvToRgb: known values and round trip', () => {
  assert.deepEqual(IP.hsvToRgb(0, 1, 1), [255, 0, 0]);
  assert.deepEqual(IP.hsvToRgb(120, 1, 1), [0, 255, 0]);
  assert.deepEqual(IP.hsvToRgb(240, 1, 1), [0, 0, 255]);
  assert.deepEqual(IP.hsvToRgb(0, 0, 0.5), [128, 128, 128]);
  for (const rgb of [[200, 30, 40], [12, 180, 90], [250, 250, 5], [70, 70, 200]]) {
    const { h, s, v } = IP.rgbToHsv(...rgb);
    const back = IP.hsvToRgb(h, s, v);
    back.forEach((ch, i) => assert.ok(Math.abs(ch - rgb[i]) <= 1, `${back} vs ${rgb}`));
  }
});

// ---------- hsvThreshold ----------
test('hsvThreshold: selects pixels inside the range only', () => {
  const data = rgba(4, 1, [[255, 0, 0], [0, 255, 0], [128, 128, 128], [200, 40, 40]]);
  const m = IP.hsvThreshold(data, 4, 1, { hMin: 340, hMax: 20, sMin: 0.5, sMax: 1, vMin: 0.3, vMax: 1 });
  assert.deepEqual([...m], [1, 0, 0, 1]);
});

test('hsvThreshold: hue range may wrap around 0/360', () => {
  const data = rgba(3, 1, [[255, 0, 20], [255, 30, 0], [0, 0, 255]]); // h~354, h~7, h=240
  const wrap = IP.hsvThreshold(data, 3, 1, { hMin: 340, hMax: 20, sMin: 0, sMax: 1, vMin: 0, vMax: 1 });
  assert.deepEqual([...wrap], [1, 1, 0]);
  const nowrap = IP.hsvThreshold(data, 3, 1, { hMin: 0, hMax: 20, sMin: 0, sMax: 1, vMin: 0, vMax: 1 });
  assert.deepEqual([...nowrap], [0, 1, 0]);
});

test('hsvThreshold: saturation and value limits are respected', () => {
  const data = rgba(3, 1, [[255, 0, 0], [90, 0, 0], [255, 200, 200]]);
  const m = IP.hsvThreshold(data, 3, 1, { hMin: 0, hMax: 10, sMin: 0.5, sMax: 1, vMin: 0.5, vMax: 1 });
  assert.deepEqual([...m], [1, 0, 0]); // dark red fails V, pale red fails S
});

// ---------- morphology ----------
test('erode shrinks a block and removes isolated pixels', () => {
  const { m, w, h } = maskFrom([
    '.......',
    '.###...',
    '.###..#',
    '.###...',
    '.......',
  ]);
  const out = IP.erode(m, w, h, 1);
  assert.deepEqual(maskToRows(out, w, h), [
    '.......',
    '.......',
    '..#....',
    '.......',
    '.......',
  ]);
});

test('dilate grows a pixel into a (2r+1) square', () => {
  const { m, w, h } = maskFrom([
    '.....',
    '.....',
    '..#..',
    '.....',
    '.....',
  ]);
  const out = IP.dilate(m, w, h, 1);
  assert.deepEqual(maskToRows(out, w, h), [
    '.....',
    '.###.',
    '.###.',
    '.###.',
    '.....',
  ]);
});

test('radius 0 is the identity and inputs are not mutated', () => {
  const { m, w, h } = maskFrom(['.#.', '###', '.#.']);
  const copy = Uint8Array.from(m);
  assert.deepEqual([...IP.erode(m, w, h, 0)], [...m]);
  assert.deepEqual([...IP.dilate(m, w, h, 0)], [...m]);
  IP.erode(m, w, h, 1); IP.dilate(m, w, h, 1);
  assert.deepEqual([...m], [...copy]);
});

test('erode ignores out-of-image pixels so a full mask stays full', () => {
  const m = new Uint8Array(5 * 4).fill(1);
  assert.deepEqual([...IP.erode(m, 5, 4, 2)], [...m]);
});

test('open removes speckle but keeps the large blob', () => {
  const { m, w, h } = maskFrom([
    '#.........',
    '..........',
    '...####...',
    '...####...',
    '...####...',
    '...####...',
    '.........#',
  ]);
  const out = IP.open(m, w, h, 1);
  const rows = maskToRows(out, w, h);
  assert.equal(rows[0][0], '.');
  assert.equal(rows[6][9], '.');
  assert.equal(rows[3].slice(3, 7), '####');
});

test('close fills a small hole inside a blob', () => {
  const { m, w, h } = maskFrom([
    '.........',
    '.........',
    '..#####..',
    '..##.##..',
    '..#####..',
    '.........',
    '.........',
  ]);
  const out = IP.close(m, w, h, 1);
  assert.deepEqual(maskToRows(out, w, h), [
    '.........',
    '.........',
    '..#####..',
    '..#####..',
    '..#####..',
    '.........',
    '.........',
  ]);
});

test('open is idempotent', () => {
  const { m, w, h } = maskFrom([
    '..........',
    '.####.....',
    '.####..#..',
    '.####.....',
    '.####.....',
    '..........',
  ]);
  const once = IP.open(m, w, h, 1);
  const twice = IP.open(once, w, h, 1);
  assert.deepEqual([...once], [...twice]);
});

// ---------- connected components ----------
test('connectedComponents: counts blobs, areas, bounding boxes (4-connectivity)', () => {
  const { m, w, h } = maskFrom([
    '##...#',
    '##...#',
    '.....#',
    '..#...',
    '...#..', // diagonal neighbour: separate under 4-connectivity
  ]);
  const { components } = IP.connectedComponents(m, w, h);
  assert.equal(components.length, 4);
  const big = components.find((c) => c.area === 4);
  assert.deepEqual(big.bbox, { x0: 0, y0: 0, x1: 1, y1: 1 });
  const col = components.find((c) => c.area === 3);
  assert.deepEqual(col.bbox, { x0: 5, y0: 0, x1: 5, y1: 2 });
  close(col.cx, 5); close(col.cy, 1);
});

test('connectedComponents: empty mask gives no components', () => {
  const { components, labels } = IP.connectedComponents(new Uint8Array(12), 4, 3);
  assert.equal(components.length, 0);
  assert.equal(labels.length, 12);
});

test('filterByArea keeps only blobs of at least minArea pixels', () => {
  const { m, w, h } = maskFrom([
    '##...#',
    '##....',
    '......',
    '...###',
  ]);
  const out = IP.filterByArea(m, w, h, 3);
  assert.deepEqual(maskToRows(out, w, h), [
    '##....',
    '##....',
    '......',
    '...###',
  ]);
  assert.equal(IP.countForeground(out), 7);
});

test('countForeground counts non-zero entries', () => {
  assert.equal(IP.countForeground(Uint8Array.from([0, 1, 1, 0, 1])), 3);
});

// ---------- synthetic scene generator ----------
test('createRng is deterministic for a seed and within [0,1)', () => {
  const a = IP.createRng(42), b = IP.createRng(42), c = IP.createRng(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  sa.forEach((v) => assert.ok(v >= 0 && v < 1));
});

test('generateScene: right size, opaque, deterministic, seed-sensitive', () => {
  const s1 = IP.generateScene(80, 60, 7);
  const s2 = IP.generateScene(80, 60, 7);
  const s3 = IP.generateScene(80, 60, 8);
  assert.equal(s1.width, 80); assert.equal(s1.height, 60);
  assert.equal(s1.data.length, 80 * 60 * 4);
  for (let i = 3; i < s1.data.length; i += 4) assert.equal(s1.data[i], 255);
  assert.deepEqual([...s1.data], [...s2.data]);
  assert.notDeepEqual([...s1.data], [...s3.data]);
});

test('generateScene: the default colour range finds some but not all pixels', () => {
  const s = IP.generateScene(160, 120, 3);
  const m = IP.hsvThreshold(s.data, s.width, s.height, IP.DEFAULT_THRESHOLDS);
  const n = IP.countForeground(m);
  assert.ok(n > 50, `expected some candidates, got ${n}`);
  assert.ok(n < s.width * s.height * 0.5, `too many candidates: ${n}`);
});

test('generateScene: scene contains a green, a brown and a red-ish region', () => {
  const s = IP.generateScene(160, 120, 5);
  const seen = { green: false, brown: false, red: false };
  for (let i = 0; i < s.width * s.height; i++) {
    const { h, s: sat, v } = IP.rgbToHsv(s.data[i * 4], s.data[i * 4 + 1], s.data[i * 4 + 2]);
    if (h > 80 && h < 150 && sat > 0.4 && v > 0.3) seen.green = true;
    if (h > 15 && h < 40 && sat > 0.4 && v < 0.5 && v > 0.2) seen.brown = true;
    if ((h > 345 || h < 12) && sat > 0.6 && v > 0.6) seen.red = true;
  }
  assert.deepEqual(seen, { green: true, brown: true, red: true });
});

// ---------- full demo pipeline ----------
test('runPipeline returns stage masks and a candidate list', () => {
  const s = IP.generateScene(160, 120, 11);
  const r = IP.runPipeline(s, { ...IP.DEFAULT_THRESHOLDS, op: 'open', radius: 1, minArea: 10 });
  assert.equal(r.raw.length, 160 * 120);
  assert.equal(r.cleaned.length, 160 * 120);
  assert.equal(r.final.length, 160 * 120);
  assert.ok(Array.isArray(r.candidates));
  r.candidates.forEach((c) => assert.ok(c.area >= 10));
  // cleaning never adds pixels when the op is 'open'
  assert.ok(IP.countForeground(r.cleaned) <= IP.countForeground(r.raw));
  // final is a subset of cleaned
  for (let i = 0; i < r.final.length; i++) if (r.final[i]) assert.equal(r.cleaned[i], 1);
});

test('runPipeline: op none leaves the raw mask untouched', () => {
  const s = IP.generateScene(80, 60, 2);
  const r = IP.runPipeline(s, { ...IP.DEFAULT_THRESHOLDS, op: 'none', radius: 2, minArea: 0 });
  assert.deepEqual([...r.cleaned], [...r.raw]);
});
