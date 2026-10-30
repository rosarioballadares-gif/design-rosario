import type { ComponentRecord, Group } from './schema';

/**
 * Every component in `src/ds/components/`, one record each, imported from
 * `records/<Name>`. One with no rival in sight has `group: null`; an internal
 * part gets none. Empty until the `component` skill builds the first one.
 */
export const RECORDS: ComponentRecord[] = [];

/**
 * The components people mistake for each other, and the one question that
 * separates them. Written when a group's second member lands.
 */
export const GROUPS: Group[] = [];
