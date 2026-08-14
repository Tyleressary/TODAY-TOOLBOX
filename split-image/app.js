(() => {
  'use strict';

  const MAX_ZOOM = 3;

  const SIZES = {
    wide: { w: 2400, h: 1200 },
    square: { w: 1000, h: 1000 },
  };

  // Fixed layouts. Orientation controls whether panels stack side-by-side
  // (vertical dividers) or top-to-bottom (horizontal dividers).
  const LAYOUTS = {
    '2': { count: 2, orientation: 'vertical' },
    '3': { count: 3, orientation: 'vertical' },
    '4': { count: 4, orientation: 'vertical' },
    '4h': { count: 4, orientation: 'horizontal' },
  };

  // Square output only offers the 2-split layout.
  const SQUARE_ONLY_LAYOUT = '2';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const uploadRow = document.getElementById('uploadRow');
  const splitsGroup = document.getElementById('splitsGroup');
  const sizeGroup = document.getElementById('sizeGroup');
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  let layoutId = '2';
  let sizeMode = 'wide';
  let panels = []; // panels[i] = { img, scaleMultiplier, panX, panY } | undefined
  let dragState = null;

  function getDims() {
    return SIZES[sizeMode];
  }

  function getLayout() {
    return LAYOUTS[layoutId];
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getPanelRect(i, w, h, layout) {
    if (layout.orientation === 'horizontal') {
      const stripH = h / layout.count;
      return { minX: 0, maxX: w, minY: i * stripH, maxY: (i + 1) * stripH };
    }
    const stripW = w / layout.count;
    return { minX: i * stripW, maxX: (i + 1) * stripW, minY: 0, maxY: h };
  }

  function pointInRect(x, y, rect) {
    return x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
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

  function drawPlaceholder(bbox, index, w) {
    ctx.fillStyle = '#d8dde5';
    ctx.fillRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
    const cx = bbox.minX + (bbox.maxX - bbox.minX) / 2;
    const cy = bbox.minY + (bbox.maxY - bbox.minY) / 2;
    ctx.fillStyle = '#4a515c';
    ctx.font = `${Math.round(w * 0.02)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Image ${index + 1}`, cx, cy);
  }

  function drawDividers(w, h, layout) {
    for (let i = 1; i < layout.count; i++) {
      ctx.beginPath();
      if (layout.orientation === 'horizontal') {
        const y = (h * i) / layout.count;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      } else {
        const x = (w * i) / layout.count;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, w * 0.0035);
      ctx.stroke();
    }
  }

  function render() {
    const { w, h } = getDims();
    const layout = getLayout();
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < layout.count; i++) {
      const bbox = getPanelRect(i, w, h, layout);
      ctx.save();
      ctx.beginPath();
      ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
      ctx.clip();
      const panel = panels[i];
      if (panel && panel.img) {
        drawPanelImage(panel, bbox);
      } else {
        drawPlaceholder(bbox, i, w);
      }
      ctx.restore();
    }

    drawDividers(w, h, layout);
  }

  function buildUploadSlots() {
    const layout = getLayout();
    uploadRow.innerHTML = '';
    for (let i = 0; i < layout.count; i++) {
      const panel = panels[i];
      const slot = document.createElement('div');
      slot.className = 'upload-slot' + (panel && panel.img ? ' has-image' : '');
      slot.dataset.index = String(i);

      const label = document.createElement('label');
      label.textContent = `Image ${i + 1}`;
      const fileId = `file-${i}`;
      label.htmlFor = fileId;

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.className = 'file-input';
      fileInput.id = fileId;
      fileInput.addEventListener('change', (e) => onFileSelected(i, e));

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

      zoomRow.appendChild(zoomLabel);
      zoomRow.appendChild(zoomSlider);
      slot.appendChild(label);
      slot.appendChild(fileInput);
      slot.appendChild(zoomRow);
      uploadRow.appendChild(slot);
    }
  }

  function onFileSelected(index, e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      panels[index] = { img, scaleMultiplier: 1, panX: 0, panY: 0 };
      buildUploadSlots();
      render();
    };
    img.src = URL.createObjectURL(file);
  }

  function setLayout(id) {
    if (id === layoutId) return;
    if (sizeMode === 'square' && id !== SQUARE_ONLY_LAYOUT) return;
    layoutId = id;
    panels.length = getLayout().count;
    updateSplitsUI();
    buildUploadSlots();
    render();
  }

  function setSizeMode(mode) {
    if (mode === sizeMode) return;
    sizeMode = mode;
    if (sizeMode === 'square' && layoutId !== SQUARE_ONLY_LAYOUT) {
      layoutId = SQUARE_ONLY_LAYOUT;
      panels.length = getLayout().count;
      buildUploadSlots();
    }
    updateSplitsUI();
    render();
  }

  function updateSplitsUI() {
    splitsGroup.querySelectorAll('button').forEach((btn) => {
      const id = btn.dataset.value;
      btn.classList.toggle('active', id === layoutId);
      const allowed = sizeMode !== 'square' || id === SQUARE_ONLY_LAYOUT;
      btn.disabled = !allowed;
    });
    sizeGroup.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === sizeMode);
    });
  }

  splitsGroup.querySelectorAll('button').forEach((btn) => {
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

  canvas.addEventListener('pointerdown', (e) => {
    const { w, h } = getDims();
    const layout = getLayout();
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    for (let i = layout.count - 1; i >= 0; i--) {
      const panel = panels[i];
      if (!panel || !panel.img) continue;
      const rect = getPanelRect(i, w, h, layout);
      if (pointInRect(x, y, rect)) {
        dragState = { index: i, startX: x, startY: y, startPanX: panel.panX, startPanY: panel.panY };
        canvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const { w, h } = getDims();
    const layout = getLayout();
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const dx = x - dragState.startX;
    const dy = y - dragState.startY;
    const panel = panels[dragState.index];
    if (!panel) return;
    const bbox = getPanelRect(dragState.index, w, h, layout);
    const bboxW = bbox.maxX - bbox.minX;
    const bboxH = bbox.maxY - bbox.minY;
    const startPanXpx = dragState.startPanX * bboxW;
    const startPanYpx = dragState.startPanY * bboxH;
    panel.panX = bboxW ? (startPanXpx + dx) / bboxW : 0;
    panel.panY = bboxH ? (startPanYpx + dy) / bboxH : 0;
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

  downloadBtn.addEventListener('click', () => {
    const raw = filenameInput.value.trim() || 'split-image';
    const safe = raw.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'split-image';
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safe}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  updateSplitsUI();
  buildUploadSlots();
  render();
})();
