/* Page behaviour for the explainer. Plain JS, no dependencies. */
(function () {
  'use strict';
  var IP = window.ImageProc;
  var $ = function (id) { return document.getElementById(id); };

  var PL = window.PaperLogic;

  /* ---------- 1. Pipeline stepper (what the paper describes, in our words) ---------- */
  var STEPS = [
    { name: 'Camera image', tag: 'Input', kind: 'reported', status: 'Paper p. 1-3',
      body: 'A photograph of the canopy taken with an ordinary RGB digital camera; the paper says a phone camera is good enough. The image set was newly collected in natural canopies in Kerala.' },
    { name: 'Pre-processing', tag: 'Clean-up', kind: 'reported', status: 'Paper p. 3-4, 6',
      body: 'Three filters before any stage: edge-preserving smoothing with a guided filter, local Laplacian filtering to raise local contrast, then histogram equalisation. The pseudo-code also resizes the input to 300 x 400 pixels.' },
    { name: 'Stage 1: red segmentation', tag: 'Gate 1', kind: 'reported', status: 'Paper p. 1, 4',
      body: 'Convert to HSV colour space and keep the red colour range as the region of interest, giving a segmented image. HSV was preferred over RGB, YCbCr and L*a*b* because red and yellow separate well from green. Gate 1: if no red component is present, the program ends with no harvestable pepper.' },
    { name: 'Stage 2: clean-up and circles', tag: 'Gate 2', kind: 'unclear', status: 'Paper p. 1, 5-6 (rule unclear)',
      body: 'Morphological operations remove small noise, objects under 60 pixels are dropped, the centroid of each remaining object is found, and a circle is drawn around each. The circles are counted. Gate 2: no circles means no harvestable pepper. The prose says zero circles; the pseudo-code says one or fewer, so the exact rule is unclear.' },
    { name: 'Stage 3: ResNet-50', tag: 'Gate 3', kind: 'unclear', status: 'Paper p. 1, 5-6 (training unclear)',
      body: 'The input image is given to a ResNet-50 classifier trained on more than 500 images from the new set. It decides pepper or not pepper and gives the final confirmation. Whether the network was fine-tuned or used only for features is not stated.' },
    { name: 'Output', tag: 'Result', kind: 'reported', status: 'Paper p. 1, 6',
      body: 'The pseudo-code ends by reporting either that pepper is ready for harvest or that no harvestable pepper was found. The circles from stage 2 show where the pepper is in the image. The paper reports 100% global accuracy for the whole system (not reproduced here).' }
  ];
  var chain = $('chain'), chainDetail = $('chainDetail');
  var stepButtons = [];
  function showStep(i) {
    stepButtons.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
    var s = STEPS[i];
    chainDetail.innerHTML = '';
    var h = document.createElement('h3'); h.textContent = s.name;
    var p = document.createElement('p'); p.textContent = s.body;
    var st = document.createElement('span');
    st.className = 'status ' + s.kind;
    st.textContent = s.status;
    chainDetail.appendChild(h); chainDetail.appendChild(p); chainDetail.appendChild(st);
  }
  STEPS.forEach(function (s, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-controls', 'chainDetail');
    b.innerHTML = '<span class="tag"></span><strong></strong>';
    b.querySelector('.tag').textContent = (i + 1) + '. ' + s.tag;
    b.querySelector('strong').textContent = s.name;
    b.addEventListener('click', function () { showStep(i); });
    li.appendChild(b);
    if (i < STEPS.length - 1) {
      var a = document.createElement('div');
      a.className = 'arrow'; a.setAttribute('aria-hidden', 'true');
      a.innerHTML = '<span>&#8595;</span>';
      li.appendChild(a);
    }
    chain.appendChild(li);
    stepButtons.push(b);
  });
  showStep(0);

  /* ---------- 2. Gate explorer (illustrative; uses PaperLogic.cascadeDecide) ---------- */
  var cascadeOut = $('cascadeOut');
  var REASONS = {
    'no-red': 'Gate 1 stops it: no pixels in the red range, so stages 2 and 3 never run.',
    'no-circles': 'Gate 2 stops it: too few circles, so the ResNet-50 stage never runs.',
    'classifier-no': 'All three stages ran, and the classifier said not pepper.',
    'classifier-yes': 'All three stages ran, and the classifier said pepper.'
  };
  function updateCascade() {
    var circles = parseInt($('gCircles').value, 10);
    $('gCirclesO').textContent = String(circles);
    var rule = document.querySelector('input[name="gate2"]:checked');
    var r = PL.cascadeDecide(
      { redPixels: $('gRed').checked ? 1 : 0, circles: circles, verifierSaysPepper: $('gPepper').checked },
      { gate2Rule: rule ? rule.value : 'text' });
    // chain list items: 0 camera, 1 pre-processing, 2..4 stages 1..3, 5 output
    chain.querySelectorAll('li').forEach(function (li, i) {
      li.classList.toggle('skipped', i >= 2 && i <= 4 && (i - 1) > r.stagesRun);
    });
    var saved = 3 - r.stagesRun;
    cascadeOut.textContent = REASONS[r.reason] + ' Answer: ' +
      (r.outcome === 'harvestable' ? 'pepper ready for harvest.' : 'no harvestable pepper found.') +
      (saved > 0 ? ' ' + saved + ' later stage' + (saved === 1 ? ' is' : 's are') + ' skipped, which is the saving in time and computing the paper describes.' : '');
  }
  ['gRed', 'gCircles', 'gPepper'].forEach(function (id) { $(id).addEventListener('input', updateCascade); $(id).addEventListener('change', updateCascade); });
  document.querySelectorAll('input[name="gate2"]').forEach(function (el) { el.addEventListener('change', updateCascade); });
  updateCascade();

  /* ---------- 3. ResNet-50 panel ---------- */
  var LAYERS = [
    { name: 'Input image', meta: '224 x 224 x 3', w: 6, body: 'The picture, resized to the standard 224 x 224 ImageNet input. The paper gives ResNet-50 the input image; the input size it used is not stated.' },
    { name: 'conv1 + max-pool', meta: '112 x 112 x 64 then 56 x 56', w: 14, body: 'A 7 x 7 convolution with stride 2 (64 filters) picks up edges and colour blobs, followed by 3 x 3 max-pooling that halves the size again.' },
    { name: 'conv2_x (3 blocks)', meta: '56 x 56 x 256', w: 30, body: 'Three residual bottleneck blocks. Each block is 1 x 1, 3 x 3, 1 x 1 convolutions plus a skip connection.' },
    { name: 'conv3_x (4 blocks)', meta: '28 x 28 x 512', w: 50, body: 'Four blocks. The first halves the spatial size; channels double, so features get more abstract (textures, parts).' },
    { name: 'conv4_x (6 blocks)', meta: '14 x 14 x 1024', w: 75, body: 'Six blocks, the deepest group. Higher-level shapes and object parts emerge here.' },
    { name: 'conv5_x (3 blocks)', meta: '7 x 7 x 2048', w: 100, body: 'Three blocks producing the final feature map. 16 blocks of 3 convolutions, plus conv1 and the final layer, give the 50 weight layers in the name.' },
    { name: 'Global average pool', meta: '2048 values', w: 100, body: 'Averages each 7 x 7 feature map to one number, giving one 2048-value summary of the crop.' },
    { name: 'Fully connected + softmax', meta: 'class scores', w: 20, body: 'Turns the summary into class probabilities. A pepper checker replaces the original 1000-class head with its own two outcomes, pepper or not pepper. About 25.6 million parameters in the standard network.' }
  ];
  var layersEl = $('layers'), layerDetail = $('layerDetail');
  var layerBtns = [];
  function showLayer(i) {
    layerBtns.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
    var L = LAYERS[i];
    layerDetail.innerHTML = '';
    var h = document.createElement('h3'); h.textContent = L.name;
    var m = document.createElement('p'); m.style.color = 'var(--muted)'; m.textContent = 'Output: ' + L.meta;
    var p = document.createElement('p'); p.textContent = L.body;
    layerDetail.appendChild(h); layerDetail.appendChild(m); layerDetail.appendChild(p);
  }
  LAYERS.forEach(function (L, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-controls', 'layerDetail');
    b.innerHTML = '<strong></strong> <span class="meta"></span><span class="bar" aria-hidden="true"></span>';
    b.querySelector('strong').textContent = L.name;
    b.querySelector('.meta').textContent = ' ' + L.meta;
    b.querySelector('.bar').style.width = L.w + '%';
    b.addEventListener('click', function () { showLayer(i); });
    li.appendChild(b); layersEl.appendChild(li); layerBtns.push(b);
  });
  showLayer(0);

  /* ---------- 4. Segmentation demo (synthetic images, generic techniques) ---------- */
  var W = 200, H = 150;
  var scene = null, seed = 3;
  var ctl = {
    hMin: $('hMin'), hMax: $('hMax'), sMin: $('sMin'), vMin: $('vMin'),
    op: $('op'), radius: $('radius'), minArea: $('minArea')
  };
  var cv = { scene: $('cvScene'), raw: $('cvRaw'), clean: $('cvClean'), over: $('cvOver') };
  var ctx = {};
  Object.keys(cv).forEach(function (k) { ctx[k] = cv[k].getContext('2d'); });

  function setControls(p) {
    ctl.hMin.value = p.hMin; ctl.hMax.value = p.hMax;
    ctl.sMin.value = Math.round(p.sMin * 100); ctl.vMin.value = Math.round(p.vMin * 100);
    ctl.op.value = p.op; ctl.radius.value = p.radius; ctl.minArea.value = p.minArea;
  }
  function readParams() {
    return {
      hMin: +ctl.hMin.value, hMax: +ctl.hMax.value,
      sMin: +ctl.sMin.value / 100, sMax: 1, vMin: +ctl.vMin.value / 100, vMax: 1,
      op: ctl.op.value, radius: +ctl.radius.value, minArea: +ctl.minArea.value
    };
  }
  function drawMask(c, mask, fg, bg) {
    var img = c.createImageData(W, H);
    for (var i = 0; i < W * H; i++) {
      var col = mask[i] ? fg : bg;
      img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }
  function drawScene(c) {
    var img = c.createImageData(W, H);
    img.data.set(scene.data);
    c.putImageData(img, 0, 0);
  }
  function updateHueBar(p) {
    var s1 = $('hueSel1'), s2 = $('hueSel2');
    function seg(el, a, b) {
      el.style.left = (a / 360 * 100) + '%';
      el.style.width = Math.max(0.8, (b - a) / 360 * 100) + '%';
      el.style.display = '';
    }
    if (p.hMin <= p.hMax) { seg(s1, p.hMin, p.hMax); s2.style.display = 'none'; }
    else { seg(s1, p.hMin, 360); seg(s2, 0, p.hMax); }
  }
  function announce(text, alts) {
    $('demoOut').textContent = text;
    cv.scene.setAttribute('aria-label', alts.scene);
    cv.raw.setAttribute('aria-label', alts.raw);
    cv.clean.setAttribute('aria-label', alts.clean);
    cv.over.setAttribute('aria-label', alts.over);
  }
  function render() {
    var p = readParams();
    $('hMinO').textContent = p.hMin + '°'; $('hMaxO').textContent = p.hMax + '°';
    $('sMinO').textContent = p.sMin.toFixed(2); $('vMinO').textContent = p.vMin.toFixed(2);
    $('radiusO').textContent = p.radius + ' px'; $('minAreaO').textContent = p.minArea + ' px';
    updateHueBar(p);
    var r = IP.runPipeline(scene, p);
    drawScene(ctx.scene);
    drawMask(ctx.raw, r.raw, [244, 240, 230], [27, 31, 28]);
    drawMask(ctx.clean, r.final, [244, 240, 230], [27, 31, 28]);
    drawScene(ctx.over);
    var o = ctx.over;
    var circles = PL.candidateCircles(r.candidates);
    circles.forEach(function (c, i) {
      o.beginPath(); o.arc(c.x, c.y, c.r + 1.5, 0, Math.PI * 2);
      o.strokeStyle = '#000'; o.lineWidth = 3; o.stroke();
      o.strokeStyle = '#ffe14d'; o.lineWidth = 1.5; o.stroke();
      o.fillStyle = '#ffe14d'; o.font = 'bold 9px sans-serif';
      o.fillText(String(i + 1), c.x + c.r + 2, Math.max(9, c.y - c.r));
    });
    var nRaw = IP.countForeground(r.raw), nFinal = IP.countForeground(r.final);
    var n = r.candidates.length;
    var text = 'Colour mask: ' + nRaw + ' pixels. After clean-up and size filter: ' + nFinal + ' pixels in ' + n + ' object' + (n === 1 ? '' : 's') + ', so ' + n + ' circle' + (n === 1 ? '' : 's') + '.';
    var okText = PL.cascadeDecide({ redPixels: nRaw, circles: n, verifierSaysPepper: true }, { gate2Rule: 'text' }).stagesRun === 3;
    var okCode = PL.cascadeDecide({ redPixels: nRaw, circles: n, verifierSaysPepper: true }, { gate2Rule: 'pseudocode' }).stagesRun === 3;
    $('gateOut').textContent = 'Gates on this synthetic scene: stage 1 ' + (nRaw > 0 ? 'passes' : 'stops here') + '. Stage 2 with the prose rule ' +
      (okText ? 'passes' : 'stops here') + '; with the pseudo-code rule ' + (okCode ? 'passes' : 'stops here') + '. No classifier runs on this page.';
    announce(text, {
      scene: 'Synthetic cartoon vine scene number ' + seed + ': a brown branch across the upper part, green leaves, hanging spikes of green berries with a few red-orange berries, and one reddish dry leaf.',
      raw: 'Black and white mask of pixels inside the chosen colour range: ' + nRaw + ' pixels selected.',
      clean: 'Mask after clean-up and size filter: ' + nFinal + ' pixels in ' + n + ' blobs.',
      over: 'The scene with ' + n + ' numbered yellow circles drawn around the surviving objects.'
    });
  }
  var timer = null;
  function schedule() { if (timer) cancelAnimationFrame(timer); timer = requestAnimationFrame(render); }
  Object.keys(ctl).forEach(function (k) { ctl[k].addEventListener('input', schedule); ctl[k].addEventListener('change', schedule); });

  function newScene(s) { seed = s; scene = IP.generateScene(W, H, seed); }
  $('newScene').addEventListener('click', function () { newScene(seed % 9 + 1); render(); });
  $('presetDefault').addEventListener('click', function () { setControls(IP.DEFAULT_PARAMS); render(); });
  $('presetLoose').addEventListener('click', function () {
    setControls({ hMin: 300, hMax: 90, sMin: 0.2, vMin: 0.2, op: 'none', radius: 1, minArea: 0 }); render();
  });
  $('presetNoClean').addEventListener('click', function () {
    var p = Object.assign({}, IP.DEFAULT_PARAMS, { op: 'none', minArea: 0 }); setControls(p); render();
  });

  newScene(seed);
  setControls(IP.DEFAULT_PARAMS);
  render();

  /* ---------- 5. Metric arithmetic (illustrative counts) ---------- */
  function pct(v) { return v === null ? 'undefined (zero denominator)' : (v * 100).toFixed(1) + '%'; }
  function updateMetrics() {
    var c = {};
    ['TP', 'FP', 'TN', 'FN'].forEach(function (k) {
      var v = parseInt($('c' + k).value, 10);
      c[k.toLowerCase()] = isNaN(v) || v < 0 ? 0 : v;
    });
    var m = PL.classificationMetrics(c);
    $('metricOut').textContent = m.total === 0
      ? 'Enter some counts to see the arithmetic.'
      : 'Out of ' + m.total + ' images: accuracy ' + pct(m.accuracy) + ', recall ' + pct(m.recall) + ', precision ' + pct(m.precision) + ', F1 ' + (m.f1 === null ? 'undefined' : m.f1.toFixed(3)) + '. These are the example counts you entered, not results from the paper.';
  }
  ['cTP', 'cFP', 'cTN', 'cFN'].forEach(function (id) { $(id).addEventListener('input', updateMetrics); });
  updateMetrics();

  /* ---------- 6. Derived bound on the reported test size ---------- */
  $('boundOut').textContent = (PL.zeroErrorUpperBound95(115) * 100).toFixed(1) + '%';
})();
