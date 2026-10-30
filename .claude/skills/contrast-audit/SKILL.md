---
name: contrast-audit
description: Shipping a colour, a screen or a chart series, or any "that token passes AA" claim that names no surface.
---

# contrast-audit

**The rule everything else follows from: a foreground token is often not a colour,
it is an alpha over whatever sits behind it.** A token that resolves to a black at
partial opacity has no contrast ratio of its own — its contrast is a function of the
surface. The same token over white and over a light grey card are two different
measurements.

> A statement of the form "that token passes AA" is not a weak claim, it is a
> **category error**. The claim has to name a surface, and if it does not, it has
> not been measured.

## There is no instrument here, and that is the point of this file

The predecessor repo had two scripts and a captured evidence set. This repo has neither, and no
test suite at all: nothing flags a contrast defect on a build, a commit or a push. So this skill
is not only a judgement layer, it has to teach the measurement — which happens on the running page
or it does not happen.

## Read the pixel, not the token file

A value read out of a token package, or out of a theme layer in a stylesheet, is
**not** the value the pixel got. Three things happen between
them:

1. The semantic token resolves through an alias chain, and **which primitive it lands on depends
   on the active theme and colour scheme**. The name is stable while the value under it moves.
2. If the resolved value carries alpha, the pixel is that colour **composited over the first
   opaque thing behind it** — which may be several translucent layers down.
3. Any `opacity` on an ancestor multiplies through, and `getComputedStyle(el).color` does not
   reflect it. This is the blind spot that produced a real false pass in the predecessor repo: a
   label measured at full strength read 11.93:1 and was reported green, while the composited
   value under its container's opacity was 3.20:1.

Where a design system publishes an MCP server or a CLI, that is the right way to answer
"what does this token alias to" without guessing. It answers question 1. It cannot answer 2 or 3,
because those are properties of the page, not of the package.

## The measurement, as a procedure

1. **Run the app** with `pnpm dev` and open the route you are judging. Note the URL it prints.
2. **Assert the scheme and theme before measuring, do not assume them.** They are attributes on
   `<body>` in `index.html`, so in the devtools console `document.body.dataset.colorScheme` and
   `document.body.dataset.theme` tell you what you are actually looking at, and assigning to them
   (`'dark'`, or another theme name) switches it live. A run you believed was dark and was not is
   false green.
3. **Select the element** in the Elements panel so it is available as `$0`.
4. **Composite and compute** in the console. Pasting the following gives the ratio for the
   selected element's text against the first genuinely opaque surface behind it:

```js
const px = (s) => s.match(/[\d.]+/g).map(Number);           // "rgba(0, 0, 0, 0.6)" -> [0,0,0,0.6]
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
};

// Walk up collecting background layers until one is actually opaque, then composite down.
const surfaceOf = (el) => {
  const stack = [];
  for (let n = el; n; n = n.parentElement) {
    const c = px(getComputedStyle(n).backgroundColor);
    const a = c.length === 4 ? c[3] : 1;
    if (a === 0) continue;
    stack.push([c[0], c[1], c[2], a]);
    if (a === 1) break;
  }
  if (!stack.length || stack.at(-1)[3] !== 1) stack.push([255, 255, 255, 1]);
  return stack.reduceRight((bg, layer) => over(layer, bg));
};

// Fold every ancestor opacity into the text alpha.
const foregroundOf = (el, surface) => {
  let a = 1;
  for (let n = el; n; n = n.parentElement) a *= Number(getComputedStyle(n).opacity);
  const c = px(getComputedStyle(el).color);
  return over([c[0], c[1], c[2], (c.length === 4 ? c[3] : 1) * a], surface);
};

// Start at the element, NOT at its parent. A tag, a solid button or a tinted
// status pill paints its own background, and starting a level up discards it and
// composites the label against the card behind instead — which returns a HIGHER
// ratio than reality and certifies a real failure as a pass. Starting here is
// safe for the other case too: `surfaceOf` skips fully transparent layers, so an
// element that paints nothing resolves to the same surface it always did.
const surface = surfaceOf($0);
ratio(foregroundOf($0, surface), surface);
```

5. **Judge the number against the bar that element actually owes** (next section), then write down
   the pair, both values, the ratio, the route, the theme and the scheme. A ratio without that
   context is not reusable by the next person.

Two honest limits of that reading. It assumes the computed strings come back as `rgb()` or
`rgba()`; if a browser hands you `color(srgb ...)` or `oklch(...)` the parse is wrong and you must
convert first, so **look at the raw string before trusting the number**. And when an ancestor
carrying `opacity` also paints its own background, the folded value is a lower bound rather than
an exact figure — enough to fail something, not enough to clear it narrowly.

## The judgement, which no snippet does for you

**1. The bar depends on the element's ROLE, not on it being coloured.** 4.5:1 for normal text,
3:1 for large text (24px, or 18.66px at weight 700 and above) and for non-text that **carries
information** (WCAG 1.4.11). A progress track, a decorative divider, the tinted fill of a dead
zone **owe nothing** — "no bar" is a valid verdict and you should write it as one. Over-flagging
is not caution: in the predecessor repo a data palette was measured twice with the wrong bar and
reported as "10 of 13 families fail in dark", a conclusion that was simply false. The cost was not
the wrong row, it was that a table where a third of the rows is flagged teaches everyone to ignore
the flags.

**2. In a dark scheme the surface that governs is the raised card, not the page.** Charts live
inside cards. Measured in the predecessor repo on 2026-08-06: a palette shift left **42 marks
passing against the page background and 12 failing against the card**, floor 2.63. Measuring
against the page returns green across the board and warns about nothing. In light the worst case
is usually the page and in dark it usually inverts to the card, so the rule is not "use the darker
one", it is **use the most elevated surface the element actually sits on**.

**3. Adjacency between marks is a separate measurement and nothing does it automatically.** 1.4.11
judges adjacent colours, and every tool measures each mark against its background instead. In the
predecessor repo's funnel, stage 1 against stage 2 came out at 1.47:1 while every mark passed
against the card. If you are choosing a ramp, compute neighbour pairs by hand.

**4. Report exemptions, do not drop them.** Disabled controls, logotypes and pure decoration are
exempt under 1.4.3 and 1.4.11, but they belong in the output **marked exempt**. Deleting them
teaches the next reader that the 2.85:1 was never there.

## The theme caveat

A ratio is a property of **(token, surface, theme, scheme)**, and three of those four
are invisible in a sentence that names only the token.

- **A ratio measured under one theme does not transfer to another.** A theme layer
  remaps which primitive each semantic alias resolves to, so the token name in your
  note stays valid while the colour under it changes. A stored number keyed by token
  name goes silently wrong.
- **Changing the theme requires a re-measure.** This is not pedantry, it is the same
  category error one level up.

**The trap that chooses itself**, and it is worth testing first in any system: semantic
text on its own tinted background — success text on the success subtle surface, the
same for danger and warning. In the system this skill was written against those landed
between 3.8:1 and 4.0:1. Above 3:1, so fine for an icon or a border; below 4.5:1, so a
small label fails. That pairing looks obviously correct, which is why nobody measures
it.

> GAP: this product's themes and default scheme are not recorded, so nothing here
> states which one a measurement was taken under. Name it in every report until
> somebody writes the list down.

## Blind spots, so a clean pass is not read as a clean bill of health

- **Non-rest states** — hover, focus, `:focus-visible`, active, and fields carrying content or an
  error. Focus rings in particular tend to go entirely unchecked.
- **Gradients.** The compositing above reads `backgroundColor`, so a gradient behind text is
  invisible to it. Sample the worst stop and the midpoints by hand.
- **Images or video behind text.** No compositing model covers them; you read the CSS surface
  underneath and pass in silence.
- **Anything outside the routes, viewport and scheme you actually opened.** With no suite here,
  that set is exactly as small as your session was.

## Closing the loop

- **Measuring is not an argument for changing.** The most valuable result of the predecessor audit
  was a refutation: the hypothesis that alpha text failed on non-white surfaces turned out to be
  false, and the real damage was entirely in control borders and chart marks. Raising a foreground
  stop to "win contrast" would have flattened a deliberate hierarchy in exchange for nothing.
- **You cannot fix a token here.** This repo consumes the published design system and never
  patches it, so a finding has exactly two honest destinations: a **composition change** in this
  repo (a different token for the pair, the tone in the background and the text in the default
  foreground, a raised surface), or a **recorded gap** in the backlog for the design system owner,
  with the pair, both values, the ratio, the theme and the scheme written out. A finding with no
  numbers is not actionable by anyone who cannot reproduce your page.
- **State the coverage of any green.** Reporting "passes AA" without naming the routes, the
  scheme, the viewport, the theme and which elements you actually selected is the same category
  error as reporting a token with no surface. What was not looked at is not covered, whatever the
  screenshot suggests.
