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

More tools will be added to the toolbox over time, linked from the home page (`/index.html`).

## Design

Shared color palette and tokens live in `assets/toolbox.css` (`:root`), documented in `docs/color-palette.md`.
