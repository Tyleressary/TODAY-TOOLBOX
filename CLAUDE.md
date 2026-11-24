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
- The Social Card's bubble edge inset is 60px, and that number is load-bearing
  rather than cosmetic: it is the largest inset at which a 433px bubble can be
  placed both above and below centred text. At 75 or 100 there is nowhere legal
  to put one and the bubble appears frozen. Do not raise it without re-running
  the free-space count.
- The Social Card's default-state export hash is a regression invariant:
  `643e123d7a860c45`. Changes that are meant to preserve the existing
  design must leave it byte-identical.
