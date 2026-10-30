/**
 * Types for `build-tokens.mjs`, so `tokens.spec.ts` builds under `tsc -b` —
 * the reason is the one `color.d.mts` records.
 */
export const OUT: string;
export const PREFIX: string | null;
export const MODES: readonly string[];
export const BANDS: readonly string[];
export function readConfig(root?: string): {
  prefix: string | null;
  modes: string[];
  defaultMode: string | null;
  bands: string[];
  defaultBand: string | null;
};
export function tierOf(filePath: string): 'primitive' | 'semantic' | 'component';
/** Every file `build/` should hold, as path → content. */
export function buildTokens(): Promise<Map<string, string>>;
