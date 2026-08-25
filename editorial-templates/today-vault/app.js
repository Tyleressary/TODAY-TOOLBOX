(() => {
  'use strict';

  const MAX_ZOOM = 3;

  const W = 2400;
  const H = 1200;

  // Badge placement, measured off the supplied example.jpg and expressed as
  // fractions of the canvas so the numbers survive a size change:
  // 0.24 * 1200 = 288px tall, 72px in from the side, 90px up from the bottom.
  const LOGO_SCALE = 0.24;
  const LOGO_MARGIN_X = 0.03;
  const LOGO_MARGIN_Y = 0.075;

  const CORNERS = { br: 'bottom-right', bl: 'bottom-left' };

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const uploadRow = document.getElementById('uploadRow');
  const cornerGroup = document.getElementById('cornerGroup');
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  let corner = 'br';
  let photo = null; // { img, scaleMultiplier, panX, panY }
  let dragState = null;
  let fileDragOver = false; // a file drag is hovering the canvas

  const logoImg = new Image();
  let logoReady = false;
  logoImg.onload = () => { logoReady = true; render(); };
  logoImg.src = '../../assets/today-vault-logo.png';

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // The photo fills the whole frame; there is only ever one.
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
    const centerX = bbox.minX + (bbox.maxX - bbox.minX) / 2 + panXpx;
    const centerY = bbox.minY + (bbox.maxY - bbox.minY) / 2 + panYpx;
    ctx.drawImage(panel.img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
  }

  function drawPlaceholder() {
    ctx.fillStyle = '#d8dde5';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#4a515c';
    ctx.font = `${Math.round(W * 0.022)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Upload an image', W / 2, H / 2);
  }

  // The badge is locked to a corner: its rect comes only from the constants
  // above and the chosen corner, never from pointer state.
  function getLogoRect() {
    const h = H * LOGO_SCALE;
    const w = h * (logoImg.width / logoImg.height);
    const y = H - h - H * LOGO_MARGIN_Y;
    const x = corner === 'bl' ? W * LOGO_MARGIN_X : W - w - W * LOGO_MARGIN_X;
    return { x, y, w, h };
  }

  function drawLogo() {
    if (!logoReady) return;
    const { x, y, w, h } = getLogoRect();
    ctx.drawImage(logoImg, x, y, w, h);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, W, H);

    if (photo && photo.img) {
      drawPanelImage(photo, getPanelRect());
    } else {
      drawPlaceholder();
    }

    drawLogo();
    drawDragHighlight();
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
    fileInput.addEventListener('change', onFileSelected);

    const zoomRow = document.createElement('div');
    zoomRow.className = 'zoom-row';
    const zoomLabel = document.createElement('span');
    zoomLabel.textContent = 'Zoom';
    const zoomSlider = document.createElement('input');
    zoomSlider.type = 'range';
    zoomSlider.min = '1';
    zoomSlider.max = String(MAX_ZOOM);
    zoomSlider.step = '0.01';
    zoomSlider.value = String(photo && photo.img ? photo.scaleMultiplier : 1);
    zoomSlider.disabled = !(photo && photo.img);
    zoomSlider.addEventListener('input', (e) => {
      if (photo) {
        photo.scaleMultiplier = parseFloat(e.target.value);
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
      loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
    });

    zoomRow.appendChild(zoomLabel);
    zoomRow.appendChild(zoomSlider);
    slot.appendChild(label);
    slot.appendChild(fileInput);
    slot.appendChild(zoomRow);
    uploadRow.appendChild(slot);
  }

  function onFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (file) loadFile(file);
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

  function setCorner(value) {
    if (!CORNERS[value] || value === corner) return;
    corner = value;
    updateCornerUI();
    render();
  }

  function updateCornerUI() {
    cornerGroup.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === corner);
    });
  }

  cornerGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setCorner(btn.dataset.value));
  });

  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  // Dragging repositions the photo only. The badge has no hit test at all,
  // so a drag starting on top of it still moves the photo underneath.
  canvas.addEventListener('pointerdown', (e) => {
    if (!photo || !photo.img) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    dragState = { startX: x, startY: y, startPanX: photo.panX, startPanY: photo.panY };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragState || !photo) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    const bbox = getPanelRect();
    const bboxW = bbox.maxX - bbox.minX;
    const bboxH = bbox.maxY - bbox.minY;
    photo.panX = (dragState.startPanX * bboxW + (x - dragState.startX)) / bboxW;
    photo.panY = (dragState.startPanY * bboxH + (y - dragState.startY)) / bboxH;
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
    if (!fileDragOver) { fileDragOver = true; render(); }
  });
  canvas.addEventListener('dragleave', () => {
    if (fileDragOver) { fileDragOver = false; render(); }
  });
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDragOver = false;
    loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
    render();
  });

  downloadBtn.addEventListener('click', () => {
    const raw = filenameInput.value.trim() || 'today-vault';
    const safe = raw.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'today-vault';
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safe}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  updateCornerUI();
  buildUploadSlot();
  render();
})();
