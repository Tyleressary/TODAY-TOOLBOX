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

- One image, or a 2-split, with a branding bug composited into a bottom corner.
- Layout: Single Image or 2-Split. The 2-split reuses the Split Image Generator's
  divider code verbatim (`DIVIDER_THICKNESS = 12`, a flat white stroke that is not
  scaled to the canvas) and its strip geometry, so the centre line is the same line.
  Verified by diffing both tools' output on the same two images: outside the bug the
  canvases are pixel-identical at 2400×1200 and 1000×1000.
- Output size: 2400×1200 (2:1) or 1000×1000 (1:1).
- Logo: TODAY 75 (default) or TODAY ARCHIVES, chosen from a dropdown that is
  built from `LOGOS` in `app.js`, so another bug is one map entry.
- Every logo lands in the same box: `getLogoRect()` fits the artwork into a
  square box by its *longer* edge and centres it, rather than assuming the
  artwork is square. TODAY 75 is square and fills the box; TODAY ARCHIVES is
  1.0988:1, so on the 2:1 it renders 288×262 centred in the same 288px box —
  same optical centre, bottom edge 13px above the 75's. Switching logo changes
  nothing outside that box.
- The ARCHIVES wordmark is white with no outline or backing plate, so it reads
  over a dark photo and disappears into a light one. The 75 badge sits on a
  solid circle and reads on anything.
- Upload one image (button or drag-and-drop); it is cover-fitted to the frame, drag to reposition and use the zoom slider to scale.
- Bug corner: bottom-left or bottom-right (bottom-right by default, matching the reference example).
- The bug is fixed — its rect comes only from constants, the chosen corner and the output size, and it has no hit test, so dragging always moves the photo underneath and never the logo.
- Bug geometry derives from the approved 2400×1200 reference (288px, 72px from the side, 90px from the bottom). Size scales with the geometric mean of the frame (`288 / sqrt(2400*1200)`), so it keeps the same visual weight in any aspect — 288px on the 2:1, 170px on the square. Margins are multiples of the bug itself (72/288 and 90/288), which reproduces the reference exactly and carries over to any format; per-axis fractions of the canvas would not survive the aspect change.
- Artwork lives at `assets/today-75-logo.png` and `assets/today-archives-logo.png`, each pre-trimmed to its alpha bounds
  (the source carries uneven transparent padding that would otherwise skew size
  and margins) and downscaled to 576px. `assets/today-vault-logo.png` is kept
  but no longer referenced, so the VAULT bug can be restored without redoing
  the trim.
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

#### Social Card (`/social-templates/social-card/`)

Recreates the Figma social card frame as a reusable template: drop in an image,
edit the copy, export a 1200×1500 JPG.

- Layout is measured from the supplied reference, not estimated. Text box is
  1000px wide and centred; at the reference copy the rendered baselines match
  Figma exactly — headline 1009/1074/1139/1204, dek 1276.5/1331.5, eyebrow 932,
  logo 247×34 at y1417.
- Type: eyebrow Source Sans 3 Black 38px/95%/+4% uppercase; headline Black
  100%/+1%; dek Medium 50px/110%/−2%. All white, centred, bottom-anchored.
- **Headline auto-sizes between 90px and 65px.** It takes the largest size whose
  block is at most three lines *and* stays below the card's vertical centre.
  Shrinking fits more characters per line, so longer copy needs a smaller size to
  reach three lines — that is what makes the size fall as copy grows. Copy that
  cannot reach three lines even at 65px falls back to 65 (which is what the Figma
  reference itself is: four lines at 65px). If it still will not fit above the
  centre, the UI warns rather than clipping or shrinking further.
- Eyebrow and dek are optional; leaving either empty collapses it and its gap.
- **Gradient is derived from the image.** The dominant colour of the band the
  gradient covers is pulled 70% toward `--gray-600`, so a blue image gives a blue
  slate and a warm one a warm slate, while the pull toward the brand neutral keeps
  white text readable on any photo. That rule was back-solved from the reference,
  whose bottom is exactly its own `--blue-200` mixed ~0.69 toward gray-600.
  Snapping to a palette *step* was rejected: the blue, amber and red ramps top out
  far too light for white text. Colour (auto or a ramp), start, neutralise,
  opacity and transition are all adjustable.
- Canvas type uses `'Source Sans 3 Canvas'`, self-hosted at
  `assets/fonts/SourceSans3-Variable-latin.woff2` (one variable file covers both
  weights). Canvas text must not depend on a runtime font fetch — a fallback would
  silently export off-brand type — which is why Mada is self-hosted too. The UI's
  Google-hosted Source Sans 3 is a separate family and is unaffected.
- The white lockup at `assets/logo-white.png` is `logo.png` with every opaque
  pixel painted white; the arc's ring gaps are already transparent, so they survive.

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
- **Cache busting**: every local stylesheet *and script* carries the same
  `?v=` number, bumped together on release. Versioning only the CSS once left
  the Tease Image Branding Kit serving new HTML against a cached older
  `app.js`: its new Layout buttons rendered but had no handlers, so they did
  nothing, silently, with no console error. Bump every asset or none.
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
