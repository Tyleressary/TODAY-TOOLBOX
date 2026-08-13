(() => {
  'use strict';

  const DIVIDER_FRACTION = 0.18; // fixed diagonal shear as a fraction of canvas width
  const MAX_ZOOM = 3;

  const SIZES = {
    wide: { w: 2400, h: 1200 },
    square: { w: 1000, h: 1000 },
  };

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const uploadRow = document.getElementById('uploadRow');
  const splitsGroup = document.getElementById('splitsGroup');
  const sizeGroup = document.getElementById('sizeGroup');
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  let splitCount = 2;
  let sizeMode = 'wide';
  let panels = []; // panels[i] = { img, scaleMultiplier, panX, panY } | undefined
  let dragState = null;

  function getDims() {
    return SIZES[sizeMode];
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function dividerX(i, y, w, h, n) {
    if (i === 0) return 0;
    if (i === n) return w;
    const baseX = (w * i) / n;
    const shear = w * DIVIDER_FRACTION;
    const t = h === 0 ? 0 : y / h;
    return baseX + (-shear / 2 + shear * t);
  }

  function getPanelPolygon(i, w, h, n) {
    const leftTop = dividerX(i, 0, w, h, n);
    const leftBottom = dividerX(i, h, w, h, n);
    const rightTop = dividerX(i + 1, 0, w, h, n);
    const rightBottom = dividerX(i + 1, h, w, h, n);
    return [
      [leftTop, 0],
      [rightTop, 0],
      [rightBottom, h],
      [leftBottom, h],
    ];
  }

  function getBBox(poly) {
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
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
    return { bboxW, bboxH, drawW, drawH, panXpx, panYpx };
  }

  function drawPanelImage(panel, bbox) {
    const { drawW, drawH, panXpx, panYpx } = panelImageMetrics(panel, bbox);
    const centerX = bbox.minX + (bbox.maxX - bbox.minX) / 2 + panXpx;
    const centerY = bbox.minY + (bbox.maxY - bbox.minY) / 2 + panYpx;
    ctx.drawImage(panel.img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
  }

  function drawPlaceholder(bbox, index, w) {
    ctx.fillStyle = '#2c2e33';
    ctx.fillRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
    const cx = bbox.minX + (bbox.maxX - bbox.minX) / 2;
    const cy = bbox.minY + (bbox.maxY - bbox.minY) / 2;
    ctx.fillStyle = '#6b6e76';
    ctx.font = `${Math.round(w * 0.02)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Image ${index + 1}`, cx, cy);
  }

  function drawDividers(w, h, n) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, w * 0.0035);
    for (let i = 1; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(dividerX(i, 0, w, h, n), 0);
      ctx.lineTo(dividerX(i, h, w, h, n), h);
      ctx.stroke();
    }
  }

  function render() {
    const { w, h } = getDims();
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < splitCount; i++) {
      const poly = getPanelPolygon(i, w, h, splitCount);
      const bbox = getBBox(poly);
      ctx.save();
      ctx.beginPath();
      poly.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.clip();
      const panel = panels[i];
      if (panel && panel.img) {
        drawPanelImage(panel, bbox);
      } else {
        drawPlaceholder(bbox, i, w);
      }
      ctx.restore();
    }

    drawDividers(w, h, splitCount);
  }

  function buildUploadSlots() {
    uploadRow.innerHTML = '';
    for (let i = 0; i < splitCount; i++) {
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

  function setSplitCount(n) {
    if (n === splitCount) return;
    splitCount = n;
    panels.length = n;
    buildUploadSlots();
    render();
  }

  function setSizeMode(mode) {
    if (mode === sizeMode) return;
    sizeMode = mode;
    render();
  }

  function wireSegmented(group, onChange) {
    group.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(btn.dataset.value);
      });
    });
  }

  wireSegmented(splitsGroup, (value) => setSplitCount(parseInt(value, 10)));
  wireSegmented(sizeGroup, (value) => setSizeMode(value));

  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('pointerdown', (e) => {
    const { w, h } = getDims();
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    for (let i = splitCount - 1; i >= 0; i--) {
      const panel = panels[i];
      if (!panel || !panel.img) continue;
      const poly = getPanelPolygon(i, w, h, splitCount);
      if (pointInPolygon(x, y, poly)) {
        dragState = { index: i, startX: x, startY: y, startPanX: panel.panX, startPanY: panel.panY };
        canvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const { w, h } = getDims();
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const dx = x - dragState.startX;
    const dy = y - dragState.startY;
    const panel = panels[dragState.index];
    if (!panel) return;
    const poly = getPanelPolygon(dragState.index, w, h, splitCount);
    const bbox = getBBox(poly);
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

  buildUploadSlots();
  render();
})();
