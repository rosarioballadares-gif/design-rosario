/**
 * Finding the transcripts, and deciding which of them are subagent work.
 *
 * Kept apart from `session-cost.mjs` because the walk is the half that was
 * wrong: it read one directory level and stopped, and on that basis the report
 * declared for weeks that no entry carries an `isSidechain` marker. Every entry
 * in a subagent transcript carries one. **A number that measures the instrument
 * reads exactly like one that measures the work**, which is why this half now
 * has a spec and the claim it feeds has a date.
 *
 * Measured 2026-09-11 under `~/.claude/projects/c--design-ops`: 94 files at the
 * top level against 1.730 nested, 711,0 MB against 640,6 MB.
 *
 * Where a subagent's transcript lives: under the session that spawned it, at
 * `<session>/subagents/agent-<id>.jsonl` for an `Agent` call, or
 * `<session>/subagents/workflows/<wf id>/agent-<id>.jsonl` for a workflow. Both
 * are sidechain, and `sidechainIdentity` is what tells one from the other.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The directory name that turns the sidechain flag on, and never off again. */
export const SIDECHAIN_DIR = 'subagents';

/**
 * Directories walked for nothing, skipped by name.
 *
 * `tool-results/` holds a session's spilled tool output. It is large, it has no
 * usage blocks, and walking it costs real seconds on a machine with a year of
 * history.
 */
export const SKIP_DIRS = new Set(['tool-results']);

/**
 * Is a path inside a subagent directory?
 *
 * Takes the path SEGMENTS rather than a string, so it cannot be fooled by a
 * separator that differs between platforms, and so a session whose id happened
 * to contain the word could not be misread as one.
 */
export function isSidechainSegments(segments) {
  return segments.some((s) => s === SIDECHAIN_DIR);
}

/** The directory a workflow adds between `subagents/` and the agent's file. */
export const WORKFLOW_DIR = 'workflows';

/** A path split the way both platforms write one. */
export const segmentsOf = (path) => path.split(/[\\/]/).filter(Boolean);

/**
 * Who ran, and under what, for one sidechain path.
 *
 * The identity is read from the PATH for the same reason the label above is:
 * one subagent run is one file, so the file is the unit, and it is known before
 * a byte is parsed. Every line inside also carries `agentId`, and reading it
 * from there would tie the answer to a transcript being parseable — a truncated
 * final line is normal on a run still going.
 *
 * What the transcript does NOT carry is the agent's name. Every sidechain line
 * under this project on 2026-09-12 — 1.968 of them — holds the same
 * `attributionAgent`, `"workflow-subagent"`, which is a category. So the id
 * here is what identifies a row, and the task it was given has to come from its
 * first message.
 *
 * The FIRST `subagents/` is the one that answers, so a nested run still names
 * the session a person started rather than the agent that spawned it.
 *
 * `agentId` is null for a sidechain file that is not a run. A workflow writes
 * `journal.jsonl` beside its agents — 69 lines of bookkeeping, no usage block —
 * and it is the whole of the gap between the 49 transcripts and the 48 that
 * priced anything, measured 2026-09-12. Reading the id from the `agent-` prefix
 * rather than from whatever the filename happens to be is what keeps a
 * bookkeeping file out of a table of runs.
 */
const AGENT_FILE = /^agent-(.+)\.jsonl$/;

export function sidechainIdentity(segments) {
  const at = segments.indexOf(SIDECHAIN_DIR);
  if (at === -1) return null;
  const after = segments.slice(at + 1);
  const file = after.length > 0 ? after[after.length - 1] : '';
  const named = AGENT_FILE.exec(file);
  return {
    sessionId: at > 0 ? segments[at - 1] : null,
    workflowId: after[0] === WORKFLOW_DIR && after.length > 2 ? after[1] : null,
    agentId: named === null ? null : named[1],
  };
}

/**
 * Every `.jsonl` under `dirs`, each as `{ path, sidechain, agent }`.
 *
 * The label comes from the PATH and is decided before the file is parsed. A
 * main session therefore stays main even if some future entry inside it carries
 * the marker, and a subagent transcript that spent nothing is still counted as
 * a subagent transcript rather than vanishing.
 *
 * `readdir` and `stat` are injectable so the spec can walk a tree it built in
 * memory. The defaults are the real ones; nothing in the runner passes them.
 */
export function transcriptsUnder(dirs, { readdir = readdirSync, stat = statSync } = {}) {
  const files = [];

  const walk = (dir, sidechain) => {
    let entries;
    try {
      entries = readdir(dir, { withFileTypes: true });
    } catch {
      /* A directory that vanished, or one this user cannot read, is not this
       * run's problem. It is also not a silent zero: the caller's scope gate
       * fails on a run that found nothing at all. */
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full, sidechain || entry.name === SIDECHAIN_DIR);
        continue;
      }
      if (!entry.name.endsWith('.jsonl')) continue;
      try {
        if (stat(full).isFile()) {
          files.push({
            path: full,
            sidechain,
            agent: sidechain ? sidechainIdentity(segmentsOf(full)) : null,
          });
        }
      } catch {
        /* a file that vanished between the listing and the stat */
      }
    }
  };

  for (const dir of dirs) walk(dir, false);
  return files.sort((a, b) => (a.path < b.path ? -1 : 1));
}
