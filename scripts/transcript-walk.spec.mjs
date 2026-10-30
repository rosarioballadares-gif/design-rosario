/**
 * Holds `transcript-walk.mjs` to what it claims.
 *
 * The defect this exists for is already paid: the walk read one directory level
 * and stopped, and on that basis `pnpm cost` declared for weeks that no entry
 * carries an `isSidechain` marker. Nothing failed. The report was green, its
 * numbers were arithmetically correct, and the sentence it printed about its own
 * blindness was false.
 *
 * So what is asserted here is the CLASSIFICATION, over a tree built in memory —
 * that a nested file is found at all, that `subagents/` is what makes it
 * sidechain, and that the flag survives the extra directory level a workflow
 * adds. A walk over this machine's real transcripts could not assert any of it:
 * it would agree with whatever the walk did.
 */
import { describe, expect, it } from 'vitest';

import {
  SIDECHAIN_DIR,
  SKIP_DIRS,
  isSidechainSegments,
  segmentsOf,
  sidechainIdentity,
  transcriptsUnder,
} from './transcript-walk.mjs';

/** A fake filesystem: { dirName: { fileName: null, subDir: {...} } }. */
const tree = {
  projects: {
    'sess-a.jsonl': null,
    'sess-b.jsonl': null,
    'notes.txt': null,
    'sess-a': {
      subagents: {
        'agent-1.jsonl': null,
        workflows: {
          'wf_abc': {
            'agent-2.jsonl': null,
            'agent-3.jsonl': null,
          },
        },
      },
      'tool-results': {
        'spilled.jsonl': null,
      },
    },
  },
};

const at = (path) => {
  const parts = path.split(/[\\/]/).filter(Boolean);
  let node = { projects: tree.projects };
  for (const part of parts) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
};

const readdir = (dir) => {
  const node = at(dir);
  if (node === null || node === undefined) throw new Error(`ENOENT ${dir}`);
  return Object.entries(node).map(([name, child]) => ({
    name,
    isDirectory: () => child !== null,
  }));
};

const stat = () => ({ isFile: () => true });

const walk = (roots) => transcriptsUnder(roots, { readdir, stat });
const names = (rows) => rows.map((r) => r.path.split(/[\\/]/).pop());
const sidechainNames = (rows) => names(rows.filter((r) => r.sidechain));

describe('transcriptsUnder', () => {
  it('finds nested transcripts, which is the whole defect it was written for', () => {
    const rows = walk(['projects']);
    expect(names(rows).sort()).toEqual(
      ['agent-1.jsonl', 'agent-2.jsonl', 'agent-3.jsonl', 'sess-a.jsonl', 'sess-b.jsonl'].sort(),
    );
  });

  it('labels a top-level transcript as main and one under subagents/ as sidechain', () => {
    const rows = walk(['projects']);
    expect(sidechainNames(rows).sort()).toEqual(
      ['agent-1.jsonl', 'agent-2.jsonl', 'agent-3.jsonl'].sort(),
    );
    const main = rows.filter((r) => !r.sidechain);
    expect(names(main).sort()).toEqual(['sess-a.jsonl', 'sess-b.jsonl']);
  });

  it('keeps the flag on through the extra levels a workflow adds', () => {
    /* subagents/workflows/<wf id>/agent-<id>.jsonl is two directories below the
       one that sets the flag. A walk that set it per-parent instead of
       inheriting it would call these main. */
    const rows = walk(['projects']);
    const deep = rows.find((r) => r.path.endsWith('agent-2.jsonl'));
    expect(deep.sidechain).toBe(true);
  });

  it('skips tool-results entirely, jsonl included', () => {
    expect(names(walk(['projects']))).not.toContain('spilled.jsonl');
    expect(SKIP_DIRS.has('tool-results')).toBe(true);
  });

  it('ignores files that are not .jsonl', () => {
    expect(names(walk(['projects']))).not.toContain('notes.txt');
  });

  it('returns a stable order, so two runs of the report agree', () => {
    expect(walk(['projects'])).toEqual(walk(['projects']));
    const paths = walk(['projects']).map((r) => r.path);
    expect([...paths].sort()).toEqual(paths);
  });

  it('survives an unreadable directory instead of taking the whole run down', () => {
    expect(walk(['does-not-exist'])).toEqual([]);
    /* And a missing root among good ones loses only itself. */
    expect(walk(['does-not-exist', 'projects'])).toHaveLength(5);
  });

  it('answers an empty list for no roots at all', () => {
    expect(walk([])).toEqual([]);
  });

  it('carries an identity for each subagent run and none for a main session', () => {
    const rows = walk(['projects']);
    const byName = Object.fromEntries(rows.map((r) => [r.path.split(/[\\/]/).pop(), r]));
    expect(byName['sess-a.jsonl'].agent).toBe(null);
    expect(byName['agent-1.jsonl'].agent).toEqual({
      sessionId: 'sess-a',
      workflowId: null,
      agentId: '1',
    });
    expect(byName['agent-2.jsonl'].agent).toEqual({
      sessionId: 'sess-a',
      workflowId: 'wf_abc',
      agentId: '2',
    });
  });
});

describe('sidechainIdentity', () => {
  const of = (path) => sidechainIdentity(segmentsOf(path));

  it('reads the session, the workflow and the agent out of a workflow path', () => {
    expect(of('/p/proj/0c9f7177/subagents/workflows/wf_894321/agent-afb34883.jsonl')).toEqual({
      sessionId: '0c9f7177',
      workflowId: 'wf_894321',
      agentId: 'afb34883',
    });
  });

  it('answers a null workflow for an Agent call, which is one directory shallower', () => {
    expect(of('/p/proj/0c9f7177/subagents/agent-afb34883.jsonl')).toEqual({
      sessionId: '0c9f7177',
      workflowId: null,
      agentId: 'afb34883',
    });
  });

  it('is not fooled by a session id that contains the word agent', () => {
    /* The session id is user-supplied in effect. Keying on the exact directory
       name is what keeps `agent-notes` from being read as an agent file's
       parent, and it is the same reasoning isSidechainSegments carries. */
    expect(of('/p/proj/agent-notes/subagents/agent-1.jsonl').sessionId).toBe('agent-notes');
  });

  it('names the session a person started, never the agent that spawned a nested run', () => {
    /* The first `subagents/` is the one that answers. Taking the last would
       attribute a nested run to its parent agent, and no person would find it
       under a session id they recognise. */
    expect(of('/p/proj/sess-a/subagents/agent-1/subagents/agent-9.jsonl')).toEqual({
      sessionId: 'sess-a',
      workflowId: null,
      agentId: '9',
    });
  });

  it('answers null for a path with no subagents/ in it, rather than a row of nulls', () => {
    expect(of('/p/proj/0c9f7177.jsonl')).toBe(null);
  });

  it('gives no agent id to a sidechain file that is not a run', () => {
    /* A workflow writes journal.jsonl beside its agents. It is sidechain by
       path and it is not an agent, and on 2026-09-12 it was the whole of the
       gap between 49 transcripts and the 48 that priced anything. */
    const row = of('/p/proj/0c9f7177/subagents/workflows/wf_894321/journal.jsonl');
    expect(row.agentId).toBe(null);
    expect(row.workflowId).toBe('wf_894321');
  });
});

describe('isSidechainSegments', () => {
  it('reads segments, never a joined string', () => {
    expect(isSidechainSegments(['projects', 'sess-a', SIDECHAIN_DIR, 'agent-1.jsonl'])).toBe(true);
    expect(isSidechainSegments(['projects', 'sess-a.jsonl'])).toBe(false);
  });

  it('does not match a segment that merely contains the word', () => {
    /* A session id is user-supplied in effect, and a substring match would
       reclassify a main session as subagent work on a name collision. */
    expect(isSidechainSegments(['projects', 'my-subagents-notes', 'x.jsonl'])).toBe(false);
    expect(isSidechainSegments(['projects', 'subagentsx', 'x.jsonl'])).toBe(false);
  });
});
