/**
 * THE SEAM. Every design system import in this repository comes from here.
 *
 * The rule it enforces is one line: nothing under `src/` outside this folder
 * may import a vendor package. That is what makes the design system swappable,
 * and it is the one convention worth defending from the first commit — a repo
 * that imports the vendor from 37 files has chosen its design system forever
 * without anybody deciding to.
 *
 * Nothing checks this yet.
 * > GAP: a lint rule or a spec that fails a vendor import outside `src/ds/`.
 *   Until one exists, the convention is prose and prose does not fire.
 *
 * Read `README.md` beside this file before wiring a design system in.
 */
export { DsProvider } from './provider';
export { bandForWidth, bands, BANDS, useViewportBand, type Band } from './breakpoint';
export { fontSizeOf, linearGradient, px, tokensFor, type SemanticColour } from './tokens';
