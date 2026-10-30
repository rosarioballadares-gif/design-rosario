/**
 * OKLCH and WCAG contrast, enough to move a colour's TONE without moving the
 * colour itself.
 *
 * **This exists because "one tone darker" is not a thing a ramp can express
 * here.** A palette retune in the repository this was harvested from reshaped
 * five families, and their two ends are no
 * longer the same hue at different lightness — `aqua-800` is a muted deep teal
 * and `aqua-400` is a neon mint. So the published theme's dark strategy, which
 * is to mirror the RUNG (800 becomes 400), changes the colour rather than the
 * tone. Correcting that means arithmetic on the colour itself: keep hue and
 * chroma, solve for lightness.
 *
 * OKLab rather than HSL because HSL's lightness is not perceptual — two colours
 * at the same HSL L can differ by several contrast points, so "same hue, one
 * step lighter" in HSL lands somewhere different for every family.
 *
 * Kept as its own module so a spec
 * can assert the emitted values against the same maths that produced them.
 */

const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const linear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** `#abc`, `#aabbcc` and `#aabbccdd` all read; alpha is dropped. */
export function hexToRgb(hex) {
  let h = hex.trim().replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export const rgbToHex = (r, g, b) =>
  '#' +
  [r, g, b]
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('');

export function hexToOklab(hex) {
  const [R, G, B] = hexToRgb(hex).map((v) => linear(v / 255));
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return rgbToHex(
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255,
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255,
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255,
  );
}

export function toLch(hex) {
  const [L, a, b] = hexToOklab(hex);
  return [L, Math.hypot(a, b), Math.atan2(b, a)];
}

export const fromLch = ([L, C, h]) => oklabToHex([L, C * Math.cos(h), C * Math.sin(h)]);

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => linear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** A value this maths can act on: an opaque hex and nothing else. */
export const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v.trim());

/**
 * Keep hue and chroma, move lightness until the colour sits at `target`
 * contrast against `ground`. Returns the closest achievable value.
 *
 * **Scored on the CLIPPED hex rather than on the ideal OKLab triple**, and that
 * is not a detail: a colour pushed outside sRGB comes back as a different
 * colour, and the contrast that matters is the one the screen renders. Scoring
 * the ideal value would report a ratio nothing displays.
 *
 * Sweeps both directions and takes the nearest hit, so the caller states the
 * target rather than also having to know which way the answer lies — which for
 * a set spanning several families is a fact per row, not a fact per rule.
 *
 * **`side` is not optional in practice, and leaving it out produced a near-black
 * tint that measured exactly right.** A contrast target has TWO solutions — one
 * lighter than the ground and one darker — and they are not interchangeable: a
 * tint that sits above its card is a tint, and the same ratio below the card is
 * a hole. Measured 2026-08-22, the pink subtle background resolved to `#220000`
 * at 1.333 where the intended answer was a dark rose at the same 1.333 on the
 * other side. Both are correct arithmetic and one of them is not a colour
 * anybody chose.
 *
 * **`'auto'` keeps the starting colour's side and crosses only when the target
 * is out of reach there, and both halves of that were learned by getting it
 * wrong.** Forcing every dark tint above its card is not right: `#001329` sits
 * BELOW a `#282828` card at 1.27, and it is the ground the info alert already
 * uses and measures well on. Preserving the side unconditionally is not right
 * either: `accent-navy-subtle` also starts below the card, but its target of
 * 1.64 is unreachable there — the whole span from `#151b30` down to pure black
 * only reaches 1.42 — so preserving its side walked it to `#000001`.
 *
 * A side whose best answer is off by more than a rounding step is a side that
 * cannot answer, and the other one gets asked. Text passes `'above'` outright,
 * because ink below the card tops out at 1.42 and there is no reading of that
 * which is a foreground.
 */
export function toneFor(hex, ground, target, side = 'auto') {
  const [, C, h] = toLch(hex);
  const groundLum = luminance(ground);
  const scan = (want) => {
    let best = null;
    for (let i = 0; i <= 250; i++) {
      const candidate = fromLch([i * 0.004, C, h]);
      if (luminance(candidate) >= groundLum !== (want === 'above')) continue;
      const err = Math.abs(contrast(candidate, ground) - target);
      if (!best || err < best.err) best = { hex: candidate, err };
    }
    return best;
  };
  const preferred = side === 'auto' ? (luminance(hex) >= groundLum ? 'above' : 'below') : side;
  const first = scan(preferred);
  if (first && first.err <= 0.02) return first.hex;
  const other = scan(preferred === 'above' ? 'below' : 'above');
  if (!first) return other ? other.hex : hex;
  if (!other) return first.hex;
  return other.err < first.err ? other.hex : first.hex;
}

/**
 * Mirror a step. `rung` sits some distance from `anchor` on the light side;
 * this returns the colour the same distance the OTHER way from `anchor`,
 * carrying `rung`'s own hue and chroma.
 *
 * **A hover state moves AWAY from the surface, and which way that is depends on
 * the scheme.** In light, an emphasis fill deepens on hover — `navy-1000` to
 * `navy-1100` — and on a white card deeper reads as more pressed. Copying that
 * into dark walks the fill toward the card instead of away from it: measured,
 * `#1f2847` on `#282828` is 1.02, a plane that vanishes at the moment somebody
 * points at it.
 */
export function mirrorStep(anchor, rung) {
  const [La] = toLch(anchor);
  const [Lr, C, h] = toLch(rung);
  return fromLch([Math.min(1, Math.max(0, La + (La - Lr))), C, h]);
}
