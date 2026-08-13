# TODAY Toolbox

Internal web-based tools for the TODAY show multimedia/production team. No build step — plain HTML/CSS/JS, deployable as-is (e.g. GitHub Pages).

## Running locally

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Tools

### Split Image Generator (`/split-image/`)

Builds diagonal split-image graphics for social/promo use:

- 2, 3, or 4-way split, each with a fixed evenly-spaced diagonal divider (angle is not user-adjustable).
- Output size: 2400×1200 (2:1) or 1000×1000 (1:1 square).
- Upload one image per panel; drag on the canvas to reposition, use each slot's zoom slider to scale.
- Enter a file name and export as a single flattened JPG at full output resolution.

More tools will be added to the toolbox over time, linked from the home page (`/index.html`).
