# TODAY Toolbox

Internal web-based tools for the TODAY show multimedia/production team. No build step — plain HTML/CSS/JS, deployable as-is (e.g. GitHub Pages).

## Running locally

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Tools

### Split Image Generator (`/split-image/`)

Builds split-image graphics for social/promo use:

- Layouts: 2-split, 3-split, 4-split (straight vertical dividers), or 4-split grid (one vertical + one horizontal divider crossing in the middle, forming a 2x2 grid). Divider position is fixed and evenly spaced — not user-adjustable.
- Output size: 2400×1200 (2:1), 1920×1080 (16:9), or 1000×1000 (1:1 square). Square output only supports the 2-split layout.
- Upload one image per panel via the buttons above the canvas, or drag an image file straight onto a panel (or its upload slot) to drop it in.
- Drag within a panel to reposition its image, and use each slot's zoom slider to scale it.
- Enter a file name and export as a single flattened JPG at full output resolution.

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

#### TODAY VAULT Template (`/editorial-templates/today-vault/`)

- Single image at 2400×1200 with the TODAY VAULT badge composited over it.
- Upload one image; it is cover-fitted to the frame, drag to reposition and use the zoom slider to scale.
- Badge corner: bottom-left or bottom-right (bottom-right by default, matching the reference example).
- The badge is fixed — its size and position come only from constants and the chosen corner, and it has no hit test, so dragging always moves the photo underneath and never the logo.
- Badge geometry was measured from the supplied reference: 24% of canvas height (288px), inset 3% of width from the side and 7.5% of height from the bottom. Stored as fractions so it stays correct if the canvas size changes.
- Artwork lives at `assets/today-vault-logo.png`, pre-trimmed to its alpha bounds and downscaled to 576px (2× the render size).
- Enter a file name and export as a single flattened JPG at full 2400×1200 resolution.

#### Challenge Calendar Template (`/editorial-templates/calendar/`)

- Recreates the "31-Day Walking Streak" Start TODAY calendar exports: a 792×612 artboard (US Letter landscape), measured from the reference files and scaled as a whole so proportions never distort at any screen width.
- All text is set in Mada (variable weight, self-hosted at `assets/fonts/Mada-Variable-*.woff2`, OFL license alongside).
- The calendar is always editable: click the headline, month, year, "Challenge", or any day box to type directly on it. The settings panel below has tabs for content (calendar name, number of days, day tab label, fill all days), color themes, and custom colors.
- Day boxes all use the same default size (16px on the artboard). A box whose text would need more than 3 lines shrinks — that box only — down to an 8px minimum; the box itself never resizes. A box that still can't fit is outlined red while editing (the outline never appears in the export).
- Colors are limited to the approved palette sampled from the references (five accents, their five tints, and white). "Color themes" reproduces each reference combination; "Custom colors" sets each part (background, banner, headline text, logo, day tab, tab text, cell, cell text) individually.
- 1–35 days (7 columns × up to 5 rows); "Match month" sets the count from the month/year shown.
- The working calendar is saved automatically in the browser (localStorage), so it's still there after a reload.
- Export as a 2376×1836 JPG (3×). The file name defaults to the month, year and headline.
- Code: `calendar-data.js` (palette, themes, default content), `calendar.js` (the reusable `TodayCalendar` component), `calendar.css` (the design), `app.js` (page controls). Change the defaults a new calendar starts with in `createCalendar` in `calendar-data.js`.

New templates are added as subfolders here and linked from the hub page.

More tools will be added to the toolbox over time, linked from the home page (`/index.html`).

## Design

Shared color palette and tokens live in `assets/toolbox.css` (`:root`), documented in `docs/color-palette.md`.
