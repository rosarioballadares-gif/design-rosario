/**
 * The product's tokens for code: the semantic and component tiers, resolved
 * for one mode. Primitives are not here on purpose — a screen binds to a
 * meaning, and the meaning picks the hue.
 *
 * What each semantic token is for: `build/usage.json`, or the rule beside it
 * in `semantic/usage.json`. The architecture: .claude/skills/tokens/SKILL.md.
 * Before the `tokens` skill builds a set, every export here is empty.
 */
import modes from './build/modes';

export type Mode = keyof typeof modes;
export type Tokens = (typeof modes)[Mode];

export const tokensFor = (mode: Mode): Tokens => modes[mode];

/** A colour a component is passed, by its semantic name, and the variable that paints it in any mode. */
export { semanticColours, type SemanticColour } from './build/colours';

/** A `16px` token as the number an inline style or a layout sum takes. */
export const px = (dimension: string): number => parseFloat(dimension);

/** A text style's size, `32` from `600 32px/1.2 …`, for a layout sum. */
export const fontSizeOf = (font: string): number => parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 'NaN');

type Stops = readonly { readonly color: string; readonly position: number }[];

/** A gradient token as CSS, top to bottom. */
export const linearGradient = (stops: Stops, angle = 180): string =>
  `linear-gradient(${angle}deg, ${stops.map((s) => `${s.color} ${Math.round(s.position * 100)}%`).join(', ')})`;
