/**
 * What a backlog item is, and how its state and owner are read.
 *
 * **The problem this exists to solve is not that the backlog is untidy.** It is
 * that on 2026-09-10 it held 366 KB across 84 items with NO machine-readable
 * state: zero checkboxes, and status appearing as prose scattered through the
 * text — `Open` 71 times, `Closed` 33, `Fixed` 37, `Shipped` 21, `Landed` 17,
 * `Resolved` 14. Owner appeared 22 times. So "what is still open" and "what am
 * I meant to be doing" could only be answered by reading the whole file, which
 * costs roughly 103.000 tokens and had been done nine times.
 *
 * A file that can only be read can only grow. This makes it queryable.
 *
 * `check-backlog.mjs` is the read and the exit code; `backlog.mjs` is the view.
 * This file is what both of them mean, and `backlog-rules.spec.mjs` is what
 * holds it to that.
 *
 * **The markers reuse the shape this repository already has.** `> SOURCE:` and
 * `> GAP:` were already the way a brief states where a claim comes from, so
 * `> STATUS:` and `> OWNER:` are read the same way rather than inventing a
 * second convention for the same job.
 */

/**
 * The states, and the reason there are exactly five.
 *
 * `dropped` is the one that earns its place. Deleting an item that nobody is
 * going to do loses the fact that somebody looked at it and decided — which is
 * the trace that stops it being rediscovered and re-argued in three months. It
 * is the same reasoning `> GAP:` already carries: an absence somebody typed is
 * a different thing from an absence nobody recorded.
 */
export const STATUSES = ['open', 'blocked', 'landed', 'dropped', 'upstream'];

export const STATUS_MEANING = {
  open: 'nobody has done it and nothing stops somebody starting',
  blocked: 'it cannot start until something else lands; the blocker is named',
  landed: 'it is done here, with the evidence beside it',
  dropped: 'somebody looked and decided not to, with the reason beside it',
  upstream: 'it is not this repository’s to fix; it belongs to whoever owns the package',
};

/** `> STATUS: open` — the state, optionally followed by a reason on the same line. */
export const STATUS_MARKER = /^>\s*STATUS:\s*([a-z]+)\b[ \t]*(.*)$/gim;

/** `> OWNER: Christine Moreau` — a person, or the literal `nobody`. */
export const OWNER_MARKER = /^>\s*OWNER:\s*(.+?)\s*$/gim;

/**
 * The owner that means the item has none.
 *
 * It has to be TYPED, for the reason every marker here has to be typed: an item
 * with no owner line is indistinguishable from one nobody has got to yet, and
 * `nobody` is somebody stating that this has no owner. `check:backlog` counts
 * them and prints the total, because an unowned backlog is a real condition and
 * hiding it behind a blank is how it stays that way.
 */
export const NO_OWNER = 'nobody';

/** A backlog item is a third-level heading. Sections (`##`) group them; items (`###`) are the unit. */
export const ITEM_HEADING = /^###\s+(.+?)\s*$/;
export const SECTION_HEADING = /^##\s+(.+?)\s*$/;

const FENCE = /^\s*(```|~~~)/;

/**
 * Splits a backlog into sections and items, blanking fenced blocks first.
 *
 * The fence handling is not decoration: this file's own examples of a marker
 * live inside fences, and without it every documented example would be read as
 * a real state. `brief-fields.mjs` has the same guard for the same reason, and
 * a fence closes on the marker that opened it.
 */
export function parseBacklog(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const items = [];
  let section = null;
  let current = null;
  let fence = null;

  const close = () => {
    if (current) items.push(current);
    current = null;
  };

  /* Fenced lines are kept in `body` so the view can print an item whole, and
   * BLANKED in `scan` so a documented example of a marker is not read as a real
   * one. Keeping both rather than stripping is what lets the item still show
   * its code block. `brief-fields.mjs` blanks for the same reason. */
  const push = (line, fenced) => {
    if (!current) return;
    current.body.push(line);
    current.scan.push(fenced ? '' : line);
  };

  for (const raw of lines) {
    const opener = FENCE.exec(raw);
    if (opener) {
      if (fence === null) fence = opener[1];
      else if (opener[1] === fence) fence = null;
      push(raw, true);
      continue;
    }
    if (fence !== null) {
      push(raw, true);
      continue;
    }

    const sec = SECTION_HEADING.exec(raw);
    if (sec && !ITEM_HEADING.test(raw)) {
      close();
      section = sec[1];
      continue;
    }
    const item = ITEM_HEADING.exec(raw);
    if (item) {
      close();
      current = { title: item[1], section, body: [], scan: [] };
      continue;
    }
    push(raw, false);
  }
  close();

  return items.map((it) => {
    const body = it.body.join('\n');
    const scan = it.scan.join('\n');
    const status = firstMatch(scan, STATUS_MARKER);
    const owner = firstMatch(scan, OWNER_MARKER);
    return {
      title: it.title,
      section: it.section,
      body,
      status: status ? status[1].toLowerCase() : null,
      statusReason: status ? (status[2] || '').trim() : '',
      owner: owner ? owner[1].trim() : null,
    };
  });
}

function firstMatch(text, re) {
  re.lastIndex = 0;
  const m = re.exec(text);
  re.lastIndex = 0;
  return m;
}

/**
 * Findings for one item.
 *
 * `dropped` and `blocked` are the two states that MUST carry a reason, and they
 * are the two for the same reason: each one is a decision that closes something
 * off, and a closed door with no note on it gets opened again by the next
 * person. `landed` does not need one here because the evidence rule already
 * governs it elsewhere.
 */
export function findingsFor(item, roster = null) {
  const found = [];
  const where = `"### ${item.title}"`;

  if (!item.status) {
    found.push({
      code: 'no-status',
      title: item.title,
      detail: `${where} has no "> STATUS:" line. One of ${STATUSES.join(', ')} — a state nobody typed is not a state.`,
    });
  } else if (!STATUSES.includes(item.status)) {
    found.push({
      code: 'bad-status',
      title: item.title,
      detail: `${where} says "> STATUS: ${item.status}", which is not one of ${STATUSES.join(', ')}.`,
    });
  } else if ((item.status === 'dropped' || item.status === 'blocked') && !item.statusReason) {
    found.push({
      code: 'no-reason',
      title: item.title,
      detail: `${where} is ${item.status} with no reason on the line. A closed door with no note on it gets opened again.`,
    });
  }

  if (!item.owner) {
    found.push({
      code: 'no-owner',
      title: item.title,
      detail: `${where} has no "> OWNER:" line. Name a person, or "${NO_OWNER}" — which is a stated fact, not a blank.`,
    });
  } else if (roster && item.owner !== NO_OWNER && !roster.includes(item.owner)) {
    found.push({
      code: 'unknown-owner',
      title: item.title,
      detail: `${where} is owned by "${item.owner}", who is not in the roster. A misspelled name is an owner no filter will ever find.`,
    });
  }

  return found;
}

/**
 * The scope gate, evaluated BEFORE any finding.
 *
 * Zero items produces zero findings, and zero findings prints as a pass. This
 * is the failure `check-role-list.mjs` has a paragraph about and that
 * `session-cost.mjs` was caught by on its first run: a walk that resolved
 * nothing reported a clean result and exited 0.
 *
 * An EMPTY backlog is the one zero that passes, and `readme` is what tells it
 * from a walk that resolved nothing: `backlog/README.md` was read, so the
 * directory was found, and no file in it holds an item. A copy starts there.
 */
export function scopeFailure({ files = 0, items = 0, readme = false } = {}) {
  if (files === 0)
    return readme ? null : 'no backlog files were found. Nothing was read, so a clean result here would be an artefact.';
  if (items === 0)
    return `${files} file(s) resolved but not one "### " item was parsed. Either the shape changed or the wrong path was read.`;
  return null;
}

/** Counts by state, for the run's own scope line. */
export function tally(items) {
  const out = { total: items.length, owned: 0, unowned: 0 };
  for (const s of STATUSES) out[s] = 0;
  for (const item of items) {
    if (item.status && STATUSES.includes(item.status)) out[item.status] += 1;
    if (item.owner === NO_OWNER) out.unowned += 1;
    else if (item.owner) out.owned += 1;
  }
  return out;
}

/** What a green run of this cannot tell you, printed rather than filed in a header. */
export const CANNOT_SEE = [
  'Whether a state is TRUE. `> STATUS: open` on something shipped last month',
  'parses exactly as well as one on something nobody has started, and no script',
  'here opens the thing an item describes. This says every item has been given a',
  'state and an owner by a person. It does not say either one is current.',
];
