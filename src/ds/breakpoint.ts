import { useEffect, useLayoutEffect, useState } from 'react';

import bands from './tokens/build/bands';

/**
 * Every band token by band, resolved: what a reader that cannot take a
 * `var(--…)` reads by name.
 */
export { bands };

export type Band = Extract<keyof typeof bands, string>;

const table: Record<string, { breakpoint: { minWidth: string } }> = bands;

/**
 * The bands, widest first as Figma's modes, each at the `breakpoint.minWidth`
 * its token set carries. Read from the sets rather than restated, so a band
 * that moves moves here with `pnpm tokens`. Empty until the set has bands.
 */
export const BANDS = Object.keys(table).map((name) => ({ name: name as Band, minWidth: parseFloat(table[name].breakpoint.minWidth) }));

/**
 * The widest band whose `minWidth` the width reaches. Below the narrowest band
 * it is still the narrowest: there is no narrower band to fall to. Undefined
 * only while there are no bands.
 */
export function bandForWidth(width: number): Band | undefined {
  return (BANDS.find((band) => width >= band.minWidth) ?? BANDS.at(-1))?.name;
}

/**
 * Keeps `data-breakpoint` on `<html>` on the band the window is in, so every
 * band token resolves to the viewport's band. A band pinned on an element
 * inside still wins for its subtree: tokens inherit from the nearest one.
 *
 * `matchMedia` rather than a resize listener, so it runs once per band crossed
 * rather than once per pixel. A layout effect, so the first paint is already
 * in the right band.
 */
export function useViewportBand() {
  useLayoutEffect(() => {
    if (!BANDS.length) return;
    const root = document.documentElement;
    const previous = root.getAttribute('data-breakpoint');
    const queries = BANDS.map((band) => window.matchMedia(`(min-width: ${band.minWidth}px)`));
    const apply = () => root.setAttribute('data-breakpoint', bandForWidth(window.innerWidth)!);

    apply();
    for (const query of queries) query.addEventListener('change', apply);
    return () => {
      for (const query of queries) query.removeEventListener('change', apply);
      if (previous === null) root.removeAttribute('data-breakpoint');
      else root.setAttribute('data-breakpoint', previous);
    };
  }, []);
}

/**
 * The band the window is in, for a reader in JS, such as a width a page
 * passes in pixels. It changes as the window crosses a band, by the same
 * queries as `useViewportBand`.
 */
export function useBand(): Band | undefined {
  const [band, setBand] = useState<Band | undefined>(() => bandForWidth(window.innerWidth));
  useEffect(() => {
    const queries = BANDS.map((b) => window.matchMedia(`(min-width: ${b.minWidth}px)`));
    const apply = () => setBand(bandForWidth(window.innerWidth));

    apply();
    for (const query of queries) query.addEventListener('change', apply);
    return () => {
      for (const query of queries) query.removeEventListener('change', apply);
    };
  }, []);
  return band;
}
