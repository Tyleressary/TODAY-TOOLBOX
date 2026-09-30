/*
 * Calendar data: the approved palette, the color themes built from it, and
 * the preset calendars. Content lives here, presentation lives in
 * calendar.css / calendar.js — edit this file to add colors, themes or
 * ready-made calendars without touching the component.
 *
 * Exposed as window.CalendarData.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------
  // CUSTOMIZE: approved palette.
  // Sampled from the supplied "Fitness Plan" reference exports — each
  // reference pairs one accent with one light background tint. These are
  // the ONLY colors the color controls offer.
  // ---------------------------------------------------------------------
  const PALETTE = [
    { id: 'white',        name: 'White',        hex: '#FFFFFF' },
    { id: 'green',        name: 'Green',        hex: '#A5A448' },
    { id: 'green-tint',   name: 'Green tint',   hex: '#EEEDE8' },
    { id: 'purple',       name: 'Purple',       hex: '#CB9AB4' },
    { id: 'purple-tint',  name: 'Purple tint',  hex: '#F3F0F2' },
    { id: 'red',          name: 'Red',          hex: '#FC705F' },
    { id: 'red-tint',     name: 'Red tint',     hex: '#F4E2E0' },
    { id: 'teal',         name: 'Teal',         hex: '#A4D3B3' },
    { id: 'teal-tint',    name: 'Teal tint',    hex: '#EEF2F1' },
    { id: 'yellow',       name: 'Yellow',       hex: '#EDB558' },
    { id: 'yellow-tint',  name: 'Yellow tint',  hex: '#F4E5D0' },
  ];

  // ---------------------------------------------------------------------
  // CUSTOMIZE: color roles. Every themable part of the calendar. The keys
  // map 1:1 to CSS custom properties in calendar.css (--cal-<key>).
  // ---------------------------------------------------------------------
  const COLOR_ROLES = [
    { key: 'background', label: 'Calendar background' },
    { key: 'header',     label: 'Headline banner' },
    { key: 'headerText', label: 'Headline & date text' },
    { key: 'logo',       label: 'Logo' },
    { key: 'band',       label: 'Day tab' },
    { key: 'bandText',   label: 'Day tab text' },
    { key: 'cell',       label: 'Cell background' },
    { key: 'cellText',   label: 'Cell text & checkbox' },
  ];

  // A theme = one accent + its tint, applied the way the references do.
  function makeTheme(accent, tint) {
    return {
      background: tint,
      header: accent,
      headerText: '#FFFFFF',
      logo: accent,
      band: accent,
      bandText: '#FFFFFF',
      cell: '#FFFFFF',
      cellText: accent,
    };
  }

  // CUSTOMIZE: preset themes — one per reference export.
  const THEMES = {
    green:  { name: 'Green',  colors: makeTheme('#A5A448', '#EEEDE8') },
    purple: { name: 'Purple', colors: makeTheme('#CB9AB4', '#F3F0F2') },
    red:    { name: 'Red',    colors: makeTheme('#FC705F', '#F4E2E0') },
    teal:   { name: 'Teal',   colors: makeTheme('#A4D3B3', '#EEF2F1') },
    yellow: { name: 'Yellow', colors: makeTheme('#EDB558', '#F4E5D0') },
  };

  // Grid limits: 7 columns x 5 rows is what the reference layout holds
  // without changing cell proportions.
  const MIN_DAYS = 1;
  const MAX_DAYS = 35;

  /**
   * Build a complete calendar definition. Anything omitted falls back to
   * the reference design ("31-Day Walking Streak", purple theme).
   */
  function createCalendar(overrides = {}) {
    const days = clampDays(overrides.days ?? 31);
    const cellText = overrides.cellText ?? 'Walk';
    const cells = Array.from({ length: MAX_DAYS }, (_, i) =>
      (overrides.cells && overrides.cells[i] != null) ? overrides.cells[i] : cellText);
    const themeId = overrides.theme && THEMES[overrides.theme] ? overrides.theme : 'purple';
    return {
      id: overrides.id || newId(),
      name: overrides.name || 'Untitled calendar',
      month: overrides.month ?? 'November',
      year: overrides.year ?? '2023',
      eyebrowSuffix: overrides.eyebrowSuffix ?? 'Challenge',
      headline: overrides.headline ?? '31-Day Walking Streak',
      dayLabel: overrides.dayLabel ?? 'Day',
      showCheckbox: overrides.showCheckbox ?? true,
      days,
      // Always MAX_DAYS long so shrinking then growing the day count keeps text.
      cells,
      colors: { ...THEMES[themeId].colors, ...(overrides.colors || {}) },
    };
  }

  // ---------------------------------------------------------------------
  // CUSTOMIZE: preset calendars shown in the "New from preset" menu.
  // Add an entry here to ship a ready-made calendar to the whole team.
  // ---------------------------------------------------------------------
  const PRESETS = [
    { presetId: 'walking-nov-2023', name: 'November 2023 Walking Streak', month: 'November', year: '2023', theme: 'purple' },
    { presetId: 'walking-dec-2023', name: 'December 2023 Walking Streak', month: 'December', year: '2023', theme: 'yellow' },
    { presetId: 'blank', name: 'Blank calendar', headline: 'Headline', cellText: '', theme: 'teal' },
  ];

  function clampDays(n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) return 31;
    return Math.min(MAX_DAYS, Math.max(MIN_DAYS, n));
  }

  function newId() {
    return 'cal-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december'];

  /** Days in the month named by `month`/`year`, or null if unrecognized. */
  function daysInMonth(month, year) {
    const m = MONTHS.findIndex((name) => name.startsWith(String(month).trim().toLowerCase().slice(0, 3)));
    const y = parseInt(year, 10);
    if (m < 0 || !String(month).trim() || !Number.isFinite(y)) return null;
    return new Date(y, m + 1, 0).getDate();
  }

  window.CalendarData = {
    PALETTE, COLOR_ROLES, THEMES, PRESETS, MIN_DAYS, MAX_DAYS,
    createCalendar, clampDays, daysInMonth, newId,
  };
})();
