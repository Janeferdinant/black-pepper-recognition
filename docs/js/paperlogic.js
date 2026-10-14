/*
 * Small decision and metric helpers that mirror what the paper DESCRIBES in words:
 *   - three gates between stages (no red-range pixels -> stop; too few circles -> stop; classifier decides),
 *   - image-level confusion counts and the metrics derived from them,
 *   - circles drawn around segmented objects.
 *
 * They work on plain numbers supplied by the caller. They contain no data, image or code from the paper,
 * and they are not the paper's implementation.
 *
 * Works in the browser (window.PaperLogic) and in Node (module.exports).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaperLogic = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function nonNegInt(v, name) {
    if (!Number.isInteger(v) || v < 0) throw new RangeError(name + ' must be a non-negative integer');
    return v;
  }

  /**
   * Walks the three gates in order.
   *  gate2Rule 'text'       : stop when there are no circles (the paper's prose).
   *  gate2Rule 'pseudocode' : stop when there is one circle or fewer (the paper's pseudo-code, "<= 1").
   * Returns { stagesRun: 1..3, stoppedEarly, outcome: 'harvestable'|'none', reason }.
   */
  function cascadeDecide(input, options) {
    const rule = (options && options.gate2Rule) || 'text';
    if (rule !== 'text' && rule !== 'pseudocode') throw new RangeError('unknown gate2Rule: ' + rule);
    const red = nonNegInt(input.redPixels, 'redPixels');
    const circles = nonNegInt(input.circles, 'circles');
    if (red === 0) return { stagesRun: 1, stoppedEarly: true, outcome: 'none', reason: 'no-red' };
    const limit = rule === 'text' ? 0 : 1;
    if (circles <= limit) return { stagesRun: 2, stoppedEarly: true, outcome: 'none', reason: 'no-circles' };
    if (input.verifierSaysPepper) return { stagesRun: 3, stoppedEarly: false, outcome: 'harvestable', reason: 'classifier-yes' };
    return { stagesRun: 3, stoppedEarly: false, outcome: 'none', reason: 'classifier-no' };
  }

  /** Image-level metrics from confusion counts. A ratio with a zero denominator is null. */
  function classificationMetrics(c) {
    const tp = nonNegInt(c.tp, 'tp'), fp = nonNegInt(c.fp, 'fp');
    const tn = nonNegInt(c.tn, 'tn'), fn = nonNegInt(c.fn, 'fn');
    const total = tp + fp + tn + fn;
    const ratio = (a, b) => (b === 0 ? null : a / b);
    const recall = ratio(tp, tp + fn);
    const precision = ratio(tp, tp + fp);
    const f1 = recall === null || precision === null || recall + precision === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
    return { total, accuracy: ratio(tp + tn, total), recall, precision, f1 };
  }

  /**
   * One-sided 95% upper confidence bound on the true error rate when n trials produced zero errors:
   * the p for which (1 - p)^n = 0.05. Close to the "rule of three", 3 / n.
   */
  function zeroErrorUpperBound95(n) {
    if (!Number.isInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
    return 1 - Math.pow(0.05, 1 / n);
  }

  /** Circle at each blob's centroid; diameter = mean of the bounding-box sides, radius = diameter / 2. */
  function candidateCircles(components) {
    return components.map((c) => {
      const w = c.bbox.x1 - c.bbox.x0 + 1, h = c.bbox.y1 - c.bbox.y0 + 1;
      return { x: c.cx, y: c.cy, r: (w + h) / 4 };
    });
  }

  return { cascadeDecide, classificationMetrics, zeroErrorUpperBound95, candidateCircles };
}));
