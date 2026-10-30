/**
 * How a snapshot is merged into the store that outlives the window.
 *
 * Kept apart from `snapshot.mjs` for the reason `transcript-walk.mjs` is kept
 * apart from `session-cost.mjs`: the reading is easy to see when it breaks and
 * the MERGE is not. A merge that quietly replaced a full row with a partial one
 * would leave the store shorter every time a snapshot ran while a session was
 * still open, and nothing downstream could tell that from a quiet week.
 *
 * The rule, in one sentence: **a row is replaced only by a heavier one, and a
 * row the new reading never saw is kept.** Both halves matter. The first is
 * what makes a snapshot safe to run at any hour; the second is the entire
 * point, because the reading can only ever see the days still on disk.
 *
 * **`recountStore` breaks the first half on purpose**, for the one case that
 * sentence does not cover: a stored row that is not lighter but wrong.
 */

/**
 * The weight of a row, which decides whether it may replace another.
 *
 * Anything missing or non-numeric weighs 0 rather than throwing: a row written
 * by an older version of this script is a row to keep, not a run to abort.
 */
export function weighCalls(row) {
  const n = row && row.calls;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/**
 * The weight of a routing row: every invocation and every typed command in it.
 *
 * A session that invoked nothing weighs 0 and stays at 0 forever, which is
 * correct — its silence is the measurement, and there is nothing for a later
 * reading to add.
 */
export function weighRouting(row) {
  const sum = (obj, of) =>
    Object.values(obj && typeof obj === 'object' ? obj : {}).reduce((total, value) => {
      const n = of(value);
      return total + (typeof n === 'number' && Number.isFinite(n) ? n : 0);
    }, 0);
  if (!row || typeof row !== 'object') return 0;
  return sum(row.invoked, (v) => (v && typeof v === 'object' ? v.count : v)) + sum(row.typed, (v) => v);
}

/**
 * One store, merged.
 *
 * A tie KEEPS the existing row rather than overwriting with an identical one.
 * The store is versioned, so an overwrite that changes no number still costs
 * somebody a line of diff to read, and the run that writes it looks like it
 * found something.
 */
export function mergeStore(existing, incoming, weigh = weighCalls) {
  const out = { ...(existing && typeof existing === 'object' ? existing : {}) };
  const added = [];
  const updated = [];
  for (const [id, row] of Object.entries(incoming && typeof incoming === 'object' ? incoming : {})) {
    if (!(id in out)) {
      out[id] = row;
      added.push(id);
    } else if (weigh(row) > weigh(out[id])) {
      out[id] = row;
      updated.push(id);
    }
  }
  return { store: sortedByKey(out), added, updated, kept: Object.keys(out).length };
}

/**
 * Replace every row a fresh reading could reach, and leave the rest alone.
 *
 * **This deliberately defeats `mergeStore`'s weight rule, and only one store may
 * ask for it.** The weight rule is right whenever a lighter reading means a
 * transcript rolled off disk — which is every COST row, where a smaller number
 * is lost evidence. It is wrong when the old row is not lighter but WRONG: when
 * `typedIn` was counting a file an agent read as somebody typing, the corrected
 * routing row weighs LESS than the inflated one, so a plain re-run would reject
 * the correction and keep the defect forever. Found 2026-09-14, and the store
 * had already absorbed 16 such rows.
 *
 * A row the incoming reading does not carry is NOT deleted — its transcript is
 * gone and the stored row is the only copy left. The caller is told how many,
 * because those keep the old number and nothing can fix them.
 */
export function recountStore(existing, incoming) {
  const out = { ...(existing && typeof existing === 'object' ? existing : {}) };
  const rows = incoming && typeof incoming === 'object' ? incoming : {};
  const replaced = [];
  const added = [];
  for (const [id, row] of Object.entries(rows)) {
    if (id in out) replaced.push(id);
    else added.push(id);
    out[id] = row;
  }
  const unreachable = Object.keys(out).filter((id) => !(id in rows));
  return { store: sortedByKey(out), replaced, added, unreachable, kept: Object.keys(out).length };
}

/** Keys in a stable order, so a diff shows what changed and never what moved. */
export function sortedByKey(obj) {
  const out = {};
  for (const key of Object.keys(obj).sort()) out[key] = obj[key];
  return out;
}

/** An array of rows, keyed by one of their fields, for a store that arrives as a list. */
export function keyBy(rows, field) {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = row && row[field];
    if (typeof id !== 'string' || id === '') continue;
    const { [field]: _drop, ...rest } = row;
    out[id] = rest;
  }
  return out;
}

/**
 * Days between the newest row in the store and today, or `null` for a store
 * with nothing dated in it.
 *
 * `null` is not the same as a large number and the caller has to decide: an
 * empty store on a fresh clone is expected, and a store whose newest day is a
 * week old means a week of transcripts may already be gone.
 */
export function daysSinceNewest(days, today) {
  const dated = (Array.isArray(days) ? days : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (dated.length === 0) return null;
  const newest = dated.sort().at(-1);
  const delta = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${newest}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(delta) ? delta : null;
}

/**
 * The shape of the file on disk: two spaces, sorted, and a closing newline.
 *
 * Named here rather than spelled at each call because five stores are written
 * by this and a diff is only readable while all five agree.
 */
export function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
