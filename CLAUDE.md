# TODAY Toolbox — working rules

## Typography and punctuation: a mandatory standard

Every graphic this repository produces, and every piece of copy written for
one, uses real typographic punctuation. This is a quality-control standard,
not a design preference. It is applied automatically, every time, without
being asked.

### 1. Curly quotation marks and apostrophes — always

- Double quotes: `“ ”` — never `"`
- Single quotes and apostrophes: `‘ ’` — never `'`

Correct: `The chef said, “It’s the best dish we’ve made.”`
Incorrect: `The chef said, "It's the best dish we've made."`

### 2. Em dash `—`

For a break in thought, an abrupt shift, or an emphatic aside. Set it
closed up, with no spaces either side, per standard American editorial
style.

Correct: `This dish—rich, smoky, unforgettable—defines the menu.`
Incorrect: `This dish - rich, smoky, unforgettable - defines the menu.`
Incorrect: `This dish -- rich, smoky, unforgettable -- defines the menu.`

### 3. En dash `–`

For ranges and spans only.

Correct: `2025–2026`, `Monday–Friday`, `9 a.m.–5 p.m.`
Incorrect: `2025-2026`, `Monday-Friday`

### 4. Ellipsis `…`

One character, never three periods.

Correct: `And then…everything changed.`
Incorrect: `And then...everything changed.`

### 5. Hyphens `-`

Only where grammar calls for one: compound modifiers and hyphenated words.
Never as a substitute for an em dash or an en dash.

Correct: `award-winning`, `behind-the-scenes`, `first-ever`

### 6. Copied and pasted text is never trusted

Text pasted from anywhere — a CMS, a doc, an email, a message — is assumed
to carry straight quotes, double hyphens and three-period ellipses. It is
converted on arrival. Wording, spelling, meaning and intended punctuation
are preserved exactly; only punctuation *characters* change. Approved copy
is never rewritten to suit these rules.

### 7. Final proofread before anything is presented or exported

Before a graphic is shown, described or exported, its text is checked for
straight quotes, straight apostrophes, three-period ellipses, double
hyphens and spaced hyphens. The same check applies to copy written in
conversation.

### 8. Non-negotiable

Apply automatically. Do not wait to be asked, and do not treat a violation
as a stylistic choice.

## The mechanism

`assets/smart-punctuation.js` is the single shared implementation. It
exposes `window.smartPunctuation(text)` and
`smartPunctuation.findStraight(text)` (the proofreading scan). Every tool
that puts free text on a graphic loads it and converts on paste and on
blur, before rendering.

Rule order inside the converter is load-bearing: ellipsis, then en dash
(ranges), then em dash, then quotes. The en dash must run first, or
`9 a.m. - 5 p.m.` becomes an em dash before the range rule can see it.

Any new tool that accepts free text loads the same file and wires the same
two events. Do not reimplement the rules locally — three copies would
drift.

### Known limits

- `5'10"` becomes `5’10”`, not the primes `5′10″`. Primes are outside the
  stated standard and are not invented here.
- Quote direction is contextual, not parsed. The elision list (`’n`,
  `’tis`, `’em`, `’cause`, `’round`, `’til`, …) covers the common cases;
  something unusual may still need a manual fix.
- A hyphen used as a deliberate separator between words becomes an em dash,
  because a spaced hyphen between words is exactly the incorrect form the
  standard names.

## Proofreading

`assets/proofreader.js` checks spelling, grammar and punctuation;
`assets/proofread-ui.js` draws the marks and the popup. Every tool that takes
copy loads both, and the dictionary under `assets/dictionary/` is fetched on
the first focus of a text field, never at page load.

The engine is **cautious on purpose**. These are display graphics: headlines
are fragments by design, eyebrows are shouted in caps and the copy is
conversational, so a checker that nags at correct editorial writing is worse
than none. Each field declares a register — `display` or `prose` — and the
sentence-level rules run only on prose.

Three standing rules for anyone extending it:

- **Never flag what another part of the toolbox fixes by itself.** Straight
  quotes, `...` and `--` are converted automatically on paste and on blur, so
  the proofreader leaves them alone.
- **Never widen a rule that cannot be made precise.** Sentence fragments,
  general run-on and missing-comma detection and "awkward phrasing" are left
  out rather than faked — none can be done without a parser, and a regex
  imitation flags good copy. A new rule ships with a true positive *and* a
  near-miss it must not flag, both in the test corpus.
- **Never rewrite the writer's words without a click.** The engine only ever
  returns issues; the only code that writes to a field is the Accept button.

Known decisions, so they are not mistaken for bugs: British spellings are
flagged with the US form first, because this is a US newsroom; the dictionary
is SCOWL's, whose licence is committed beside it and requires attribution; and
names the general dictionary lacks belong in `assets/dictionary/today-terms.txt`
so the whole team gets them, rather than in one person's browser.

## Repository conventions

- Plain static HTML, CSS and JS. No build step, no bundler, no framework.
- One folder per tool; GitHub Pages serves `main` directly.
- Local assets carry a `?v=N` cache-busting query. Bump the version on a
  page when its own scripts or styles change.
- `editorial-templates/calendar/calendar.css` is not edited.
- The Social Card's black lockup `assets/logo-black.png` is pre-sized from the
  official artwork by `assets/logo-black.build.py`, and must stay that way.
  The supplied original is 11723x1671: drawing it at the card's 247x34 costs
  136ms a render against a ~37ms keystroke budget, and its transparent
  padding would shift the mark. Both lockups are 720x98 so `logoRect()` is
  identical for either — the dek gap and the bubble guard both read that
  rect, so a file of another size would move the composition.
- The Social Card's type colour is one assignment in `drawLines()`, which is
  the only place card type is coloured — add no second one; the colour
  arrives as an argument. The body (headline and dek) is White or Charcoal;
  the eyebrow follows it unless overridden to Blue or Red. Automatic is
  `null`, never a copy of the body colour, and the drawn colour is resolved
  as `eyebrowInk || ink` at paint time — copying it instead would let an
  automatic eyebrow fall out of step or an override be overwritten. The
  overlay's caret and placeholder read `--card-ink` / `--card-ink-dim`, set
  on the stage for the body and on the eyebrow element for itself.
- The Social Card's contrast note is advisory and must stay that way: colour,
  gradient and placement never adjust each other. It samples the backdrop
  BEFORE the type is drawn — measured afterwards the type is part of its own
  backdrop, reading high for dark ink and low for light ink — and each colour
  is judged against the blocks it actually paints.
  White is exempt while the gradient is behind it, and that is measured, not
  lenience: the scrim exists for white, and the reference design puts white
  over its thin upper part at 1.6–1.8:1, so judging white there would open
  the tool with a warning about the design itself. With no scrim (Centre
  placement, or the gradient off) white is judged like any other colour.
  Do not "fix" the exemption without re-measuring the default card.
- The Social Card's gradient has no position control and must not be given
  one: it is derived from Place. Bottom keeps the reference's bottom-up ramp,
  Top mirrors it, Centre draws none. `gradSide()` is the single source of that
  truth and `gradientOn()` combines it with the user's checkbox; the colour
  sampling band follows the same rule. The bottom case's arithmetic
  (`gradStart() * H`, `H - startY`) is left exactly as written — the
  algebraically identical `height * H` differs by an ulp and moves the
  default card's pixels.
- The Social Card's bubble edge inset is 60px, and that number is load-bearing
  rather than cosmetic: it is the largest inset at which a 433px bubble can be
  placed both above and below centred text. At 75 or 100 there is nowhere legal
  to put one and the bubble appears frozen. Do not raise it without re-running
  the free-space count.
- `social-templates/social-card/` is the **Carousel Builder** now: a workspace
  of many cards around the same single card engine. `app.js` renders the card
  and binds element ids, never a layout, which is why the workspace could be
  built around it without forking it — keep it that way. `carousel.js` owns
  the cards, the rail, the style selector and the toolbar slot, and reaches
  the card only through `window.__card`.
- One engine, one live card. A page can hold exactly one instance of the card
  because it binds ids, so a second card is a second state object, not a
  second renderer: `getState()` / `setState()` swap the whole document in and
  out. Add a field to the card and it must join `getState()`, or that field
  will leak from one card to the next.
- The workspace's own layout rules, replacing the one-row control bar's page
  height of 1244 and row heights of 71/61, which no longer exist: at 1440x900
  the card keeps its 4:5 aspect and the download row stays on screen, the rail
  and the toolbar scroll inside themselves, and below 1040px the three columns
  stack. That breakpoint is not cosmetic — without it the style bar overlaps
  the card at phone widths and a click on the card's top-left lands on a
  style button.
- The Social Card's default state is a regression invariant, at two levels.
  The canvas pixels hash `a14fcf56d18e9ea3`; that is the design itself and
  must not move. The exported file hashes `dadee5dc637029f2`. The older
  number `643e123d7a860c45` is the same pixels encoded at the old JPEG
  quality of 0.92, which is why `card-hash.js` still prints it: it is a
  pixel probe, not an export probe. Changes that are meant to preserve the
  existing design must leave all of these byte-identical.
- The Social Card exports at JPEG quality 1, and that is not a round-number
  flourish. Chrome's canvas encoder subsamples colour 4:2:0 at every quality
  below 1 and writes 4:4:4 only at 1, so colour detail is capped however high
  the quality goes: chroma error measured against the canvas is 35.6 dB at
  0.92 and still 36.3 dB at 0.99, then 54.6 dB at 1. Lowering it to save
  bytes reintroduces the softness it was raised to remove.
- Bubble rings are a white disc drawn UNDER the photo, with the photo clipped
  to the aperture — never a stroke over a photo clipped to the outer radius.
  Stroking composites the boundary pixel twice and leaves a grey halo around
  the circle, measured at 61–76 levels below the background on a dark photo.
  The photo is also drawn in one pass from the decoded original: a step-down
  pre-pass sounds like a sharpening measure and is the opposite, costing
  contrast below Nyquist (0.93 → 0.89 at a 6.5px period).
