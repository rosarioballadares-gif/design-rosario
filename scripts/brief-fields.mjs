/**
 * Is this brief complete, or does it say where it is not?
 *
 * WHAT THIS CAN AND CANNOT DO, stated first, because overclaiming here would be
 * the exact failure the brief exists to prevent. The difference between a filled
 * field and a plausible sentence is judgement, and no regular expression sees
 * it. A paragraph of confident prose about a screen nobody looked at passes
 * every check below.
 *
 * What can be enforced is narrower and still worth having: each required
 * field is present, and each is either backed by a citation or explicitly
 * marked as a gap. That turns the one behaviour which would make the artefact
 * worthless — quietly filling an unknown with something reasonable — from a
 * habit into a visible act. You can still write a bad brief. You can no longer
 * write one that hides which parts are unsupported.
 *
 * Pure: takes text, returns findings. No filesystem.
 */

/**
 * The fields of the execution prompt in CLAUDE.md, in reading order.
 *
 * Most of them ask what the work IS. `Differentiator` asks what it DESCENDS
 * FROM, and it is the last of three added on 2026-08-19 because nothing here
 * asked. A brief could be complete — objective, scope, ordered tasks,
 * validation that closes with a real log — and describe a screen nobody
 * needed. That is not
 * hypothetical: the Marketing Center plan comparison was built on 2026-08-13,
 * rehoused inside a real frame the next day, and deleted the same afternoon.
 * The gate ran. Every field was filled. The work was still the wrong work.
 *
 * There were three, and the two cuts that left one are not the same kind of
 * cut. Both happened on 2026-09-14 and the distinction is worth keeping,
 * because reading them as one would make the second look better supported than
 * it is.
 *
 * `Moment` was measured to collect nothing and removed for it: a stated gap in
 * 100 per cent of the 64 briefs under budget enforcement, and still 82 per cent
 * across the 33 whose commit touched a rendering file. Neither cut of the data
 * found it doing anything.
 *
 * `Key screen` was measured the same way and did NOT come out dead. Its gap
 * rate splits on the kind of task — 36 per cent when the work rendered
 * something against 74 per cent when it did not — which is the signature of a
 * field people answer when they have an answer. It was removed anyway, by Ian
 * Rueff and with that measurement in front of him, because this workspace has
 * spent its recent weeks on itself and the field was a typed `no screen` 98 per
 * cent of the time. So: retired for lack of occasion, not for lack of worth.
 * If product work comes back, the argument for restoring it is already made
 * here, and the number to re-measure is that 36.
 *
 * `Differentiator` does not produce the upstream answer, and cannot. What it
 * does is put it under the same rule as every other section — cite it,
 * attribute it, or write "> GAP:" — so a brief with nothing upstream of it has
 * to SAY so, in the document, where the next reader sees it. An absence that
 * has to be typed is a different thing from an absence nobody asked about.
 */
export const BRIEF_FIELDS = [
  'Objective',
  'Differentiator',
  'Context and rules',
  'Dependencies',
  'Scope',
  'Tasks',
  'Autonomy',
  'Validation',
];

/**
 * The field that asks what the work descends from.
 *
 * Held separately because it is the one a brief can predate. Everything else in
 * BRIEF_FIELDS has been required since this checker existed. It is a list of
 * one after 2026-09-14 and stays a list: the 52 briefs written before
 * `UPSTREAM_REQUIRED_FROM` still need the exemption, and that is the whole job.
 */
export const UPSTREAM_FIELDS = ['Differentiator'];

/**
 * The date from which the upstream fields are required.
 *
 * Fifty briefs were written before these fields existed. Requiring them
 * retroactively would fail all fifty at once, and the only repairs available
 * are to edit fifty files nobody is re-deciding, or to paste "> GAP:" into each
 * — which turns a marker that is supposed to mean "somebody looked and did not
 * know" into background noise. A brief is a record of a decision on a day. It
 * is not improved by being back-dated against a rule that did not exist.
 *
 * The cutoff is the day AFTER this landed, because a brief dated 2026-08-19 was
 * already written when it did.
 */
export const UPSTREAM_REQUIRED_FROM = '2026-08-20';

/**
 * How many bytes each field gets, and the reason there is a number at all.
 *
 * A brief is WRITTEN into the conversation and then carried in every later call
 * of that session, so length is paid twice and the second time repeatedly.
 *
 * These numbers were set 2026-09-10 between the p25 and the median of 180
 * briefs, when the mean brief was 9.370 bytes and `Context and rules` and
 * `Validation` were 55 per cent of it.
 *
 * **It is a budget, not a quality bar.** A field over its cap is not wrong, it
 * is unedited — the repair is to cite the thing instead of transcribing it, and
 * to say the rule instead of narrating how it was discovered. Where the
 * narration is the point, it belongs in `docs/` or a PDR, which the brief then
 * cites in one line.
 *
 * THIS table is the one the first enforced briefs were written against. It is
 * kept, rather than lowered in place, because lowering a cap in place fails
 * every already-written brief above it — and by 2026-09-14 the maxima sat
 * against the ceiling: `Context and rules` 1467 of 1500, `Tasks` 900 of 900,
 * `Validation` 944 of 1000. The only three with real room were `Moment`, `Key
 * screen` and `Dependencies` — the smallest fields in the corpus, and never the
 * cost. The first two have since been cut entirely. See
 * `TIGHTENED_FIELD_BUDGET` below.
 */
export const FIELD_BUDGET = {
  Objective: 500,
  Differentiator: 800,
  'Context and rules': 1500,
  Dependencies: 600,
  Scope: 900,
  Tasks: 900,
  Autonomy: 200,
  Validation: 1000,
};

/**
 * The date from which the budget is enforced at all.
 *
 * Same reasoning as `UPSTREAM_REQUIRED_FROM`, and the same shape: 180 briefs
 * predate this, 133 of them would fail at least one cap, and the only repair
 * available would be to re-edit files whose decisions nobody is re-taking. A
 * brief is a record of a decision on a day; it is not improved by being trimmed
 * against a rule that did not exist when it was written.
 */
export const LENGTH_CAPPED_FROM = '2026-09-11';

/**
 * The lower caps, and the date they start applying.
 *
 * Measured 2026-09-14 over all 254 briefs — 190 legacy, 64 enforced. The mean
 * brief went 9.223 bytes of recognised sections to 3.810 once the caps bit, and
 * **no enforced brief is over any cap in the table above**. That is what a
 * ceiling left far above the measurement looks like, and `context-floor.json`
 * says the same thing about its own: a ceiling nothing reaches has stopped
 * checking.
 *
 * Each cap below is the p75 of the enforced regime, rounded. Distribution in
 * bytes, over the 64 briefs dated from `LENGTH_CAPPED_FROM`. `Key screen` is
 * kept in the table with no cap because the measurement is what the decision to
 * cut it was taken against, and a row deleted from the evidence would leave
 * that decision looking unmeasured:
 *
 *   field               p50    p75    p90    max    was     now
 *   Objective           260    347    401    485    500     350
 *   Key screen           81    138    196    270    500       —  (cut)
 *   Differentiator      457    593    649    794    800     600
 *   Context and rules   870  1.005  1.201  1.467  1.500   1.000
 *   Dependencies        194    273    407    502    600     300
 *   Scope               458    542    719    893    900     550
 *   Tasks               472    597    696    900    900     600
 *   Autonomy            144    172    183    197    200     250
 *   Validation          610    685    811    944  1.000     700
 *
 * **`Autonomy` goes UP, and it is the only measured squeeze in the table.** Its
 * cap has 17 bytes of headroom above p90 and nine of the 64 briefs sit within
 * ten per cent of it. The field was capped at 200 on 2026-09-10 for a binary
 * choice; `RUNG_REQUIRED_FROM` then asked it for a rung, the effort that rung
 * prescribes, and a link to the ladder, and nobody moved the number.
 *
 * A dated second table rather than an edit in place, for the reason the header
 * of `FIELD_BUDGET` gives: the caps below are under six existing maxima, so
 * applying them backwards would fail briefs whose decisions nobody is re-taking.
 * It is the fourth cutoff in this module and the shape is deliberate — the day
 * AFTER the rule lands, so the briefs written while it was being written are
 * held to what they were written against.
 */
export const TIGHTENED_FIELD_BUDGET = {
  Objective: 350,
  Differentiator: 600,
  'Context and rules': 1000,
  Dependencies: 300,
  Scope: 550,
  Tasks: 600,
  Autonomy: 250,
  Validation: 700,
};

/** From when `TIGHTENED_FIELD_BUDGET` replaces `FIELD_BUDGET`. */
export const BUDGET_TIGHTENED_FROM = '2026-09-15';

/**
 * Four caps raised, and the date they start applying.
 *
 * Measured 2026-10-08 over the nine briefs of the base's from-zero rehearsal,
 * one per pipeline stage: every one of them was trimmed two to eight times to
 * fit, and the overruns sat on the same four fields, each run cut to the bone
 * before it passed —
 *
 *   field        cap    first drafts over it
 *   Scope        550    three stages, after the surfaces parity asks to name
 *   Tasks        600    619, 719 — a stage skill has six to eleven steps
 *   Autonomy     250    263, 283, 289 — rung, effort, the row not taken, SOURCE
 *   Validation   700    744, 828, 874 — a screen in six states at two bands
 *
 * Each new cap is the largest first draft rounded up, so the stage briefs fit
 * once and the cap still bites a brief that transcribes instead of citing. The
 * other four fields never came near theirs and keep them. Raised in a dated
 * third table, the day after, for the reason the two above give.
 */
export const RAISED_FIELD_BUDGET = {
  ...TIGHTENED_FIELD_BUDGET,
  Scope: 700,
  Tasks: 800,
  Autonomy: 350,
  Validation: 900,
};

/** From when `RAISED_FIELD_BUDGET` replaces `TIGHTENED_FIELD_BUDGET`. */
export const BUDGET_RAISED_FROM = '2026-10-09';

/**
 * From when `## Autonomy` is asked for the row it did NOT take.
 *
 * The fourth dated cutoff in this file and the only one `check-briefs.mjs`
 * does not read: nothing FAILS a brief for skipping the rejected rung, because
 * nothing can tell a rung weighed against its neighbour from one typed beside
 * a plausible sentence. It is here rather than in the script that uses it
 * because it is the same kind of fact as the three above — the day a rule
 * about briefs started applying — and keeping it beside them is what stops a
 * second, disagreeing copy of the date.
 *
 * Same shape as its neighbours, the day AFTER the rule landed: `TEMPLATE.md`
 * gained the ask on 2026-09-14, so briefs written while it was being written
 * are held to what they were written against.
 */
export const REJECTED_RUNG_ASKED_FROM = '2026-09-15';

/**
 * How many briefs an after-figure needs before it is allowed to be a number.
 *
 * The before-figures this measures against were taken over 64 and 66 briefs.
 * An after taken over one is not a smaller version of that — it is a different
 * claim wearing the same units, and the corpus grows by roughly two briefs a
 * day, so the choice is between a figure that is wrong now and one that is
 * right later. `brief-after.mjs` abstains below this and says how many it is
 * short.
 *
 * What the number buys: at 20, one unusual brief moves a mean by a twentieth
 * of its own deviation, and a proportion that was 3 per cent is separable from
 * one that is 30. What it does NOT buy is a confidence interval anybody should
 * quote — 20 is the point where the figure stops being an anecdote, not the
 * point where it becomes precise.
 */
export const AFTER_FIGURE_FLOOR = 20;

/** `YYYY-MM-DD` at the start of a brief's filename. */
const DATED = /^(\d{4}-\d{2}-\d{2})-/;

/**
 * Whether this brief's sections are held to `FIELD_BUDGET`.
 *
 * A filename with no parseable date is budgeted, which is the same
 * fail-closed direction `requiredFieldsForBrief` takes: naming a file
 * `draft.md` must not be the way to switch a rule off.
 */
/**
 * The rungs of the ladder, and the effort each one prescribes.
 *
 * Transcribed from `.claude/skills/model-and-effort/SKILL.md`, which is the
 * ladder itself; this is the pair a checker can hold, not a second ladder. If
 * the two ever disagree, the skill is right and this is stale.
 *
 * **Why a checker at all.** `## Autonomy` accepted any model and any effort with
 * one `> SOURCE:` beside it, so the field filled itself in by habit: two briefs
 * written on 2026-09-11 declared `high` without naming what the task reaches,
 * and both passed. A default nobody chose reads exactly like a choice.
 *
 * What this cannot see is whether the rung is the RIGHT one. Naming `default`
 * for an audit passes. It makes the choice an assertion with an author, which
 * is the whole of what a static read can buy here.
 */
export const RUNGS = {
  census: 'low',
  repair: 'medium',
  default: 'high',
  decision: 'xhigh',
  audit: 'xhigh',
};

/** From when `## Autonomy` is held to naming its rung. Same reasoning, and the
 * same shape, as `LENGTH_CAPPED_FROM`: briefs written before it recorded a
 * decision nobody is re-taking, and back-filling a rung into them would invent
 * a choice their authors never made. It is the day AFTER this rule landed for
 * exactly that reason — six briefs written on 2026-09-11 would otherwise have
 * needed a rung typed into them by somebody who did not choose it. */
export const RUNG_REQUIRED_FROM = '2026-09-12';

/**
 * Findings for an `## Autonomy` that does not say where on the ladder it stopped.
 *
 * Two ways to fail, and they are different defects: naming no rung at all, and
 * naming one whose effort contradicts the ladder. The second is the one worth
 * having — it catches a brief that reached for `xhigh` and then called itself
 * routine.
 */
export const REJECTED_RUNG = new RegExp(
  String.raw`\b(?:not|never|rather than|instead of)\s+\`(?:` + Object.keys(RUNGS).join('|') + String.raw`)\``,
  'gi',
);

export function autonomyFailures(body) {
  const text = String(body ?? '');
  /* An empty Autonomy already has its own finding. Saying it names no rung on
   * top of that reports one defect twice and invites two repairs. */
  if (!text.trim()) return [];
  /* A rung named to be REJECTED is not a second choice, and counting it as one
   * made the best-written form of this field illegal. TEMPLATE.md asks for the
   * row not taken — "Not `decision`: the cutoff is reversible" — because
   * nothing can check whether a rung is the right one, and the rejected
   * neighbour is the only evidence two rows were weighed. The two briefs that
   * already wrote it are both dated 2026-09-11 and so predate
   * RUNG_REQUIRED_FROM: the convention had never once been run past this
   * function, and the day it was, it failed. Stripped before counting, not
   * after, so `named` never sees it. */
  const asserted = text.replace(REJECTED_RUNG, ' ');
  /* Backticked, the way the ladder writes them and the way the finding asks for.
   * A bare word would match `default` inside ordinary prose. */
  const named = Object.keys(RUNGS).filter((rung) => asserted.includes('`' + rung + '`'));

  if (named.length === 0) {
    return [
      'names no rung. Say which row of the ladder this task reaches — ' +
        Object.keys(RUNGS).map((r) => '`' + r + '`').join(', ') +
        ' — in .claude/skills/model-and-effort/SKILL.md, and the effort that row ' +
        'prescribes. A model and an effort with no row behind them are a habit, ' +
        'not a choice',
    ];
  }

  if (named.length > 1) {
    return [
      'names ' + named.length + ' rungs (' + named.join(', ') + '). ' +
        'One task stops on one row; two rows means the field was edited and not re-read',
    ];
  }

  const rung = named[0];
  const wanted = RUNGS[rung];
  const efforts = [
    ...new Set((text.match(/\b(low|medium|xhigh|high)\b/gi) || []).map((e) => e.toLowerCase())),
  ];

  if (efforts.length === 0) {
    return ['names rung `' + rung + '` but no effort. That row prescribes `' + wanted + '`'];
  }
  if (!efforts.includes(wanted)) {
    return [
      'names rung `' + rung + '`, which prescribes effort `' + wanted + '`, ' +
        'but declares ' + efforts.map((e) => '`' + e + '`').join(' and ') +
        '. Either the rung is wrong or the effort is',
    ];
  }
  return [];
}

export function budgetAppliesTo(filename) {
  return budgetForBrief(filename) !== null;
}

/**
 * WHICH budget table this brief is held to, or null for none.
 *
 * Dated tables rather than one edited in place, because a cap cannot be
 * lowered under a brief that is already written: `check:briefs` reads the whole
 * directory on every run, so an edit in place would fail files whose decisions
 * nobody is re-taking. Same reasoning as `UPSTREAM_REQUIRED_FROM`, applied to a
 * number instead of to a heading.
 *
 * An undated filename gets the STRICTEST table, which is the same fail-closed
 * direction `requiredFieldsForBrief` takes: naming a file `draft.md` must not
 * be the way to buy back 2.650 bytes.
 */
export function budgetForBrief(filename) {
  const match = DATED.exec(String(filename ?? ''));
  if (!match) return TIGHTENED_FIELD_BUDGET;
  if (match[1] >= BUDGET_RAISED_FROM) return RAISED_FIELD_BUDGET;
  if (match[1] >= BUDGET_TIGHTENED_FROM) return TIGHTENED_FIELD_BUDGET;
  if (match[1] >= LENGTH_CAPPED_FROM) return FIELD_BUDGET;
  return null;
}

/** Same gate as the budget, for the rung rule. A name with no parseable date is
 * held to it, because the lenient default fails open. */
export function rungAppliesTo(filename) {
  const match = DATED.exec(String(filename ?? ''));
  return match ? match[1] >= RUNG_REQUIRED_FROM : true;
}

/**
 * Which fields a brief of this name must carry.
 *
 * A name with no parseable date gets the strict set, and that direction is
 * deliberate. The lenient default fails open: somebody names a file
 * `draft.md`, the upstream fields go unasked, and the check reports green over
 * a brief it decided not to inspect. The strict default fails loudly and the
 * repair is to name the file the way every other brief here is named.
 *
 * String comparison rather than Date, because ISO dates sort correctly as text
 * and parsing introduces a timezone this has no business having an opinion
 * about.
 */
export function requiredFieldsForBrief(filename) {
  const dated = DATED.exec(String(filename ?? ''));
  if (dated && dated[1] < UPSTREAM_REQUIRED_FROM) {
    return BRIEF_FIELDS.filter((f) => !UPSTREAM_FIELDS.includes(f));
  }
  return BRIEF_FIELDS;
}

/**
 * The explicit gap marker.
 *
 * It has to be TYPED rather than inferred from an empty section, and that is
 * the whole design. An empty heading is indistinguishable from an unfinished
 * draft; a line saying GAP is somebody stating they do not know. The point is
 * to make not-knowing a deliberate act rather than an absence.
 */
export const GAP_MARKER = /^>\s*GAP:\s*(.+)$/gim;

/**
 * A person, named and dated, as a citation.
 *
 * This is the adaptation that a workspace like this one needs and a
 * document-backed repository does not. Here the most common source for a
 * product fact is that somebody said it in a conversation, and a conversation
 * has no URL. Without a form for it, a writer has two bad options: mark a fact
 * they were plainly told as a gap, or invent a link — and inventing the link is
 * the one that survives review.
 *
 * It is trivially forgeable, and so is every other citation shape. Enforcement
 * is not the point; visibility is. `SOURCE: Dana, 2026-08-13` tells the next
 * reader who to go and ask, which is the whole job.
 */
export const SOURCE_MARKER = /^>\s*SOURCE:\s*(.+)$/gim;

/**
 * A citation is a markdown link, an inline-code repo path, or a URL.
 *
 * Deliberately generous about shape, because narrowing it would push a writer
 * to omit a source rather than cite it in an unexpected form. Whether the
 * citation actually supports the claim is judgement and stays out of scope,
 * which is the boundary where the reviewing tier begins.
 *
 * Generous about shape is not the same as generous about substance, and the
 * first version confused the two in both directions. It accepted `[](x)` and
 * `[see below](#scope)` — a link with no text and a link that points back into
 * the same document, neither of which sends a reader anywhere — while its
 * extension allowlist rejected every image format, so a designer citing the
 * screenshot that proves the work was told the section was uncited. CLAUDE.md
 * names a screenshot as evidence; the checker had no shape for one.
 *
 * The allowlist stays an allowlist rather than becoming "any dotted token",
 * because that version reads `some-pkg@1.11.0` as a citation and a checker
 * that counts a version number as evidence is worse than one that misses a
 * `.png`.
 */
const CITED_EXTENSIONS =
  'ts|tsx|mts|cts|js|jsx|mjs|cjs|json|md|mdx|css|scss|html|yml|yaml|png|jpg|jpeg|svg|webp|gif|pdf|txt|csv';

export const CITATION = new RegExp(
  [
    // A markdown link with text, pointing somewhere other than this document.
    String.raw`\[[^\]\n]+\]\(\s*(?!#)[^)\s]+\s*\)`,
    // A backticked repo path, optionally with a line anchor.
    String.raw`\`[\w.@/-]+\.(?:${CITED_EXTENSIONS})(?:#L\d+(?:-L\d+)?)?\``,
    String.raw`https?:\/\/\S+`,
  ].join('|'),
  'g',
);

/**
 * Blank out fenced code blocks, keeping the line count so nothing downstream
 * shifts.
 *
 * A fenced EXAMPLE of a marker is not a stated gap. This matters more than it
 * looks: the template below contains examples of every marker, so without this
 * the template itself would pass its own check, and so would any brief that
 * copied it and filled in nothing.
 */
/**
 * Walks lines tracking which fence, if any, is open.
 *
 * Which one matters. Toggling on either marker means a `~~~` line inside a
 * ``` block closes it, and everything after leaks out — measured: a body whose
 * only content was a fenced example containing `~~~` and a `> SOURCE:` line
 * counted that example as a real attribution, which is verbatim what fence
 * handling exists to prevent. A fence closes on the marker that opened it.
 */
function* walk(markdown) {
  let open = null;
  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      const marker = fence[1];
      if (open === null) open = marker;
      else if (open === marker) open = null;
      // A non-matching marker while a fence is open is content, not a fence.
      yield { line, fenced: true, isFenceMarker: true };
      continue;
    }
    yield { line, fenced: open !== null, isFenceMarker: false };
  }
}

/** Blank out fenced blocks, keeping the line count so nothing downstream shifts. */
export function stripFences(markdown) {
  const out = [];
  for (const { line, fenced } of walk(markdown)) out.push(fenced ? '' : line);
  return out.join('\n');
}

const countMatches = (text, re) =>
  (text.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) || []).length;

/**
 * The short forms people actually write, mapped to the field they mean.
 *
 * These are the ones no prefix rule reaches in either direction: `Task list`
 * shares no prefix with `Tasks`, and `Dependency` shares none with
 * `Dependencies`. Measured 2026-08-13, every one of these resolved to no field
 * at all — so the run reported `no "## Tasks" section` while a heading saying
 * exactly that sat in front of the author, and the obvious repair was to add a
 * second section rather than rename one.
 */
const HEADING_ALIASES = new Map([
  ['task list', 'Tasks'],
  ['task', 'Tasks'],
  ['steps', 'Tasks'],
  ['dependency', 'Dependencies'],
  ['depends on', 'Dependencies'],
  ['goal', 'Objective'],
  ['evidence', 'Validation'],
  // Five aliases left on 2026-09-14 with the two fields they resolved to:
  // `Magic moment` and `The magic moment`, then `Screen`, `Screens` and
  // `Key screens`. An alias outliving its field is worse than no alias: it
  // returns a name that is in no table, so the heading is neither recognised
  // nor reported.
  ['differentiation', 'Differentiator'],
]);

/**
 * Which field a heading means, or null.
 *
 * Three rules, tried in order, all case-insensitive and all after normalising
 * `&` to `and` — the ampersand form is the one CLAUDE.md records as having
 * already cost somebody a whole section silently, and it was still live for
 * every variant except the single line that was edited at the time.
 *
 * 1. The heading starts with the field: `Scope (in and out)`, `Validation and
 *    evidence`. This is the original rule and it still does most of the work.
 * 2. The field starts with the heading: `Context` for `Context and rules`.
 *    Floored at four characters, so a one-letter heading cannot claim a field.
 * 3. An explicit alias, for the irregular forms above.
 *
 * Longest field first, so a field whose name is another's prefix resolves by
 * specificity rather than by declaration order.
 */
export function fieldFor(heading) {
  const norm = heading.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
  const byLength = [...BRIEF_FIELDS].sort((a, b) => b.length - a.length);

  const prefix = byLength.find((f) => norm.startsWith(f.toLowerCase()));
  if (prefix) return prefix;

  if (norm.length >= 4) {
    const expands = byLength.find((f) => f.toLowerCase().startsWith(norm));
    if (expands) return expands;
  }

  for (const [alias, field] of HEADING_ALIASES) {
    if (norm === alias || norm.startsWith(`${alias} `)) return field;
  }

  return null;
}

/** The synthetic heading given to everything above the first `##`. */
export const PREAMBLE = '(preamble)';

/**
 * Split a brief into its sections.
 *
 * Matches `## <field>` case-insensitively and tolerates decoration, so someone
 * who writes `## Scope (in / out)` is not failed over formatting. The field
 * name is what is checked; how it is dressed is not this module's business.
 *
 * Everything above the first `##` becomes a section too, and that is not
 * cosmetic. Measured 2026-08-13: content there was never buffered and so was
 * never checked, and a brief whose preamble read "Starter clients churn twice
 * as often as Pro clients" passed. It is also precisely where a non-engineer
 * writes the situation, it reads to the next human exactly like the rest of the
 * document, and the repo's own first brief already uses that zone — so the
 * habit was modelled before it was checked.
 *
 * `resolve` exists so a second document type can borrow this splitter instead
 * of copying it. `feedback-fields.mjs` passes its own heading resolver and gets
 * the fence handling above for free — which is the half worth sharing, because
 * a duplicate of it would be a duplicate that silently lacks the `~~~`-inside-
 * a-``` fix, and nothing about the copy would say so.
 */
export function splitSections(markdown, resolve = fieldFor) {
  /** @type {{heading: string, field: string|null, body: string}[]} */
  const sections = [];

  let current = { heading: PREAMBLE, field: null };
  let buffer = [];
  const flush = () => {
    if (current) sections.push({ ...current, body: buffer.join('\n').trim() });
    buffer = [];
  };

  for (const { line, fenced } of walk(markdown)) {
    // A `##` inside a fenced block is example markdown, not a heading. Without
    // this, a template that demonstrates the section layout would be parsed as
    // having those sections.
    const m = fenced ? null : /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      const heading = m[1].trim();
      current = { heading, field: resolve(heading) };
      continue;
    }
    // The document's own H1 is its title, not a claim. Everything else in the
    // preamble is prose somebody wrote and stands behind.
    if (current.heading === PREAMBLE && !fenced && /^#\s+/.test(line)) continue;
    buffer.push(line);
  }
  flush();
  return sections.filter((s) => s.heading !== PREAMBLE || s.body.trim());
}

/** The section for a field, or undefined. Returns the FIRST if a brief repeats one. */
export function sectionFor(sections, field) {
  return sections.find((s) => s.field === field);
}

/**
 * Check one brief.
 *
 * `required` exists so that a field can be added without invalidating every
 * brief written before it. It names which fields must be PRESENT; it changes
 * nothing else. A section that is written is checked for citation, attribution
 * or a stated gap whether it was required or not — the rule is about claims,
 * not about which headings were mandatory on the day.
 *
 * The caller decides, and `requiredFieldsForBrief` below is how it decides.
 * Neither touches the filesystem — one takes text, the other takes a name — so
 * the cutoff is testable against two strings rather than against a directory.
 *
 * @param {string} markdown
 * @param {{ required?: readonly string[] }} [options]
 * @returns {{ ok: boolean, findings: {field: string, code: string, detail: string}[], stats: object }}
 */
export function checkBrief(markdown, options = {}) {
  const required = options.required ?? BRIEF_FIELDS;
  const budgeted = options.budget === true ? FIELD_BUDGET : (options.budget || null);
  const rungRequired = options.rung ?? false;
  const text = String(markdown ?? '');
  const sections = splitSections(text);
  const findings = [];
  let cited = 0;
  let gaps = 0;
  let sourced = 0;

  // Every required field is present, exactly once.
  for (const field of required) {
    const matching = sections.filter((s) => s.field === field);

    if (matching.length === 0) {
      findings.push({
        field,
        code: 'missing',
        detail:
          `no "## ${field}" section. A missing field is not a gap: ` +
          `a gap is something you SAY you do not know.`,
      });
      continue;
    }

    // Two headings resolving to one field used to silently overwrite, so
    // "## Scope (in)" with uncited prose followed by a cited "## Scope (out)"
    // passed with the first one never read. Splitting a field in two is
    // legitimate writing; having it checked once is not.
    if (matching.length > 1) {
      findings.push({
        field,
        code: 'duplicate',
        detail:
          `${matching.length} headings resolve to "${field}" ` +
          `(${matching.map((s) => `"${s.heading}"`).join(', ')}). ` +
          `Merge them: only one can be the section, and the others would go unchecked.`,
      });
    }
  }

  // Then EVERY section, required or not, has to stand behind what it says.
  //
  // Checking only the seven left a hole big enough to drive a fabricated
  // statistic through: an extra "## Background" saying "Starter customers churn
  // twice as often" was never inspected, because it matched no field name. The
  // rule is about claims, not about headings, so it applies to all of them.
  for (const section of sections) {
    const label = section.field ?? section.heading;
    const body = stripFences(section.body);

    if (!body.trim()) {
      // A section holding ONLY a code block is not an empty section, and calling
      // it one was this checker doing the inverse of its job. Measured
      // 2026-08-13: a real `pnpm build` log pasted into Validation — the most
      // literal possible reading of "closes with evidence, never with an
      // assertion" — reported "## Validation is empty". The repair that message
      // invites is to delete the log and write "the build passes", which is the
      // unsupported assertion the whole tool exists to catch. It told the author
      // that was an improvement.
      //
      // The block still cannot stand alone, because a pasted log says what
      // happened and not who ran it or when. So it gets its own finding, naming
      // what is actually missing.
      if (section.body.trim()) {
        findings.push({
          field: label,
          code: 'unattributed-block',
          detail:
            `"## ${section.heading}" is only a code block. The check cannot read ` +
            `pasted output as attribution — add "> SOURCE: who ran it, when" ` +
            `beside it. Keep the block: it is the evidence.`,
        });
        continue;
      }

      // An unrecognized empty section is just a heading someone left; only the
      // required ones are worth a finding.
      if (section.field) {
        findings.push({
          field: label,
          code: 'empty',
          detail:
            `"## ${section.heading}" is empty. Write it, or state the gap with ` +
            `"> GAP: ...". An empty section reads as unfinished, not as unknown.`,
        });
      }
      continue;
    }

    // Everything is counted before anything is judged. Counting inside the
    // branches under-reported: a section that stated a gap returned early, so
    // its citations were never added, and the summary line said "1 cited" about
    // a document with five links in it. A check that undercounts its own
    // evidence is a small lie in the tool built to catch them.
    const gapCount = countMatches(body, GAP_MARKER);
    const sourceCount = countMatches(body, SOURCE_MARKER);
    const citationCount = countMatches(body, CITATION);

    gaps += gapCount;
    sourced += sourceCount;
    cited += citationCount;

    if (gapCount) continue; // A stated gap is a complete answer. It needs no citation.

    if (!sourceCount && !citationCount) {
      findings.push({
        field: label,
        code: 'uncited',
        detail:
          `"## ${section.heading}" has prose with no citation, no ` +
          `"> SOURCE: who, when", and no "> GAP: ...". An uncited paragraph is ` +
          `the one thing that makes this document worse than nothing, because ` +
          `it reads exactly like a researched one.`,
      });
    }
  }

  /* The budget, checked AFTER the citation rules and separately from them.
   * Over-length is a different defect from unsupported: the first is unedited
   * writing, the second is a claim with nothing behind it, and reporting them
   * together would let somebody read a length finding as a sourcing one. */
  /* The rung, checked separately from both. An Autonomy that is cited and
   * within budget can still have filled itself in by habit, which is a third
   * defect and needs its own finding rather than to ride on one of theirs. */
  if (rungRequired) {
    const autonomy = sections.find((s) => s.field === 'Autonomy');
    if (autonomy) {
      for (const detail of autonomyFailures(stripFences(autonomy.body))) {
        findings.push({ field: 'Autonomy', code: 'rung', detail: `"## ${autonomy.heading}" ${detail}.` });
      }
    }
  }

  if (budgeted) {
    for (const section of sections) {
      const cap = budgeted[section.field];
      if (!cap) continue;
      const bytes = Buffer.byteLength(section.body.trim(), 'utf8');
      if (bytes <= cap) continue;
      findings.push({
        field: section.field,
        code: 'over-budget',
        detail:
          `"## ${section.heading}" is ${bytes} bytes against a budget of ${cap}. ` +
          `A brief is written into the conversation and then carried in every ` +
          `later call of the session, so length is paid twice. Cite the thing ` +
          `instead of transcribing it, and state the rule instead of narrating ` +
          `how it was found — the narration belongs in docs/ or a PDR, which ` +
          `this can then cite in one line.`,
      });
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    stats: { fields: required.length, sections: sections.length, cited, sourced, gaps },
  };
}
