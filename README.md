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
- Output size: 2400×1200 (2:1) or 1000×1000 (1:1 square). Square output only supports the 2-split layout.
- Upload one image per panel; drag on the canvas to reposition, use each slot's zoom slider to scale.
- Enter a file name and export as a single flattened JPG at full output resolution.

### Editorial Templates (`/editorial-templates/`)

A hub page collecting reusable layouts for recurring franchises and other editorial projects. Each template is a fixed, non-configurable layout so the same graphic comes out identically every time it's rebuilt.

#### Trivia Tease Template (`/editorial-templates/trivia-tease/`)

- 15-box split: 5 across × 3 down at 2400×1200, so every box is 480×400.
- Layout and output size are fixed by design — there are no split or size options.
- Fill each box with either an image or a flat color:
  - Image: upload one per box; each is cover-fitted, drag on the canvas to reposition, use each slot's zoom slider to scale.
  - Color: pick from the dropdown under the file input — all 36 palette colors (six ramps × six steps) plus white, grouped by ramp, with a swatch showing the current pick.
  - The two are mutually exclusive per box — setting one clears the other. Choosing the blank dropdown option empties the box again.
- White dividers on every seam, matching the Split Image Generator.
- Enter a file name and export as a single flattened JPG at full 2400×1200 resolution.

New templates are added as subfolders here and linked from the hub page.

More tools will be added to the toolbox over time, linked from the home page (`/index.html`).

## Design

Shared color palette and tokens live in `assets/toolbox.css` (`:root`), documented in `docs/color-palette.md`.
