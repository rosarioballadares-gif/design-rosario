/**
 * Tests for the Figma comment rules.
 *
 * **Every fixture here is invented**, in the shape the REST API documents for
 * `GET /v1/files/:key/comments`. None names a real file or a real comment, so a
 * change in Figma's response is something only a live run can catch.
 */

import { describe, expect, it } from 'vitest';
import { fileKeyOf, formatThreads, nodeLink, threadsByNode } from './figma-comments-rules.mjs';

const comment = (over) => ({
  id: '1',
  parent_id: '',
  user: { handle: 'Ada' },
  created_at: '2026-10-01T10:00:00Z',
  resolved_at: null,
  message: 'a note',
  client_meta: { node_id: '12:34', node_offset: { x: 0, y: 0 } },
  order_id: '1',
  ...over,
});

describe('fileKeyOf', () => {
  it('reads the key from a design URL', () => {
    expect(fileKeyOf('https://www.figma.com/design/AbCdEf123456/Some-File?node-id=1-2')).toBe('AbCdEf123456');
  });

  it('reads the key from an older file URL', () => {
    expect(fileKeyOf('https://figma.com/file/AbCdEf123456/Some-File')).toBe('AbCdEf123456');
  });

  it('answers a branch URL with the branch key, not the main file key', () => {
    expect(fileKeyOf('https://www.figma.com/design/AbCdEf123456/branch/XyZ987654321/Some-File')).toBe('XyZ987654321');
  });

  it('takes a bare key as it is', () => {
    expect(fileKeyOf('  AbCdEf123456 ')).toBe('AbCdEf123456');
  });

  it('refuses something that is neither', () => {
    expect(fileKeyOf('https://example.com/design/AbCdEf123456')).toBeNull();
    expect(fileKeyOf('')).toBeNull();
    expect(fileKeyOf(undefined)).toBeNull();
  });
});

describe('nodeLink', () => {
  it('writes the node id the way a Figma URL carries it', () => {
    expect(nodeLink('AbCdEf123456', '12:34')).toBe('https://www.figma.com/design/AbCdEf123456/?node-id=12-34');
  });
});

describe('threadsByNode', () => {
  it('hangs a reply under its root, oldest first', () => {
    const groups = threadsByNode([
      comment({ id: '3', parent_id: '1', created_at: '2026-10-03T00:00:00Z', message: 'second', client_meta: null, order_id: null }),
      comment({ id: '2', parent_id: '1', created_at: '2026-10-02T00:00:00Z', message: 'first', client_meta: null, order_id: null }),
      comment({ id: '1' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].node).toBe('12:34');
    expect(groups[0].threads[0].replies.map((r) => r.message)).toEqual(['first', 'second']);
  });

  it('groups by node and puts a canvas-pinned root under null', () => {
    const groups = threadsByNode([
      comment({ id: '1' }),
      comment({ id: '2', client_meta: { node_id: '56:78' }, created_at: '2026-10-02T00:00:00Z' }),
      comment({ id: '3', client_meta: { x: 10, y: 20 }, created_at: '2026-10-03T00:00:00Z' }),
    ]);
    expect(groups.map((g) => g.node)).toEqual(['12:34', '56:78', null]);
  });

  it('keeps a reply whose root is missing, as a root of its own', () => {
    const groups = threadsByNode([comment({ id: '9', parent_id: 'gone', client_meta: null })]);
    expect(groups).toEqual([{ node: null, threads: [expect.objectContaining({ id: '9', replies: [] })] }]);
  });

  it('drops resolved threads only when asked for the open ones', () => {
    const list = [comment({ id: '1', resolved_at: '2026-10-02T00:00:00Z' }), comment({ id: '2', created_at: '2026-10-02T00:00:00Z' })];
    expect(threadsByNode(list)[0].threads).toHaveLength(2);
    expect(threadsByNode(list, { open: true })[0].threads.map((t) => t.id)).toEqual(['2']);
  });

  it('answers an empty or missing list with no groups', () => {
    expect(threadsByNode([])).toEqual([]);
    expect(threadsByNode(undefined)).toEqual([]);
  });
});

describe('formatThreads', () => {
  it('prints the node link, the author and date, the message and its replies', () => {
    const text = formatThreads('AbCdEf123456', threadsByNode([
      comment({ id: '1', message: 'line one\nline two', resolved_at: '2026-10-02T00:00:00Z' }),
      comment({ id: '2', parent_id: '1', user: { handle: 'Bo' }, created_at: '2026-10-02T00:00:00Z', message: 'done', client_meta: null, order_id: null }),
    ]));
    expect(text).toContain('node 12:34  https://www.figma.com/design/AbCdEf123456/?node-id=12-34');
    expect(text).toContain('  #1 Ada, 2026-10-01  [resolved]');
    expect(text).toContain('    line one\n    line two');
    expect(text).toContain('    ↳ Bo, 2026-10-02\n      done');
  });
});
