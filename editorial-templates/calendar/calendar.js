/*
 * TodayCalendar — reusable, editable calendar component.
 *
 *   const cal = new TodayCalendar(frameElement, CalendarData.createCalendar({...}), {
 *     onChange(data) { ... },   // called after every edit
 *   });
 *   cal.setEditing(true);       // View mode <-> Edit mode
 *   cal.setData(otherCalendar); // show a different calendar
 *   cal.getData();              // current content (plain JSON)
 *
 * The component only knows how to render and edit ONE calendar
 * definition; storage, menus and color controls live in app.js. Visual
 * styling lives in calendar.css. Exposed as window.TodayCalendar.
 */
(() => {
  'use strict';

  // Artboard size in design pixels (matches calendar.css).
  const DESIGN_W = 792;
  const DESIGN_H = 612;

  // ---------------------------------------------------------------------
  // CUSTOMIZE: cell auto-fit.
  // Every cell starts at the default size set on .tcal-text in
  // calendar.css (16px). A cell whose text needs more than MAX_LINES lines
  // at that size shrinks (that cell only) until it fits in the same
  // height, but never below MIN_SIZE. Sizes are design pixels.
  // ---------------------------------------------------------------------
  const FIT = {
    MIN_SIZE: 8,
    MAX_LINES: 3,
  };

  // Headline keeps its calendar.css size (46px) and only shrinks if a longer
  // title would run into the banner's curved edge.
  const HEADLINE_MAX_WIDTH = 580;
  const HEADLINE_MIN_SIZE = 24;

  // Alpha-only logo artwork, tinted per calendar (path relative to the page).
  const LOGO_MASK_URL = '../../assets/start-today-logo-hd.png';

  const supportsPlaintextOnly = (() => {
    const probe = document.createElement('div');
    try { probe.contentEditable = 'plaintext-only'; } catch (e) { return false; }
    return probe.contentEditable === 'plaintext-only';
  })();

  class TodayCalendar {
    constructor(frame, data, options = {}) {
      this.frame = frame;
      this.onChange = options.onChange || (() => {});
      this.editing = false;
      this.frame.classList.add('tcal-frame');
      this.build();
      this.setData(data);

      // Scale the fixed-size artboard to whatever width the frame has.
      this.resizeObserver = new ResizeObserver(() => this.updateScale());
      this.resizeObserver.observe(this.frame);
      this.updateScale();

      // Re-fit once the Mada webfont is ready — metrics change on swap.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this.fitAll());
      }
    }

    /* ---------- DOM ---------- */

    build() {
      const root = el('div', 'tcal');
      root.innerHTML = `
        <div class="tcal-banner"></div>
        <p class="tcal-eyebrow"><span data-field="month"></span> <span data-field="year"></span> <span data-field="eyebrowSuffix"></span></p>
        <h2 class="tcal-headline" data-field="headline"></h2>
        <div class="tcal-logo" role="img" aria-label="start TODAY"></div>
        <ol class="tcal-grid"></ol>`;
      this.root = root;
      this.grid = root.querySelector('.tcal-grid');
      this.fields = {};
      root.querySelectorAll('[data-field]').forEach((node) => {
        this.fields[node.dataset.field] = node;
        this.wireSingleLine(node);
      });

      // Day boxes first, then week boxes, which fill the slots after the
      // last day. Both sets are built once at full size and shown/hidden.
      const max = window.CalendarData.MAX_BOXES;
      this.cells = [];
      this.weekCells = [];
      for (let i = 0; i < max; i++) this.cells.push(this.buildCell('cells', i));
      for (let i = 0; i < max; i++) {
        const cell = this.buildCell('weekCells', i);
        cell.li.classList.add('tcal-cell--week');
        this.wireWeekLabel(cell.day, i);
        this.weekCells.push(cell);
      }

      this.frame.replaceChildren(root);
    }

    // One box: domed tab + white body. `key` is the data array its text
    // lives in ('cells' for days, 'weekCells' for weeks).
    buildCell(key, index) {
      const li = el('li', 'tcal-cell');
      const band = el('div', 'tcal-band');
      const day = el('span', 'tcal-day');
      band.appendChild(day);
      const body = el('div', 'tcal-body');
      const text = el('div', 'tcal-text');
      text.dataset[key === 'cells' ? 'cell' : 'week'] = String(index);
      body.appendChild(text);
      li.append(band, body);
      this.grid.appendChild(li);
      const cell = { li, day, body, text };
      this.wireCell(cell, key, index);
      return cell;
    }

    // Week tab labels ("WEEK 1") are editable in place, one line each.
    wireWeekLabel(node, index) {
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
      });
      node.addEventListener('paste', pastePlainText);
      node.addEventListener('input', () => {
        this.data.weekLabels[index] = node.textContent.replace(/\s+/g, ' ').trim();
        this.onChange(this.data);
      });
      node.addEventListener('blur', () => { node.textContent = this.data.weekLabels[index]; });
    }

    // Headline / month / year / suffix: one line, Enter commits.
    wireSingleLine(node) {
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
      });
      node.addEventListener('paste', pastePlainText);
      node.addEventListener('input', () => {
        const value = node.textContent.replace(/\s+/g, ' ');
        this.data[node.dataset.field] = value.trim();
        if (node.dataset.field === 'headline') this.fitHeadline();
        this.onChange(this.data);
      });
      node.addEventListener('blur', () => {
        // Normalise whitespace once editing of the field is finished.
        node.textContent = this.data[node.dataset.field];
        if (node.dataset.field === 'headline') this.fitHeadline();
      });
    }

    // Box text: multi-line, each box re-fits itself on every keystroke.
    wireCell(cell, key, index) {
      const node = cell.text;
      node.addEventListener('paste', pastePlainText);
      node.addEventListener('input', () => {
        this.data[key][index] = node.innerText.replace(/\n$/, '');
        if (key === 'weekCells') this.fitWeeks(); else this.fitCell(cell);
        this.onChange(this.data);
      });
    }

    /* ---------- data ---------- */

    setData(data) {
      this.data = data;
      this.render();
    }

    getData() {
      return this.data;
    }

    render() {
      const d = this.data;
      for (const key of ['month', 'year', 'eyebrowSuffix', 'headline']) {
        if (document.activeElement !== this.fields[key]) this.fields[key].textContent = d[key];
      }
      this.cells.forEach((cell, i) => {
        cell.li.hidden = i >= d.days;
        cell.day.textContent = `${d.dayLabel} ${i + 1}`.trim();
        if (document.activeElement !== cell.text) cell.text.textContent = d.cells[i] || '';
      });
      this.weekCells.forEach((cell, i) => {
        cell.li.hidden = i >= d.weeks;
        if (document.activeElement !== cell.day) cell.day.textContent = d.weekLabels[i] || '';
        if (document.activeElement !== cell.text) cell.text.textContent = d.weekCells[i] || '';
      });
      // Trim trailing empty rows so e.g. 28 days is exactly 4 rows.
      this.grid.style.gridTemplateRows = `repeat(${Math.ceil((d.days + d.weeks) / 7)}, 89px)`;
      this.applyColors(d.colors);
      this.applyLogo(d.colors.logo);
      this.applyEditing();
      this.fitAll();
    }

    applyColors(colors) {
      for (const [key, hex] of Object.entries(colors || {})) {
        this.root.style.setProperty(`--cal-${key}`, hex);
      }
    }

    // Render the logo as a tinted <img>. Falls back to the CSS mask if the
    // artwork can't be read (e.g. page opened from file://).
    async applyLogo(hex) {
      const logo = this.root.querySelector('.tcal-logo');
      try {
        const src = await tintedLogo(hex);
        if (this.data.colors.logo !== hex) return; // a newer color won
        let img = logo.querySelector('img');
        if (!img) {
          img = document.createElement('img');
          img.alt = '';
          logo.appendChild(img);
        }
        img.src = src;
        logo.classList.add('has-img');
      } catch (e) {
        logo.classList.remove('has-img');
        logo.replaceChildren();
      }
    }

    /* ---------- modes ---------- */

    setEditing(on) {
      this.editing = !!on;
      this.applyEditing();
    }

    applyEditing() {
      const mode = this.editing ? (supportsPlaintextOnly ? 'plaintext-only' : 'true') : 'false';
      this.root.classList.toggle('is-editing', this.editing);
      const editable = [
        ...Object.values(this.fields),
        ...this.cells.map((c) => c.text),
        ...this.weekCells.flatMap((c) => [c.day, c.text]),
      ];
      editable.forEach((node) => {
        if (this.editing) {
          node.setAttribute('contenteditable', mode);
          node.setAttribute('spellcheck', 'true');
        } else {
          node.removeAttribute('contenteditable');
          node.removeAttribute('spellcheck');
        }
      });
      if (!this.editing && this.root.contains(document.activeElement)) document.activeElement.blur();
    }

    /* ---------- layout ---------- */

    updateScale() {
      const w = this.frame.clientWidth;
      if (w > 0) this.root.style.setProperty('--tcal-scale', String(w / DESIGN_W));
    }

    fitAll() {
      this.fitHeadline();
      this.cells.slice(0, this.data.days).forEach((cell) => this.fitCell(cell));
      this.fitWeeks();
    }

    // Week boxes are fitted like day boxes, then all share the smallest
    // resulting size so the row reads as one set (as in the reference).
    fitWeeks() {
      const shown = this.weekCells.slice(0, this.data.weeks);
      shown.forEach((cell) => this.fitCell(cell));
      const sizes = shown.map((c) => parseFloat(getComputedStyle(c.text).fontSize));
      const min = Math.min(...sizes);
      shown.forEach((c, i) => { if (sizes[i] > min) c.text.style.fontSize = min + 'px'; });
    }

    fitHeadline() {
      const node = this.fields.headline;
      node.style.fontSize = '';
      let size = parseFloat(getComputedStyle(node).fontSize);
      while (node.scrollWidth > HEADLINE_MAX_WIDTH && size > HEADLINE_MIN_SIZE) {
        size -= 0.5;
        node.style.fontSize = size + 'px';
      }
    }

    /**
     * Shrink ONE cell's text until it fits in MAX_LINES lines' worth of
     * height at the default size. Other cells are untouched; the box size
     * never changes. Measurements are in unscaled layout pixels, so the
     * current zoom level doesn't matter.
     */
    fitCell({ text, body }) {
      text.classList.remove('is-breaking');
      text.style.maxHeight = 'none';
      text.style.fontSize = '';
      // Default size + line height come from calendar.css (single source).
      const cs = getComputedStyle(text);
      const defaultSize = parseFloat(cs.fontSize);
      const maxHeight = parseFloat(cs.lineHeight) * FIT.MAX_LINES + 0.5;
      const fits = () => text.scrollHeight <= maxHeight && text.scrollWidth <= text.clientWidth + 0.5;

      let ok = fits();
      if (!ok) {
        // Binary search the largest size (0.25px steps) that fits.
        let lo = FIT.MIN_SIZE, hi = defaultSize;
        text.style.fontSize = lo + 'px';
        if (fits()) {
          while (hi - lo > 0.25) {
            const mid = (lo + hi) / 2;
            text.style.fontSize = mid + 'px';
            if (fits()) lo = mid; else hi = mid;
          }
          text.style.fontSize = lo + 'px';
          ok = true;
        } else {
          // Still too wide/tall at the minimum: allow breaks inside words.
          text.classList.add('is-breaking');
          ok = fits();
        }
      }
      text.style.maxHeight = '';
      body.classList.toggle('is-overflowing', !ok);
    }

    /* ---------- export helpers ---------- */

    get artboard() { return this.root; }
  }

  TodayCalendar.DESIGN_W = DESIGN_W;
  TodayCalendar.DESIGN_H = DESIGN_H;
  TodayCalendar.FIT = FIT;

  const logoCache = new Map();
  let logoMask = null;
  function tintedLogo(hex) {
    if (!logoCache.has(hex)) {
      logoMask = logoMask || new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = LOGO_MASK_URL;
      });
      logoCache.set(hex, logoMask.then((mask) => {
        const c = document.createElement('canvas');
        c.width = mask.naturalWidth;
        c.height = mask.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(mask, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, c.width, c.height);
        return c.toDataURL('image/png');
      }));
      logoCache.get(hex).catch(() => logoCache.delete(hex));
    }
    return logoCache.get(hex);
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }

  // Keep pasted content as plain text (matters where plaintext-only
  // contenteditable isn't supported).
  function pastePlainText(e) {
    if (supportsPlaintextOnly) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  window.TodayCalendar = TodayCalendar;
})();
