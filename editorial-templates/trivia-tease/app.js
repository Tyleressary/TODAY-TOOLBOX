(() => {
  'use strict';

  const MAX_ZOOM = 3;

  // Toolbox palette — six ramps, 100 (lightest) to 600 (most saturated).
  // Mirrors assets/toolbox.css :root and docs/color-palette.md.
  const PALETTE = [
    ['Red',    ['#FFECEA', '#FFC7C2', '#FF8F84', '#FF6859', '#FF513C', '#FF3A2C']],
    ['Purple', ['#F8E8FD', '#E4C7F0', '#C8A2D7', '#AE7DC9', '#7F479E', '#652E84']],
    ['Blue',   ['#EEF9FF', '#C9EDFA', '#8CDCF7', '#63CFF5', '#4ACAF1', '#2CC4F1']],
    ['Amber',  ['#FFF6EA', '#FFE3C0', '#FFC87E', '#FFB64D', '#FEAE30', '#FEA300']],
    ['Green',  ['#E4EFEA', '#ADD1C0', '#58A380', '#008357', '#00733E', '#006327']],
    ['Gray',   ['#F0F2F5', '#D8DDE5', '#ABB4C2', '#7B838F', '#4A515C', '#363B43']],
  ];
  const STEPS = [100, 200, 300, 400, 500, 600];
  const WHITE = '#FFFFFF';

  // Fixed template: a 5-across, 3-down grid of 15 boxes on a 2400x1200 canvas,
  // so each box lands at 480x400. Nothing here is user-configurable — the whole
  // point of the template is that every trivia tease comes out the same shape.
  const W = 2400;
  const H = 1200;
  const COLS = 5;
  const ROWS = 3;
  const COUNT = COLS * ROWS; // 15

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const uploadRow = document.getElementById('uploadRow');
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  // panels[i] is an image fill { img, scaleMultiplier, panX, panY },
  // a solid fill { color }, or undefined for an empty box.
  let panels = [];
  let dragState = null;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // Boxes run left-to-right, top-to-bottom: 0 = top-left, 14 = bottom-right.
  function getPanelRect(i) {
    const cellW = W / COLS;
    const cellH = H / ROWS;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      minX: col * cellW,
      maxX: (col + 1) * cellW,
      minY: row * cellH,
      maxY: (row + 1) * cellH,
    };
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

  function drawColor(bbox, color) {
    ctx.fillStyle = color;
    ctx.fillRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
  }

  function drawPlaceholder(bbox, index) {
    ctx.fillStyle = '#d8dde5';
    ctx.fillRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
    const cx = bbox.minX + (bbox.maxX - bbox.minX) / 2;
    const cy = bbox.minY + (bbox.maxY - bbox.minY) / 2;
    ctx.fillStyle = '#4a515c';
    ctx.font = `${Math.round(W * 0.016)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Image ${index + 1}`, cx, cy);
  }

  function strokeLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, W * 0.0035);
    ctx.stroke();
  }

  function drawDividers() {
    for (let c = 1; c < COLS; c++) {
      const x = (W * c) / COLS;
      strokeLine(x, 0, x, H);
    }
    for (let r = 1; r < ROWS; r++) {
      const y = (H * r) / ROWS;
      strokeLine(0, y, W, y);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < COUNT; i++) {
      const bbox = getPanelRect(i);
      ctx.save();
      ctx.beginPath();
      ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
      ctx.clip();
      const panel = panels[i];
      if (panel && panel.img) {
        drawPanelImage(panel, bbox);
      } else if (panel && panel.color) {
        drawColor(bbox, panel.color);
      } else {
        drawPlaceholder(bbox, i);
      }
      ctx.restore();
    }

    drawDividers();
  }

  function buildUploadSlots() {
    uploadRow.innerHTML = '';
    for (let i = 0; i < COUNT; i++) {
      const panel = panels[i];
      const slot = document.createElement('div');
      const filled = !!(panel && (panel.img || panel.color));
      slot.className = 'upload-slot' + (filled ? ' has-image' : '');
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

      // Each box takes an image or a flat palette color, whichever was set last.
      const colorRow = document.createElement('div');
      colorRow.className = 'color-row';

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      if (panel && panel.color) {
        swatch.style.background = panel.color;
      } else {
        swatch.classList.add('is-empty');
      }

      const colorSelect = document.createElement('select');
      colorSelect.className = 'color-select';
      colorSelect.id = `color-${i}`;
      colorSelect.setAttribute('aria-label', `Fill color for image ${i + 1}`);

      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = 'Or pick a color';
      colorSelect.appendChild(noneOpt);

      const whiteOpt = document.createElement('option');
      whiteOpt.value = WHITE;
      whiteOpt.textContent = 'White';
      colorSelect.appendChild(whiteOpt);

      PALETTE.forEach(([rampName, hexes]) => {
        const group = document.createElement('optgroup');
        group.label = rampName;
        hexes.forEach((hex, step) => {
          const opt = document.createElement('option');
          opt.value = hex;
          opt.textContent = `${rampName} ${STEPS[step]}`;
          group.appendChild(opt);
        });
        colorSelect.appendChild(group);
      });

      colorSelect.value = panel && panel.color ? panel.color : '';
      colorSelect.addEventListener('change', (e) => onColorSelected(i, e.target.value));

      colorRow.appendChild(colorSelect);
      colorRow.appendChild(swatch);

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
      slot.appendChild(colorRow);
      slot.appendChild(zoomRow);
      uploadRow.appendChild(slot);
    }
  }

  function onFileSelected(index, e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
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

  // Picking a color replaces whatever was in the box; picking the blank
  // option empties it again.
  function onColorSelected(index, hex) {
    panels[index] = hex ? { color: hex } : undefined;
    buildUploadSlots();
    render();
  }

  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    for (let i = COUNT - 1; i >= 0; i--) {
      const panel = panels[i];
      if (!panel || !panel.img) continue;
      if (pointInRect(x, y, getPanelRect(i))) {
        dragState = { index: i, startX: x, startY: y, startPanX: panel.panX, startPanY: panel.panY };
        canvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const dx = x - dragState.startX;
    const dy = y - dragState.startY;
    const panel = panels[dragState.index];
    if (!panel) return;
    const bbox = getPanelRect(dragState.index);
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
    const raw = filenameInput.value.trim() || 'trivia-tease';
    const safe = raw.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'trivia-tease';
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safe}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  buildUploadSlots();
  render();
})();
