/**
 * One usage rule per component that is a choice: the per-component rules the
 * `component` skill writes, one record per component in `records/`.
 *
 * A component here is born in code and the design file mirrors it, so a
 * record is anchored to its file in `src/ds/components/`, and the description
 * it is checked against is that file's JSDoc. `figmaNode` points at the
 * mirrored set in the design file, and is null for a team with no Figma.
 *
 * `group` and `competesWith` may be empty: a rival that is not built yet is
 * named in prose in the description, and the group is written when its second
 * member lands.
 */
import { z } from 'zod';

const nonEmpty = z.string().min(1);

/** A component's exported name, which is also its key everywhere below. The spec holds it to the set's prefix. */
const zExportName = z.string().regex(/^[A-Z][A-Za-z0-9]*$/);

const zId = z.string().regex(/^[a-z][a-z0-9-]*$/);

/** Four authored fields, each list with at least one entry. */
export const zGuidance = z
  .object({
    summary: nonEmpty,
    useWhen: z.array(nonEmpty).min(1),
    do: z.array(nonEmpty).min(1),
    dont: z.array(nonEmpty).min(1),
  })
  .strict();

/**
 * Where a claim came from — a citation, an attribution, or an admission that
 * nobody knows. There is no fourth state.
 */
const ATTRIBUTED = /^SOURCE: .+, \d{4}-\d{2}-\d{2}$/;
const ADMITTED = /^GAP: \S.*/;
const isCitation = (s: string) => s.startsWith('https://') || s.includes('/');

const zProvenance = nonEmpty.refine(
  (s) => ATTRIBUTED.test(s) || ADMITTED.test(s) || isCitation(s),
  'a rule needs `SOURCE: who, when`, `GAP: what nobody knows`, or a path or URL that can be opened',
);

/** The components people mistake for each other, and the one question that separates them. */
export const zGroup = z
  .object({
    id: zId,
    axis: nonEmpty.regex(/\?$/, 'the axis is a question, so it ends in a question mark'),
    none: nonEmpty.regex(/^None\b.*\S/, 'starts with `None` and then says what its presence means'),
    members: z.array(zExportName).min(2),
  })
  .strict();

export const zRecord = z
  .object({
    exportName: zExportName,
    /** The component's file, relative to the repository root. */
    sourcePath: z.string().regex(/^src\/ds\/components\/[A-Z][A-Za-z0-9]+\.tsx$/),
    /** The component set in the design file, as `123:456`; null when the team designs in no Figma. */
    figmaNode: z.string().regex(/^\d+:\d+$/).nullable(),
    group: zId.nullable(),
    competesWith: z.array(zExportName),
    /** One sentence per rival, only the half that separates them. */
    insteadOf: z.record(zExportName, nonEmpty),
    guidance: zGuidance,
    source: zProvenance,
  })
  .strict()
  .refine((r) => !r.competesWith.includes(r.exportName), 'a component does not compete with itself')
  .refine(
    (r) => {
      const rivals = [...r.competesWith].sort();
      const written = Object.keys(r.insteadOf).sort();
      return rivals.length === written.length && rivals.every((n, i) => n === written[i]);
    },
    'every rival named in `competesWith` gets exactly one `insteadOf` line, and nothing else does',
  )
  .refine((r) => (r.group === null) === (r.competesWith.length === 0), 'a group needs rivals, and rivals need a group');

export type Guidance = z.infer<typeof zGuidance>;
export type Group = z.infer<typeof zGroup>;
export type ComponentRecord = z.infer<typeof zRecord>;

export const group = (g: Group) => g;
export const record = (r: ComponentRecord) => r;
