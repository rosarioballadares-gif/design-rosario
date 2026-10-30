import type { ReactNode } from 'react';
import { useViewportBand } from './breakpoint';
import './tokens/build/tokens.css';

/**
 * A passthrough: the design system needs no provider, only its stylesheet.
 *
 * It exists BEFORE there is anything to provide on purpose: `main.tsx` mounts
 * through it from the first commit, so adding a vendor provider later is an
 * edit to this file rather than a change to how the application mounts.
 *
 * The stylesheet is imported here — one import, in the one place that is
 * allowed to name the vendor. It declares variables only, and switches mode
 * on the nearest `data-theme`: a page that draws the product's components sets
 * it on its root. Its band switches on the nearest `data-breakpoint`, which
 * this keeps on `<html>`.
 */
export function DsProvider({ children }: { children: ReactNode }) {
  useViewportBand();
  return <>{children}</>;
}
