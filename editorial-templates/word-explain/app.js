(() => {
  'use strict';

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

  const SIZES = {
    wide: { w: 2400, h: 1200 },
    square: { w: 1000, h: 1000 },
  };

  // Derived from the reference graphic: font sized as a fraction of canvas
  // height so a short word reads at the same relative size in both formats;
  // only shrinks further (by measured width) when a longer word would
  // otherwise blow past the safe margins.
  const FONT_HEIGHT_FRACTION = 0.34;
  const MAX_WIDTH_FRACTION = 0.82;
  const UNDERLINE_THICKNESS_FRACTION = 0.018;
  const UNDERLINE_GAP_FRACTION = 0.065;
  const FONT_STACK = '"Mada Black", -apple-system, sans-serif';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const sizeGroup = document.getElementById('sizeGroup');
  const wordInput = document.getElementById('wordInput');
  const wordColorSelect = document.getElementById('wordColorSelect');
  const wordColorSwatch = document.getElementById('wordColorSwatch');
  const bgColorSelect = document.getElementById('bgColorSelect');
  const bgColorSwatch = document.getElementById('bgColorSwatch');
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  let sizeMode = 'wide';
  let wordColor = WHITE;
  let bgColor = '#363B43'; // gray-600

  function getDims() {
    return SIZES[sizeMode];
  }

  function buildColorOptions(select, selected) {
    PALETTE.forEach(([rampName, hexes]) => {
      const group = document.createElement('optgroup');
      group.label = rampName;
      hexes.forEach((hex, step) => {
        const opt = document.createElement('option');
        opt.value = hex;
        opt.textContent = `${rampName} ${STEPS[step]}`;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });
    const whiteOpt = document.createElement('option');
    whiteOpt.value = WHITE;
    whiteOpt.textContent = 'White';
    select.insertBefore(whiteOpt, select.firstChild);
    select.value = selected;
  }

  function render() {
    const { w, h } = getDims();
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const text = wordInput.value.toUpperCase().trim();
    if (!text) return;

    let fontSize = h * FONT_HEIGHT_FRACTION;
    ctx.font = `900 ${fontSize}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    let metrics = ctx.measureText(text);
    // Use the actual glyph ink extents, not the advance width — a font's
    // left/right side bearings are rarely equal, so measuring/centering by
    // `metrics.width` alone leaves the underline (and the word itself)
    // visibly off-center relative to where the letters actually start/end.
    let inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const maxWidth = w * MAX_WIDTH_FRACTION;
    if (inkWidth > maxWidth) {
      fontSize *= maxWidth / inkWidth;
      ctx.font = `900 ${fontSize}px ${FONT_STACK}`;
      metrics = ctx.measureText(text);
      inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    }

    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.72;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.02;
    const underlineGap = h * UNDERLINE_GAP_FRACTION;
    const underlineThickness = h * UNDERLINE_THICKNESS_FRACTION;

    const blockHeight = ascent + descent + underlineGap + underlineThickness;
    const blockTop = (h - blockHeight) / 2;
    const baselineY = blockTop + ascent;

    // Shift the draw point so the ink (not the advance box) lands centered
    // on the canvas: with textAlign 'center', drawing at this x puts the
    // true left/right glyph edges at exactly w/2 -+ inkWidth/2.
    const textX = w / 2 + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2;

    ctx.fillStyle = wordColor;
    ctx.fillText(text, textX, baselineY);

    const lineY = baselineY + descent + underlineGap;
    ctx.fillRect(w / 2 - inkWidth / 2, lineY, inkWidth, underlineThickness);
  }

  function setSizeMode(mode) {
    if (mode === sizeMode) return;
    sizeMode = mode;
    sizeGroup.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === mode);
    });
    render();
  }

  sizeGroup.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => setSizeMode(btn.dataset.value));
  });

  wordInput.addEventListener('input', render);

  buildColorOptions(wordColorSelect, wordColor);
  wordColorSwatch.style.background = wordColor;
  wordColorSelect.addEventListener('change', (e) => {
    wordColor = e.target.value;
    wordColorSwatch.style.background = wordColor;
    render();
  });

  buildColorOptions(bgColorSelect, bgColor);
  bgColorSwatch.style.background = bgColor;
  bgColorSelect.addEventListener('change', (e) => {
    bgColor = e.target.value;
    bgColorSwatch.style.background = bgColor;
    render();
  });

  downloadBtn.addEventListener('click', () => {
    const raw = filenameInput.value.trim() || 'word-explain';
    const safe = raw.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'word-explain';
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safe}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // Canvas text ignores CSS font-loading timing, so paint once immediately
  // (falls back to a system font briefly) and again once Mada Black is
  // actually ready.
  render();
  if (document.fonts && document.fonts.load) {
    document.fonts.load(`900 100px ${FONT_STACK}`).then(render).catch(() => {});
  }
})();
