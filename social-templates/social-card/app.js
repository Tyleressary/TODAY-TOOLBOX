(() => {
  'use strict';

  const W = 1200;
  const H = 1500;
  const MAX_ZOOM = 3;

  // Circular image bubbles, measured off the supplied reference card at
  // 1200x1500 rather than estimated: outer diameter 433 (a circle fit to the
  // ring gave SD 0.67px), a 5.5px pure white ring, so the visible photo
  // aperture is 422. No shadow -- the background luminance there is flat
  // right up to the ring.
  const BUBBLE_D = 433;
  const BUBBLE_R = BUBBLE_D / 2;
  const BUBBLE_RING = 5.5;
  // Minimum air between two bubbles' rings, so a pair reads as a pair.
  const BUBBLE_GAP = 16;

  // Canvas-only families, self-hosted. Canvas text must not depend on a
  // runtime font fetch: a fallback face would silently export off-brand type.
  const SANS = "'Source Sans 3 Canvas'";
  const SERIF = "'Libre Bodoni Canvas'";

  // Every number below was measured off the supplied Figma reference card at
  // 1200x1500, not estimated. Text box is 1000 wide, centred (the widest
  // headline line's ink spanned 138-1063, i.e. a centred 1000px box).
  const BOX_W = 1000;
  const CENTRE_X = W / 2;
  // The content safe inset the text box already sits in: (1200 - 1000) / 2.
  // Reused as the left edge for left alignment and as the top safe margin,
  // so no new margin is invented.
  const BOX_LEFT = (W - BOX_W) / 2;
  const SAFE_TOP = BOX_LEFT;

  // In the original bottom-anchored composition the headline may never cross
  // the card's vertical centre. Top and centre placements deliberately work
  // above it, so there the limit is the top safe margin instead.
  const TOP_LIMIT = H / 2;

  // Bubble guard rails.
  //
  // The edge inset is NOT the text box's 100px any more, and deliberately so:
  // that is the text column's inset, while this is "how much room does a
  // 433px disc need to be placeable". With the text centred the two are in
  // conflict. A bubble needs 433 of diameter plus 40 of clearance either
  // side, and centred copy splits the 1500px card into bands that are just
  // too short. Counting legal centres on an 8px grid over a default centred
  // card: at a 100px inset there are ZERO -- the bubble cannot move at all,
  // which reads as it being stuck behind the type. At 80 there are 3 and at
  // 75 there are 4, all in a sliver below. 60 is the largest inset that
  // opens room both above and below (33), and it still keeps the whole ring
  // 60px clear of every edge, so nothing is ever clipped.
  const BUBBLE_EDGE = 60;
  // Air between the ring and any ink -- type or lockup. Measured, and
  // unchanged: a bubble over the lockup's x-range bottoms out at
  // 1417 - 40 - 216.5 = 1160.5, precisely the reference's left-bubble
  // centre, and the design's own dek-to-logo air (GAP_DEK_LOGO 85.5 baseline
  // to top, ~74.5 ink to top) corroborates it from the other side.
  const BUBBLE_CLEAR = 40;

  // Text composition. The original design is horizontally centred and
  // vertically bottom-anchored to the logo, so the horizontal default IS
  // 'center' -- there is no third horizontal state to have. ('original' is
  // still accepted here and renders identically, because the test suite and
  // any saved link may still name it.) Vertically 'original' is the real
  // bottom-anchored composition and is its own state.
  const align = { h: 'center', v: 'original' };
  // Automatic editorial line breaking; off reverts to plain greedy wrapping.
  let typeset = true;
  function alignLeft() { return align.h === 'left'; }
  function placeLimit() { return align.v === 'original' ? TOP_LIMIT : SAFE_TOP; }

  // Three independent typographic controls per style:
  //   tracking  -- extra space between letters, in em
  //   wordSpace -- the TOTAL advance of a space, in em (not an increment)
  //   kerning   -- the font's own pair adjustments, left to the font
  // Canvas letterSpacing lands on the space glyph as well as on letters, so
  // without wordSpace each style's word gaps were decided by its tracking:
  // +4% opened the eyebrow's, -2% pinched the dek's, -1% pinched the serif
  // headline's to 0.15em, where `Serif Headline` ran together. Stating the
  // advance keeps the three controls from moving each other.
  const EYEBROW = { family: SANS, weight: 900, size: 38, leading: 0.95, tracking: 0.04, wordSpace: 0.240 };
  const DEK = { family: SANS, weight: 500, size: 50, leading: 1.10, tracking: -0.02, wordSpace: 0.200 };

  // Two headline styles. The sans one auto-sizes 90..65 under the rule in
  // chooseLayout(); the serif one is pinned at the size its Figma panel
  // specifies, so copy that will not fit warns rather than being resized.
  //
  // gapEye / gapDek are baseline-to-baseline, so they cannot simply be shared:
  // the reference's 77 and 72.5 were measured against a 65px Source Sans
  // headline whose caps rise 43px, and Libre Bodoni's rise 76px at 100px, so
  // reusing them runs the headline straight into the eyebrow. The serif values
  // below are set to reproduce the reference's *visual* clearances exactly --
  // 34px from the eyebrow's baseline to the headline's cap top, and 22.5px
  // from the headline's descender to the dek's cap top -- against measured
  // Bodoni metrics (cap 76, descender 33 at 100px; dek ascent 36 at 50px).
  const HEAD_STYLES = {
    sans: { label: 'Source Sans 3', family: SANS, weight: 900,
            min: 65, max: 90, leading: 1.00, tracking: 0.01, wordSpace: 0.210,
            gapEye: 77, gapDek: 72.5 },
    // fixed is the design size; min is only reached when no acceptable
    // composition exists at 100px -- see chooseLayout().
    serif: { label: 'Libre Bodoni', family: SERIF, weight: 700,
             fixed: 100, min: 85, leading: 1.14, tracking: -0.01, wordSpace: 0.210,
             gapEye: 110, gapDek: 91.5 },
  };
  let headKey = 'sans';
  function headStyle() { return HEAD_STYLES[headKey]; }

  // Placeholder copy that describes the face it is set in. Swapped when the
  // font changes, but only while the headline is still untouched: the moment
  // anything is typed it is the user's copy and is never overwritten.
  const DEFAULT_HEAD = {
    sans: 'Use Source Sans 3 Black at 65pt for Long Headlines and Keep Extended '
        + 'Headline Treatments Within Four Lines Maximum',
    serif: 'A Serif Headline Set in Libre Bodoni',
  };
  let headPristine = true;

  // Bottom-anchored gaps, measured from the reference.
  // Back-solved from the reference's two most reliable baselines: headline
  // line 4 has no descenders so its ink bottom (1204) is exactly its baseline,
  // and the all-caps eyebrow's is 932.
  const LOGO_BOTTOM_MARGIN = 49;   // card bottom -> logo bottom (logo top 1417)
  const LOGO_WIDTH = 247;          // logo renders 247 x 34
  const GAP_DEK_LOGO = 85.5;       // dek last baseline -> logo top
                                   // (independent of the headline's face)

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

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const uploadRow = document.getElementById('uploadRow');
  const stage = document.getElementById('stage');
  const EDIT = {
    eyebrow: document.getElementById('edEyebrow'),
    headline: document.getElementById('edHeadline'),
    dek: document.getElementById('edDek'),
  };
  const fontSelect = document.getElementById('fontSelect');
  const alignXGroup = document.getElementById('alignX');
  const alignYGroup = document.getElementById('alignY');
  const typesetToggle = document.getElementById('typesetToggle');
  const gradToggle = document.getElementById('gradToggle');
  const dropperBtn = document.getElementById('dropperBtn');
  const colourDot = document.getElementById('colourDot');
  const colourText = document.getElementById('colourText');
  const colourChip = document.getElementById('colourChip');
  const colourReset = document.getElementById('colourReset');
  const loupe = document.getElementById('loupe');
  const loupeCanvas = document.getElementById('loupeCanvas');
  const loupeCtx = loupeCanvas.getContext('2d');
  const loupeHex = document.getElementById('loupeHex');
  const strengthRange = document.getElementById('gradStrength');
  const heightRange = document.getElementById('gradHeight');
  const eyebrowToggle = document.getElementById('eyebrowToggle');
  const dekToggle = document.getElementById('dekToggle');
  const sizeNote = document.getElementById('sizeNote');
  const bubbleNote = document.getElementById('bubbleNote');
  const bubbleRow = document.getElementById('bubbleRow');
  const bubbleLayer = document.getElementById('bubbleLayer');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const filenameInput = document.getElementById('filename');
  const downloadBtn = document.getElementById('downloadBtn');

  const shown = { eyebrow: true, dek: true, gradient: true };
  let photo = null; // { img, scaleMultiplier, panX, panY }
  // Two bubble slots. Each is null or a record carrying the same four panel
  // fields as `photo`, so panelImageMetrics() and drawPanelImage() work on a
  // bubble unchanged, plus its centre in canvas pixels and a panel thumbnail.
  const bubbles = [null, null];
  let selected = -1;      // index of the selected bubble, -1 for none
  let adjusting = false;  // true => a drag pans the photo inside `selected`
  let bubbleDrag = null;
  let rescuing = false;
  let lastLayout = null;  // the layout the last render used, for the guards
  let dragState = null;
  let fileDragOver = false;
  let fontsReady = false;
  const grad = { ...GRAD_DEFAULTS };

  // Gradient colour source: null means derive it from the image (Auto),
  // otherwise an [r, g, b] the dropper sampled.
  let pickedColour = null;
  let picking = false;
  let photoLayer = null; // offscreen copy of the photo alone, for sampling

  const logoImg = new Image();
  logoImg.onload = () => render();
  logoImg.src = '../../assets/logo-white.png';

  // Canvas text needs the real face before the first measurement, or wrapping
  // and auto-sizing would be computed against a fallback.
  Promise.all([
    document.fonts.load(`900 100px ${SANS}`),
    document.fonts.load(`500 100px ${SANS}`),
    document.fonts.load(`700 100px ${SERIF}`),
  ]).then(() => { fontsReady = true; render(); });

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // The editable's own characters, verbatim. The only transformation is
  // mapping our injected line-break newlines back to the single space each
  // one replaced -- that swap is length-preserving, so this is exactly what
  // the user typed. The canvas renders THIS, which is what keeps the caret
  // and the glyphs on the same layout.
  function blockText(el) {
    return (el.textContent || '').replace(/\n/g, ' ');
  }

  // Tidied form. Used for the commit on blur, and for comparisons such as
  // the pristine-placeholder check -- never for rendering while editing.
  function readEditable(el) {
    return blockText(el).replace(/\s+/g, ' ').trim();
  }

  // Editorial punctuation, from the shared converter. Guarded so the page
  // still works if the script is missing rather than throwing on blur.
  function smartText(t) {
    return (typeof window.smartPunctuation === 'function') ? window.smartPunctuation(t) : t;
  }

  // Lays each editable box exactly over the type the canvas draws, so the
  // caret and selection land where the glyphs are. The text itself is
  // transparent -- the canvas underneath is what you actually see, which keeps
  // the preview and the exported JPG the same renderer.
  // Caret position as a character offset into the block's text, so it can be
  // restored across a rewrite.
  function caretOffset(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0).cloneRange();
    r.selectNodeContents(el);
    r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
    return r.toString().length;
  }

  function setCaretOffset(el, offset) {
    const node = el.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const pos = Math.max(0, Math.min(offset, node.textContent.length));
    const r = document.createRange();
    r.setStart(node, pos); r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
  }

  // The canvas and the overlay used to agree because both wrapped greedily.
  // Once the engine chooses the canvas's breaks, CSS no longer matches it, so
  // the overlay is given those breaks as newlines (.edit-text is pre-wrap).
  // Swapping a space for a newline keeps the text the same length, so the
  // caret offset is unaffected -- and readEditable collapses whitespace, so
  // the user's text is unchanged.
  function syncEditableBreaks(el, lines) {
    if (!lines.length) return;
    const wanted = lines.join('\n');
    const cur = el.textContent;
    if (cur === wanted) return;
    // Swap whitespace for whitespace at the same positions, and nothing else.
    // Anything that would add or remove a character is refused: mid-word the
    // user's text legitimately differs from the trimmed, wrapped version --
    // typing a space gives "My " against a wanted "My" -- and rewriting there
    // would eat the character they just typed. Equal length also means the
    // caret offset survives untouched.
    if (cur.length !== wanted.length) return;
    for (let i = 0; i < cur.length; i++) {
      if (cur[i] === wanted[i]) continue;
      const a = cur[i], b = wanted[i];
      if ((a === ' ' || a === '\n') && (b === ' ' || b === '\n')) continue;
      return;
    }
    const focused = document.activeElement === el;
    const off = focused ? caretOffset(el) : null;
    el.textContent = wanted;
    if (focused && off !== null) setCaretOffset(el, off);
  }

  function setStyles(el, props) {
    for (const k in props) if (el.style[k] !== props[k]) el.style[k] = props[k];
  }

  function placeEditable(el, lines, baselines, st, size, visible) {
    if (!visible) { el.hidden = true; return; }
    el.hidden = false;
    syncEditableBreaks(el, lines);
    const leading = st.leading, tracking = st.tracking, family = st.family, weight = st.weight;
    const m = metrics(st, size);
    const lineH = size * leading;
    const count = Math.max(1, lines.length);
    const firstBaseline = baselines.length ? baselines[0] : H - 200;
    // CSS puts half the leading above the ascent; undo that to hit the baseline.
    const top = firstBaseline - m.fontAscent - (lineH - (m.fontAscent + m.fontDescent)) / 2;
    // Write a property only when it actually changes: churning the active
    // element's geometry on every keystroke is a way to disturb the caret.
    setStyles(el, {
      textAlign: alignLeft() ? 'left' : 'center',
      left: `${BOX_LEFT}px`,
      width: `${BOX_W}px`,
      top: `${top}px`,
      height: `${lineH * count}px`,
      fontFamily: family,
      fontWeight: String(weight),
      fontSize: `${size}px`,
      lineHeight: `${lineH}px`,
      letterSpacing: `${(tracking * size).toFixed(3)}px`,
      // The same px value the canvas uses: CSS word-spacing and letter-spacing
      // treat the space glyph exactly as Canvas does, so the caret and the
      // selection keep landing on the glyphs.
      wordSpacing: `${wordSpacingPx(st, size).toFixed(3)}px`,
      fontKerning: 'normal',
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

  // target defaults to the visible canvas; the dropper passes its offscreen
  // photo layer so the two can never drift apart.
  function drawPanelImage(panel, bbox, target) {
    const g = target || ctx;
    const { drawW, drawH, panXpx, panYpx } = panelImageMetrics(panel, bbox);
    const cx = bbox.minX + (bbox.maxX - bbox.minX) / 2 + panXpx;
    const cy = bbox.minY + (bbox.maxY - bbox.minY) / 2 + panYpx;
    g.drawImage(panel.img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }

  // panX/panY are fractions OF THE BBOX, so a 433px bubble and the 1200x1500
  // background cannot share a divisor. One helper, both callers.
  function panBy(panel, bbox, dxPx, dyPx, startPanX, startPanY) {
    const bw = bbox.maxX - bbox.minX;
    const bh = bbox.maxY - bbox.minY;
    panel.panX = (startPanX * bw + dxPx) / bw;
    panel.panY = (startPanY * bh + dyPx) / bh;
  }

  /* ---------- image bubbles ---------- */

  function bubbleBox(b) {
    return { minX: b.cx - BUBBLE_R, maxX: b.cx + BUBBLE_R,
             minY: b.cy - BUBBLE_R, maxY: b.cy + BUBBLE_R };
  }

  function drawBubble(b) {
    if (!b || !b.img) return;
    ctx.save();
    // Clip at the OUTER radius and let the ring paint over the image's last
    // 5.5px. Clipping at the aperture instead would leave the clip's own
    // antialiased edge only half covered by the ring, which is where a seam
    // comes from. Cover-fitting the outer square for the same reason: the
    // image then covers every pixel the clip can expose.
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, BUBBLE_R, 0, Math.PI * 2);
    ctx.clip();
    // Canvas state, so it is set inside the save: touching it globally would
    // change how the background photo resamples on every existing card.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawPanelImage(b, bubbleBox(b));
    ctx.restore();

    ctx.save();
    // A stroke straddles its path, so the path radius is the ring's mid-line:
    // 216.5 - 5.5/2 = 213.75 spans 211..216.5. Outer 433, ring 5.5, photo 422.
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, BUBBLE_R - BUBBLE_RING / 2, 0, Math.PI * 2);
    ctx.lineWidth = BUBBLE_RING;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }

  function drawBubbles() {
    for (const b of bubbles) drawBubble(b);
  }

  /* ---------- text measuring ---------- */

  function setFont(family, weight, size) {
    ctx.font = `${weight} ${size}px ${family}`;
  }

  /* ---------- spacing: three controls that do not move each other ---------- */

  // What the browser actually does, not what it claims to expose: a property
  // can exist and still not reach measureText or the raster. Probed once, in a
  // scratch context, so the real one is never left in a probe state.
  const CAP = (() => {
    const g = document.createElement('canvas').getContext('2d');
    g.font = '700 100px serif';
    const plain = g.measureText('a b').width;
    let wordSpacing = false, letterSpacing = false, fontKerning = false;
    try { g.wordSpacing = '20px'; wordSpacing = Math.abs(g.measureText('a b').width - plain - 20) < 0.5; }
    catch (e) { /* unsupported */ }
    try { g.wordSpacing = '0px'; } catch (e) { /* noop */ }
    try { g.letterSpacing = '10px'; letterSpacing = Math.abs(g.measureText('a b').width - plain - 30) < 0.5; }
    catch (e) { /* unsupported */ }
    try { g.letterSpacing = '0px'; } catch (e) { /* noop */ }
    try {
      g.fontKerning = 'normal'; const on = g.measureText('AV').width;
      g.fontKerning = 'none'; const off = g.measureText('AV').width;
      g.fontKerning = 'auto'; fontKerning = on !== off;
    } catch (e) { /* unsupported */ }
    return { wordSpacing, letterSpacing, fontKerning, wordSpacingNative: wordSpacing };
  })();

  // The font's own advance for a space, measured directly. Deliberately not
  // width('a a') - width('aa'): that subtraction also carries whatever kern
  // the font applies between the probe letters. Spacing is zeroed first or the
  // reading would include a letterSpacing unit, and restored after.
  const spaceCache = new Map();
  function baseSpace(family, weight, size) {
    const key = `${weight}|${size}|${family}`;
    let v = spaceCache.get(key);
    if (v !== undefined) return v;
    const hasLS = 'letterSpacing' in ctx, hasWS = 'wordSpacing' in ctx;
    const ls = ctx.letterSpacing, ws = ctx.wordSpacing;
    if (hasLS) ctx.letterSpacing = '0px';
    if (hasWS) ctx.wordSpacing = '0px';
    setFont(family, weight, size);
    v = ctx.measureText(' ').width;
    if (hasLS) ctx.letterSpacing = ls;
    if (hasWS) ctx.wordSpacing = ws;
    spaceCache.set(key, v);
    return v;
  }

  // The advance a space should end up with, in px.
  function wordAdvance(st, size) {
    return (st.wordSpace !== undefined ? st.wordSpace : 0.2) * size;
  }

  // Sets font, tracking, word spacing and kerning together, so a measurement
  // can never be taken under different settings than the drawing.
  function setStyle(st, size) {
    setFont(st.family, st.weight, size);
    if (CAP.fontKerning) ctx.fontKerning = 'normal';
    if (CAP.letterSpacing) ctx.letterSpacing = `${(st.tracking * size).toFixed(3)}px`;
    if (CAP.wordSpacing) {
      // letterSpacing has already been added to the space glyph; subtract it
      // back out so tracking moves letters only.
      ctx.wordSpacing = `${wordSpacingPx(st, size).toFixed(3)}px`;
    } else if ('wordSpacing' in ctx) {
      // Fallback path: the gaps are placed by hand, so nothing may be added
      // to the space glyph on top of them.
      ctx.wordSpacing = '0px';
    }
  }

  // The px value the overlay needs for the same result. CSS word-spacing and
  // letter-spacing treat the space glyph exactly as Canvas does.
  function wordSpacingPx(st, size) {
    return wordAdvance(st, size) - baseSpace(st.family, st.weight, size)
         - (CAP.letterSpacing ? st.tracking * size : 0);
  }

  // Width of a whole line under the current style. Without native word
  // spacing the gaps are added here, so wrapping measures what gets drawn.
  function measureLine(text, st, size) {
    setStyle(st, size);
    if (CAP.wordSpacing) return ctx.measureText(text).width;
    const words = text.split(' ');
    if (words.length === 1) return ctx.measureText(text).width;
    let w = 0;
    for (const word of words) w += ctx.measureText(word).width;
    return w + (words.length - 1) * wordAdvance(st, size);
  }

  // Draws one line, anchored either on the centre axis or on the left safe
  // edge. Alignment only chooses where the line starts -- the gaps inside it
  // are the style's own, never stretched to fill the measure.
  function drawLine(text, baseline, st, size, left) {
    setStyle(st, size);
    if (CAP.wordSpacing) {
      ctx.textAlign = left ? 'left' : 'center';
      ctx.fillText(text, left ? BOX_LEFT : CENTRE_X, baseline);
      return;
    }
    const words = text.split(' ');
    if (words.length === 1) {
      ctx.textAlign = left ? 'left' : 'center';
      ctx.fillText(text, left ? BOX_LEFT : CENTRE_X, baseline);
      return;
    }
    const gap = wordAdvance(st, size);
    const total = measureLine(text, st, size);
    setStyle(st, size);
    ctx.textAlign = 'left';
    let x = left ? BOX_LEFT : CENTRE_X - total / 2;
    for (let i = 0; i < words.length; i++) {
      ctx.fillText(words[i], x, baseline);
      x += ctx.measureText(words[i]).width + gap;
    }
    ctx.textAlign = 'center';
  }

  // Splits a token that is itself wider than the box. Without this a single
  // long word never breaks and runs straight off both edges of the card. Only
  // an over-long token is ever split, and only here: ordinary words are always
  // measured and drawn whole, so the font's shaping and kerning stay intact.
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

  // Wrapping measures through measureLine, so the word spacing that will be
  // drawn is the word spacing lines are fitted against.
  // Every index at which a line may break: one whitespace character, which
  // the break consumes. Because exactly one character goes, the lines
  // rejoined with '\n' have the raw text's length and differ from it only at
  // whitespace positions -- which is what keeps the overlay's caret offsets
  // mapped one-to-one onto the canvas's glyphs.
  function breakOps(text) {
    const ops = [];
    for (let i = 0; i < text.length; i++) if (/\s/.test(text[i])) ops.push(i);
    return ops;
  }

  function sliceLines(text, breaks) {
    const lines = [];
    let start = 0;
    for (const b of breaks) { lines.push(text.slice(start, b)); start = b + 1; }
    lines.push(text.slice(start));
    return lines;
  }

  // Greedy wrap over the raw string. Whitespace is preserved exactly: a line
  // may carry a leading or trailing space when the user typed a run of them,
  // and the canvas centres it including that space -- which is precisely what
  // CSS does with white-space: pre-wrap, so the two agree.
  function wrap(text, st, size, maxWidth) {
    setStyle(st, size);
    if (!text) return [];
    const ops = breakOps(text);
    const breaks = [];
    let start = 0;
    let guard = 0;
    while (guard++ < 1000) {
      if (measureLine(text.slice(start), st, size) <= maxWidth) break;
      let chosen = -1;
      for (let k = 0; k < ops.length; k++) {
        const b = ops[k];
        if (b <= start) continue;
        if (measureLine(text.slice(start, b), st, size) <= maxWidth) chosen = b;
        else break;
      }
      if (chosen < 0) {
        // The first token is itself wider than the measure. Splitting inside
        // a word cannot be mirrored length-preservingly, so the overlay falls
        // back to the browser's own break-word for this block.
        let nextOp = -1;
        for (const b of ops) if (b > start) { nextOp = b; break; }
        const end = nextOp < 0 ? text.length : nextOp;
        setStyle(st, size);
        const pieces = breakLongWord(text.slice(start, end), maxWidth);
        const head = sliceLines(text, breaks).slice(0, -1);
        const rest = nextOp < 0 ? '' : text.slice(nextOp + 1);
        const tail = rest ? wrap(rest, st, size, maxWidth) : [];
        return [...head, ...pieces, ...tail];
      }
      breaks.push(chosen);
      start = chosen + 1;
    }
    return sliceLines(text, breaks);
  }

  /* ---------- editorial line breaking ---------- */

  // Greedy wrapping -- take as many words as fit -- is what strands widows.
  // This pass is GATED: it does nothing unless the greedy result has a real
  // fault, because an over-eager engine is worse than none. Wholesale
  // rebalancing was measured and rejected: minimising line-length variance
  // turned a clean descending rag (984/861/638) into a zigzag (720/954/810).
  const TYPESET = {
    // A one-word last line this far under the longest line is a widow.
    widowFrac: 0.45,
    // Any last line this far under the longest is an orphan sliver.
    shortFrac: 0.30,
    // A single-word line that is NOT the last one reads as stranded when it
    // is this far under the longest. 0.60 catches "American" (46% of its
    // longest), "Downtown" (57%) and "Determined" (59%) while sparing
    // "Transforming" (66%), a long word filling a fair share of the measure.
    isolatedFrac: 0.60,
    // "Dramatically uneven": no line may fall below this share of the longest.
    evenFloor: 0.45,
    // Enumeration ceiling; hitting it falls back to greedy untouched.
    maxCandidates: 4000,
    // Work ceiling, which is a different thing: maxCandidates counts
    // arrangements that SUCCEED, and on a headline too long to fit almost
    // none do -- the last line overruns the measure, so the path is dropped
    // without ever being counted. The walk is exponential in line count
    // (measured: 1.9M nodes at 9 lines, 11M at 10, 65M at 11, 383M at 12,
    // the last costing 65s for a single keystroke) so the result cap alone
    // never fires and typing freezes the page. Counting nodes bounds the
    // work itself. Every headline that actually gets typeset is far below
    // this: the heaviest real case measured is 133 nodes, so the ceiling is
    // ~150x the worst genuine need and changes no current output.
    maxNodes: 20000,
  };

  // Words that govern what follows, so a line should not end on one. This is
  // a real editorial convention, not a grammar model: it catches articles,
  // short prepositions, conjunctions and bare numerals, and cannot recognise
  // an arbitrary noun phrase.
  const PHRASE_WORDS = new Set([
    'a', 'an', 'the', 'of', 'to', 'in', 'at', 'on', 'for', 'and', 'or', 'but',
    'as', 'by', 'is', 'it', 'with', 'from', 'that', 'into', 'over', 'per',
  ]);
  function endsPhrase(word) {
    const w = String(word).toLowerCase().replace(/[^a-z0-9’']/g, '');
    return PHRASE_WORDS.has(w) || /^\d+$/.test(w);
  }

  // The fault that justifies rewrapping. A line ending on a function word is
  // a blemish ranked on below -- never a trigger, or good rags get destroyed.
  function lineFault(lines, widths) {
    if (lines.length < 2) return null;
    const longest = Math.max(...widths);
    const last = widths[widths.length - 1];
    if (!longest) return null;
    const oneWord = lines[lines.length - 1].trim().split(/\s+/).filter(Boolean).length === 1;
    if (oneWord && last < longest * TYPESET.widowFrac) return 'widow';
    if (last < longest * TYPESET.shortFrac) return 'short-last';
    if (isolatedCount(lines, widths)) return 'isolated';
    return null;
  }

  // Single-word lines stranded in the middle of the block. Looking only at
  // the last line let the widow fix trade one fault for another: clearing
  // "Today" produced an isolated "American" at 460px under a 990px line.
  function isolatedCount(lines, widths) {
    const longest = Math.max(...widths);
    if (!longest) return 0;
    let n = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      const n1 = lines[i].trim().split(/\s+/).filter(Boolean).length;
      if (n1 === 1 && widths[i] < longest * TYPESET.isolatedFrac) n++;
    }
    return n;
  }

  // Summed squared shortfall from the longest line: penalises a short line
  // anywhere, not only at the end.
  function raggedness(widths) {
    const longest = Math.max(...widths);
    return widths.reduce((s, w) => s + ((longest - w) / BOX_W) ** 2, 0);
  }

  // Every arrangement with the SAME line count whose lines all fit, pruned on
  // width. Breaks are indices into the raw string, so each candidate's lines
  // rejoin to exactly the user's characters. The line count is fixed, which
  // is what makes the chosen font size, the baselines and every gap
  // impossible to disturb.
  function breakCandidates(text, count, st, size) {
    const ops = breakOps(text);
    if (count - 1 > ops.length) return [];
    const res = [];
    const cache = new Map();
    const width = (a, b) => {
      const key = a + ':' + b;
      let v = cache.get(key);
      if (v === undefined) { v = measureLine(text.slice(a, b), st, size); cache.set(key, v); }
      return v;
    };
    let capped = false;
    let budget = TYPESET.maxNodes;
    const walk = (start, left, acc, from) => {
      if (capped) return;
      if (--budget < 0 || res.length >= TYPESET.maxCandidates) { capped = true; return; }
      if (left === 1) {
        if (start < text.length && width(start, text.length) <= BOX_W) res.push([...acc]);
        return;
      }
      for (let k = from; k < ops.length; k++) {
        const b = ops[k];
        if (b <= start) continue;
        if (width(start, b) > BOX_W) break;   // longer prefixes only get wider
        walk(b + 1, left - 1, [...acc, b], k + 1);
      }
    };
    walk(0, count, [], 0);
    if (capped) return null;
    return res
      .map((breaks) => {
        const lines = sliceLines(text, breaks);
        return { lines, widths: lines.map((l) => measureLine(l, st, size)) };
      })
      // A break either side of a whitespace run would leave a blank line.
      .filter((c) => c.lines.every((l) => l.trim().length));
  }

  function polishLines(text, lines, st, size) {
    if (!typeset || lines.length < 2) return lines;
    const widths = lines.map((t) => measureLine(t, st, size));
    if (!lineFault(lines, widths)) return lines;          // already fine

    const cands = breakCandidates(text, lines.length, st, size);
    if (!cands || !cands.length) return lines;            // hit the cap, or none

    const clean = cands.filter((c) => !lineFault(c.lines, c.widths));
    if (!clean.length) return lines;                      // no cure; leave it

    // Never trade a widow for dramatic unevenness.
    const evenness = (c) => Math.min(...c.widths) / Math.max(...c.widths);
    let pool = clean.filter((c) => evenness(c) >= TYPESET.evenFloor);
    if (!pool.length) pool = clean;

    // Isolated interior lines first, then phrase grouping, then rag.
    let best = null, bestKey = null;
    for (const c of pool) {
      const phrase = c.lines.slice(0, -1).filter((l) => endsPhrase(l.trim().split(/\s+/).pop())).length;
      const key = [isolatedCount(c.lines, c.widths), phrase, raggedness(c.widths)];
      const better = !bestKey
        || key[0] < bestKey[0]
        || (key[0] === bestKey[0] && key[1] < bestKey[1])
        || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2]);
      if (better) { best = c; bestKey = key; }
    }
    return best ? best.lines : lines;
  }

  // The lockup's drawn box. layout() positions the logo from it and the
  // bubble guard holds bubbles off it, so the arithmetic lives in one place
  // and the two cannot drift.
  function logoRect() {
    const h = Math.round(LOGO_WIDTH * (logoImg.height || 98) / (logoImg.width || 720));
    const y0 = H - LOGO_BOTTOM_MARGIN - h;
    return { x0: CENTRE_X - LOGO_WIDTH / 2, x1: CENTRE_X + LOGO_WIDTH / 2,
             y0, y1: y0 + h, h };
  }

  // Font metrics for the overlay's half-leading maths.
  function metrics(st, size) {
    setStyle(st, size);
    const m = ctx.measureText('Hg');
    return {
      ascent: m.actualBoundingBoxAscent || size * 0.75,
      descent: m.actualBoundingBoxDescent || size * 0.21,
      fontAscent: m.fontBoundingBoxAscent || size * 0.8,
      fontDescent: m.fontBoundingBoxDescent || size * 0.2,
    };
  }

  /* ---------- bubble guard rails ---------- */

  // Per-line ink rects for the three text blocks, from the same measurement
  // path that drew them. Horizontal extents are the line's own measured
  // width, so a short line really does leave room beside it. Vertical
  // extents come from the STYLE's ascent and descent rather than the line's
  // own ink, so the boundary does not jump 20px when a line happens to be
  // all lowercase -- what a bubble is held off has to stay still while the
  // copy is being typed.
  function textBoxes(l) {
    if (!l) return [];
    // setStyle writes letterSpacing/wordSpacing on the context, and render()
    // clears both before this runs. Save and restore them the way baseSpace()
    // does, or the next thing drawn inherits a measuring state.
    const hasLS = 'letterSpacing' in ctx, hasWS = 'wordSpacing' in ctx;
    const ls = hasLS ? ctx.letterSpacing : null;
    const ws = hasWS ? ctx.wordSpacing : null;
    const left = alignLeft();
    const out = [];
    const block = (name, lines, baselines, st, size) => {
      if (!baselines || !baselines.length) return;
      const m = metrics(st, size);
      // layout() reserves a baseline for an empty headline and for a shown
      // but empty eyebrow or dek, so baselines can outnumber lines.
      for (let i = 0; i < baselines.length; i++) {
        const text = (lines && lines[i]) || '';
        if (!text.trim()) continue;
        const w = measureLine(text, st, size);
        const x0 = left ? BOX_LEFT : CENTRE_X - w / 2;
        out.push({ block: name, x0, x1: x0 + w,
                   y0: baselines[i] - m.ascent, y1: baselines[i] + m.descent });
      }
    };
    block('eyebrow', l.eyeLines, l.eyeBaselines, EYEBROW, EYEBROW.size);
    block('headline', l.headLines, l.headBaselines, headStyle(), l.size);
    block('dek', l.dekLines, l.dekBaselines, DEK, DEK.size);
    if (hasLS) ctx.letterSpacing = ls;
    if (hasWS) ctx.wordSpacing = ws;
    return out;
  }

  // True minimum distance from the circle to the rect, so inflating the rect
  // by pad gives a rounded keep-out -- "the ring stays pad away from the
  // ink", not "the bubble's bounding box stays away from it".
  function circleClearsRect(cx, cy, r, rect, pad) {
    const dx = Math.max(rect.x0 - pad - cx, 0, cx - (rect.x1 + pad));
    const dy = Math.max(rect.y0 - pad - cy, 0, cy - (rect.y1 + pad));
    return dx * dx + dy * dy >= r * r;
  }

  function clampToSafe(cx, cy) {
    return { cx: clamp(cx, BUBBLE_EDGE + BUBBLE_R, W - BUBBLE_EDGE - BUBBLE_R),
             cy: clamp(cy, BUBBLE_EDGE + BUBBLE_R, H - BUBBLE_EDGE - BUBBLE_R) };
  }

  // The keep-out set for a drag: computed once at pointerdown, because text
  // cannot reflow mid-drag and a boundary that jitters is unusable.
  function keepOut(l) {
    return { logo: logoRect(), text: textBoxes(l || lastLayout) };
  }

  // Is this centre legal for bubble i? Edges are clamped separately; this is
  // the lockup, the type and the other bubble.
  function bubbleLegal(i, cx, cy, ko) {
    if (!circleClearsRect(cx, cy, BUBBLE_R, ko.logo, BUBBLE_CLEAR)) return false;
    for (const r of ko.text) {
      if (!circleClearsRect(cx, cy, BUBBLE_R, r, BUBBLE_CLEAR)) return false;
    }
    const other = bubbles[i === 0 ? 1 : 0];
    if (other && Math.hypot(cx - other.cx, cy - other.cy) < BUBBLE_D + BUBBLE_GAP) return false;
    return true;
  }

  // The smallest translation that takes the circle out of one inflated rect.
  // Four candidates -- off each face -- and the nearest wins, which is what
  // makes a dragged bubble hug the boundary it is pressed against instead of
  // jumping to a corner.
  function escapeRect(cx, cy, rect, pad) {
    const out = [
      { cx: rect.x0 - pad - BUBBLE_R, cy },
      { cx: rect.x1 + pad + BUBBLE_R, cy },
      { cx, cy: rect.y0 - pad - BUBBLE_R },
      { cx, cy: rect.y1 + pad + BUBBLE_R },
    ];
    out.sort((a, b) => Math.hypot(a.cx - cx, a.cy - cy) - Math.hypot(b.cx - cx, b.cy - cy));
    return out;
  }

  function firstBlocker(i, cx, cy, ko) {
    if (!circleClearsRect(cx, cy, BUBBLE_R, ko.logo, BUBBLE_CLEAR)) return ko.logo;
    for (const r of ko.text) {
      if (!circleClearsRect(cx, cy, BUBBLE_R, r, BUBBLE_CLEAR)) return r;
    }
    return null;
  }

  // Move bubble i as close to (cx, cy) as the guards allow: push the circle
  // straight back out of whatever it is touching, by the shortest distance,
  // and repeat for anything that pushes it into something else. Falls back to
  // one axis at a time, then to not moving at all.
  function placeBubble(i, cx, cy, ko) {
    const b = bubbles[i];
    if (!b) return false;
    const keep = ko || keepOut();
    const commit = (p) => {
      const moved = p.cx !== b.cx || p.cy !== b.cy;
      b.cx = p.cx; b.cy = p.cy;
      return moved;
    };

    let p = clampToSafe(cx, cy);
    for (let iter = 0; iter < 6 && !bubbleLegal(i, p.cx, p.cy, keep); iter++) {
      const other = bubbles[i === 0 ? 1 : 0];
      const blocker = firstBlocker(i, p.cx, p.cy, keep);
      if (blocker) {
        let next = null;
        for (const cand of escapeRect(p.cx, p.cy, blocker, BUBBLE_CLEAR)) {
          const c = clampToSafe(cand.cx, cand.cy);
          // The clamp can undo the escape at the card's edge; only take a
          // candidate the clamp actually leaves clear of this blocker.
          if (circleClearsRect(c.cx, c.cy, BUBBLE_R, blocker, BUBBLE_CLEAR)) { next = c; break; }
        }
        if (!next) break;
        p = next;
      } else if (other) {
        // Pushed apart along the line between the two centres.
        const dx = p.cx - other.cx, dy = p.cy - other.cy;
        const d = Math.hypot(dx, dy) || 1;
        const need = BUBBLE_D + BUBBLE_GAP;
        p = clampToSafe(other.cx + dx / d * need, other.cy + dy / d * need);
      } else break;
    }
    if (bubbleLegal(i, p.cx, p.cy, keep)) return commit(p);

    // Cornered: try holding one axis, so a drag along a boundary still runs.
    for (const q of [clampToSafe(cx, b.cy), clampToSafe(b.cx, cy)]) {
      if (bubbleLegal(i, q.cx, q.cy, keep)) return commit(q);
    }
    return false;   // keep the last valid position
  }

  // The legal centre nearest to (cx, cy), searched outward in rings. Used for
  // the first placement and to rescue a bubble the text has grown into.
  function nearestClear(i, cx, cy, ko) {
    const keep = ko || keepOut();
    const start = clampToSafe(cx, cy);
    if (bubbleLegal(i, start.cx, start.cy, keep)) return start;
    for (let rad = 8; rad <= 1300; rad += 8) {
      // Up first, then down, then sideways: vertical room is what a card
      // with a bottom-anchored text block actually has.
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0],
                              [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
        const p = clampToSafe(cx + dx * rad, cy + dy * rad);
        if (bubbleLegal(i, p.cx, p.cy, keep)) return p;
      }
    }
    return null;
  }

  // Where a newly added bubble lands. Hug the safe margin horizontally the
  // way the reference does -- its two bubbles sit at the left and right
  // extremes -- then take the lowest clear centre, because the reference's
  // composition is low on the card. With the copy hidden this lands on the
  // reference position itself; with a full headline it lands above the type.
  function defaultCentre(i, ko) {
    const keep = ko || keepOut();
    const near = BUBBLE_EDGE + BUBBLE_R;
    const far = W - BUBBLE_EDGE - BUBBLE_R;
    const xs = i === 0 ? [near, far, CENTRE_X] : [far, near, CENTRE_X];
    for (const cx of xs) {
      for (let cy = H - BUBBLE_EDGE - BUBBLE_R; cy >= near; cy -= 4) {
        if (bubbleLegal(i, cx, cy, keep)) return { cx, cy };
      }
    }
    return nearestClear(i, xs[0], near, keep) || { cx: xs[0], cy: near };
  }

  /* ---------- layout ---------- */

  // Builds the bottom-anchored stack and reports where its top edge lands.
  function layout(size, polish) {
    // Raw, so the canvas draws the characters the editable holds. Uppercasing
    // is length-preserving for Latin, and the eyebrow's overlay carries the
    // matching text-transform, so its offsets stay one-to-one too.
    const eyebrowText = shown.eyebrow ? blockText(EDIT.eyebrow).toUpperCase() : '';
    const headlineText = blockText(EDIT.headline);
    const dekText = shown.dek ? blockText(EDIT.dek) : '';

    const hs = headStyle();
    // The sweep wraps greedily; only the winning size is polished, so the
    // engine runs once per render rather than at all 26 candidate sizes.
    const P = (txt, lines, st, sz) => (polish ? polishLines(txt, lines, st, sz) : lines);
    const headLines = P(headlineText, wrap(headlineText, hs, size, BOX_W), hs, size);
    const dekLines = dekText.trim()
      ? P(dekText, wrap(dekText, DEK, DEK.size, BOX_W), DEK, DEK.size) : [];
    const eyeLines = eyebrowText.trim()
      ? P(eyebrowText, wrap(eyebrowText, EYEBROW, EYEBROW.size, BOX_W), EYEBROW, EYEBROW.size) : [];

    const { h: logoH, y0: logoTop } = logoRect();

    // Walk upward from the logo.
    let dekBaselines = [];
    let cursor;
    if (dekLines.length || (shown.dek && !dekText.trim())) {
      const n = Math.max(1, dekLines.length);
      const lastDekBaseline = logoTop - GAP_DEK_LOGO;
      for (let i = n - 1; i >= 0; i--) {
        dekBaselines[i] = lastDekBaseline - (n - 1 - i) * DEK.size * DEK.leading;
      }
      cursor = dekBaselines[0] - hs.gapDek;
    } else {
      cursor = logoTop - GAP_DEK_LOGO;
    }

    // An empty headline still reserves one line, so there is always somewhere
    // to click to start typing.
    const headBaselines = [];
    const headCount = Math.max(1, headLines.length);
    for (let i = headCount - 1; i >= 0; i--) {
      headBaselines[i] = cursor - (headCount - 1 - i) * size * hs.leading;
    }

    const eyeBaselines = [];
    if (eyeLines.length || (shown.eyebrow && !eyebrowText.trim())) {
      const n = Math.max(1, eyeLines.length);
      const lastEye = (headBaselines[0] ?? cursor) - hs.gapEye;
      for (let i = n - 1; i >= 0; i--) {
        eyeBaselines[i] = lastEye - (n - 1 - i) * EYEBROW.size * EYEBROW.leading;
      }
    }

    // Top edge = ink top of the topmost line (ascender, not baseline).
    const topBaseline = eyeBaselines.length ? eyeBaselines[0] : headBaselines[0];
    const topIsEyebrow = eyeBaselines.length > 0;
    const topSize = topIsEyebrow ? EYEBROW.size : size;
    setStyle(topIsEyebrow ? EYEBROW : hs, topSize);
    const probe = ctx.measureText(eyeBaselines.length ? (eyeLines[0] || 'H') : (headLines[0] || 'H'));
    const ascent = probe.actualBoundingBoxAscent || topSize * 0.75;
    const rawTop = (topBaseline ?? H) - ascent;

    // Bottom ink of the group, for its height. The last line is the dek's if
    // there is one, otherwise the headline's.
    const lastIsDek = dekBaselines.length > 0;
    const lastBaseline = lastIsDek ? dekBaselines[dekBaselines.length - 1]
                                   : headBaselines[headBaselines.length - 1];
    const lastSt = lastIsDek ? DEK : hs;
    const lastSize = lastIsDek ? DEK.size : size;
    setStyle(lastSt, lastSize);
    const lastProbe = ctx.measureText(
      (lastIsDek ? dekLines[dekLines.length - 1] : headLines[headLines.length - 1]) || 'Hg');
    const descent = lastProbe.actualBoundingBoxDescent || lastSize * 0.21;
    const bottomInk = (lastBaseline ?? H) + descent;

    // The whole group moves as one; every internal gap is already baked into
    // the baselines above and is untouched by the shift. The text area runs
    // from the top safe margin down to wherever the group's ink bottoms out
    // in the original composition -- i.e. the logo's existing clearance --
    // so centring can never push text into the logo.
    //   top:    ink top lands on the safe margin
    //   centre: half of that, since both share the same bottom edge
    let shiftY = 0;
    if (align.v === 'top') shiftY = SAFE_TOP - rawTop;
    else if (align.v === 'center') shiftY = (SAFE_TOP - rawTop) / 2;

    if (shiftY) {
      for (let i = 0; i < eyeBaselines.length; i++) eyeBaselines[i] += shiftY;
      for (let i = 0; i < headBaselines.length; i++) headBaselines[i] += shiftY;
      for (let i = 0; i < dekBaselines.length; i++) dekBaselines[i] += shiftY;
    }

    return { size, headLines, dekLines, eyeLines, headBaselines, dekBaselines, eyeBaselines,
             logoTop, logoH,
             top: rawTop + shiftY,
             // Pre-shift, so the fit test is about the group's HEIGHT rather
             // than where it was moved to.
             rawTop, bottomInk: bottomInk + shiftY, groupH: bottomInk - rawTop, shiftY };
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
    const hs = headStyle();
    // A style pinned to one size is never resized: copy that will not fit
    // above the centre warns instead, which is the whole point of pinning it.
    const limit = placeLimit();
    // Polishing keeps the line count, so it cannot move the chosen size; the
    // winner is re-laid once with it on. If the polished block somehow stops
    // fitting, keep the greedy one rather than ship something clipped.
    const settle = (size, greedyLayout) => {
      if (!typeset) return greedyLayout;
      const p = layout(size, true);
      if (p.headLines.length !== greedyLayout.headLines.length) return greedyLayout;
      if (p.dekLines.length !== greedyLayout.dekLines.length) return greedyLayout;
      if (p.eyeLines.length !== greedyLayout.eyeLines.length) return greedyLayout;
      if (greedyLayout.rawTop >= limit && p.rawTop < limit) return greedyLayout;
      return p;
    };
    if (hs.fixed) {
      const atFixed = settle(hs.fixed, layout(hs.fixed));
      // A fixed style holds its design size unless the composition at that
      // size is genuinely unsalvageable. At 100px "Transforming American"
      // measures 1130px against a 1000px measure, so some headlines have no
      // fault-free arrangement there at all; those step down, nothing else
      // does. Overflow is deliberately NOT a trigger: copy too long for the
      // area still warns at the design size rather than being shrunk.
      const faultAt = (l) => {
        const w = l.headLines.map((t) => measureLine(t, hs, l.size));
        return lineFault(l.headLines, w);
      };
      if (typeset && hs.min && faultAt(atFixed)) {
        for (let size = hs.fixed - 1; size >= hs.min; size--) {
          const cand = settle(size, layout(size));
          if (!faultAt(cand) && cand.rawTop >= limit) {
            return { ...cand, overflow: false, steppedDown: true };
          }
        }
      }
      return { ...atFixed, overflow: atFixed.rawTop < limit };
    }
    for (let size = hs.max; size >= hs.min; size--) {
      const g = layout(size);
      if (g.headLines.length <= 3 && g.rawTop >= limit) {
        return { ...settle(size, g), overflow: false };
      }
    }
    const floorG = layout(hs.min);
    const floor = settle(hs.min, floorG);
    return { ...floor, overflow: floor.rawTop < limit };
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
    const base = pickedColour || dominantColour();
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

  function drawLines(lines, baselines, st, size) {
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    const left = alignLeft();
    lines.forEach((line, i) => drawLine(line, baselines[i], st, size, left));
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

    if (shown.gradient) drawGradient();
    syncColour();

    // Above the background and the gradient, below all type and the lockup.
    // Drawn before the font gate so a bubble never waits on a font load, and
    // under the text so that the one degenerate case -- copy so long that no
    // legal bubble position is left -- keeps the headline readable instead of
    // running a white ring through it. With both slots empty this is two null
    // checks: no pixel and no canvas state is touched.
    drawBubbles();

    if (!fontsReady) return;
    const l = chooseLayout();
    lastLayout = l;
    // Text wins. If the copy has grown into a bubble, slide the bubble to the
    // nearest legal centre and say so. The bubbles for this frame are already
    // painted, so a rescue repaints from scratch; the flag stops that
    // recursing, and it only ever happens on the frame a collision appears.
    if (!rescuing && rescueBubbles(l)) {
      rescuing = true;
      render();
      rescuing = false;
      return;
    }
    const hs = headStyle();
    drawLines(l.eyeLines, l.eyeBaselines, EYEBROW, EYEBROW.size);
    drawLines(l.headLines, l.headBaselines, hs, l.size);
    drawLines(l.dekLines, l.dekBaselines, DEK, DEK.size);
    // Leave no spacing set on the context for whatever draws next.
    if (CAP.letterSpacing) ctx.letterSpacing = '0px';
    if ('wordSpacing' in ctx) ctx.wordSpacing = '0px';

    if (logoImg.complete && logoImg.naturalWidth) {
      ctx.drawImage(logoImg, CENTRE_X - LOGO_WIDTH / 2, l.logoTop, LOGO_WIDTH, l.logoH);
    }

    drawDragHighlight();
    syncEditables(l);
    syncBubbleLayer();
    // The marks are positioned from the overlay's own glyph rects, so they
    // have to be redrawn whenever the type is relaid.
    if (window.proofreadUI) window.proofreadUI.repaintAll();
    reportSize(l);
  }

  // Text wins on reflow: any bubble the copy has grown into slides the
  // shortest distance to a legal centre. Returns true when something moved,
  // which means the frame has to be painted again.
  function rescueBubbles(l) {
    // Nothing to rescue, and nothing to measure: with no bubbles this costs
    // one array check per render rather than a full pass over every line.
    if (!bubbles[0] && !bubbles[1]) return false;
    const ko = keepOut(l);
    const notes = [];
    let moved = false;
    bubbles.forEach((b, i) => {
      if (!b) return;
      if (bubbleLegal(i, b.cx, b.cy, ko)) return;
      const p = nearestClear(i, b.cx, b.cy, ko);
      if (p) {
        b.cx = p.cx; b.cy = p.cy;
        moved = true;
        notes.push(`Bubble ${i + 1} moved clear of the text.`);
      } else {
        notes.push(`Bubble ${i + 1} has nowhere clear to go — shorten the copy or remove it.`);
      }
    });
    bubbleNote.textContent = notes.join(' ');
    return moved;
  }

  /* ---------- bubble chrome (SVG, never exported) ---------- */

  // One hit circle per live bubble, plus dashed keep-out outlines while a
  // drag is in progress. Everything here is DOM, so it cannot reach
  // toDataURL: the export needs no flag and the download handler needs no
  // change at all.
  // The guides are inert, so they are rebuilt freely. The hit circles are
  // NOT: a circle is created once per bubble and then only has its
  // attributes updated. Replacing it on every render would drop keyboard
  // focus between two arrow presses and tear up the pointer capture holding
  // a drag together -- both of which it did, until this was split.
  const guideGroup = document.createElementNS(SVGNS, 'g');
  const hitNodes = [null, null];

  function makeHit(i) {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('r', String(BUBBLE_R));
    c.setAttribute('tabindex', '0');
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label',
      `Bubble ${i + 1}. Drag to move, press Enter to adjust the photo inside, Delete to remove.`);
    c.addEventListener('pointerdown', (e) => onBubbleDown(i, e));
    c.addEventListener('pointermove', onBubbleMove);
    c.addEventListener('pointerup', onBubbleUp);
    c.addEventListener('pointercancel', onBubbleUp);
    c.addEventListener('dblclick', (e) => { e.preventDefault(); setAdjust(true); render(); });
    c.addEventListener('wheel', (e) => onBubbleWheel(i, e), { passive: false });
    c.addEventListener('keydown', (e) => onBubbleKey(i, e));
    c.addEventListener('dragover', (e) => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      c.classList.add('is-sel');
    });
    c.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadBubbleFile(i, f);
    });
    return c;
  }

  function guideRect(r, cls) {
    const g = document.createElementNS(SVGNS, 'rect');
    g.setAttribute('class', cls);
    g.setAttribute('x', String(r.x0));
    g.setAttribute('y', String(r.y0));
    g.setAttribute('width', String(r.x1 - r.x0));
    g.setAttribute('height', String(r.y1 - r.y0));
    g.setAttribute('rx', String(BUBBLE_CLEAR));
    return g;
  }

  function syncBubbleLayer() {
    if (guideGroup.parentNode !== bubbleLayer) bubbleLayer.appendChild(guideGroup);
    guideGroup.textContent = '';
    if (bubbleDrag) {
      for (const r of bubbleDrag.keepout.text.concat([bubbleDrag.keepout.logo])) {
        guideGroup.appendChild(guideRect({
          x0: r.x0 - BUBBLE_CLEAR, y0: r.y0 - BUBBLE_CLEAR,
          x1: r.x1 + BUBBLE_CLEAR, y1: r.y1 + BUBBLE_CLEAR,
        }, 'bubble-guide'));
      }
      guideGroup.appendChild(guideRect({
        x0: BUBBLE_EDGE, y0: BUBBLE_EDGE, x1: W - BUBBLE_EDGE, y1: H - BUBBLE_EDGE,
      }, 'bubble-guide is-edge'));
    }
    bubbles.forEach((b, i) => {
      if (!b) {
        if (hitNodes[i]) { hitNodes[i].remove(); hitNodes[i] = null; }
        return;
      }
      if (!hitNodes[i]) { hitNodes[i] = makeHit(i); bubbleLayer.appendChild(hitNodes[i]); }
      const c = hitNodes[i];
      let cls = 'bubble-hit';
      if (selected === i) cls += adjusting ? ' is-adj' : ' is-sel';
      if (bubbleDrag && bubbleDrag.i === i && bubbleDrag.blocked) cls += ' is-blocked';
      if (c.getAttribute('class') !== cls) c.setAttribute('class', cls);
      if (c.getAttribute('cx') !== String(b.cx)) c.setAttribute('cx', String(b.cx));
      if (c.getAttribute('cy') !== String(b.cy)) c.setAttribute('cy', String(b.cy));
    });
  }

  function select(i) {
    if (selected !== i) { selected = i; adjusting = false; }
    syncBubbleControls();
  }

  function setAdjust(on) {
    adjusting = !!on && selected >= 0 && !!bubbles[selected];
    syncBubbleLayer();
    syncBubbleControls();
  }

  function onBubbleDown(i, e) {
    if (picking) return;
    const b = bubbles[i];
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const wasSelected = selected === i;
    select(i);
    const p = clientToCanvas(e.clientX, e.clientY);
    bubbleDrag = {
      i, x0: p.x, y0: p.y, cx0: b.cx, cy0: b.cy,
      panX0: b.panX, panY0: b.panY, moved: false, blocked: false,
      wasSelected,
      pan: adjusting || e.shiftKey,
      keepout: keepOut(lastLayout),
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    render();
  }

  function onBubbleMove(e) {
    if (!bubbleDrag) return;
    const b = bubbles[bubbleDrag.i];
    if (!b) return;
    const p = clientToCanvas(e.clientX, e.clientY);
    const dx = p.x - bubbleDrag.x0;
    const dy = p.y - bubbleDrag.y0;
    if (!bubbleDrag.moved && Math.hypot(dx, dy) < 3) return;
    bubbleDrag.moved = true;
    if (bubbleDrag.pan) {
      panBy(b, bubbleBox(b), dx, dy, bubbleDrag.panX0, bubbleDrag.panY0);
    } else {
      const want = { cx: bubbleDrag.cx0 + dx, cy: bubbleDrag.cy0 + dy };
      placeBubble(bubbleDrag.i, want.cx, want.cy, bubbleDrag.keepout);
      bubbleDrag.blocked = Math.abs(b.cx - want.cx) > 0.5 || Math.abs(b.cy - want.cy) > 0.5;
    }
    render();
  }

  function onBubbleUp(e) {
    if (!bubbleDrag) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    const d = bubbleDrag;
    bubbleDrag = null;
    // A click rather than a drag: the second click on an already selected
    // bubble enters adjust mode, which is what makes this work on touch
    // where dblclick is unreliable.
    if (!d.moved && d.wasSelected) adjusting = !adjusting;
    render();
  }

  function onBubbleWheel(i, e) {
    // Only trapped in adjust mode: at 420px the page genuinely needs to
    // scroll, and swallowing the wheel over a 150px target would be hostile.
    if (!adjusting || selected !== i || !bubbles[i]) return;
    e.preventDefault();
    setBubbleZoom(i, bubbles[i].scaleMultiplier * (e.deltaY < 0 ? 1.06 : 1 / 1.06));
  }

  function onBubbleKey(i, e) {
    const b = bubbles[i];
    if (!b) return;
    const step = e.shiftKey ? 10 : 1;
    const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (nudge) {
      e.preventDefault();
      select(i);
      if (adjusting) {
        panBy(b, bubbleBox(b), nudge[0] * step, nudge[1] * step, b.panX, b.panY);
      } else {
        placeBubble(i, b.cx + nudge[0] * step, b.cy + nudge[1] * step);
      }
      render();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); select(i); setAdjust(!adjusting); render(); return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); removeBubble(i); return;
    }
    if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault();
      setBubbleZoom(i, b.scaleMultiplier + (e.key === '-' ? -0.05 : 0.05));
    }
  }

  // Keeps the overlay's pixel grid locked to the canvas's displayed size.
  function syncScale() {
    const shownW = canvas.clientWidth || W;
    stage.style.setProperty('--card-scale', String(shownW / W));
  }

  function syncEditables(l) {
    syncScale();
    const hs = headStyle();
    placeEditable(EDIT.eyebrow, l.eyeLines, l.eyeBaselines, EYEBROW, EYEBROW.size, shown.eyebrow);
    placeEditable(EDIT.headline, l.headLines, l.headBaselines, hs, l.size, true);
    placeEditable(EDIT.dek, l.dekLines, l.dekBaselines, DEK, DEK.size, shown.dek);
  }

  function reportSize(l) {
    if (l.overflow) {
      sizeNote.className = 'size-note is-warning';
      const hs = headStyle();
      const where = align.v === 'original' ? 'above the centre line' : 'inside the text area';
      sizeNote.textContent = hs.fixed
        ? `Copy is too long — it will not fit ${where} at ${hs.label}'s ${hs.fixed}px, which is a fixed size. Shorten the headline or dek, or switch font.`
        : `Copy is too long — it will not fit ${where} even at ${hs.min}px. Shorten the headline or dek.`;
    } else {
      /* Nothing to say when the copy fits: the note collapses to zero height
         (.size-note:empty) so it never costs a line of the page. */
      sizeNote.className = 'size-note';
      sizeNote.textContent = '';
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

  /* ---------- dropper ---------- */

  // The visible canvas is photo + gradient + text composited, so sampling it
  // in the lower half would read a colour the gradient has already tinted and
  // every further pick would drift greyer. Sample a layer holding the photo
  // alone, drawn through the same transform the card uses.
  function buildPhotoLayer() {
    photoLayer = null;
    if (!photo || !photo.img) return;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    try { drawPanelImage(photo, getPanelRect(), g); }
    catch (e) { return; }
    photoLayer = { canvas: c, ctx: g };
  }

  // Averages a 5x5 box, the way a real dropper's "sample size" does: a single
  // raw pixel on a JPEG picks up compression noise.
  function sampleAt(x, y) {
    if (!photoLayer) return null;
    const half = 2;
    const left = clamp(Math.round(x) - half, 0, W - 1);
    const top = clamp(Math.round(y) - half, 0, H - 1);
    const w = Math.min(half * 2 + 1, W - left);
    const h = Math.min(half * 2 + 1, H - top);
    let d;
    try { d = photoLayer.ctx.getImageData(left, top, w, h).data; }
    catch (e) { return null; }
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
  }

  function hex(rgb) {
    return '#' + rgb.map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('');
  }

  function setPicking(on) {
    picking = on && !!(photo && photo.img);
    if (picking) buildPhotoLayer();
    stage.classList.toggle('is-picking', picking);
    dropperBtn.setAttribute('aria-pressed', String(picking));
    if (picking) {
      // Leave no caret sitting in the text while the pointer means "pick".
      Object.values(EDIT).forEach((el) => { if (document.activeElement === el) el.blur(); });
    } else {
      hideLoupe();
      photoLayer = null;
    }
  }

  function hideLoupe() { loupe.hidden = true; }

  function showLoupe(clientX, clientY, x, y) {
    const rgb = sampleAt(x, y);
    if (!rgb) { hideLoupe(); return; }
    const SRC = 15, Z = 6;                       // 15x15 source pixels at 6x
    const size = loupeCanvas.width;              // 90 = 15 * 6
    loupeCtx.imageSmoothingEnabled = false;
    loupeCtx.clearRect(0, 0, size, size);
    loupeCtx.fillStyle = '#ffffff';
    loupeCtx.fillRect(0, 0, size, size);
    loupeCtx.drawImage(photoLayer.canvas,
      Math.round(x) - (SRC - 1) / 2, Math.round(y) - (SRC - 1) / 2, SRC, SRC, 0, 0, size, size);
    // The cell actually under the crosshair.
    const c = ((SRC - 1) / 2) * Z;
    loupeCtx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    loupeCtx.lineWidth = 2;
    loupeCtx.strokeRect(c - 1, c - 1, Z + 2, Z + 2);
    loupeCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    loupeCtx.lineWidth = 1;
    loupeCtx.strokeRect(c - 0.5, c - 0.5, Z + 1, Z + 1);

    loupeHex.textContent = hex(rgb);
    loupe.hidden = false;

    // Position in stage-relative CSS pixels, clamped inside the stage, which
    // is overflow:hidden.
    const sr = stage.getBoundingClientRect();
    const lw = loupe.offsetWidth || 100, lh = loupe.offsetHeight || 120;
    const lx = clamp(clientX - sr.left - lw / 2, 2, Math.max(2, sr.width - lw - 2));
    const ly = clamp(clientY - sr.top - lh - 14, 2, Math.max(2, sr.height - lh - 2));
    loupe.style.left = `${lx}px`;
    loupe.style.top = `${ly}px`;
  }

  function commitPick(x, y) {
    const rgb = sampleAt(x, y);
    if (!rgb) return;
    pickedColour = rgb;
    setPicking(false);
    syncColour();
    render();
  }

  // The dot shows the colour that actually lands on the card -- the source
  // pulled toward the neutral by Strength -- so it tracks the Strength slider.
  function syncColour() {
    const resulting = gradientColour();
    colourDot.style.background = hex(resulting);
    colourText.textContent = pickedColour ? hex(pickedColour) : 'Auto';
    colourChip.title = pickedColour
      ? `Picked ${hex(pickedColour)} — renders as ${hex(resulting)} at this strength`
      : `Derived from the image — renders as ${hex(resulting)} at this strength`;
    colourReset.hidden = !pickedColour;
  }

  function syncDropperEnabled() {
    const has = !!(photo && photo.img);
    const usable = has && shown.gradient;
    dropperBtn.disabled = !usable;
    dropperBtn.title = !shown.gradient
      ? 'Turn the gradient on to pick a colour for it'
      : has ? 'Pick a colour from the image'
            : 'Upload an image to pick a colour from it';
    if (!usable && picking) setPicking(false);
  }

  dropperBtn.addEventListener('click', () => setPicking(!picking));

  colourReset.addEventListener('click', () => {
    pickedColour = null;
    syncColour();
    render();
    dropperBtn.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // In order: cancel the dropper, then leave adjust mode, then deselect.
    if (picking) { e.preventDefault(); setPicking(false); return; }
    if (adjusting) { e.preventDefault(); setAdjust(false); render(); return; }
    if (selected >= 0) { e.preventDefault(); select(-1); render(); }
  });

  // A click anywhere that is not a bubble or its controls drops the
  // selection, so the chrome does not linger over a finished card.
  document.addEventListener('pointerdown', (e) => {
    if (selected < 0 || bubbleDrag) return;
    if (e.target.closest && (e.target.closest('.bubble-hit') || e.target.closest('.bubble-group'))) return;
    select(-1);
    render();
  });

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

  // Decoding is shared; what happens afterwards is not. The background's
  // own reset (a picked colour means nothing in a new image) must not fire
  // when a bubble is loaded.
  function decodeImage(file) {
    return new Promise((res, rej) => {
      if (!file || !file.type || !file.type.startsWith('image/')) { rej(); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(); };
      img.src = url;
    });
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      photo = { img, scaleMultiplier: 1, panX: 0, panY: 0 };
      URL.revokeObjectURL(url);
      // A colour picked out of the previous image means nothing in this one.
      pickedColour = null;
      setPicking(false);
      buildUploadSlot();
      syncDropperEnabled();
      render();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  /* ---------- bubble images and controls ---------- */

  function thumbOf(img) {
    const c = document.createElement('canvas');
    c.width = 60; c.height = 60;
    const g = c.getContext('2d');
    const s = Math.max(60 / img.width, 60 / img.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 30 - img.width * s / 2, 30 - img.height * s / 2,
                img.width * s, img.height * s);
    return c.toDataURL('image/jpeg', 0.8);
  }

  function setBubbleImage(i, img) {
    const prev = bubbles[i];
    // Replacing keeps the position -- it is the composition the user chose --
    // but resets zoom and pan, because a pan computed for another image at
    // another aspect ratio means nothing in this one.
    const centre = prev ? { cx: prev.cx, cy: prev.cy } : null;
    bubbles[i] = { img, scaleMultiplier: 1, panX: 0, panY: 0, thumb: thumbOf(img),
                   cx: 0, cy: 0 };
    const place = centre || defaultCentre(i, keepOut(lastLayout));
    bubbles[i].cx = place.cx;
    bubbles[i].cy = place.cy;
    select(i);
    adjusting = false;
    buildBubbleControls();
    render();
  }

  function loadBubbleFile(i, file) {
    return decodeImage(file).then((img) => setBubbleImage(i, img), () => {});
  }

  function removeBubble(i) {
    if (!bubbles[i]) return;
    bubbles[i] = null;
    if (selected === i) { selected = -1; adjusting = false; }
    bubbleNote.textContent = '';
    buildBubbleControls();
    render();
  }

  function setBubbleZoom(i, z) {
    const b = bubbles[i];
    if (!b) return;
    b.scaleMultiplier = clamp(z, 1, MAX_ZOOM);
    syncBubbleControls();
    render();
  }

  function buildBubbleControls() {
    bubbleRow.textContent = '';
    bubbles.forEach((b, i) => {
      const slot = document.createElement('span');
      slot.className = 'bubble-slot';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bubble-btn' + (b ? ' has-image' : '');
      btn.id = `bubbleBtn${i}`;
      btn.title = b ? `Replace the photo in bubble ${i + 1}` : `Add bubble ${i + 1}`;
      btn.setAttribute('aria-label', btn.title);
      if (b) btn.style.backgroundImage = `url(${b.thumb})`;
      else btn.textContent = '+';

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.className = 'file-input';
      input.id = `file-b${i}`;
      input.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) loadBubbleFile(i, f);
        e.target.value = '';
      });
      btn.addEventListener('click', () => input.click());
      btn.addEventListener('dragover', (e) => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
        btn.classList.add('drag-over');
      });
      btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
      btn.addEventListener('drop', (e) => {
        e.preventDefault(); btn.classList.remove('drag-over');
        loadBubbleFile(i, e.dataTransfer.files && e.dataTransfer.files[0]);
      });

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'bubble-remove';
      rm.id = `bubbleRemove${i}`;
      rm.textContent = '×';
      rm.title = `Remove bubble ${i + 1}`;
      rm.setAttribute('aria-label', rm.title);
      rm.hidden = !b;
      rm.addEventListener('click', () => removeBubble(i));

      slot.appendChild(btn); slot.appendChild(input); slot.appendChild(rm);
      bubbleRow.appendChild(slot);
    });

    const zoomWrap = document.createElement('span');
    zoomWrap.className = 'bubble-zoom';
    const zl = document.createElement('label');
    zl.textContent = 'Zoom';
    zl.htmlFor = 'bubbleZoom';
    const zoom = document.createElement('input');
    zoom.type = 'range'; zoom.id = 'bubbleZoom';
    zoom.min = '1'; zoom.max = String(MAX_ZOOM); zoom.step = '0.01';
    zoom.addEventListener('input', (e) => {
      if (selected >= 0) setBubbleZoom(selected, parseFloat(e.target.value));
    });
    zoomWrap.appendChild(zl); zoomWrap.appendChild(zoom);
    bubbleRow.appendChild(zoomWrap);
    syncBubbleControls();
  }

  // The one slider follows the selection, so two bubbles keep independent
  // zoom without a second slider wrapping the control bar to a third row.
  function syncBubbleControls() {
    const zoom = document.getElementById('bubbleZoom');
    if (!zoom) return;
    const b = selected >= 0 ? bubbles[selected] : null;
    zoom.disabled = !b;
    zoom.value = String(b ? b.scaleMultiplier : 1);
    zoom.title = b ? `Zoom bubble ${selected + 1}` : 'Select a bubble to zoom its photo';
    bubbles.forEach((x, i) => {
      const btn = document.getElementById(`bubbleBtn${i}`);
      if (btn) btn.classList.toggle('is-sel', selected === i && !!x);
    });
  }

  /* ---------- controls ---------- */

  fontSelect.addEventListener('change', () => {
    headKey = fontSelect.value in HEAD_STYLES ? fontSelect.value : 'sans';
    if (headPristine && DEFAULT_HEAD[headKey]) EDIT.headline.textContent = DEFAULT_HEAD[headKey];
    render();
  });

  // Two independent settings, combinable; 'original' in both reproduces the
  // existing design exactly.
  function wireSegmented(group, axis) {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-v]');
      if (!btn || btn.dataset.v === align[axis]) return;
      align[axis] = btn.dataset.v;
      [...group.querySelectorAll('button')].forEach((b) => {
        const on = b.dataset.v === align[axis];
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      render();
    });
    [...group.querySelectorAll('button')].forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.v === align[axis])));
  }
  typesetToggle.addEventListener('change', () => { typeset = typesetToggle.checked; render(); });

  wireSegmented(alignXGroup, 'h');
  wireSegmented(alignYGroup, 'v');

  gradToggle.addEventListener('change', () => {
    shown.gradient = gradToggle.checked;
    syncGradientEnabled();
    render();
  });

  // The gradient's three controls mean nothing while it is off, and the picked
  // colour is kept so switching back restores exactly what was there.
  function syncGradientEnabled() {
    const on = shown.gradient;
    strengthRange.disabled = !on;
    heightRange.disabled = !on;
    colourReset.disabled = !on;
    stage.classList.toggle('no-gradient', !on);
    document.querySelector('.grad-group').classList.toggle('is-off', !on);
    if (!on && picking) setPicking(false);
    syncDropperEnabled();
  }

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
  // Once the headline has been typed into, it is the user's copy.
  EDIT.headline.addEventListener('input', () => { headPristine = false; });

  Object.values(EDIT).forEach((el) => {
    el.addEventListener('input', render);
    el.addEventListener('focus', () => stage.classList.add('is-editing'));
    el.addEventListener('blur', () => {
      stage.classList.remove('is-editing');
      // Commit: while focused the canvas shows exactly what was typed, so the
      // caret can track it. Tidy the stray whitespace once, on the way out.
      const tidy = smartText(readEditable(el));
      if (blockText(el).trim() !== '' && el.textContent.replace(/\n/g, ' ') !== tidy) {
        el.textContent = tidy;
      }
      stage.classList.remove('is-editing');
      render();
    });
    // Keep it plain text: no pasted markup, no newlines (wrapping is automatic).
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      // Pasted copy is never assumed to be correctly typeset.
      const t = smartText((e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '));
      document.execCommand('insertText', false, t);
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  });

  function clientToCanvas(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) * (canvas.width / r.width), y: (cy - r.top) * (canvas.height / r.height) };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (picking) {
      // One path for mouse and touch: a desktop click is a down and up in the
      // same place, so it reads as click-to-pick; on touch you drag to aim and
      // lift to commit, which is the only way to aim without a hover state.
      e.preventDefault();
      const { x, y } = clientToCanvas(e.clientX, e.clientY);
      showLoupe(e.clientX, e.clientY, x, y);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (!photo || !photo.img) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    dragState = { startX: x, startY: y, startPanX: photo.panX, startPanY: photo.panY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (picking) {
      const { x, y } = clientToCanvas(e.clientX, e.clientY);
      showLoupe(e.clientX, e.clientY, x, y);
      return;
    }
    if (!dragState || !photo) return;
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    photo.panX = (dragState.startPanX * W + (x - dragState.startX)) / W;
    photo.panY = (dragState.startPanY * H + (y - dragState.startY)) / H;
    render();
  });
  canvas.addEventListener('pointerleave', () => { if (picking) hideLoupe(); });
  function endDrag(e) {
    if (dragState && e.pointerId !== undefined) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    dragState = null;
  }
  canvas.addEventListener('pointerup', (e) => {
    if (picking) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      const { x, y } = clientToCanvas(e.clientX, e.clientY);
      commitPick(x, y);
      return;
    }
    endDrag(e);
  });
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
    // Nothing leaves this tool with straight punctuation in it. Blur normally
    // fires first, but commit every block anyway and repaint, so the export
    // is both correct and still identical to the preview.
    let dirty = false;
    Object.values(EDIT).forEach((el) => {
      const tidy = smartText(readEditable(el));
      if (blockText(el).trim() !== '' && blockText(el) !== tidy) { el.textContent = tidy; dirty = true; }
    });
    if (dirty) render();

    const raw = filenameInput.value.trim() || 'social-card';
    const safe = raw.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'social-card';
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.download = `${safe}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
  });

  /* ---------- proofreading ---------- */

  // Character offset -> (text node, offset). The editable is normally one
  // text node, but execCommand('insertText') on a paste can split it, so the
  // walk is the safe way to turn an offset from blockText() into a Range
  // position.
  function locate(el, offset) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let seen = 0, node;
    while ((node = walk.nextNode())) {
      const len = node.textContent.length;
      if (seen + len >= offset) return { node, offset: offset - seen };
      seen += len;
    }
    return node ? { node, offset: node.textContent.length } : null;
  }

  // How far down a line box the glyphs actually end. A Range rect is the
  // LINE box, which for this type is taller than the ink, so a mark drawn at
  // its foot floats well below the word. CSS puts half the leading above the
  // ascent, so the ink ends that much plus the ascent down -- the same sum
  // placeEditable uses to hit the baseline. Returned as a fraction, so it
  // works whatever the card is scaled to.
  function inkFraction(st, size) {
    const m = metrics(st, size);
    const lineH = size * st.leading;
    const half = (lineH - (m.fontAscent + m.fontDescent)) / 2;
    return Math.min(1, (half + m.fontAscent + m.descent * 0.45) / lineH);
  }

  function blockStyle(el) {
    if (el === EDIT.eyebrow) return [EYEBROW, EYEBROW.size];
    if (el === EDIT.dek) return [DEK, DEK.size];
    return [headStyle(), lastLayout ? lastLayout.size : headStyle().min];
  }

  // Where a character range is drawn, in viewport pixels. One rect per line,
  // because a flagged phrase can straddle one of the injected line breaks.
  function proofRects(el, start, end) {
    const a = locate(el, start), b = locate(el, end);
    if (!a || !b) return [];
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    const [st, size] = blockStyle(el);
    const f = inkFraction(st, size);
    return [...r.getClientRects()]
      .filter((q) => q.width > 0)
      .map((q) => ({ x: q.left, y: q.top, w: q.width, h: q.height * f }));
  }

  // Accepting a correction changes the text's length, which the typing path
  // forbids -- so it commits exactly the way the blur tidy-up does: write the
  // whole block, put the caret after the replacement, repaint.
  function proofReplace(el, start, end, text) {
    const cur = blockText(el);
    const next = cur.slice(0, start) + text + cur.slice(end);
    el.textContent = next;
    if (document.activeElement === el) setCaretOffset(el, start + text.length);
    if (el === EDIT.headline) headPristine = false;
    render();
  }

  function wireProofreading() {
    if (!window.proofreadUI || !window.proofreader) return;
    const blocks = [
      ['eyebrow', EDIT.eyebrow, 'display', () => !shown.eyebrow],
      ['headline', EDIT.headline, 'display', () => false],
      ['dek', EDIT.dek, 'prose', () => !shown.dek],
    ];
    for (const [name, el, register, hidden] of blocks) {
      window.proofreadUI.attach({
        name, el, register, hidden,
        host: stage,
        read: () => blockText(el),
        rects: (a, b) => proofRects(el, a, b),
        replace: (a, b, t) => proofReplace(el, a, b, t),
      });
    }
    window.proofreadUI.setNote(document.getElementById('proofNote'));
  }

  window.__card = {
    layout: chooseLayout, grad, gradientColour, sampleAt,
    picked: () => (pickedColour ? pickedColour.slice() : null),
    picking: () => picking,
    headStyle: () => ({ ...headStyle(), key: headKey }),
    shown,
    styles: { EYEBROW, DEK, HEAD_STYLES },
    pristine: () => headPristine,
    align,
    setAlign: (h, v) => { if (h) align.h = h; if (v) align.v = v; render(); },
    setTypeset: (on) => { typeset = !!on; typesetToggle.checked = !!on; render(); },
    typeset: () => typeset,
    polishLines, blockText, lineFault, isolatedCount, raggedness, endsPhrase, TYPESET,
    geom: { W, H, BOX_W, BOX_LEFT, SAFE_TOP, TOP_LIMIT, CENTRE_X,
            BUBBLE_D, BUBBLE_R, BUBBLE_RING, BUBBLE_EDGE, BUBBLE_CLEAR, BUBBLE_GAP },
    // Bubbles. addBubble resolves after decode and render, because a file
    // dialog cannot be driven headlessly.
    bubbles: () => bubbles.map((b, i) => (b ? {
      i, cx: b.cx, cy: b.cy, r: BUBBLE_R, zoom: b.scaleMultiplier,
      panX: b.panX, panY: b.panY, w: b.img.naturalWidth, h: b.img.naturalHeight,
    } : null)),
    addBubble: (i, src) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { setBubbleImage(i, img); res(); };
      img.onerror = rej;
      img.src = src;
    }),
    removeBubble,
    moveBubble: (i, cx, cy) => {
      placeBubble(i, cx, cy, keepOut(lastLayout));
      render();
      return bubbles[i] ? { cx: bubbles[i].cx, cy: bubbles[i].cy } : null;
    },
    setBubbleZoom,
    setBubblePan: (i, px, py) => {
      if (!bubbles[i]) return null;
      bubbles[i].panX = px; bubbles[i].panY = py; render();
      return { panX: bubbles[i].panX, panY: bubbles[i].panY };
    },
    selectBubble: (i) => { select(i); render(); },
    setAdjust: (on) => { setAdjust(on); render(); },
    selection: () => ({ selected, adjusting }),
    textBoxes: () => textBoxes(chooseLayout()),
    logoRect,
    bubbleLegal: (i, cx, cy) => bubbleLegal(i, cx, cy, keepOut(chooseLayout())),
    bubbleNote: () => bubbleNote.textContent,
    bgPan: () => (photo ? { panX: photo.panX, panY: photo.panY, zoom: photo.scaleMultiplier } : null),
    exportURL: () => canvas.toDataURL('image/jpeg', 0.92),
    defaults: { ...DEFAULT_HEAD },
    caps: () => ({ ...CAP }),
    baseSpace, wordAdvance, wordSpacingPx, measureLine,
    // Lets the harness exercise the no-native-word-spacing path.
    forceFallback: (on) => { CAP.wordSpacing = on ? false : CAP.wordSpacingNative; render(); },
  };

  syncGradientEnabled();
  syncColour();

  if (window.ResizeObserver) new ResizeObserver(syncScale).observe(canvas);
  window.addEventListener('resize', syncScale);

  buildUploadSlot();
  buildBubbleControls();
  wireProofreading();
  render();
})();
