import { useViewportBand } from '../src/ds/breakpoint';

/** The canvas's band on `<html>`, as `DsProvider` keeps it for the app: a story at a phone's width resolves base. */
export function ViewportBand() {
  useViewportBand();
  return null;
}
