'use strict';
// Tests for the small decision and metric helpers that mirror what the paper DESCRIBES
// (gates between stages, image-level confusion counts). They run on plain numbers, never on paper data.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const PL = require('../docs/js/paperlogic.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

// ---------- cascadeDecide ----------
test('cascadeDecide: no red-range pixels stops at stage 1', () => {
  const r = PL.cascadeDecide({ redPixels: 0, circles: 5, verifierSaysPepper: true });
  assert.equal(r.stagesRun, 1);
  assert.equal(r.stoppedEarly, true);
  assert.equal(r.outcome, 'none');
  assert.equal(r.reason, 'no-red');
});

test('cascadeDecide: zero circles stops at stage 2 under either rule', () => {
  for (const gate2Rule of ['text', 'pseudocode']) {
    const r = PL.cascadeDecide({ redPixels: 10, circles: 0, verifierSaysPepper: true }, { gate2Rule });
    assert.equal(r.stagesRun, 2);
    assert.equal(r.stoppedEarly, true);
    assert.equal(r.outcome, 'none');
    assert.equal(r.reason, 'no-circles');
  }
});

test('cascadeDecide: exactly one circle passes under the text rule but stops under the pseudo-code rule', () => {
  const input = { redPixels: 10, circles: 1, verifierSaysPepper: true };
  const text = PL.cascadeDecide(input, { gate2Rule: 'text' });
  const code = PL.cascadeDecide(input, { gate2Rule: 'pseudocode' });
  assert.equal(text.stagesRun, 3);
  assert.equal(text.outcome, 'harvestable');
  assert.equal(code.stagesRun, 2);
  assert.equal(code.outcome, 'none');
});

test('cascadeDecide: default rule is the text rule', () => {
  const r = PL.cascadeDecide({ redPixels: 1, circles: 1, verifierSaysPepper: true });
  assert.equal(r.outcome, 'harvestable');
});

test('cascadeDecide: the classifier has the last word when both gates pass', () => {
  const yes = PL.cascadeDecide({ redPixels: 4, circles: 3, verifierSaysPepper: true });
  const no = PL.cascadeDecide({ redPixels: 4, circles: 3, verifierSaysPepper: false });
  assert.equal(yes.stagesRun, 3); assert.equal(yes.stoppedEarly, false); assert.equal(yes.outcome, 'harvestable');
  assert.equal(no.stagesRun, 3); assert.equal(no.stoppedEarly, false); assert.equal(no.outcome, 'none');
  assert.equal(no.reason, 'classifier-no');
});

test('cascadeDecide: rejects an unknown rule and negative inputs', () => {
  assert.throws(() => PL.cascadeDecide({ redPixels: 1, circles: 1, verifierSaysPepper: true }, { gate2Rule: 'x' }));
  assert.throws(() => PL.cascadeDecide({ redPixels: -1, circles: 1, verifierSaysPepper: true }));
  assert.throws(() => PL.cascadeDecide({ redPixels: 1, circles: 1.5, verifierSaysPepper: true }));
});

// ---------- classificationMetrics ----------
test('classificationMetrics: accuracy is (TP + TN) over all images', () => {
  const m = PL.classificationMetrics({ tp: 8, fp: 2, tn: 7, fn: 3 });
  assert.equal(m.total, 20);
  near(m.accuracy, 15 / 20);
  near(m.recall, 8 / 11);
  near(m.precision, 8 / 10);
  near(m.f1, 2 * (8 / 10) * (8 / 11) / ((8 / 10) + (8 / 11)));
});

test('classificationMetrics: no errors gives 1 for every metric', () => {
  const m = PL.classificationMetrics({ tp: 3, fp: 0, tn: 2, fn: 0 });
  assert.equal(m.accuracy, 1); assert.equal(m.recall, 1); assert.equal(m.precision, 1); assert.equal(m.f1, 1);
});

test('classificationMetrics: undefined ratios are null, not NaN', () => {
  const m = PL.classificationMetrics({ tp: 0, fp: 0, tn: 5, fn: 0 });
  assert.equal(m.recall, null);
  assert.equal(m.precision, null);
  assert.equal(m.f1, null);
  assert.equal(m.accuracy, 1);
  assert.equal(PL.classificationMetrics({ tp: 0, fp: 0, tn: 0, fn: 0 }).accuracy, null);
});

test('classificationMetrics: rejects negative or non-integer counts', () => {
  assert.throws(() => PL.classificationMetrics({ tp: -1, fp: 0, tn: 0, fn: 0 }));
  assert.throws(() => PL.classificationMetrics({ tp: 1.5, fp: 0, tn: 0, fn: 0 }));
});

// ---------- zeroErrorUpperBound95 ----------
test('zeroErrorUpperBound95: one-sided 95% upper bound when no errors were seen in n trials', () => {
  near(PL.zeroErrorUpperBound95(115), 1 - Math.pow(0.05, 1 / 115), 1e-12);
  assert.ok(Math.abs(PL.zeroErrorUpperBound95(115) - 3 / 115) < 0.002); // the "rule of three" approximation
  assert.ok(PL.zeroErrorUpperBound95(10) > PL.zeroErrorUpperBound95(100));
  assert.throws(() => PL.zeroErrorUpperBound95(0));
});

// ---------- candidateCircles ----------
test('candidateCircles: circle at the centroid, radius = half the mean side of the bounding box', () => {
  const comps = [{ id: 1, area: 50, bbox: { x0: 10, y0: 20, x1: 19, y1: 33 }, cx: 14.5, cy: 26.5 }];
  const c = PL.candidateCircles(comps);
  assert.equal(c.length, 1);
  assert.equal(c[0].x, 14.5);
  assert.equal(c[0].y, 26.5);
  near(c[0].r, ((10 + 14) / 2) / 2); // sides are 10 and 14 pixels
});

test('candidateCircles: empty input gives no circles', () => {
  assert.deepEqual(PL.candidateCircles([]), []);
});
