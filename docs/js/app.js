/* Page behaviour for the explainer. Plain JS, no dependencies. */
(function () {
  'use strict';
  var IP = window.ImageProc;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 1. Pipeline stepper (what the public sources state) ---------- */
  var STEPS = [
    { name: 'Camera image', tag: 'Input',
      body: 'A photograph taken with a digital camera. The abstract says the authors introduce a new black-pepper image set captured this way.',
      status: 'Stated in abstract' },
    { name: 'Stage 1', tag: 'Image processing',
      body: 'One of three image-processing stages. The abstract does not say what it does. Its role in a cascade: an inexpensive first check that either passes the image on or stops.',
      status: 'Contents not public' },
    { name: 'Stage 2', tag: 'Image processing',
      body: 'The second image-processing stage. The abstract says an image moves to the next stage only when pre-defined conditions are met, but does not list them.',
      status: 'Contents not public' },
    { name: 'Stage 3', tag: 'Image processing',
      body: 'The third and last image-processing stage, before the verification model. Its operations and pass conditions are not in the public record.',
      status: 'Contents not public' },
    { name: 'ResNet-50 verification', tag: 'Deep learning',
      body: 'A ResNet-50 convolutional classifier validates the final results. The abstract says it was chosen after trying several classifiers, for its speed and accuracy. See the ResNet-50 section below for the standard architecture.',
      status: 'Stated in abstract' },
    { name: 'Harvestable pepper recognised', tag: 'Output',
      body: 'The goal: recognise and detect harvestable pepper, distinct from leaves, trunks and branches, and unripe pepper. The paper reports 100% global accuracy (not reproduced here).',
      status: 'Reported (abstract, CV)' }
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
    st.className = 'status ' + (s.status.indexOf('not public') > -1 ? 'gap' : 'reported');
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

  /* ---------- 2. Cascade explorer (illustrative) ---------- */
  var cascadeOut = $('cascadeOut');
  function updateCascade() {
    var sel = document.querySelector('input[name="reject"]:checked');
    var r = sel ? parseInt(sel.value, 10) : 0;
    // chain list items: 0 image, 1..3 stages, 4 verifier, 5 output
    var items = chain.querySelectorAll('li');
    items.forEach(function (li, i) {
      var skipped = r > 0 && i > r && i <= 5;
      li.classList.toggle('skipped', skipped);
    });
    if (r === 0) {
      cascadeOut.textContent = 'The image passes all three gates, so the verifier also runs: 4 processing steps in total.';
    } else {
      var skippedCount = 4 - r;
      cascadeOut.textContent = 'Rejected at stage ' + r + '. ' + skippedCount + ' later step' + (skippedCount === 1 ? '' : 's') +
        ' (including the verifier) are skipped. This is the kind of saving in time and computing the abstract describes.';
    }
  }
  document.querySelectorAll('input[name="reject"]').forEach(function (el) { el.addEventListener('change', updateCascade); });
  updateCascade();

  /* ---------- 3. ResNet-50 panel ---------- */
  var LAYERS = [
    { name: 'Input crop', meta: '224 x 224 x 3', w: 6, body: 'A candidate region, resized to the standard 224 x 224 ImageNet input. The input size used in the paper is not public.' },
    { name: 'conv1 + max-pool', meta: '112 x 112 x 64 then 56 x 56', w: 14, body: 'A 7 x 7 convolution with stride 2 (64 filters) picks up edges and colour blobs, followed by 3 x 3 max-pooling that halves the size again.' },
    { name: 'conv2_x (3 blocks)', meta: '56 x 56 x 256', w: 30, body: 'Three residual bottleneck blocks. Each block is 1 x 1, 3 x 3, 1 x 1 convolutions plus a skip connection.' },
    { name: 'conv3_x (4 blocks)', meta: '28 x 28 x 512', w: 50, body: 'Four blocks. The first halves the spatial size; channels double, so features get more abstract (textures, parts).' },
    { name: 'conv4_x (6 blocks)', meta: '14 x 14 x 1024', w: 75, body: 'Six blocks, the deepest group. Higher-level shapes and object parts emerge here.' },
    { name: 'conv5_x (3 blocks)', meta: '7 x 7 x 2048', w: 100, body: 'Three blocks producing the final feature map. 16 blocks of 3 convolutions, plus conv1 and the final layer, give the 50 weight layers in the name.' },
    { name: 'Global average pool', meta: '2048 values', w: 100, body: 'Averages each 7 x 7 feature map to one number, giving one 2048-value summary of the crop.' },
    { name: 'Fully connected + softmax', meta: 'class scores', w: 20, body: 'Turns the summary into class probabilities. A verifier replaces the original 1000-class head with its own classes; the classes used in the paper are not public. About 25.6 million parameters in the standard network.' }
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
  var outTimer = null;
  function announce(text, alts) {
    $('demoOut').textContent = text;
    cv.scene.setAttribute('aria-label', alts.scene);
    cv.raw.setAttribute('aria-label', alts.raw);
    cv.clean.setAttribute('aria-label', alts.clean);
    cv.over.setAttribute('aria-label', alts.over);
  }
  function drawCrops(cands) {
    var box = $('crops');
    box.innerHTML = '';
    cands.slice(0, 8).forEach(function (c, i) {
      var pad = 3;
      var x0 = Math.max(0, c.bbox.x0 - pad), y0 = Math.max(0, c.bbox.y0 - pad);
      var x1 = Math.min(W - 1, c.bbox.x1 + pad), y1 = Math.min(H - 1, c.bbox.y1 + pad);
      var cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      var tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
      var tctx = tmp.getContext('2d'); drawScene(tctx);
      var fig = document.createElement('figure');
      var cc = document.createElement('canvas'); cc.width = 64; cc.height = 64;
      cc.setAttribute('role', 'img');
      cc.setAttribute('aria-label', 'Crop of candidate ' + (i + 1) + ' from the synthetic scene, ' + cw + ' by ' + ch + ' pixels');
      var side = Math.max(cw, ch);
      var g = cc.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#222'; g.fillRect(0, 0, 64, 64);
      var cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2;
      g.drawImage(tmp, cxm - side / 2, cym - side / 2, side, side, 0, 0, 64, 64);
      var cap = document.createElement('figcaption'); cap.textContent = '#' + (i + 1);
      fig.appendChild(cc); fig.appendChild(cap); box.appendChild(fig);
    });
    if (!cands.length) {
      var none = document.createElement('p');
      none.style.color = 'var(--muted)'; none.style.margin = '0';
      none.textContent = 'No candidates at these settings, so nothing would reach a verifier.';
      box.appendChild(none);
    }
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
    o.lineWidth = 1.5;
    r.candidates.forEach(function (c, i) {
      var x = c.bbox.x0 - 1.5, y = c.bbox.y0 - 1.5, w = c.bbox.x1 - c.bbox.x0 + 4, h = c.bbox.y1 - c.bbox.y0 + 4;
      o.strokeStyle = '#000'; o.lineWidth = 3; o.strokeRect(x, y, w, h);
      o.strokeStyle = '#ffe14d'; o.lineWidth = 1.5; o.strokeRect(x, y, w, h);
      o.fillStyle = '#ffe14d'; o.font = 'bold 9px sans-serif';
      o.fillText(String(i + 1), x + 1, Math.max(9, y - 2));
    });
    drawCrops(r.candidates);
    var nRaw = IP.countForeground(r.raw), nFinal = IP.countForeground(r.final);
    var n = r.candidates.length;
    var text = 'Colour mask: ' + nRaw + ' pixels. After clean-up and size filter: ' + nFinal + ' pixels in ' + n + ' candidate blob' + (n === 1 ? '' : 's') + '.';
    announce(text, {
      scene: 'Synthetic cartoon vine scene number ' + seed + ': a brown branch across the upper part, green leaves, hanging spikes of green berries with a few red-orange berries, and one reddish dry leaf.',
      raw: 'Black and white mask of pixels inside the chosen colour range: ' + nRaw + ' pixels selected.',
      clean: 'Mask after clean-up and size filter: ' + nFinal + ' pixels in ' + n + ' blobs.',
      over: 'The scene with ' + n + ' numbered yellow boxes around candidate blobs.'
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
})();
