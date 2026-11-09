(() => {
  'use strict';

  const W = 1200;
  const H = 1500;
  const MAX_ZOOM = 3;

  const FONT = "'Source Sans 3 Canvas'";

  // Every number below was measured off the supplied Figma reference card at
  // 1200x1500, not estimated. Text box is 1000 wide, centred (the widest
  // headline line's ink spanned 138-1063, i.e. a centred 1000px box).
  const BOX_W = 1000;
  const CENTRE_X = W / 2;

  // The headline may never cross the card's vertical centre.
  const TOP_LIMIT = H / 2;

  const EYEBROW = { size: 38, leading: 0.95, tracking: 0.04 };
  const DEK = { size: 50, leading: 1.10, tracking: -0.02 };
  const HEADLINE = { min: 65, max: 90, leading: 1.00, tracking: 0.01 };

  // Bottom-anchored gaps, measured from the reference.
  // Back-solved from the reference's two most reliable baselines: headline
  // line 4 has no descenders so its ink bottom (1204) is exactly its baseline,
  // and the all-caps eyebrow's is 932.
  const LOGO_BOTTOM_MARGIN = 49;   // card bottom -> logo bottom (logo top 1417)
  const LOGO_WIDTH = 247;          // logo renders 247 x 34
  const GAP_DEK_LOGO = 85.5;       // dek last baseline -> logo top
  const GAP_HEAD_DEK = 72.5;       // headline last baseline -> dek first baseline
  const GAP_EYE_HEAD = 77;         // eyebrow baseline -> headline first baseline

  // Gradient, decomposed from the reference: it begins 47.5% down and reaches
  // the image's own colour pulled 70% toward --gray-600 at the bottom.
  // Three knobs only. Strength drives how far the colour is pulled toward the
  // brand neutral and how opaque it gets; height is how far up the card it
  // reaches. The easing exponent is fixed at the 1.15 the reference measures.
  const SOFTNESS = 1.15;
  const GRAD_DEFAULTS = { strength: 0.70, height: 0.525 };

  function gradStart() { return 1 - grad.height; }
  function gradNeutralise() { return grad.strength; }
  function gradOpacity() { return Math.min(1, 0.55 + 0.65 * grad.strength); }
  const NEUTRAL = [0x36, 0x3b, 0x43]; // --gray-600

  const RAMPS = {
    auto: null,
    red: [0xff, 0x51, 0x3c],
    purple: [0x7f, 0x47, 0x9e],
    blue: [0x4a, 0xca, 0xf1],
    amber: [0xfe, 0xae, 0x30],
    green: [0x00, 0x73, 0x3e],
    gray: [0x4a, 0x51, 0x5c],
  };

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const uploadRow = document.getElementById('uploadRow');
  const stage = document.getElementById('stage');
  const EDIT = {
    eyebrow: document.getElementById('edEyebrow'),
    headline: document.getElementById('edHeadline'),
    dek: document.getElementById('edDek'),
  };
  const rampSelect = document.getElementById('rampSelect');
  const strengthRange = document.getElementById('gradStrength');
  const heightRange = document.getElementById('gradHeight');
  const eyebrowToggle = document.getElementById('eyebrowToggle');
  const dekToggle = document.getElementById('dekToggle');
  const sizeNote = document.getElementById('sizeNote');
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  const shown = { eyebrow: true, dek: true };
  let photo = null; // { img, scaleMultiplier, panX, panY }
  let dragState = null;
  let fileDragOver = false;
  let fontsReady = false;
  const grad = { ...GRAD_DEFAULTS };

  const logoImg = new Image();
  logoImg.onload = () => render();
  logoImg.src = '../../assets/logo-white.png';

  // Canvas text needs the real face before the first measurement, or wrapping
  // and auto-sizing would be computed against a fallback.
  Promise.all([
    document.fonts.load(`900 100px ${FONT}`),
    document.fonts.load(`500 100px ${FONT}`),
  ]).then(() => { fontsReady = true; render(); });

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function readEditable(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Lays each editable box exactly over the type the canvas draws, so the
  // caret and selection land where the glyphs are. The text itself is
  // transparent -- the canvas underneath is what you actually see, which keeps
  // the preview and the exported JPG the same renderer.
  function placeEditable(el, lines, baselines, weight, size, leading, tracking, visible) {
    if (!visible) { el.hidden = true; return; }
    el.hidden = false;
    const m = metrics(weight, size);
    const lineH = size * leading;
    const count = Math.max(1, lines.length);
    const firstBaseline = baselines.length ? baselines[0] : H - 200;
    // CSS puts half the leading above the ascent; undo that to hit the baseline.
    const top = firstBaseline - m.fontAscent - (lineH - (m.fontAscent + m.fontDescent)) / 2;
    Object.assign(el.style, {
      left: `${(W - BOX_W) / 2}px`,
      width: `${BOX_W}px`,
      top: `${top}px`,
      height: `${lineH * count}px`,
      fontWeight: String(weight),
      fontSize: `${size}px`,
      lineHeight: `${lineH}px`,
      letterSpacing: `${(tracking * size).toFixed(2)}px`,
    });
  }

  function getPanelRect() {
    return { minX: 0, maxX: W, minY: 0, maxY: H };
  }

  function panelImageMetrics(panel, bbox) {
    const bboxW = bbox.maxX - bbox.minX;
    const bboxH = bbox.maxY - bbox.minY;
    const baseScale = Math.max(bboxW / panel.img.width, bboxH / panel.img.height);
    const effScale = baseScale * panel.scaleMultiplier;
    const drawW = panel.img.width * effScale;
    const drawH = panel.img.height * effScale;
    const halfExtraW = Math.max(0, (drawW - bboxW) / 2);
    const halfExtraH = Math.max(0, (drawH - bboxH) / 2);
    const panXpx = clamp(panel.panX * bboxW, -halfExtraW, halfExtraW);
    const panYpx = clamp(panel.panY * bboxH, -halfExtraH, halfExtraH);
    return { drawW, drawH, panXpx, panYpx };
  }

  function drawPanelImage(panel, bbox) {
    const { drawW, drawH, panXpx, panYpx } = panelImageMetrics(panel, bbox);
    const cx = bbox.minX + (bbox.maxX - bbox.minX) / 2 + panXpx;
    const cy = bbox.minY + (bbox.maxY - bbox.minY) / 2 + panYpx;
    ctx.drawImage(panel.img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }

  /* ---------- text measuring ---------- */

  function setFont(weight, size) {
    ctx.font = `${weight} ${size}px ${FONT}`;
  }

  // Canvas letterSpacing is honoured by Chrome/Edge; where it is not, the
  // measurement below still matches what is drawn, so wrapping stays correct.
  function setTracking(em, size) {
    ctx.letterSpacing = `${(em * size).toFixed(2)}px`;
  }

  // Splits a token that is itself wider than the box. Without this a single
  // long word never breaks and runs straight off both edges of the card.
  function breakLongWord(word, maxWidth) {
    const pieces = [];
    let piece = '';
    for (const ch of word) {
      if (piece && ctx.measureText(piece + ch).width > maxWidth) {
        pieces.push(piece);
        piece = ch;
      } else {
        piece += ch;
      }
    }
    if (piece) pieces.push(piece);
    return pieces;
  }

  function wrap(text, weight, size, tracking, maxWidth) {
    setFont(weight, size);
    setTracking(tracking, size);
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      if (ctx.measureText(word).width <= maxWidth) { line = word; continue; }
      const pieces = breakLongWord(word, maxWidth);
      lines.push(...pieces.slice(0, -1));
      line = pieces[pieces.length - 1] || '';
    }
    if (line) lines.push(line);
    return lines;
  }

  // Font metrics for the overlay's half-leading maths.
  function metrics(weight, size) {
    setFont(weight, size);
    const m = ctx.measureText('Hg');
    return {
      ascent: m.actualBoundingBoxAscent || size * 0.75,
      descent: m.actualBoundingBoxDescent || size * 0.21,
      fontAscent: m.fontBoundingBoxAscent || size * 0.8,
      fontDescent: m.fontBoundingBoxDescent || size * 0.2,
    };
  }

  /* ---------- layout ---------- */

  // Builds the bottom-anchored stack and reports where its top edge lands.
  function layout(size) {
    const eyebrowText = shown.eyebrow ? readEditable(EDIT.eyebrow).toUpperCase() : '';
    const headlineText = readEditable(EDIT.headline);
    const dekText = shown.dek ? readEditable(EDIT.dek) : '';

    const headLines = wrap(headlineText, 900, size, HEADLINE.tracking, BOX_W);
    const dekLines = dekText ? wrap(dekText, 500, DEK.size, DEK.tracking, BOX_W) : [];
    const eyeLines = eyebrowText ? wrap(eyebrowText, 900, EYEBROW.size, EYEBROW.tracking, BOX_W) : [];

    const logoH = Math.round(LOGO_WIDTH * (logoImg.height || 98) / (logoImg.width || 720));
    const logoBottom = H - LOGO_BOTTOM_MARGIN;
    const logoTop = logoBottom - logoH;

    // Walk upward from the logo.
    let dekBaselines = [];
    let cursor;
    if (dekLines.length || (shown.dek && !dekText)) {
      const n = Math.max(1, dekLines.length);
      const lastDekBaseline = logoTop - GAP_DEK_LOGO;
      for (let i = n - 1; i >= 0; i--) {
        dekBaselines[i] = lastDekBaseline - (n - 1 - i) * DEK.size * DEK.leading;
      }
      cursor = dekBaselines[0] - GAP_HEAD_DEK;
    } else {
      cursor = logoTop - GAP_DEK_LOGO;
    }

    // An empty headline still reserves one line, so there is always somewhere
    // to click to start typing.
    const headBaselines = [];
    const headCount = Math.max(1, headLines.length);
    for (let i = headCount - 1; i >= 0; i--) {
      headBaselines[i] = cursor - (headCount - 1 - i) * size * HEADLINE.leading;
    }

    const eyeBaselines = [];
    if (eyeLines.length || (shown.eyebrow && !eyebrowText)) {
      const n = Math.max(1, eyeLines.length);
      const lastEye = (headBaselines[0] ?? cursor) - GAP_EYE_HEAD;
      for (let i = n - 1; i >= 0; i--) {
        eyeBaselines[i] = lastEye - (n - 1 - i) * EYEBROW.size * EYEBROW.leading;
      }
    }

    // Top edge = ink top of the topmost line (ascender, not baseline).
    const topBaseline = eyeBaselines.length ? eyeBaselines[0] : headBaselines[0];
    const topSize = eyeBaselines.length ? EYEBROW.size : size;
    const topWeight = 900;
    setFont(topWeight, topSize);
    const probe = ctx.measureText(eyeBaselines.length ? (eyeLines[0] || 'H') : (headLines[0] || 'H'));
    const ascent = probe.actualBoundingBoxAscent || topSize * 0.75;
    const top = (topBaseline ?? H) - ascent;

    return { size, headLines, dekLines, eyeLines, headBaselines, dekBaselines, eyeBaselines,
             logoTop, logoH, top };
  }

  // Two conditions make a headline "comfortable": at most three lines, and a
  // block that stays below the card's vertical centre. Take the largest size
  // in 65..90 that satisfies both. Shrinking fits more characters per line, so
  // longer copy needs a smaller size to reach three lines -- that is what makes
  // the size fall as the copy grows.
  //
  // Copy that cannot reach three lines even at 65px falls back to 65 rather
  // than to some larger size with more lines: that keeps the block compact and
  // is what the Figma reference itself is (four lines at 65px).
  function chooseLayout() {
    for (let size = HEADLINE.max; size >= HEADLINE.min; size--) {
      const l = layout(size);
      if (l.headLines.length <= 3 && l.top >= TOP_LIMIT) return { ...l, overflow: false };
    }
    const floor = layout(HEADLINE.min);
    return { ...floor, overflow: floor.top < TOP_LIMIT };
  }

  /* ---------- gradient ---------- */

  function dominantColour() {
    if (!photo || !photo.img) return [0xc9, 0xed, 0xfa]; // --blue-200, the reference's own image
    const s = document.createElement('canvas');
    s.width = 40; s.height = 40;
    const sctx = s.getContext('2d', { willReadFrequently: true });
    // Sample only the band the gradient actually covers, so the colour comes
    // from what sits behind the text rather than the whole frame.
    const bbox = getPanelRect();
    const { drawW, drawH, panXpx, panYpx } = panelImageMetrics(photo, bbox);
    const cx = W / 2 + panXpx, cy = H / 2 + panYpx;
    const scale = drawW / photo.img.width;
    const bandTop = gradStart() * H;
    const sx = (0 - (cx - drawW / 2)) / scale;
    const sy = (bandTop - (cy - drawH / 2)) / scale;
    const sw = W / scale, sh = (H - bandTop) / scale;
    try { sctx.drawImage(photo.img, sx, sy, sw, sh, 0, 0, 40, 40); }
    catch (e) { return [0xc9, 0xed, 0xfa]; }
    const d = sctx.getImageData(0, 0, 40, 40).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
    return [r / n, g / n, b / n];
  }

  function gradientColour() {
    const picked = RAMPS[rampSelect.value];
    const base = picked || dominantColour();
    const t = gradNeutralise();
    return base.map((c, i) => Math.round(c + (NEUTRAL[i] - c) * t));
  }

  function drawGradient() {
    const [r, g, b] = gradientColour();
    const startY = gradStart() * H;
    const gr = ctx.createLinearGradient(0, startY, 0, H);
    // A few eased stops rather than one linear ramp, so the onset stays soft.
    const stops = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
    const op = gradOpacity();
    stops.forEach((p) => {
      const a = Math.pow(p, SOFTNESS) * op;
      gr.addColorStop(p, `rgba(${r}, ${g}, ${b}, ${a})`);
    });
    ctx.fillStyle = gr;
    ctx.fillRect(0, startY, W, H - startY);
  }

  /* ---------- render ---------- */

  function drawLines(lines, baselines, weight, size, tracking) {
    setFont(weight, size);
    setTracking(tracking, size);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => ctx.fillText(line, CENTRE_X, baselines[i]));
  }

  function render() {
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, W, H);

    if (photo && photo.img) {
      drawPanelImage(photo, getPanelRect());
    } else {
      ctx.fillStyle = '#c9edfa';
      ctx.fillRect(0, 0, W, H);
    }

    drawGradient();

    if (!fontsReady) return;
    const l = chooseLayout();
    drawLines(l.eyeLines, l.eyeBaselines, 900, EYEBROW.size, EYEBROW.tracking);
    drawLines(l.headLines, l.headBaselines, 900, l.size, HEADLINE.tracking);
    drawLines(l.dekLines, l.dekBaselines, 500, DEK.size, DEK.tracking);
    ctx.letterSpacing = '0px';

    if (logoImg.complete && logoImg.naturalWidth) {
      ctx.drawImage(logoImg, CENTRE_X - LOGO_WIDTH / 2, l.logoTop, LOGO_WIDTH, l.logoH);
    }

    drawDragHighlight();
    syncEditables(l);
    reportSize(l);
  }

  // Keeps the overlay's pixel grid locked to the canvas's displayed size.
  function syncScale() {
    const shownW = canvas.clientWidth || W;
    stage.style.setProperty('--card-scale', String(shownW / W));
  }

  function syncEditables(l) {
    syncScale();
    placeEditable(EDIT.eyebrow, l.eyeLines, l.eyeBaselines, 900, EYEBROW.size,
      EYEBROW.leading, EYEBROW.tracking, shown.eyebrow);
    placeEditable(EDIT.headline, l.headLines, l.headBaselines, 900, l.size,
      HEADLINE.leading, HEADLINE.tracking, true);
    placeEditable(EDIT.dek, l.dekLines, l.dekBaselines, 500, DEK.size,
      DEK.leading, DEK.tracking, shown.dek);
  }

  function reportSize(l) {
    if (l.overflow) {
      sizeNote.className = 'size-note is-warning';
      sizeNote.textContent = `Copy is too long — it will not fit above the centre line even at ${HEADLINE.min}px. Shorten the headline or dek.`;
    } else {
      sizeNote.className = 'size-note';
      sizeNote.textContent = `Headline ${l.size}px · ${l.headLines.length} line${l.headLines.length === 1 ? '' : 's'}`;
    }
  }

  function drawDragHighlight() {
    if (!fileDragOver) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 81, 60, 0.18)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ff513c';
    ctx.lineWidth = Math.max(4, W * 0.006);
    ctx.setLineDash([W * 0.02, W * 0.012]);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, W - ctx.lineWidth * 2, H - ctx.lineWidth * 2);
    ctx.restore();
  }

  /* ---------- upload ---------- */

  function buildUploadSlot() {
    uploadRow.innerHTML = '';
    const slot = document.createElement('div');
    slot.className = 'upload-slot' + (photo && photo.img ? ' has-image' : '');

    const label = document.createElement('label');
    label.textContent = 'Image';
    label.htmlFor = 'file-0';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'file-input';
    fileInput.id = 'file-0';
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) loadFile(f);
    });

    const zoomRow = document.createElement('div');
    zoomRow.className = 'zoom-row';
    const zoomLabel = document.createElement('span');
    zoomLabel.textContent = 'Zoom';
    const zoom = document.createElement('input');
    zoom.type = 'range'; zoom.min = '1'; zoom.max = String(MAX_ZOOM); zoom.step = '0.01';
    zoom.value = String(photo && photo.img ? photo.scaleMultiplier : 1);
    zoom.disabled = !(photo && photo.img);
    zoom.addEventListener('input', (e) => {
      if (photo) { photo.scaleMultiplier = parseFloat(e.target.value); render(); }
    });

    slot.addEventListener('dragover', (e) => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault(); slot.classList.remove('drag-over');
      loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
    });

    zoomRow.appendChild(zoomLabel); zoomRow.appendChild(zoom);
    slot.appendChild(label); slot.appendChild(fileInput); slot.appendChild(zoomRow);
    uploadRow.appendChild(slot);
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      photo = { img, scaleMultiplier: 1, panX: 0, panY: 0 };
      URL.revokeObjectURL(url);
      buildUploadSlot();
      render();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  /* ---------- controls ---------- */

  rampSelect.addEventListener('change', render);
  strengthRange.addEventListener('input', (e) => { grad.strength = parseFloat(e.target.value); render(); });
  heightRange.addEventListener('input', (e) => { grad.height = parseFloat(e.target.value); render(); });

  eyebrowToggle.addEventListener('change', () => {
    shown.eyebrow = eyebrowToggle.checked;
    if (shown.eyebrow) EDIT.eyebrow.focus();
    render();
  });
  dekToggle.addEventListener('change', () => {
    shown.dek = dekToggle.checked;
    if (shown.dek) EDIT.dek.focus();
    render();
  });

  // Typing never rewrites the editable's own content, so the caret is never
  // disturbed; render only reads from it and repaints the canvas beneath.
  Object.values(EDIT).forEach((el) => {
    el.addEventListener('input', render);
    el.addEventListener('focus', () => stage.classList.add('is-editing'));
    el.addEventListener('blur', () => { stage.classList.remove('is-editing'); render(); });
    // Keep it plain text: no pasted markup, no newlines (wrapping is automatic).
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' ');
      document.execCommand('insertText', false, t);
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  });

  function clientToCanvas(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) * (canvas.width / r.width), y: (cy - r.top) * (canvas.height / r.height) };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!photo || !photo.img) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    dragState = { startX: x, startY: y, startPanX: photo.panX, startPanY: photo.panY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragState || !photo) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    photo.panX = (dragState.startPanX * W + (x - dragState.startX)) / W;
    photo.panY = (dragState.startPanY * H + (y - dragState.startY)) / H;
    render();
  });
  function endDrag(e) {
    if (dragState && e.pointerId !== undefined) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    dragState = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    if (!fileDragOver) { fileDragOver = true; render(); }
  });
  canvas.addEventListener('dragleave', () => { if (fileDragOver) { fileDragOver = false; render(); } });
  canvas.addEventListener('drop', (e) => {
    e.preventDefault(); fileDragOver = false;
    loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
    render();
  });

  downloadBtn.addEventListener('click', () => {
    const raw = filenameInput.value.trim() || 'social-card';
    const safe = raw.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'social-card';
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.download = `${safe}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
  });

  window.__card = { layout: chooseLayout, grad, gradientColour };

  if (window.ResizeObserver) new ResizeObserver(syncScale).observe(canvas);
  window.addEventListener('resize', syncScale);

  buildUploadSlot();
  render();
})();
