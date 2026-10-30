/**
 * Tests for the brief checker.
 *
 * This is the first test in this repository of this repository's own code —
 * `pnpm test:run` was 35 schema assertions over the product context and nothing
 * else, which BACKLOG.md section 6 records as the standing gap.
 *
 * It exists because the checker was measured on 2026-08-13 doing the exact
 * inverse of its job: it rejected a real `pnpm build` log and a screenshot
 * citation, and it accepted an unsupported assertion, an empty markdown link and
 * a paragraph of fabricated statistics. A tool built to make unsupported claims
 * visible cannot be trusted on reading alone — the only way to know which way it
 * points is to run it.
 */

import { describe, expect, it } from 'vitest';
import {
  FIELD_BUDGET,
  TIGHTENED_FIELD_BUDGET,
  BUDGET_TIGHTENED_FROM,
  BUDGET_RAISED_FROM,
  RAISED_FIELD_BUDGET,
  budgetAppliesTo,
  budgetForBrief,
  BRIEF_FIELDS,
  UPSTREAM_FIELDS,
  UPSTREAM_REQUIRED_FROM,
  checkBrief,
  fieldFor,
  requiredFieldsForBrief,
  splitSections,
  stripFences,
  autonomyFailures,
  RUNGS,
} from './brief-fields.mjs';

/** A brief that passes, so a test can change exactly one thing and see it fail. */
const brief = (overrides = {}) => {
  const sections = {
    Objective: 'Ship it. [App](../src/App.tsx)',
    Differentiator: 'Nobody else does it. [App](../src/App.tsx)',
    'Context and rules': 'Verified. [App](../src/App.tsx)',
    Dependencies: 'None. [App](../src/App.tsx)',
    Scope: 'In: this. Out: that. [App](../src/App.tsx)',
    Tasks: '1. Do it. [App](../src/App.tsx)',
    Autonomy: 'Checkpoints. [App](../src/App.tsx)',
    Validation: 'It ran. [App](../src/App.tsx)',
    ...overrides,
  };
  return (
    '# Brief: a probe\n\n' +
    Object.entries(sections)
      .map(([h, body]) => `## ${h}\n${body}`)
      .join('\n\n')
  );
};

const codes = (markdown) => checkBrief(markdown).findings.map((f) => f.code);

describe('the baseline holds', () => {
  it('passes a brief where every section cites something', () => {
    expect(checkBrief(brief()).ok).toBe(true);
  });

  it('still fails a brief that is missing a field', () => {
    const without = brief();
    expect(checkBrief(without.replace('## Validation\nIt ran. [App](../src/App.tsx)', '')).ok).toBe(
      false,
    );
  });

  it('still counts a stated gap as a complete answer', () => {
    expect(checkBrief(brief({ Validation: '> GAP: nobody has run it yet' })).ok).toBe(true);
  });

  it('still refuses to read a fenced example of a marker as a real one', () => {
    expect(checkBrief(brief({ Validation: '```\n> SOURCE: nobody, never\n```' })).ok).toBe(false);
  });

  it('still closes a fence on the marker that opened it', () => {
    expect(stripFences('```\n~~~\n> SOURCE: leaked\n```\nout').trim()).toBe('out');
  });
});

describe('evidence that is real has to pass', () => {
  // Measured 2026-08-13: pasting a real build log — the most literal reading of
  // "closes with evidence, never with an assertion" — reported the section
  // EMPTY. The repair a writer would then make is to delete the log and write
  // "the build passes", which is the unsupported assertion the tool exists to
  // catch. It told the author that was an improvement.
  it('does not call a section empty when it holds a fenced terminal log', () => {
    const log = '```\n$ pnpm build\nvite v8.2.0 building for production...\nbuilt in 1.24s\n```';
    expect(codes(brief({ Validation: log }))).not.toContain('empty');
  });

  it('names what a code-block-only section is actually missing', () => {
    const log = '```\n$ pnpm build\nbuilt in 1.24s\n```';
    const finding = checkBrief(brief({ Validation: log })).findings.find(
      (f) => f.field === 'Validation',
    );
    expect(finding?.code).toBe('unattributed-block');
    expect(finding?.detail).toMatch(/SOURCE/);
  });

  it('accepts a fenced log that says who ran it', () => {
    const log = '```\n$ pnpm build\nbuilt in 1.24s\n```\n\n> SOURCE: Ian Rueff, 2026-08-13';
    expect(checkBrief(brief({ Validation: log })).ok).toBe(true);
  });

  // CLAUDE.md names "a screenshot of the thing rendering" as evidence, and the
  // extension allowlist did not include a single image format.
  it.each([
    'shots/empty-state.png',
    'shots/dashboard.jpg',
    'art/icon.svg',
    'index.html',
    'docs/notes.yaml',
    'src/App.jsx',
    'src/styles.scss',
  ])('accepts `%s` as a citation', (path) => {
    expect(checkBrief(brief({ Validation: `Rendered: \`${path}\`` })).ok).toBe(true);
  });

  it('does not mistake a version number for a citation', () => {
    expect(checkBrief(brief({ Validation: 'We use `some-pkg@1.11.0`.' })).ok).toBe(false);
  });
});

describe('citations that point at nothing have to fail', () => {
  it('rejects an empty markdown link', () => {
    expect(checkBrief(brief({ Validation: 'Proven [](x)' })).ok).toBe(false);
  });

  it('rejects a link whose target is a bare anchor', () => {
    expect(checkBrief(brief({ Validation: 'Proven [see below](#scope)' })).ok).toBe(false);
  });

  it('still accepts a real relative link', () => {
    expect(checkBrief(brief({ Validation: 'Proven [App](../src/App.tsx)' })).ok).toBe(true);
  });
});

describe('nothing gets smuggled above the first heading', () => {
  // Measured 2026-08-13: everything before the first `##` was never buffered,
  // so it was never checked. It is also exactly where a non-engineer writes the
  // situation, and it reads to the next human like the rest of the document.
  it('checks a preamble paragraph that cites nothing', () => {
    const smuggled = brief().replace(
      '# Brief: a probe\n',
      '# Brief: a probe\n\nStarter clients churn twice as often as Pro clients.\n',
    );
    expect(checkBrief(smuggled).ok).toBe(false);
    expect(codes(smuggled)).toContain('uncited');
  });

  it('accepts a preamble that cites', () => {
    const cited = brief().replace(
      '# Brief: a probe\n',
      '# Brief: a probe\n\nFollows on from [the empty state](2026-08-13-report-empty-state.md).\n',
    );
    expect(checkBrief(cited).ok).toBe(true);
  });

  it('does not trip on the title line alone', () => {
    expect(checkBrief(brief()).ok).toBe(true);
  });
});

describe('the headings a person actually writes resolve', () => {
  const field = (heading) => splitSections(`${heading}\nbody`)[0].field;

  it.each([
    ['## Context', 'Context and rules'],
    ['## Context & rules', 'Context and rules'],
    ['## Context and rules', 'Context and rules'],
    ['## Task list', 'Tasks'],
    ['## Task', 'Tasks'],
    ['## Dependency', 'Dependencies'],
    ['## Scope (in and out)', 'Scope'],
    ['## Validation and evidence', 'Validation'],
    ['## Objective', 'Objective'],
    ['## Autonomy', 'Autonomy'],
  ])('%s resolves to %s', (heading, expected) => {
    expect(field(heading)).toBe(expected);
  });

  it('leaves a genuinely unrelated heading unresolved', () => {
    expect(field('## Background')).toBe(null);
  });

  // The ampersand form is the one CLAUDE.md records as having already cost
  // someone a whole section once, silently.
  it('does not lose a section written with an ampersand', () => {
    const amp = brief().replace('## Context and rules', '## Context & rules');
    expect(checkBrief(amp).ok).toBe(true);
  });

  it('still reports two headings that resolve to one field', () => {
    const dup = `${brief()}\n\n## Scope (out)\nAlso this. [App](../src/App.tsx)`;
    expect(codes(dup)).toContain('duplicate');
  });
});

describe('the three upstream fields', () => {
  it('are required by default, so a brief that answers only the old seven fails', () => {
    const old = brief();
    const stripped = UPSTREAM_FIELDS.reduce(
      (text, f) => text.replace(new RegExp(`## ${f}\n[^\n]*\n\n`), ''),
      old,
    );
    const result = checkBrief(stripped);
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.field).sort()).toEqual([...UPSTREAM_FIELDS].sort());
  });

  it('names the missing one rather than reporting a generic failure', () => {
    const without = brief().replace(new RegExp(`## Differentiator\\n[^\\n]*\\n\\n`), '');
    const finding = checkBrief(without).findings.find((f) => f.field === 'Differentiator');
    expect(finding?.code).toBe('missing');
  });

  it('accept a stated gap, which is the answer for work with no product upstream', () => {
    expect(
      checkBrief(brief({ Differentiator: '> GAP: nobody has named the alternative.' })).ok,
    ).toBe(true);
  });

  it('reject an upstream section that only asserts', () => {
    expect(checkBrief(brief({ Differentiator: 'It is simply better.' })).ok).toBe(false);
  });
});

describe('the headings somebody actually writes for them resolve', () => {
  // `Differentiation` matches none of fieldFor's three rules, so it needs the
  // alias or the check reports a missing section while the heading sits in
  // front of the author.
  it.each([
    ['Differentiator', 'Differentiator'],
    ['Differentiator (vs doing nothing)', 'Differentiator'],
    ['Differentiation', 'Differentiator'],
  ])('%s resolves to %s', (heading, field) => {
    expect(fieldFor(heading)).toBe(field);
  });

  it('does not let a new field steal a heading that already resolved', () => {
    for (const field of BRIEF_FIELDS) expect(fieldFor(field)).toBe(field);
  });
});

describe('the cutoff protects briefs written before the fields existed', () => {
  const LEGACY = BRIEF_FIELDS.filter((f) => !UPSTREAM_FIELDS.includes(f));

  it.each([
    ['2026-08-13-layout-tokens.md', LEGACY.length],
    ['2026-08-19-a-theme-fork.md', LEGACY.length],
    [`${UPSTREAM_REQUIRED_FROM}-anything.md`, BRIEF_FIELDS.length],
    ['2027-01-01-much-later.md', BRIEF_FIELDS.length],
  ])('%s is asked for %i fields', (filename, count) => {
    expect(requiredFieldsForBrief(filename).length).toBe(count);
  });

  // Failing OPEN would be the quiet version: name a file draft.md, the upstream
  // fields go unasked, and the run reports green over a brief it decided not to
  // inspect. The strict default is loud and the repair is to name the file.
  it.each(['TEMPLATE.md', 'draft.md', 'notes-2026-08-13.md', ''])(
    'treats %s, which carries no leading date, as new',
    (filename) => {
      expect(requiredFieldsForBrief(filename)).toEqual(BRIEF_FIELDS);
    },
  );

  // The one that measures the cutoff rather than asserting it: ONE document,
  // two filenames, opposite verdicts. Without both halves a green says nothing
  // about whether the rule is doing anything at all.
  it('passes and fails the same text depending only on the filename', () => {
    const sevenFields = UPSTREAM_FIELDS.reduce(
      (text, f) => text.replace(new RegExp(`## ${f}\n[^\n]*\n\n`), ''),
      brief(),
    );

    const asOld = checkBrief(sevenFields, {
      required: requiredFieldsForBrief('2026-08-14-dashboard.md'),
    });
    const asNew = checkBrief(sevenFields, {
      required: requiredFieldsForBrief('2026-08-21-dashboard.md'),
    });

    expect(asOld.ok).toBe(true);
    expect(asNew.ok).toBe(false);
  });

  it('reports how many fields the pass actually covered', () => {
    const result = checkBrief(brief(), { required: LEGACY });
    expect(result.stats.fields).toBe(LEGACY.length);
    expect(result.stats.fields).toBeLessThan(BRIEF_FIELDS.length);
  });

  // Exempt from being REQUIRED is not exempt from being checked. An old brief
  // that volunteers an upstream section still has to stand behind it, because
  // the citation rule is about claims and not about which headings were
  // mandatory.
  it('still checks an upstream section an exempt brief chose to write', () => {
    const volunteered = brief({ Differentiator: 'It is simply better.' });
    const result = checkBrief(volunteered, {
      required: requiredFieldsForBrief('2026-08-14-dashboard.md'),
    });
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain('uncited');
  });

  // `Moment` was a field until 2026-09-14 and 202 briefs still carry one. This
  // is the whole of what made deleting it backward-compatible: the section is
  // no longer required, no longer budgeted and no longer named by a field, and
  // it is STILL held to the citation rule under its own heading. Nothing else
  // in the suite would notice if that stopped being true.
  // `Moment` and `Key screen` were fields until 2026-09-14, and 202 briefs
  // still carry one or both. This is the whole of what made deleting them
  // backward-compatible: the section is no longer required, no longer budgeted
  // and no longer named by a field, and it is STILL held to the citation rule
  // under its own heading. Nothing else in the suite would notice if that
  // stopped being true. The aliases are checked in the same test because an
  // alias outliving its field resolves to a name in no table, which is neither
  // recognised nor reported.
  it.each([
    ['Moment', ['Magic moment', 'The magic moment']],
    ['Key screen', ['Screen', 'Screens', 'Key screens']],
  ])('holds the retired heading %s to the citation rule under its own name', (retired, aliases) => {
    expect(BRIEF_FIELDS).not.toContain(retired);
    expect(fieldFor(retired)).toBe(null);
    for (const alias of aliases) expect(fieldFor(alias), alias).toBe(null);

    const kept = brief({ [retired]: 'It came from the onboarding flow.' });
    expect(checkBrief(kept).findings.find((f) => f.field === retired)?.code).toBe('uncited');

    expect(checkBrief(brief({ [retired]: '> GAP: nobody decided.' })).ok).toBe(true);
  });
});

describe('the tightened budget', () => {
  it('lowers every field but Autonomy, which was the one measured squeeze', () => {
    // Measured 2026-09-14 over the 64 enforced briefs. Autonomy's cap had 17
    // bytes of headroom above its p90 while every other field had at least 99,
    // so it is the one number that goes UP. Pinned in both directions, because
    // a table that only ever drops would take this field down with it.
    for (const field of BRIEF_FIELDS) {
      const before = FIELD_BUDGET[field];
      const after = TIGHTENED_FIELD_BUDGET[field];
      expect(after, `${field} has no tightened cap`).toBeGreaterThan(0);
      if (field === 'Autonomy') expect(after).toBeGreaterThan(before);
      else expect(after, `${field} did not tighten`).toBeLessThan(before);
    }
  });

  it('picks the table by the brief date, and an undated name gets the strictest', () => {
    expect(budgetForBrief('2026-09-10-x.md')).toBe(null);
    expect(budgetForBrief('2026-09-11-x.md')).toBe(FIELD_BUDGET);
    expect(budgetForBrief('2026-09-14-x.md')).toBe(FIELD_BUDGET);
    expect(budgetForBrief(`${BUDGET_TIGHTENED_FROM}-x.md`)).toBe(TIGHTENED_FIELD_BUDGET);
    expect(budgetForBrief('2026-10-08-x.md')).toBe(TIGHTENED_FIELD_BUDGET);
    expect(budgetForBrief(`${BUDGET_RAISED_FROM}-x.md`)).toBe(RAISED_FIELD_BUDGET);
    expect(budgetForBrief('2027-01-01-x.md')).toBe(RAISED_FIELD_BUDGET);
    expect(RAISED_FIELD_BUDGET.Objective).toBe(TIGHTENED_FIELD_BUDGET.Objective);
    // Fails CLOSED: naming a file `draft.md` must not buy back the difference.
    expect(budgetForBrief('draft.md')).toBe(TIGHTENED_FIELD_BUDGET);
  });

  it('fires on a field that fits the old table and not the new one', () => {
    const between = 'x'.repeat(FIELD_BUDGET.Validation - 100) + ' [App](../src/App.tsx)';
    const body = brief({ Validation: between });
    expect(checkBrief(body, { budget: FIELD_BUDGET }).ok).toBe(true);
    expect(
      checkBrief(body, { budget: TIGHTENED_FIELD_BUDGET }).findings.map((f) => f.code),
    ).toContain('over-budget');
  });
});

describe('the field budget', () => {
  it('caps the two fields that are 55 per cent of a brief', () => {
    // Measured 2026-09-10 over 180 briefs: Context and rules averages 2.711
    // bytes and Validation 2.422, against a 9.370-byte mean brief. These two
    // numbers are the whole reason the budget exists, so they are pinned.
    expect(FIELD_BUDGET['Context and rules']).toBe(1500);
    expect(FIELD_BUDGET.Validation).toBe(1000);
  });

  it('gives every required field a cap, so none is silently exempt', () => {
    for (const field of BRIEF_FIELDS) {
      expect(FIELD_BUDGET[field], `${field} has no budget`).toBeGreaterThan(0);
    }
    expect(Object.keys(FIELD_BUDGET).sort()).toEqual([...BRIEF_FIELDS].sort());
  });

  it('is not enforced on the briefs that predate it', () => {
    // 133 of the 180 existing briefs would fail at least one cap. Trimming
    // files whose decisions nobody is re-taking is the failure this avoids —
    // the same reasoning UPSTREAM_REQUIRED_FROM already carries.
    expect(budgetAppliesTo('2026-09-10-something.md')).toBe(false);
    expect(budgetAppliesTo('2026-09-11-something.md')).toBe(true);
    expect(budgetAppliesTo('2026-12-01-something.md')).toBe(true);
  });

  it('budgets an undated filename, failing CLOSED', () => {
    // Naming a file `draft.md` must not be the way to switch the rule off.
    // This is the same direction requiredFieldsForBrief takes for the same
    // reason, and the opposite direction is how a check goes quiet.
    expect(budgetAppliesTo('draft.md')).toBe(true);
    expect(budgetAppliesTo('')).toBe(true);
    expect(budgetAppliesTo(undefined)).toBe(true);
  });

  it('reports over-length separately from unsupported', () => {
    // Two different defects. Over-budget is unedited writing; uncited is a
    // claim with nothing behind it. Merging the codes would let a reader
    // discharge one by fixing the other.
    const body = `# b\n\n${BRIEF_FIELDS.map((f) => `## ${f}\n\n> GAP: none.\n`).join('\n')}`;
    const fat = body.replace(
      '## Validation\n\n> GAP: none.',
      `## Validation\n\n> GAP: none.\n\n${'x'.repeat(1200)}`,
    );
    const result = checkBrief(fat, { budget: true });
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('over-budget');
    expect(codes).not.toContain('uncited');
    expect(result.findings.find((f) => f.code === 'over-budget').field).toBe('Validation');
  });

  it('does not fire at all when the budget is off', () => {
    const body = `# b\n\n${BRIEF_FIELDS.map(
      (f) => `## ${f}\n\n> GAP: none.\n${f === 'Validation' ? 'x'.repeat(4000) : ''}\n`,
    ).join('\n')}`;
    expect(checkBrief(body, { budget: false }).findings.map((f) => f.code)).not.toContain(
      'over-budget',
    );
    // The default is off, because the runner is what knows the filename.
    expect(checkBrief(body).findings.map((f) => f.code)).not.toContain('over-budget');
  });
});

describe('the rung in Autonomy', () => {
  it('accepts a rung whose effort matches the ladder', () => {
    expect(autonomyFailures('Checkpoints. Rung `default`: effort high, no fan-out.')).toEqual([]);
    expect(autonomyFailures('Rung `census`: sonnet, effort low, no fan-out.')).toEqual([]);
  });

  it('fails a model and an effort with no row behind them', () => {
    // The shape every brief of 2026-09-11 carried, and the reason this exists.
    const found = autonomyFailures('Checkpoints. Opus 5, effort high, no fan-out.');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/names no rung/);
  });

  it('fails a rung whose effort contradicts the ladder', () => {
    const found = autonomyFailures('Rung `default`, effort xhigh, no fan-out.');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/prescribes effort `high`/);
    expect(found[0]).toMatch(/`xhigh`/);
  });

  it('fails two rungs, because one task stops on one row', () => {
    expect(autonomyFailures('Rung `default` or `audit`, high.')).toHaveLength(1);
  });

  // TEMPLATE.md asks for the row NOT taken, which is the only evidence that
  // two rows were weighed — nothing can check whether a rung is the right one.
  // Counting the rejected row as a second choice made that form illegal, and
  // it went unnoticed because both briefs that already wrote it are dated
  // 2026-09-11 and predate RUNG_REQUIRED_FROM. Measured 2026-09-14.
  it.each(['Not', 'not', 'never', 'rather than', 'instead of'])(
    'accepts a row rejected with "%s", which is a weighing and not a second choice',
    (phrase) => {
      expect(
        autonomyFailures(`Checkpoints. RUNG \`repair\`, effort \`medium\`. ${phrase} \`default\`: no real diff.`),
      ).toEqual([]);
    },
  );

  it('still needs a rung ASSERTED: rejecting one is not choosing one', () => {
    expect(autonomyFailures('Checkpoints. Not `default`: no real diff.')[0]).toMatch(
      /names no rung/,
    );
  });

  it('fails a rung with no effort beside it', () => {
    expect(autonomyFailures('Rung `census`.')[0]).toMatch(/prescribes `low`/);
  });

  it('reads only backticked rung names, not the word in prose', () => {
    // "by default" and "a repair" are ordinary English and must not count.
    expect(autonomyFailures('By default this is a repair, effort high.')[0]).toMatch(/names no rung/);
  });

  it('says nothing about an empty or absent body', () => {
    expect(autonomyFailures('')).toEqual([]);
    expect(autonomyFailures(undefined)).toEqual([]);
  });

  it('holds RUNGS to the ladder it transcribes', async () => {
    // The pair lives in two places on purpose; this is what keeps them equal.
    const { readFile } = await import('node:fs/promises');
    const ladder = await readFile(
      new URL('../.claude/skills/model-and-effort/SKILL.md', import.meta.url),
      'utf8',
    );
    for (const [rung, effort] of Object.entries(RUNGS)) {
      const row = ladder.split('\n').find((l) => l.startsWith('| `' + rung + '`'));
      expect(row, 'the ladder has no row for ' + rung).toBeTruthy();
      expect(row).toContain('`' + effort + '`');
    }
  });
});
