/**
 * Tests for the link rules.
 *
 * The subject is a check whose whole value is that it fails, so the assertions
 * that matter are the negative ones. **Every fixture here is invented** — none
 * names a real document, so the day a link in `CLAUDE.md` moves these tests say
 * nothing about it.
 */

import { describe, expect, it } from 'vitest';
import { danglingLinks, resolveAgainst, targets } from './doc-links.mjs';

const always = () => true;
const never = () => false;

describe('targets', () => {
  it('collects a repository-relative link', () => {
    expect(targets('see [the notes](docs/notes.md) for more')).toEqual([
      { raw: 'docs/notes.md', path: 'docs/notes.md' },
    ]);
  });

  it('strips an anchor, keeping the path to look for', () => {
    expect(targets('[a rule](docs/notes.md#a-heading)')).toEqual([
      { raw: 'docs/notes.md#a-heading', path: 'docs/notes.md' },
    ]);
  });

  it('leaves URLs and bare anchors alone', () => {
    const text = '[site](https://example.com/x) [mail](mailto:a@b.c) [here](#a-section)';
    expect(targets(text)).toEqual([]);
  });

  it('ignores a link inside a fenced block', () => {
    const text = 'real [one](docs/a.md)\n```\nexample [two](docs/never-written.md)\n```\n';
    expect(targets(text).map((t) => t.path)).toEqual(['docs/a.md']);
  });
});

describe('resolveAgainst', () => {
  it('leaves a path alone for a document at the root', () => {
    expect(resolveAgainst('CLAUDE.md', 'docs/notes.md')).toBe('docs/notes.md');
  });

  it('resolves a sibling path from the folder the document sits in', () => {
    expect(resolveAgainst('docs/research/inventory.md', 'shots/a.png')).toBe(
      'docs/research/shots/a.png',
    );
  });

  it('walks up for each leading `..`', () => {
    expect(resolveAgainst('docs/research/inventory.md', '../../README.md')).toBe('README.md');
  });

  /* A link that leaves the repository has to stay unfollowable. Dropping the
   * spare `..` would hand the caller a path at the root that plausibly exists,
   * and this check reports green on a path that exists. */
  it('keeps a `..` with nothing left to remove', () => {
    expect(resolveAgainst('CLAUDE.md', '../outside.md')).toBe('../outside.md');
    expect(resolveAgainst('docs/notes.md', '../../outside.md')).toBe('../outside.md');
  });

  it('ignores `.` and empty segments', () => {
    expect(resolveAgainst('docs/notes.md', './shots//a.png')).toBe('docs/shots/a.png');
  });
});

describe('danglingLinks', () => {
  it('finds nothing when every destination exists', () => {
    expect(danglingLinks('[a](docs/a.md) [b](docs/b.md)', always)).toEqual([]);
  });

  it('names the link and the path it could not find', () => {
    const found = danglingLinks('[a](docs/gone.md)', never);
    expect(found).toEqual(['docs/gone.md — no file at docs/gone.md']);
  });

  /* The pointer a cut leaves behind is the case this check was written for: the
   * rule stays, the evidence was never written, and the reader is told to go
   * somewhere that is not there. */
  it('reports one finding per destination rather than per mention', () => {
    const text = '[a](docs/gone.md) and again [a](docs/gone.md)';
    expect(danglingLinks(text, never)).toHaveLength(1);
  });

  it('reports a dangling link even when its neighbours resolve', () => {
    const found = danglingLinks('[a](docs/a.md) [b](docs/gone.md)', (p) => p === 'docs/a.md');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/docs\/gone\.md/);
  });
});
