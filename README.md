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
- **Word spacing, letter tracking and kerning are three independent controls.**
  Canvas `letterSpacing` lands on the space glyph as well as on letters, so
  before this each style's word gaps were decided by its tracking: +4% opened
  the eyebrow's, −2% pinched the dek's to 0.180em, −1% pinched the serif
  headline's to 0.150em, where `Serif Headline` rendered a 6px gap on a 100px
  headline against 18px for `on of` on the same line — a 3.0× spread.

  Each style now states the **total advance of a space** in em, and the
  correction subtracts the tracking back out, so the two never move each other:
  `wordSpacing = wordSpace·size − baseSpace − tracking·size`. Values are
  headline 0.210em (both faces), eyebrow 0.240em, dek 0.200em — optical
  consistency rather than one number everywhere; tracked all-caps need the
  wider eyebrow value or they read as one run-on string. The serif's worst-case
  gap goes 6px → 10px and its spread 3.0× → 2.4×; the sans headline is
  unchanged (its correction works out to exactly 0px).

  `baseSpace()` measures `measureText(' ')` with spacing zeroed and restored,
  memoised per family|weight|size — deliberately not `width('a a') − width('aa')`,
  which also carries whatever kern the font applies between the probe letters.

  Kerning is the font's own: `fontKerning = 'normal'` on the canvas and
  `font-kerning: normal` on the overlay, with **no correction table**. An audit
  of 21 pairs at the production 100px found native kerning already active and
  doing real work (`AV` −9.2px, `WA` −11.2px), zero overlapping ink, and a
  minimum separation of 7.0px (`Ty`); checked again inside whole words, nothing
  collides. The remaining variation in word gaps is the side bearings of
  whichever letters meet — `f H` is always tighter than `i H` — and is not
  something tracking or word spacing should be used to paper over.

  Capability detection is by **behaviour, not presence**: the page probes that
  `wordSpacing`, `letterSpacing` and `fontKerning` actually reach `measureText`
  before relying on them. Without native word spacing, `measureLine()` sums word
  widths plus the target advance and `drawLine()` places each word itself — never
  each character, which would break shaping and kerning within a word. Wrapping
  measures through `measureLine()`, so lines are fitted against the spacing that
  will be drawn. No justification and no stretching: every gap on a line is the
  same width whatever the line's length.
- **Two headline fonts.** A Font control switches the headline between
  **Source Sans 3 Black**, which auto-sizes as below, and **Libre Bodoni Bold
  at a fixed 100px** (114% leading, −1% tracking) from its own Figma panel.
  Eyebrow and dek stay in Source Sans 3 at 38px and 50px either way, so the
  serif option reads as a display headline against a sans deck.

  The bottom-anchored gaps are baseline-to-baseline and so are **per style**,
  not shared: the reference's 77 and 72.5 were measured against a 65px Source
  Sans headline whose caps rise 43px, and Libre Bodoni's rise 76px at 100px —
  reusing them ran the headline straight into the eyebrow. The serif's 110 and
  91.5 were set to reproduce the reference's *visual* clearances exactly: 34px
  from the eyebrow's baseline to the headline's cap top, 22.5px from the
  headline's descender to the dek's cap top, against measured Bodoni metrics.

  Libre Bodoni is self-hosted for canvas use as `'Libre Bodoni Canvas'`, for
  the same reason as Source Sans 3 — the UI's Google-hosted Libre Bodoni is a
  separate family and is unaffected.
- **Headline auto-sizes between 90px and 65px** (Source Sans 3 only; the Libre
  Bodoni option is pinned at 100px and warns rather than resizing). It takes the largest size whose
  block is at most three lines *and* stays below the card's vertical centre.
  Shrinking fits more characters per line, so longer copy needs a smaller size to
  reach three lines — that is what makes the size fall as copy grows. Copy that
  cannot reach three lines even at 65px falls back to 65 (which is what the Figma
  reference itself is: four lines at 65px). If it still will not fit above the
  centre, the UI warns rather than clipping or shrinking further.
- **Text is edited in place.** Clicking any line on the card puts a caret in it;
  typing repaints the canvas live. The editable boxes are a transparent overlay
  laid exactly over the type the canvas draws, scaled from canvas pixels to the
  displayed size, so the canvas stays the single renderer and the preview and the
  exported JPG can never diverge. There are no separate copy fields.
- Wrapping is automatic at the 1000px box, and a word wider than the box is
  broken mid-word — without that a single long token never wraps and runs off
  both edges of the card.
- Eyebrow and dek are optional; the Show toggles collapse them and their gaps.
- **Gradient is derived from the image.** The dominant colour of the band the
  gradient covers is pulled 70% toward `--gray-600`, so a blue image gives a blue
  slate and a warm one a warm slate, while the pull toward the brand neutral keeps
  white text readable on any photo. That rule was back-solved from the reference,
  whose bottom is exactly its own `--blue-200` mixed ~0.69 toward gray-600.
  Snapping to a palette *step* was rejected: the blue, amber and red ramps top out
  far too light for white text. Three controls only — **Colour**, **Strength**
  (drives both how far the colour is pulled toward the neutral and how opaque it
  gets) and **Height** (how far up the card it reaches). The easing exponent is
  fixed at the 1.15 the reference measures.
- **Automatic editorial line breaking.** Greedy wrapping — take as many words
  as fit — is what strands widows, and on a 48-headline corpus run through the
  real pipeline **12 produced one**: `System` at 303px under a 958px line,
  `Plan` at 214px under 893px. A gated pass fixes those and leaves everything
  else alone.

  It is **gated on a genuine fault**: a one-word last line under 45% of the
  longest, or any last line under 30%. A line ending on a function word is a
  blemish, ranked on below — never a trigger. Candidates are every arrangement
  with the **same line count** whose lines fit the measure; those still at
  fault are dropped, then any whose shortest line falls under 45% of its
  longest, so a widow is never traded for dramatic unevenness. What survives is
  ranked by phrase grouping first — lines ending on an article, short
  preposition, conjunction or bare numeral — then by raggedness. Nothing
  qualifies, or the enumeration hits its cap: greedy is kept untouched.

  Two obvious designs were built, measured and rejected. Minimising line-length
  variance everywhere turned a clean descending rag (984/861/638) into a zigzag
  (720/954/810) — evenness is not the goal. Treating a function-word line
  ending as a *fault* rewrote the reference dek and destroyed that same rag to
  avoid ending on "the".

  **Isolated interior lines count too.** Looking only at the last line let the
  widow fix trade one fault for another: clearing `Today` produced an isolated
  `American` at 460px under a 990px line. A single-word line that is not the
  last, and falls under 60% of the longest, is now a fault in its own right
  and ranks ahead of phrase grouping in the scoring. The threshold catches
  `American` (46% of its longest), `Downtown` (57%) and `Determined` (59%)
  while sparing `Transforming` (66%) — a long word filling a fair share of the
  measure does not read as stranded. Across the 48-headline corpus this takes
  isolated lines from three to none.

  **The cap counts work, not just results.** `maxCandidates` bounds the
  arrangements that *succeed*, and on a headline too long to fit almost none
  do — the last line overruns the measure, so the path is dropped without ever
  being counted. The walk is exponential in line count, so the result cap
  never fired and typing a very long headline froze the page: measured at
  1.9M explored nodes for 9 lines, 11M for 10, 65M for 11 and 383M for 12,
  that last costing **65 seconds for a single keystroke**. A node budget
  (`maxNodes`) now bounds the search itself and falls back to greedy exactly
  as the result cap does. Typing a 389-character headline went from over four
  minutes, still climbing, to 6.9s end to end — about 17ms a keystroke. Every
  headline that genuinely gets typeset is far below the ceiling: the heaviest
  real case measured is 133 nodes against a budget of 20,000, so no current
  output changes, and the default card's pixels are unmoved.

  Because the line count is fixed to greedy's and the pass runs after the size
  sweep, it **cannot** move the font, size, tracking, word spacing, kerning,
  leading, the gaps between blocks, the ≤3-line rule or any baseline. Only
  where words break. The Typeset toggle turns it off and restores plain greedy
  exactly.

  **One narrow exception.** Some copy has no fault-free arrangement at Libre
  Bodoni's fixed 100px at all: in `The Quiet Revolution Transforming American
  Kitchens Today`, `Revolution Transforming` measures 1175px and `Transforming
  American` 1130px against a 1000px measure, so `Transforming` is stuck alone
  whatever the engine does, and only two 4-line arrangements fit — a widow or
  an isolated word. There the serif steps down 1px at a time to a floor of
  85px, taking the largest size whose composition is fault-free and still
  fits; this headline lands on 88px as 871 / 995 / 631. Exactly one of the 24
  serif corpus headlines steps at all. **Overflow is not a trigger**: copy too
  long for the text area still warns at 100px and is never shrunk.

  There is no grammar model: "phrase grouping" is the function-word, numeral
  and isolation rules above. They are real editorial conventions and catch the
  common cases, but they cannot recognise an arbitrary noun phrase — and in a
  title-case headline every word is capitalised, so there is no signal to tell
  an adjective from the noun it modifies without a part-of-speech tagger.

  The overlay is given the canvas's breaks as newlines (`.edit-text` is
  `pre-wrap`), because the two previously agreed only by both being greedy.
  That rewrite is allowed **only** as a whitespace-for-whitespace swap at
  identical positions — never a change in length. Anything else is refused,
  since rewriting there would eat the character just typed. Equal length also
  means the caret offset survives untouched.
- **The editable's text is the single source of truth, and the canvas renders
  it verbatim.** This is what makes the caret reliable. Previously the canvas
  drew `readEditable()`'s normalised text — `\s+` collapsed, ends trimmed —
  while the overlay held the raw text. The newline mirror above can only apply
  when the two are the same length, so the moment they differed the mirror was
  refused and the overlay fell back to the browser's own greedy wrapping while
  the canvas used engine-chosen breaks. The two layers then disagreed about
  which words were on which line. Measured, caret against glyph: **0px on
  clean text, but 551px with a trailing space, and 722–891px on a long
  headline** — and a trailing space exists for the interval after every space
  the user types. With a double space the canvas's lines were not even
  substrings of the overlay's text, so no mapping existed at all.

  Now line breaking runs on **break-opportunity indices** into the raw string:
  a break consumes exactly one whitespace character and the overlay gets `\n`
  in its place, so the mirror is length-preserving *by construction* and
  always applies. Lines may carry a leading or trailing space when the user
  typed a run of them, and the canvas centres them including that space —
  which is exactly what CSS `pre-wrap` does, verified at 364.4px on both
  sides. Caret and glyph now measure **0px apart in every state**.

  Normalisation happens **once, on blur**: while a block has focus you see
  precisely what you typed, and clicking away collapses repeated spaces and
  trims the ends so the card and the JPG are clean.

  The eyebrow needed its own fix: the canvas uppercases it while its overlay
  was `text-transform: none`, so the two measured different glyphs —
  `Breaking news today` is 386.2px against 432.7px — drifting the caret up to
  23px. The overlay now carries the matching transform. Uppercasing is
  length-preserving for Latin, which is what keeps those offsets one-to-one; a
  character whose uppercase form is longer, such as German `ß` → `SS`, would
  shift the eyebrow caret by one.

  The one case the mirror cannot cover is a single token wider than the whole
  measure, where the break falls inside a word and cannot be a
  whitespace-for-whitespace swap. There the browser breaks the word itself and
  any drift is bounded by that word.

  `placeEditable()` also writes a style property only when its value actually
  changed, so the active element's geometry is not churned on every keystroke.
- **Text layout: two independent settings.** **Align** (Left / Center) and
  **Place** (Bottom / Top / Center), freely combinable. Center/Bottom — the
  default, and what the buttons used to call Original — reproduces the
  existing design exactly, pixel for pixel with before the feature existed.

  Both reference the inset the text box already sits in, `(1200 − 1000) / 2 =
  100px`, as the left edge and as the top safe margin; no new margin is
  invented. *Align: Centre is identical to Original by construction*, since the
  card is already centred — the meaningful distinction is Left. Alignment only
  chooses where a line starts: the gaps inside it are the style's own, never
  stretched, and there is no justification.

  The three blocks are **one composition**. Placement shifts every baseline by
  a single offset, so every internal gap survives untouched — verified
  identical across all nine combinations. The text area runs from the top safe
  margin down to wherever the group's ink bottoms out in the original
  composition, i.e. the logo's existing clearance, so Centre is exactly half
  the Top offset and neither can push text into the logo. The logo is drawn
  from its own unshifted `logoTop` and never moves.

  Auto-sizing keeps the ≤3-line rule, but its vertical limit follows the
  placement: the original bottom-anchored composition still may not cross the
  card's centre, while Top and Centre work above it and are instead bounded by
  the group having to fit the text area. The fit test is on the group's height
  (pre-shift), so it asks "does this fit?" rather than "where was it moved to?".
  Copy that will not fit still warns rather than clipping.

  One consequence worth knowing: Top placement lifts the text clear of the
  gradient, so on a bright image white text can lose contrast there. The
  gradient Height control is the lever for that.
- **The gradient is optional.** The Gradient checkbox is the Colour group's own
  label, which is what keeps the control bar to one row — a sixth group, or a
  third item in Show, would wrap it and cost the page its one-screen fit. Off,
  the card is the flat photo and the dropper, swatch, Strength and Height are
  disabled; the picked colour is remembered, so turning it back on restores
  exactly what was there.
- **Colour is a dropper.** Arm it and click anywhere on the card to take the
  gradient colour from that point; a loupe magnifies the pixels under the cursor
  while you aim, and the chip shows the source hex beside a dot of the colour that
  actually lands on the card. Reset returns to the automatic colour, which is the
  default. A picked colour goes through the same Strength-driven pull toward the
  neutral as the automatic one, so readability holds by default and Strength keeps
  one meaning — at Strength 0 you get the pure pick. Three things this has to get
  right, and each has a test:
  - It samples an offscreen layer holding **only the photo**, drawn through the
    same transform the card uses. The visible canvas is photo + gradient + text
    composited, so sampling that in the lower half would read a colour the
    gradient had already tinted and every further pick would drift greyer.
  - Arming sets `pointer-events: none` on **both** `.edit-layer` and `.edit-text`.
    Setting it on the parent alone does nothing, because a child that re-enables
    it stays hit-testable — and the editable text covers most of the lower half of
    the card, which is exactly where people pick.
  - Pan-drag shares the pointer, so it stands down while armed. One pointer path
    covers both inputs: a desktop click is a down and up in one place and reads as
    click-to-pick, while on touch you drag to aim and lift to commit.

  Esc or a second click on the button cancels. There is no keyboard picking —
  a point on a photograph is not a keyboard target — so the button and reset are
  focusable and the automatic colour remains the keyboard-reachable default.
- Canvas type uses `'Source Sans 3 Canvas'`, self-hosted at
  `assets/fonts/SourceSans3-Variable-latin.woff2` (one variable file covers both
  weights). Canvas text must not depend on a runtime font fetch — a fallback would
  silently export off-brand type — which is why Mada is self-hosted too. The UI's
  Google-hosted Source Sans 3 is a separate family and is unaffected.
- The white lockup at `assets/logo-white.png` is `logo.png` with every opaque
  pixel painted white; the arc's ring gaps are already transparent, so they survive.
- **The page is laid out for one screen.** Image, Colour, Strength, Height and the
  Show toggles share a single control bar above the card, File name and Download
  sit on one row directly beneath it, and the vertical rhythm is tightened against
  the shared sheet — page-locally, in `social-templates/social-card/style.css`, so
  no other tool's spacing moves. The page measures 1171px tall at 1440px wide,
  down from 1804px. The only line under the card is the edit hint; the size
  readout is gone and the note below the card now appears solely to carry the
  too-long-copy warning.

More tools will be added to the toolbox over time, linked from the home page (`/index.html`).

  **Image bubbles.** Up to two circular photo bubbles can be dropped on the
  card. The geometry is measured off the supplied reference, not estimated:
  outer diameter **433px**, a **5.5px** pure white ring and so a **422px**
  photo aperture, with no shadow — a circle fit to the reference's ring gave
  a radius SD of 0.67px, and the rendered card reproduces 433.0 / 421.1 / 5.9
  by the same 50%-luminance method.

  A bubble is the same four-field record as the background photo
  (`img`, `scaleMultiplier`, `panX`, `panY`) plus a centre, so
  `panelImageMetrics` and `drawPanelImage` drive it unchanged — cover fit,
  zoom, and pan clamped so no edge can be revealed. The image is cover-fitted
  to the **outer** square rather than the aperture, so it covers every pixel
  the clip can expose and nothing bleeds through the ring's inner edge. The
  decoded image is kept at natural size for its whole life, so twenty zoom
  steps and one zoom step to the same value export byte for byte.

  **The ring is a disc under the photo, not a stroke over it.** It began as
  the obvious construction: clip the photo at the outer radius, stroke 5.5px
  of white over its last few pixels. That composites the boundary pixel
  twice. The clip leaves it part photo and part background, then the stroke's
  own antialiasing lays only partial white on top, so a fraction of the photo
  survives *outside* the white — and where the photo is dark it reads as a
  grey halo. Measured on a near-black photo against the flat light blue
  background: 359 pixels in the annulus below the background level, the worst
  **61 levels** down on one bubble and **76** on the other, and the ring
  itself eaten back to **4.54px** of its 5.5. Filling a solid white disc at
  216.5 first and clipping the photo to the 211px aperture means the only
  thing that ever meets the background is white. The fringe goes to zero
  pixels, the ring measures **5.43px** against the reference's own 5.79, and
  the photo inside the aperture is byte for byte what it was — the fix is at
  the edge and nowhere else.

  **Downscaling is one pass, deliberately.** A progressive halving pre-pass is
  the usual advice for large reductions, and measured here it is the wrong
  advice: against a sine chirp at the bubble's own 3.7:1 ratio it loses
  contrast *below* Nyquist, where the real detail is — 0.93 → 0.89 at a 6.5px
  output period, 0.84 → 0.73 at 3.25px. The browser's own resampler, given
  the decoded original in a single `drawImage`, keeps more. `imageSmoothing`
  stays `high`, and it is set inside the bubble's `save()` so the background
  photo's resampling is untouched.

  **Export quality is 1, for colour rather than for bytes.** Chrome's canvas
  JPEG encoder subsamples colour 4:2:0 at every quality below 1 — readable in
  the file's own SOF sampling factors, `2x2 1x1 1x1` up to 0.99 and
  `1x1 1x1 1x1` at 1 — so chroma detail is capped however high the quality
  goes. Measured against the canvas the export is made from: chroma error
  35.6 dB at 0.92, still 36.3 dB at 0.99, then 54.6 dB at 1. Inside a bubble
  the whole error goes **31.9 → 50.3 dB**, which is the difference between a
  photograph that has been through a visible lossy pass and one that has not,
  and it shows most where colour carries the detail — skin, lips, eyes. The
  cost is about 4.5x the file: 112 KB → 522 KB for a card with no photo,
  180 → 812 KB with one bubble, 545 KB → 2.3 MB for a background photo and
  two bubbles.

  Bubbles draw above the background and the gradient and **below all type and
  the lockup**, so neither can be covered by construction rather than by
  guard arithmetic. With no bubble added the draw call is two null checks, and
  the default card's pixels are unchanged.

  **Guard rails.** Four, all hard. The card edges hold the centre inside
  276.5–923.5 × 276.5–1223.5, a 60px inset. The lockup and every line of
  type need 40px of clearance; the two bubbles stay 449px apart, centre to
  centre. 40px is measured, not guessed: a bubble over the lockup's x-range
  bottoms out at `1417 − 40 − 216.5 = 1160.5`, which is exactly the reference's own
  left-bubble centre, and the design's dek-to-logo air (~74.5px ink to top)
  corroborates the range from the other side. A blocked bubble is pushed
  straight back out of whatever it touches by the shortest distance, so it
  hugs the boundary instead of sticking, and the restricted zones show as
  dashed outlines while dragging.

  **Why the inset is 60 and not 100.** It began as the text column's own 100px,
  which is where the reference's left bubble sits — but the two are different
  ideas, and with centred text they conflict. A bubble needs its 433px plus
  40px of clearance either side, and centred copy splits the card into bands
  that are just too short. Counting legal centres on an 8px grid over a default
  centred card: **at 100 there are none at all**, so the bubble cannot move and
  reads as stuck behind the type; at 80 there are 3 and at 75 there are 4, all
  in a sliver below. 60 is the largest inset that opens room on both sides —
  18 above and 15 below — and it still keeps the whole ring 60px clear of every
  edge. A test pins the both-sides count so the number cannot drift back up.

  Crossing the type was never a drag-model problem: `onBubbleMove` hands
  `placeBubble` the pointer's absolute position rather than an increment, so a
  bubble jumps to the far side the moment a legal centre exists there. It had
  nowhere to land, not no way to travel.

  The text guard works from `textBoxes()`, which derives a rect per line from
  the same `measureLine` and `metrics` the renderer uses — so a short line
  really does leave room beside it. Vertical extents come from the style's
  ascent and descent rather than the line's own ink, or the boundary would
  jump 20px whenever a line happened to be all lowercase. Text always wins:
  when copy grows into a placed bubble the bubble slides to the nearest legal
  centre and says so. Nothing in `layout()` reads the bubbles, so a bubble can
  never move a baseline, a line break or the chosen size — asserted by
  comparing the whole layout object with zero, one and two bubbles.

  **Chrome is an SVG over the canvas, not canvas drawing.** Selection rings
  and keep-out guides therefore cannot reach `toDataURL` — no export flag and
  no change to the download handler — and a hit circle sits above the editable
  layer, so a click on a bubble is never swallowed by the contenteditable
  while the existing eyedropper and background-pan handlers keep working
  untouched. The hit circles are created once per bubble and only have their
  attributes updated: rebuilding them each render dropped keyboard focus
  between two arrow presses and tore up the pointer capture holding a drag
  together.

  Drag a bubble to move it; click a selected bubble, or double-click, to enter
  adjust mode, where dragging pans the photo inside the fixed frame and the
  wheel zooms. Shift+drag pans without entering the mode. The wheel is only
  trapped in adjust mode, because at 420px the page genuinely needs to scroll.
  Arrows nudge 1px and 10px, Enter toggles adjust, Delete removes, Escape
  steps back out. Two consequences worth knowing: the dropper samples the
  background photo only, so clicking "on" a bubble picks what is behind it
  (correct — the gradient is a property of the background), and type sitting
  under a bubble cannot be clicked to edit, though Tab still reaches it.

## Proofreading

A Word-style checker built into every tool that takes copy: red squiggles for
spelling, blue for grammar, purple for punctuation, a popup with the
explanation and a one-click fix, and a counter that collapses to nothing when
the copy is clean. `assets/proofreader.js` is the engine (pure, no DOM),
`assets/proofread-ui.js` the interface, `assets/proofread.css` the marks.

**The dictionary** is SCOWL's hunspell `en`, 49,568 stems expanded through 59
suffix and 14 prefix rule groups into **123,778 inflected forms**. It is
front-coded — each line gives the number of characters it shares with the line
before — which takes it from 1.19MB to 582KB on disk and **195KB over the
wire**, with a six-line decoder. It is fetched on the first focus of a text
field, so a page nobody types on downloads nothing, and if the fetch fails
spelling stands down while the grammar and punctuation rules, which need no
dictionary, carry on. SCOWL's licence is committed beside the data as it
requires. `assets/dictionary/today-terms.txt` carries the names the general
dictionary lacks and ships to the whole team; "Add to dictionary" saves to the
browser on top of it.

**Suggestions** are ranked by frequency first, then by the cost of the slip:
leaving a letter out is much the commonest mistake, so restoring one outranks
changing one. That ordering is what makes `wich` give `which` before `with`.
The affix file's REP table of phonetic confusions is priced as a cheaper
substitution rather than an override — as a flat discount it put `wish` first
instead. Candidates are generated only when a popup opens, never while typing;
the typing pass is a set lookup per word and runs in 0.10ms on a 400-character
headline.

**Registers.** Headlines and eyebrows are deliberate fragments, so the
sentence-level rules (terminal punctuation, sentence capitals, comma splices)
run only on prose fields — in practice the Social Card's dek. Everything else
is display copy.

**Left out on purpose**, rather than faked: sentence fragments (they are the
product here), general run-on and missing-comma detection, general
subject–verb agreement beyond closed-class pronouns, and "awkward phrasing".
None can be made precise without a parser. Straight quotes, `...` and `--` are
not flagged either, because the punctuation converter fixes them a moment
later — flagging them would be nagging about the toolbox's own pending work.

**Three false positives found by testing against real copy**, each of which
would have made the tool worse than nothing. Every contraction in finished
copy was flagged, because the toolbox writes curly apostrophes and the
dictionary stores straight ones; the two are now folded together before
lookup. Conversational clipped forms — `goin’`, `talkin’`, `y’all`, `ok` —
were flagged, so a word ending in "in" whose "-ing" form is known is now
accepted, while nonsense still is not. And an accepted fix inherited the wrong
case, turning "Their is" into "there is".

**Marks never touch the edited text.** They are drawn from `Range` rects into
a separate layer, so they cannot move a caret or a selection, and they cannot
reach an export: on the Social Card the layer is DOM rather than canvas, and
on the Calendar it is a sibling of the artboard, outside the subtree the
export clones into its `foreignObject`. Accepting a correction changes the
text's length, which the Social Card's typing path forbids, so it commits the
way the blur tidy-up does — write the block, put the caret after the
replacement, repaint.

The browser's own spellcheck is switched off wherever the checker runs. On the
Social Card it was painting squiggles under text that is transparent, with the
real glyphs on the canvas carrying none; the Calendar was forcing it on for all
72 of its editable nodes.

## Punctuation and typography

Straight quotation marks, double hyphens and three-period ellipses must never
reach a finished graphic. The full standard is recorded in `CLAUDE.md`; the
mechanism is `assets/smart-punctuation.js`, a single shared converter loaded by
every tool that places free text on an image: the Social Card (eyebrow,
headline, dek), Word Explain (the word) and the Challenge Calendar (band title,
day label, day fills). The other three tools take only a filename, which never
appears on the image.

It exposes `window.smartPunctuation(text)` and, for the pre-delivery proofread,
`smartPunctuation.findStraight(text)`.

- Three or more periods become `…`.
- Ranges become an en dash: `2025-2026`, `Monday-Friday`, `9 a.m.-5 p.m.`
- `--`, and a hyphen standing alone between words, become an em dash, set
  closed up with no surrounding spaces, per American editorial style.
- `"` and `'` become curly by context. An apostrophe between or after
  alphanumerics is `’`; at the start of a word it is `’` before digits
  (`’90s`) or a known elision (`’n`, `’tis`, `’em`, `’cause`, `’round`,
  `’til`) and an opening `‘` otherwise.
- Hyphens are otherwise left alone: `award-winning`, `behind-the-scenes` and
  `first-ever` keep theirs.

**Rule order is load-bearing.** The en-dash range rule runs before the
spaced-hyphen em-dash rule. Reversed, `9 a.m. - 5 p.m.` turns into an em dash
before the range rule ever sees it. The `--` substitution also leaves its
surrounding spaces behind, so a closing pass strips literal spaces either side
of an em dash — literal spaces only, because a newline there is a line break the
Social Card depends on.

Conversion runs on **paste** and on **blur**, not on every keystroke: it reuses
the commit-on-blur that already normalises whitespace, so no new
caret-shifting logic enters the editor. Straight quotes are visible while you
type a block and turn curly when you click away. The Social Card's Download
handler also commits any still-focused block and re-renders before reading the
canvas, so an export cannot carry straight punctuation even if blur has not
fired. The converter is idempotent by construction and by test, since it runs
again on every blur.

Known limits: `5'10"` becomes `5’10”`, not the primes `5′10″` — primes are outside
the stated standard and are not invented here. Quote direction is contextual
rather than parsed, so something unusual may still need a manual fix. And a
hyphen used as a deliberate separator between words becomes an em dash, because
a spaced hyphen between words is exactly the incorrect form the standard names.

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
