/*
 * Challenge Calendar page controller.
 *
 * Owns everything around the calendar component: saving the working
 * calendar in this browser (localStorage), the settings tabs, color
 * controls and the JPG download. The calendar
 * itself is rendered by TodayCalendar (calendar.js) from plain data built
 * by CalendarData.createCalendar (calendar-data.js).
 */
(() => {
  'use strict';

  const { PALETTE, COLOR_ROLES, THEMES, createCalendar, clampDays, clampWeeks, daysInMonth, MAX_BOXES } = window.CalendarData;
  const STORAGE_KEY = 'today-toolbox.calendar.v2';
  const EXPORT_SCALE = 3; // JPG = 2376 x 1836 (3x the 792 x 612 artboard)

  const $ = (id) => document.getElementById(id);
  const nameInput = $('nameInput');
  const daysInput = $('daysInput');
  const weeksInput = $('weeksInput');
  const weeksHint = $('weeksHint');
  const dayLabelInput = $('dayLabelInput');
  const fillInput = $('fillInput');
  const themeList = $('themeList');
  const roleList = $('roleList');
  const filenameInput = $('filename');

  /* ---------- the working calendar (saved in this browser) ---------- */

  let current = load();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      // Re-run through createCalendar so older saves gain any new fields.
      if (saved && typeof saved === 'object') return createCalendar(saved);
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return createCalendar();
  }

  function writeNow() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch (e) { /* ignore */ }
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; writeNow(); }, 250);
  }

  // Don't lose the last keystrokes if the tab closes inside the debounce.
  window.addEventListener('pagehide', () => {
    if (saveTimer) { clearTimeout(saveTimer); writeNow(); }
  });

  /* ---------- calendar component (always editable) ---------- */

  const calendar = new window.TodayCalendar($('calendar'), current, {
    onChange() {
      // Keep the name field in step when the headline is typed on the calendar.
      if (document.activeElement !== nameInput) nameInput.value = current.headline;
      filenameInput.placeholder = defaultFilename();
      save();
    },
  });
  calendar.setEditing(true);

  /* ---------- settings tabs ---------- */

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    });
  });

  /* ---------- Content tab ---------- */

  // The calendar's name is its headline — editable here or on the calendar.
  nameInput.addEventListener('input', () => {
    current.headline = nameInput.value;
    calendar.render();
    filenameInput.placeholder = defaultFilename();
    save();
  });

  // Days and week boxes share the 35-box grid; days win if they collide.
  function setCounts(days, weeks) {
    current.days = clampDays(days);
    current.weeks = clampWeeks(weeks, current.days);
    calendar.render();
    syncControls();
    save();
  }

  daysInput.addEventListener('change', () => setCounts(daysInput.value, current.weeks));
  weeksInput.addEventListener('change', () => setCounts(current.days, weeksInput.value));

  $('matchMonthBtn').addEventListener('click', () => {
    const n = daysInMonth(current.month, current.year);
    if (n == null) {
      alert('Set a month name (e.g. "November") and a year on the calendar first.');
      return;
    }
    setCounts(n, current.weeks);
  });

  dayLabelInput.addEventListener('input', () => {
    current.dayLabel = dayLabelInput.value;
    calendar.render();
    save();
  });

  $('fillBtn').addEventListener('click', () => {
    const text = fillInput.value;
    const target = text === '' ? 'clear every day box' : `set every day box to "${text}"`;
    if (!confirm(`This will ${target}. Continue?`)) return;
    current.cells = current.cells.map(() => text);
    calendar.render();
    save();
  });

  /* ---------- Color themes tab ---------- */

  Object.entries(THEMES).forEach(([id, theme]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    btn.dataset.theme = id;
    btn.innerHTML = `
      <span class="theme-preview" style="background:${theme.colors.background}">
        <span style="background:${theme.colors.header}"></span>
        <span style="background:${theme.colors.cell};border-top:4px solid ${theme.colors.band}"></span>
      </span>
      <span class="theme-name">${theme.name}</span>`;
    btn.addEventListener('click', () => {
      current.colors = { ...theme.colors };
      calendar.render();
      syncControls();
      save();
    });
    themeList.appendChild(btn);
  });

  /* ---------- Custom colors tab ---------- */

  COLOR_ROLES.forEach((role) => {
    const row = document.createElement('div');
    row.className = 'role-row';
    row.innerHTML = `<span class="role-label">${role.label}</span><div class="swatch-row" role="radiogroup" aria-label="${role.label}"></div>`;
    const swatches = row.querySelector('.swatch-row');
    PALETTE.forEach((color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch-btn';
      b.style.background = color.hex;
      b.title = `${color.name} ${color.hex}`;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', color.name);
      b.dataset.role = role.key;
      b.dataset.hex = color.hex;
      b.addEventListener('click', () => {
        current.colors[role.key] = color.hex;
        calendar.render();
        syncControls();
        save();
      });
      swatches.appendChild(b);
    });
    roleList.appendChild(row);
  });

  /* ---------- sync controls from data ---------- */

  function syncControls() {
    nameInput.value = current.headline;
    daysInput.value = current.days;
    weeksInput.value = current.weeks;
    weeksInput.max = MAX_BOXES - current.days;
    weeksHint.textContent = `Up to ${MAX_BOXES - current.days} with ${current.days} days. Click a week tab or box on the calendar to edit it.`;
    dayLabelInput.value = current.dayLabel;
    roleList.querySelectorAll('.swatch-btn').forEach((b) => {
      const on = (current.colors[b.dataset.role] || '').toUpperCase() === b.dataset.hex;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
    themeList.querySelectorAll('.theme-btn').forEach((b) => {
      const t = THEMES[b.dataset.theme].colors;
      b.classList.toggle('active', Object.keys(t).every((k) => t[k].toUpperCase() === (current.colors[k] || '').toUpperCase()));
    });
    filenameInput.placeholder = defaultFilename();
  }

  /* ---------- JPG download ---------- */

  // Renders the live calendar DOM into an SVG <foreignObject> (with fonts
  // and the logo inlined as data URLs), then rasterises it on a canvas —
  // so the JPG is pixel-for-pixel the same layout as the page.
  $('downloadBtn').addEventListener('click', async () => {
    const btn = $('downloadBtn');
    btn.disabled = true;
    try {
      const blob = await renderJpg(EXPORT_SCALE);
      downloadBlob(blob, (filenameInput.value.trim() || filenameInput.placeholder || 'challenge-calendar') + '.jpg');
    } catch (err) {
      console.error(err);
      alert('This browser couldn\'t export the image. Try the latest Chrome or Edge.');
    } finally {
      btn.disabled = false;
    }
  });

  let inlinedCss = null;
  async function getInlinedCss() {
    if (inlinedCss) return inlinedCss;
    const cssUrl = new URL('calendar.css', location.href);
    let css = await (await fetch(cssUrl)).text();
    const urls = [...new Set([...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]))];
    for (const u of urls) {
      const blob = await (await fetch(new URL(u, cssUrl))).blob();
      css = css.split(`url('${u}')`).join(`url('${await blobToDataUrl(blob)}')`);
    }
    inlinedCss = css;
    return css;
  }

  async function renderJpg(scale) {
    const W = window.TodayCalendar.DESIGN_W;
    const H = window.TodayCalendar.DESIGN_H;
    const css = await getInlinedCss();

    const clone = calendar.artboard.cloneNode(true);
    clone.classList.remove('is-editing');
    clone.style.setProperty('--tcal-scale', '1');
    clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    clone.querySelectorAll('.is-overflowing').forEach((n) => n.classList.remove('is-overflowing'));

    const html = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}">`
      + `<foreignObject x="0" y="0" width="${W}" height="${H}">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${W}px;height:${H}px">`
      + `<style>${escapeXml(css)}</style>${html}</div></foreignObject></svg>`;

    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    // Give the embedded webfont a beat to apply inside the SVG image.
    await new Promise((r) => setTimeout(r, 150));

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.95);
    });
  }

  /* ---------- helpers ---------- */

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function defaultFilename() {
    return slug(`${current.month} ${current.year} ${current.headline}`);
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'challenge-calendar';
  }

  syncControls();
})();
