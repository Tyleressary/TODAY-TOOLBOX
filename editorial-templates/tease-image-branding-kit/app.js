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

  // Every logo renders at the same size in the same place, so the only thing
  // that changes between them is the artwork.
  const LOGOS = {
    vault: { label: 'TODAY VAULT', src: '../../assets/today-vault-logo.png' },
    today75: { label: 'TODAY 75', src: '../../assets/today-75-logo.png' },
  };

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const uploadRow = document.getElementById('uploadRow');
  const cornerGroup = document.getElementById('cornerGroup');
  const logoGroup = document.getElementById('logoGroup');
  const sizeGroup = document.getElementById('sizeGroup');
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  let corner = 'br';
  let logoId = 'vault';
  let sizeMode = 'wide';
  let photo = null; // { img, scaleMultiplier, panX, panY }
  let dragState = null;
  let fileDragOver = false; // a file drag is hovering the canvas

  // Both logos are decoded up front, so switching never flashes an empty
  // corner and an export can never race a pending decode.
  const logoImages = {};
  Object.entries(LOGOS).forEach(([id, { src }]) => {
    const img = new Image();
    img.onload = () => render();
    img.src = src;
    logoImages[id] = img;
  });

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

  // The photo fills the whole frame; there is only ever one.
  function getPanelRect() {
    const { w, h } = getDims();
    return { minX: 0, maxX: w, minY: 0, maxY: h };
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
    const { w, h } = getDims();
    ctx.fillStyle = '#d8dde5';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4a515c';
    ctx.font = `${Math.round(w * 0.022)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Upload an image', w / 2, h / 2);
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
    const { w: W, h: H } = getDims();
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
    updateControlsUI();
    render();
  }

  function setLogo(value) {
    if (!LOGOS[value] || value === logoId) return;
    logoId = value;
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
    sync(logoGroup, logoId);
    sync(sizeGroup, sizeMode);
  }

  cornerGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setCorner(btn.dataset.value));
  });
  logoGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setLogo(btn.dataset.value));
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
  buildUploadSlot();
  render();
})();
