/**
 * The prototypes this repository can render, as data.
 *
 * It is the single source: `route.ts` resolves a hash against it and `Root.tsx`
 * generates the index from it. A route with no entry and an entry with no route
 * are therefore both impossible, rather than both looking fine until somebody
 * clicks.
 */
import type { ComponentType } from 'react';

export interface Prototype {
  /** The hash segment. Kebab-case, and stable — a link somebody saved. */
  readonly id: string;
  /** What the index calls it. */
  readonly title: string;
  /** One line under the title. What it shows, not how it was built. */
  readonly summary: string;
  /**
   * A closed set for the SECOND hash segment — `#/dashboard/empty`.
   *
   * Screen states belong here rather than behind a network call: a state you
   * can only reach by waiting is a state nobody captures, reviews, or notices
   * regressing. A prototype designed only in its full state, with plausible
   * data in every slot, has been illustrated rather than designed.
   */
  readonly variants?: readonly string[];
  /** A page of the product's site, which the index lists. The rest keep
   *  their route and are reached by link only. */
  readonly site?: true;
  /** Ids it answered to before a rename, so a saved link still opens it. */
  readonly aliases?: readonly string[];
  readonly render: ComponentType<{ variant?: string }>;
}

/** Every prototype, one entry each. The `sandbox` skill adds the first. */
export const PROTOTYPES: readonly Prototype[] = [];

/** One prototype by id or by an id it had before, or `undefined`. The only lookup into the list. */
export function prototype(id: string): Prototype | undefined {
  return PROTOTYPES.find((p) => p.id === id || p.aliases?.includes(id));
}
