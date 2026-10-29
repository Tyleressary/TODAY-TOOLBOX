# TODAY Toolbox

Internal web-based tools for the TODAY show multimedia/production team. No build step — plain HTML/CSS/JS, deployable as-is (e.g. GitHub Pages).

## Running locally

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Structure

The home page lists categories; each category page lists its templates.

```
/                             Toolbox home
/editorial-templates/         Editorial Templates — 5 templates
/social-templates/            Social Templates — empty for now
```

The Split Image Generator lives at `/split-image/` and is listed under Editorial
Templates; it is a general-purpose split tool rather than a fixed franchise
layout, but in practice it sits alongside Trivia Tease, which is itself a split.

## Templates

### Editorial Templates (`/editorial-templates/`)

A hub page collecting reusable layouts for recurring franchises and other editorial projects. Each template is a fixed, non-configurable layout so the same graphic comes out identically every time it's rebuilt.

#### Trivia Tease Template (`/editorial-templates/trivia-tease/`)

- 15-box split: 5 across × 3 down at 2400×1200, so every box is 480×400.
- Layout and output size are fixed by design — there are no split or size options.
- Fill each box with either an image or a flat color:
  - Image: upload one per box via the buttons above, or drag an image file straight onto a box (or its upload slot) to drop it in; each is cover-fitted, drag on the canvas to reposition, use each slot's zoom slider to scale.
  - Color: pick from the dropdown under the file input — all 36 palette colors (six ramps × six steps) plus white, grouped by ramp, with a swatch showing the current pick.
  - The two are mutually exclusive per box — setting one clears the other. Choosing the blank dropdown option empties the box again.
- White dividers on every seam, matching the Split Image Generator.
- Enter a file name and export as a single flattened JPG at full 2400×1200 resolution.

#### Word Explain Template (`/editorial-templates/word-explain/`)

- A single word (typed in, all-caps on render) centered on a solid background, with an underline in the same color spanning the word's rendered width.
- Output size: 2400×1200 or 1000×1000 — no split options, since this is a single text panel.
- Word is set in Mada Black (self-hosted at `assets/fonts/Mada-Black.ttf`), sized to a fixed fraction of the canvas height; if a longer word would overflow the safe margins at that size, the font shrinks just enough to fit — it never wraps or exceeds the canvas.
- Word/underline color and background color are each an independent dropdown, same 36-color palette + white component used in Trivia Tease.
- Enter a file name and export as a single flattened JPG at full output resolution.

#### Tease Image Branding Kit (`/editorial-templates/tease-image-branding-kit/`)

- Single image with a branding bug composited into a bottom corner.
- Output size: 2400×1200 (2:1) or 1000×1000 (1:1).
- Logo: TODAY VAULT or TODAY 75. Every logo renders at the same size in the same place, so switching changes only the artwork.
- Upload one image (button or drag-and-drop); it is cover-fitted to the frame, drag to reposition and use the zoom slider to scale.
- Bug corner: bottom-left or bottom-right (bottom-right by default, matching the reference example).
- The bug is fixed — its rect comes only from constants, the chosen corner and the output size, and it has no hit test, so dragging always moves the photo underneath and never the logo.
- Bug geometry derives from the approved 2400×1200 reference (288px, 72px from the side, 90px from the bottom). Size scales with the geometric mean of the frame (`288 / sqrt(2400*1200)`), so it keeps the same visual weight in any aspect — 288px on the 2:1, 170px on the square. Margins are multiples of the bug itself (72/288 and 90/288), which reproduces the reference exactly and carries over to any format; per-axis fractions of the canvas would not survive the aspect change.
- Artwork lives at `assets/today-vault-logo.png` and `assets/today-75-logo.png`, each pre-trimmed to its alpha bounds (both sources carry uneven transparent padding that would otherwise skew size and margins) and downscaled to 576px.
- Enter a file name and export as a single flattened JPG at full output resolution.
- The former `/editorial-templates/today-vault/` path redirects here.

#### Challenge Calendar Template (`/editorial-templates/calendar/`)

- Recreates the "31-Day Walking Streak" Start TODAY calendar exports: a 792×612 artboard (US Letter landscape), measured from the reference files and scaled as a whole so proportions never distort at any screen width.
- All text is set in Mada (variable weight, self-hosted at `assets/fonts/Mada-Variable-*.woff2`, OFL license alongside).
- The calendar is always editable: click the headline, month, year, "Challenge", or any day box to type directly on it. The settings panel below has tabs for content (calendar name, number of days, week boxes, day tab label, fill all days), color themes, custom colors, and download.
- Day boxes all use the same default size (16px on the artboard). A box whose text would need more than 3 lines shrinks — that box only — down to an 8px minimum; the box itself never resizes. A box that still can't fit is outlined red while editing (the outline never appears in the export).
- Colors are limited to the approved palette sampled from the references (five accents, their five tints, and white). "Color themes" reproduces each reference combination; "Custom colors" sets each part (background, banner, headline text, logo, day tab, tab text, cell, cell text) individually.
- 1–35 days (7 columns × up to 5 rows); "Match month" sets the count from the month/year shown.
- Optional week boxes fill the empty grid slots after the last day (days + weeks ≤ 35). Each week box's tab label ("WEEK 1") and text are edited in place on the calendar. Week tabs are set heavier and tighter than day tabs, and all week boxes share one text size (the smallest any of them needs), matching the reference.
- The working calendar is saved automatically in the browser (localStorage), so it's still there after a reload.
- Download tab: export as a 2376×1836 JPG (3×). The file name defaults to the month, year and headline.
- Code: `calendar-data.js` (palette, themes, default content), `calendar.js` (the reusable `TodayCalendar` component), `calendar.css` (the design), `app.js` (page controls). Change the defaults a new calendar starts with in `createCalendar` in `calendar-data.js`.

#### Split Image Generator (`/split-image/`)

Builds split-image graphics for social/promo use:

- Layouts: 2-split, 3-split, 4-split (straight vertical dividers), or 4-split grid (one vertical + one horizontal divider crossing in the middle, forming a 2x2 grid). Divider position is fixed and evenly spaced — not user-adjustable.
- Output size: 2400×1200 (2:1), 1920×1080 (16:9), or 1000×1000 (1:1 square). Square output only supports the 2-split layout.
- Upload one image per panel via the buttons above the canvas, or drag an image file straight onto a panel (or its upload slot) to drop it in.
- Drag within a panel to reposition its image, and use each slot's zoom slider to scale it.
- Enter a file name and export as a single flattened JPG at full output resolution.

New templates are added as subfolders here and linked from the hub page.

### Social Templates (`/social-templates/`)

Empty for now. The page exists so the category is present in the navigation and
new social templates can be added as subfolders without restructuring the home page.

More tools will be added to the toolbox over time, linked from the home page (`/index.html`).

## Design system

Shared in `assets/toolbox.css` and used by every page.

- **Type**: Libre Bodoni (`--font-display`) for the page name in the header band
  and the home link; Source Sans 3 (`--font-ui`) for all functional UI. Both load
  from Google Fonts. Mada stays self-hosted and is reserved for the Word
  template's canvas output, where a runtime font failure would corrupt the export.
- **Header**: `.brand-band` — a lavender (`--purple-100`) band holding the TODAY
  wordmark and the page name. Identical on all eight pages.
- **Cards**: `.category-card` is the envelope used on the home page (tinted body,
  saturated flap cut with `clip-path`); `.template-tile` is the flat square used
  on category pages. Fill and label ink are paired by the `.fill-*` classes.
- **Centering**: `.card-grid` is flex-wrap with `justify-content: center`, not an
  auto-fit grid. An auto-fit grid leaves a short final row stretched or
  left-aligned; flex keeps a trailing row of one or two tiles genuinely centered.
- **Card labels**: white Source Sans 3 Black (900) on every fill, per brand
  direction. White on the lighter fills (blue-500, amber-500) sits below the
  WCAG AA ratio; that is a deliberate brand call, not an oversight.
- **Contrast elsewhere**: body and control text all meet AA. Selected controls
  use `--purple-500` rather than red, because white on red-500 is 3.2:1 — fine
  for the large Download button, not for a 14px control label.
- **Header sizing**: `--logo-h` drives both the wordmark height and the heading
  size. Libre Bodoni's cap height is 0.77em (measured), so the heading is set to
  `--logo-h / 0.77` and its capitals match the TODAY wordmark at every width.

## Palette

Shared color palette and tokens live in `assets/toolbox.css` (`:root`), documented in `docs/color-palette.md`.
