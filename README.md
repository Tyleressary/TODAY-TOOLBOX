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

New templates are added as subfolders here and linked from the hub page.

More tools will be added to the toolbox over time, linked from the home page (`/index.html`).

## Design

Shared color palette and tokens live in `assets/toolbox.css` (`:root`), documented in `docs/color-palette.md`.
