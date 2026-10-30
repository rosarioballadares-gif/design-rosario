import { useEffect, useState } from 'react';

import { hashFor, parseRoute } from './route';
import { PROTOTYPES } from './sandbox/registry';

/** The pages of the product's site; the other prototypes are reached by link. */
const SITE = PROTOTYPES.filter((p) => p.site);

/**
 * The index, and the one place a hash change is observed.
 *
 * The list is generated from the registry rather than written out, which is
 * what keeps the index and the routes from disagreeing.
 */
export function Root() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const route = parseRoute(hash);

  if (route.prototype) {
    const Prototype = route.prototype.render;
    // Keyed by the hash, so a variant opens on its own state rather than on
    // whatever the variant before it left in `useState`.
    return <Prototype key={hash} variant={route.variant} />;
  }

  return (
    <main>
      <h1>Product Operations</h1>
      {SITE.length === 0 ? (
        <p>
          No prototypes yet. Add one to <code>src/sandbox/registry.ts</code> and
          it appears here, with its route.
        </p>
      ) : (
        <ul>
          {SITE.map((p) => (
            <li key={p.id}>
              <a href={hashFor(p.id)}>{p.title}</a> — {p.summary}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
