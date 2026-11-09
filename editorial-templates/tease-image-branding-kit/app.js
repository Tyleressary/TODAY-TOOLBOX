(() => {
  'use strict';

  const MAX_ZOOM = 3;

  const SIZES = {
    wide: { w: 2400, h: 1200 },
    square: { w: 1000, h: 1000 },
  };

  // Bug geometry, derived from the approved 2400x1200 reference: 288px bug,
  // 72px in from the side, 90px up from the bottom.
  //
  // Size scales with the geometric mean of the frame (288 / sqrt(2400*1200)),
  // so the bug keeps the same visual weight whatever the aspect ratio:
  // 2400x1200 -> 288px, 1000x1000 -> 170px. Per-axis fractions would not
  // survive the change -- on a square they put the bug 30px from the side but
  // 75px from the bottom, visibly hugging the edge.
  const LOGO_SCALE_K = 0.169706;
  // Margins as multiples of the bug (72/288, 90/288), which reproduces the
  // reference exactly on the 2:1 and keeps the same inset on any format.
  const LOGO_MARGIN_X_K = 0.25;
  const LOGO_MARGIN_Y_K = 0.3125;

  const CORNERS = { br: 'bottom-right', bl: 'bottom-left' };

  const LAYOUTS = {
    single: { count: 1 },
    split2: { count: 2 },
  };

  // Copied verbatim from split-image/app.js so the centre line is the same
  // line, not a lookalike: a flat 12px white stroke, deliberately not scaled
  // to the canvas.
  const DIVIDER_THICKNESS = 12;

  // Keyed so another bug can be added back as one entry plus a picker; every
  // logo renders at the same size in the same place regardless.
  const LOGOS = {
    today75: { label: 'TODAY 75', src: '../../assets/today-75-logo.png' },
    archives: { label: 'TODAY ARCHIVES', src: '../../assets/today-archives-logo.png' },
  };

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const uploadRow = document.getElementById('uploadRow');
  const cornerGroup = document.getElementById('cornerGroup');
  const logoSelect = document.getElementById('logoSelect');
  const layoutGroup = document.getElementById('layoutGroup');
  const sizeGroup = document.getElementById('sizeGroup');
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  let corner = 'br';
  let logoId = 'today75';
  let sizeMode = 'wide';
  let layoutId = 'single';
  let panels = []; // panels[i] = { img, scaleMultiplier, panX, panY } | undefined
  let dragState = null;
  let fileDragOver = false; // a file drag is hovering the canvas
  let dragHoverIndex = null; // panel a file drag is currently over, if any

  // Both logos are decoded up front, so switching never flashes an empty
  // corner and an export can never race a pending decode.
  const logoImages = {};
  Object.entries(LOGOS).forEach(([id, { src }]) => {
    const img = new Image();
    img.onload = () => render();
    img.src = src;
    logoImages[id] = img;
  });

  Object.entries(LOGOS).forEach(([id, { label }]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    logoSelect.appendChild(opt);
  });

  function setLogo(value) {
    if (!LOGOS[value] || value === logoId) return;
    logoId = value;
    updateControlsUI();
    render();
  }

  logoSelect.addEventListener('change', (e) => setLogo(e.target.value));

  function getDims() {
    return SIZES[sizeMode];
  }

  function getLogoImg() {
    const img = logoImages[logoId];
    return img && img.complete && img.naturalWidth ? img : null;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getLayout() {
    return LAYOUTS[layoutId];
  }

  // Same strip maths as the Split Image Generator: stripW = w / count, full
  // height. Single image is the degenerate case of one strip.
  function getPanelRect(i) {
    const { w, h } = getDims();
    const count = getLayout().count;
    const stripW = w / count;
    return { minX: i * stripW, maxX: (i + 1) * stripW, minY: 0, maxY: h };
  }

  function pointInRect(x, y, r) {
    return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;
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
    const centerX = bbox.minX + (bbox.maxX - bbox.minX) / 2 + panXpx;
    const centerY = bbox.minY + (bbox.maxY - bbox.minY) / 2 + panYpx;
    ctx.drawImage(panel.img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
  }

  function drawPlaceholder(bbox, index) {
    const { w } = getDims();
    const single = getLayout().count === 1;
    ctx.fillStyle = '#d8dde5';
    ctx.fillRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
    ctx.fillStyle = '#4a515c';
    ctx.font = `${Math.round(w * 0.022)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      single ? 'Upload an image' : `Image ${index + 1}`,
      bbox.minX + (bbox.maxX - bbox.minX) / 2,
      bbox.minY + (bbox.maxY - bbox.minY) / 2
    );
  }

  // strokeLine and drawDividers are copied verbatim from split-image/app.js.
  function strokeLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = DIVIDER_THICKNESS;
    ctx.stroke();
  }

  function drawDividers(w, h) {
    const count = getLayout().count;
    for (let i = 1; i < count; i++) {
      strokeLine((w * i) / count, 0, (w * i) / count, h);
    }
  }

  // The badge is locked to a corner: its rect comes only from the constants
  // above and the chosen corner, never from pointer state.
  function getLogoRect() {
    const img = getLogoImg();
    if (!img) return null;
    const { w: cw, h: ch } = getDims();
    // Every logo is fitted into a square box of this size by its longer edge,
    // so they all occupy the same footprint in the same spot regardless of
    // their own proportions.
    const box = LOGO_SCALE_K * Math.sqrt(cw * ch);
    const k = box / Math.max(img.width, img.height);
    const w = img.width * k;
    const h = img.height * k;
    const boxX = corner === 'bl'
      ? box * LOGO_MARGIN_X_K
      : cw - box - box * LOGO_MARGIN_X_K;
    const boxY = ch - box - box * LOGO_MARGIN_Y_K;
    return { x: boxX + (box - w) / 2, y: boxY + (box - h) / 2, w, h };
  }

  function drawLogo() {
    const rect = getLogoRect();
    if (!rect) return;
    ctx.drawImage(getLogoImg(), rect.x, rect.y, rect.w, rect.h);
  }

  function render() {
    const { w: W, h: H } = getDims();
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, W, H);

    const count = getLayout().count;
    for (let i = 0; i < count; i++) {
      const bbox = getPanelRect(i);
      ctx.save();
      ctx.beginPath();
      ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
      ctx.clip();
      const panel = panels[i];
      if (panel && panel.img) {
        drawPanelImage(panel, bbox);
      } else {
        drawPlaceholder(bbox, i);
      }
      ctx.restore();
    }

    drawDividers(W, H);
    drawLogo();
    drawDragHighlight();
  }

  function drawDragHighlight() {
    if (!fileDragOver) return;
    const { w: W } = getDims();
    const bbox = getPanelRect(dragHoverIndex === null ? 0 : dragHoverIndex);
    const bw = bbox.maxX - bbox.minX;
    const bh = bbox.maxY - bbox.minY;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 81, 60, 0.18)';
    ctx.fillRect(bbox.minX, bbox.minY, bw, bh);
    ctx.strokeStyle = '#ff513c';
    ctx.lineWidth = Math.max(4, W * 0.006);
    ctx.setLineDash([W * 0.02, W * 0.012]);
    ctx.strokeRect(bbox.minX + ctx.lineWidth / 2, bbox.minY + ctx.lineWidth / 2,
                   bw - ctx.lineWidth, bh - ctx.lineWidth);
    ctx.restore();
  }

  function buildUploadSlots() {
    const count = getLayout().count;
    uploadRow.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const panel = panels[i];
      const slot = document.createElement('div');
      slot.className = 'upload-slot' + (panel && panel.img ? ' has-image' : '');

      const label = document.createElement('label');
      label.textContent = count === 1 ? 'Image' : `Image ${i + 1}`;
      label.htmlFor = `file-${i}`;

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.className = 'file-input';
      fileInput.id = `file-${i}`;
      fileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) loadFile(i, f);
      });

      const zoomRow = document.createElement('div');
      zoomRow.className = 'zoom-row';
      const zoomLabel = document.createElement('span');
      zoomLabel.textContent = 'Zoom';
      const zoomSlider = document.createElement('input');
      zoomSlider.type = 'range';
      zoomSlider.min = '1';
      zoomSlider.max = String(MAX_ZOOM);
      zoomSlider.step = '0.01';
      zoomSlider.value = String(panel && panel.img ? panel.scaleMultiplier : 1);
      zoomSlider.disabled = !(panel && panel.img);
      zoomSlider.addEventListener('input', (e) => {
        if (panels[i]) {
          panels[i].scaleMultiplier = parseFloat(e.target.value);
          render();
        }
      });

      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        slot.classList.add('drag-over');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        loadFile(i, e.dataTransfer.files && e.dataTransfer.files[0]);
      });

      zoomRow.appendChild(zoomLabel);
      zoomRow.appendChild(zoomSlider);
      slot.appendChild(label);
      slot.appendChild(fileInput);
      slot.appendChild(zoomRow);
      uploadRow.appendChild(slot);
    }
  }

  function loadFile(index, file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      panels[index] = { img, scaleMultiplier: 1, panX: 0, panY: 0 };
      URL.revokeObjectURL(url);
      buildUploadSlots();
      render();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  function setLayout(value) {
    if (!LAYOUTS[value] || value === layoutId) return;
    layoutId = value;
    // Keep whatever is already placed; only trim panels the layout dropped.
    panels.length = getLayout().count;
    updateControlsUI();
    buildUploadSlots();
    render();
  }

  function setCorner(value) {
    if (!CORNERS[value] || value === corner) return;
    corner = value;
    updateControlsUI();
    render();
  }

  function setSizeMode(value) {
    if (!SIZES[value] || value === sizeMode) return;
    sizeMode = value;
    updateControlsUI();
    render();
  }

  function updateControlsUI() {
    const sync = (group, current) => group.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === current);
    });
    sync(cornerGroup, corner);
    logoSelect.value = logoId;
    sync(layoutGroup, layoutId);
    sync(sizeGroup, sizeMode);
  }

  cornerGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setCorner(btn.dataset.value));
  });
  layoutGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setLayout(btn.dataset.value));
  });
  sizeGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setSizeMode(btn.dataset.value));
  });

  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  // Dragging repositions whichever photo is under the pointer. The badge has
  // no hit test at all, so a drag starting on top of it still moves the photo
  // underneath rather than the bug.
  function panelIndexAt(x, y) {
    for (let i = getLayout().count - 1; i >= 0; i--) {
      if (pointInRect(x, y, getPanelRect(i))) return i;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const i = panelIndexAt(x, y);
    if (i === null) return;
    const panel = panels[i];
    if (!panel || !panel.img) return;
    dragState = { index: i, startX: x, startY: y, startPanX: panel.panX, startPanY: panel.panY };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const panel = panels[dragState.index];
    if (!panel) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const bbox = getPanelRect(dragState.index);
    const bboxW = bbox.maxX - bbox.minX;
    const bboxH = bbox.maxY - bbox.minY;
    panel.panX = (dragState.startPanX * bboxW + (x - dragState.startX)) / bboxW;
    panel.panY = (dragState.startPanY * bboxH + (y - dragState.startY)) / bboxH;
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
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const i = panelIndexAt(x, y);
    if (!fileDragOver || i !== dragHoverIndex) {
      fileDragOver = true;
      dragHoverIndex = i;
      render();
    }
  });
  canvas.addEventListener('dragleave', () => {
    if (fileDragOver) { fileDragOver = false; dragHoverIndex = null; render(); }
  });
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const i = panelIndexAt(x, y);
    fileDragOver = false;
    dragHoverIndex = null;
    loadFile(i === null ? 0 : i, e.dataTransfer.files && e.dataTransfer.files[0]);
    render();
  });

  downloadBtn.addEventListener('click', () => {
    const raw = filenameInput.value.trim() || 'tease-image';
    const safe = raw.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'tease-image';
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safe}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  updateControlsUI();
  buildUploadSlots();
  render();
})();
