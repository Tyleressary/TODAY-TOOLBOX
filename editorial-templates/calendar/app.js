/*
 * Challenge Calendar page controller.
 *
 * Owns everything around the calendar component: the saved-calendar
 * library (localStorage), View/Edit mode, the settings tabs, color
 * controls, JSON import/export, JPG download and printing. The calendar
 * itself is rendered by TodayCalendar (calendar.js) from plain data built
 * by CalendarData.createCalendar (calendar-data.js).
 */
(() => {
  'use strict';

  const { PALETTE, COLOR_ROLES, THEMES, PRESETS, createCalendar, clampDays, daysInMonth, newId } = window.CalendarData;
  const STORAGE_KEY = 'today-toolbox.calendars.v1';
  const EXPORT_SCALE = 3; // JPG = 2376 x 1836 (3x the 792 x 612 artboard)

  const $ = (id) => document.getElementById(id);
  const calendarSelect = $('calendarSelect');
  const newSelect = $('newSelect');
  const modeGroup = $('modeGroup');
  const nameInput = $('nameInput');
  const daysInput = $('daysInput');
  const dayLabelInput = $('dayLabelInput');
  const checkboxInput = $('checkboxInput');
  const fillInput = $('fillInput');
  const themeList = $('themeList');
  const roleList = $('roleList');
  const filenameInput = $('filename');

  /* ---------- library (saved in this browser) ---------- */

  let library = loadLibrary();
  let current = library.calendars.find((c) => c.id === library.currentId) || library.calendars[0];

  function loadLibrary() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.calendars) && saved.calendars.length) {
        // Re-run through createCalendar so older saves gain any new fields.
        saved.calendars = saved.calendars.map((c) => createCalendar(c));
        return saved;
      }
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    const first = fromPreset(PRESETS[0]);
    return { calendars: [first], currentId: first.id };
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      library.currentId = current.id;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); } catch (e) { /* ignore */ }
    }, 250);
  }

  // Don't lose the last keystrokes if the tab closes inside the debounce.
  window.addEventListener('pagehide', () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    library.currentId = current.id;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); } catch (e) { /* ignore */ }
  });

  function fromPreset(preset) {
    const { presetId, ...rest } = preset;
    return createCalendar({ ...rest, id: newId() });
  }

  /* ---------- calendar component ---------- */

  const calendar = new window.TodayCalendar($('calendar'), current, {
    onChange() { save(); },
  });

  function show(cal) {
    current = cal;
    calendar.setData(cal);
    syncControls();
    save();
  }

  /* ---------- library controls ---------- */

  function renderCalendarSelect() {
    calendarSelect.replaceChildren(...library.calendars.map((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      return opt;
    }));
    calendarSelect.value = current.id;
  }

  PRESETS.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    newSelect.appendChild(opt);
  });

  calendarSelect.addEventListener('change', () => {
    show(library.calendars.find((c) => c.id === calendarSelect.value));
  });

  newSelect.addEventListener('change', () => {
    if (newSelect.value === '') return;
    const cal = fromPreset(PRESETS[Number(newSelect.value)]);
    newSelect.value = '';
    library.calendars.push(cal);
    show(cal);
    setMode('edit');
  });

  $('duplicateBtn').addEventListener('click', () => {
    const copy = createCalendar({ ...JSON.parse(JSON.stringify(current)), id: newId(), name: current.name + ' copy' });
    library.calendars.push(copy);
    show(copy);
  });

  $('deleteBtn').addEventListener('click', () => {
    if (!confirm(`Delete "${current.name}"? This can't be undone.`)) return;
    library.calendars = library.calendars.filter((c) => c !== current);
    if (!library.calendars.length) library.calendars.push(fromPreset(PRESETS[0]));
    show(library.calendars[0]);
  });

  /* ---------- View / Edit mode ---------- */

  function setMode(mode) {
    const editing = mode === 'edit';
    calendar.setEditing(editing);
    document.body.classList.toggle('is-edit-mode', editing);
    document.body.classList.toggle('is-view-mode', !editing);
    modeGroup.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  }

  modeGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

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

  nameInput.addEventListener('input', () => {
    current.name = nameInput.value.trim() || 'Untitled calendar';
    renderCalendarSelect();
    save();
  });

  daysInput.addEventListener('change', () => {
    current.days = clampDays(daysInput.value);
    daysInput.value = current.days;
    calendar.render();
    save();
  });

  $('matchMonthBtn').addEventListener('click', () => {
    const n = daysInMonth(current.month, current.year);
    if (n == null) {
      alert('Set a month name (e.g. "November") and a year on the calendar first.');
      return;
    }
    current.days = n;
    daysInput.value = n;
    calendar.render();
    save();
  });

  dayLabelInput.addEventListener('input', () => {
    current.dayLabel = dayLabelInput.value;
    calendar.render();
    save();
  });

  checkboxInput.addEventListener('change', () => {
    current.showCheckbox = checkboxInput.checked;
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

  /* ---------- Import / export ---------- */

  $('exportJsonBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
    downloadBlob(blob, slug(current.name) + '.json');
  });

  $('importJsonInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const imported = list.map((c) => createCalendar({ ...c, id: newId() }));
      library.calendars.push(...imported);
      show(imported[0]);
    } catch (err) {
      alert('That file isn\'t a valid calendar export.');
    }
  });

  /* ---------- sync controls from data ---------- */

  function syncControls() {
    renderCalendarSelect();
    nameInput.value = current.name;
    daysInput.value = current.days;
    dayLabelInput.value = current.dayLabel;
    checkboxInput.checked = current.showCheckbox !== false;
    roleList.querySelectorAll('.swatch-btn').forEach((b) => {
      const on = (current.colors[b.dataset.role] || '').toUpperCase() === b.dataset.hex;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
    themeList.querySelectorAll('.theme-btn').forEach((b) => {
      const t = THEMES[b.dataset.theme].colors;
      b.classList.toggle('active', Object.keys(t).every((k) => t[k].toUpperCase() === (current.colors[k] || '').toUpperCase()));
    });
    filenameInput.placeholder = slug(current.name);
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
      alert('This browser couldn\'t export the image. Use "Print / Save as PDF" instead, or try Chrome.');
    } finally {
      btn.disabled = false;
    }
  });

  let inlinedCss = null;
  async function getInlinedCss() {
    if (inlinedCss) return inlinedCss;
    const cssUrl = new URL('calendar.css', location.href);
    let css = await (await fetch(cssUrl)).text();
    css = css.replace(/@media print\s*\{[\s\S]*?\}\s*\}/, '');
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

  /* ---------- print ---------- */

  $('printBtn').addEventListener('click', () => {
    const wasEditing = document.body.classList.contains('is-edit-mode');
    setMode('view');
    window.print();
    if (wasEditing) setMode('edit');
  });

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

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'challenge-calendar';
  }

  syncControls();
  setMode('view');
})();
