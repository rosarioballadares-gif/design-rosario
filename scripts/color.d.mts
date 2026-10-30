/**
 * Types for `color.mjs`.
 *
 * **It exists because `pnpm test:run` cannot see this and `pnpm build` can.**
 * The suite transpiles without checking types, so importing an untyped `.mjs`
 * from a spec is green there and fails `tsc -b` — which is the one local command
 * that reads types, and the lesson CLAUDE.md already records. Measured again
 * 2026-08-22, with 529 tests passing over a branch that would not build.
 *
 * `.d.mts` rather than `.d.ts`: TypeScript resolves a `./color.mjs` specifier to
 * `./color.d.mts` and does not fall back to the other extension.
 */

/** A colour in OKLab: perceptual lightness, and the two opponent axes. */
export type Oklab = [L: number, a: number, b: number];
/** The same in cylindrical form: lightness, chroma, hue in radians. */
export type Oklch = [L: number, C: number, h: number];

export function hexToRgb(hex: string): [number, number, number];
export function rgbToHex(r: number, g: number, b: number): string;
export function hexToOklab(hex: string): Oklab;
export function oklabToHex(lab: Oklab): string;
export function toLch(hex: string): Oklch;
export function fromLch(lch: Oklch): string;
export function luminance(hex: string): number;
export function contrast(a: string, b: string): number;
export function isHex(value: unknown): boolean;

/**
 * Keep hue and chroma, move lightness until the colour reads at `target`
 * contrast against `ground`. `side` says which side of the ground the answer
 * must sit on; `'auto'` keeps the starting colour's side and crosses only when
 * the target cannot be reached there.
 */
export function toneFor(
  hex: string,
  ground: string,
  target: number,
  side?: 'above' | 'below' | 'auto',
): string;

/** The colour as far the other side of `anchor` as `rung` sits on this one. */
export function mirrorStep(anchor: string, rung: string): string;
