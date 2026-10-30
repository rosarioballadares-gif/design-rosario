/**
 * The seam, as a check: nothing under `src/` outside `src/ds/` imports a
 * package that is not on `ALLOWED`. A vendor package belongs behind this
 * folder, or on the list in the same diff with the reason it is not a design
 * system.
 *
 * It is an allowlist because no vendor is wired yet, so a denylist would have
 * nothing to name. The forms read are `import … from`, `import '…'`,
 * `export … from` and `import()`, in `.ts`, `.tsx` and `.mdx`.
 *
 * What this cannot see: a CSS `@import`, a `require()`, a relative path that
 * walks into `node_modules`, and a package on the list that should not be.
 * Brief: briefs/2026-10-09-ds-seam-spec.md.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

/** What `src/` outside `src/ds/` may import, each with why it is not a design system. */
const ALLOWED: { pattern: RegExp; why: string }[] = [
  { pattern: /^react(\/.*)?$/, why: 'the framework every screen is written in' },
  { pattern: /^react-dom(\/.*)?$/, why: 'mounts the app, in src/main.tsx' },
  { pattern: /^vitest$/, why: 'the runner the specs import' },
  { pattern: /^node:/, why: 'the runtime the specs read files with' },
];

const SPECIFIER =
  /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function specifiers(text: string): string[] {
  return [...text.matchAll(SPECIFIER)].map((m) => m[1] ?? m[2] ?? m[3]);
}

const isRelative = (spec: string) => spec.startsWith('.') || spec.startsWith('/');
const isAllowed = (spec: string) => isRelative(spec) || ALLOWED.some((a) => a.pattern.test(spec));

const files = (readdirSync(SRC, { recursive: true, encoding: 'utf8' }) as string[])
  .map((path) => path.split(sep).join('/'))
  .filter((path) => /\.(ts|tsx|mdx)$/.test(path) && !path.startsWith('ds/'));
const imports = files.flatMap((path) =>
  specifiers(readFileSync(join(SRC, path), 'utf8')).map((spec) => ({ file: `src/${path}`, spec })),
);

describe('the matcher', () => {
  it('reads a vendor import in every form, across lines, and refuses it', () => {
    const sample = [
      "import { Button } from '@vendor/ui';",
      "import '@vendor/ui/styles.css';",
      "export { Card } from '@vendor/ui';",
      "const lazy = import('@vendor/ui');",
      'import type {',
      '  Theme,',
      "} from '@vendor/theme';",
    ].join('\n');
    const found = specifiers(sample);
    expect(found).toEqual(['@vendor/ui', '@vendor/ui/styles.css', '@vendor/ui', '@vendor/ui', '@vendor/theme']);
    expect(found.filter(isAllowed)).toEqual([]);
  });

  it('lets through what is listed and relative, and nothing that only starts like it', () => {
    for (const spec of ['react', 'react/jsx-runtime', 'react-dom/client', 'vitest', 'node:fs', './route', '../ds']) {
      expect(isAllowed(spec), spec).toBe(true);
    }
    for (const spec of ['react-router', 'reactive', 'vitest-axe', 'vitest/config', 'zod', '@vendor/ui']) {
      expect(isAllowed(spec), spec).toBe(false);
    }
  });
});

describe('src/ outside src/ds/', () => {
  it('was read at all', () => {
    // A glob that matches nothing reports every import allowed.
    expect(files.length).toBeGreaterThan(0);
    expect(imports.length).toBeGreaterThan(0);
  });

  it('imports no package that is not on the list', () => {
    const outside = imports.filter((i) => !isAllowed(i.spec)).map((i) => `${i.file} imports '${i.spec}'`);
    expect(outside, 'move it behind src/ds/, or add it to ALLOWED with its reason').toEqual([]);
  });
});
