/**
 * The hash this repository understands. A stopgap, not a router.
 *
 * ```
 *   #/                  the index
 *   #/<prototype-id>    a prototype, from `sandbox/registry.ts`
 *   #/<id>/<variant>    a second segment, where the prototype declares a
 *                       closed set for it — `#/dashboard/empty`
 * ```
 *
 * The moment this needs a query string or a nested route it should be REPLACED
 * rather than extended.
 *
 * It lives apart from `Root.tsx` because a module that exports both a component
 * and a plain function breaks React fast refresh.
 */
import { prototype, type Prototype } from './sandbox/registry';

export interface Route {
  /** `null` is the index, which is a destination rather than a fallback. */
  prototype: Prototype | null;
  /** The second segment, where the prototype declares a closed set for it. */
  variant?: string;
}

/** Reads a route out of a hash. Anything unrecognized falls back to the index. */
export function parseRoute(hash: string): Route {
  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  const found = segments[0] ? prototype(segments[0]) : undefined;
  if (!found) return { prototype: null };

  // Validated against the registry rather than cast. A segment typed into the
  // address bar is user input, and a variant the prototype does not declare
  // renders a blank screen with nothing in the console to explain it.
  const asked = segments[1];
  const variant = asked && found.variants?.includes(asked) ? asked : undefined;

  return { prototype: found, variant };
}

/** The hash for a prototype, so links are built rather than typed. */
export function hashFor(id: string, segment?: string): string {
  return segment ? `#/${id}/${segment}` : `#/${id}`;
}
