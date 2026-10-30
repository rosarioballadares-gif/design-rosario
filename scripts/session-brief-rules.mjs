/**
 * What the session-start notice owes the agent about `/setup`, decided from
 * three reads: the profile, the wiring file and the briefs directory.
 *
 * Kept apart from `session-brief.mjs` because that file must exit 0 on
 * anything, so a wrong branch there fails silent: a clone that never offers
 * `/setup` looks exactly like one that has run it. Here each branch has a
 * spec.
 *
 * **The agent starts `/setup` itself.** The people this repository is handed
 * to have never seen it, and "there is a skill you should run" is exactly what
 * nobody says in time — so the notice tells the agent to run it on the first
 * message rather than telling the person to type it.
 *
 * Brief: briefs/2026-10-08-product-ops-base.md
 */

/** The line `workspace-wiring.md` carries until the client layer of `/setup` has run. */
export const NO_CLIENT = 'no client has been recorded';

/** A client spec, as the client layer names it. */
export const SPEC = /^\d{4}-\d{2}-\d{2}-client-setup\.md$/;

/** The template's own `origin`, https or ssh. The template has no client; its copies do. */
export const TEMPLATE = /[/:]studiohakuna\/product-ops-base(\.git)?\/?$/i;

/**
 * Which layers of `/setup` are owed.
 *
 * `wiringText` null means the file could not be read, which is read as no
 * client: a missing wiring file is a clone nobody has set up. An `origin` that
 * is the template itself owes no client, whatever the wiring file says.
 */
export function owedLayers({ hasProfile, wiringText, briefNames = [], origin = null }) {
  const template = TEMPLATE.test(origin ?? '');
  const client = !template && (wiringText === null || wiringText === undefined || wiringText.includes(NO_CLIENT));
  const spec = briefNames.find((name) => SPEC.test(name)) ?? null;
  return { client, person: !hasProfile, spec, template };
}

/** The notice for what is owed, or null when nothing is. */
export function setupNotice({ client, person, spec, template = false }) {
  if (client || person) {
    const layers = [client && 'the client (once for this repository)', person && 'you (once per person and machine)'].filter(Boolean);
    return [
      `This workspace has not recorded ${layers.join(' or ')} yet.`,
      'Agent: on the first message, before anything else, invoke the setup skill',
      `yourself — Skill(setup) — and run ${client && person ? 'both layers, client first' : client ? 'its client layer' : 'its person layer'}.`,
      'Tell the person that is what is happening, in one line.',
    ].join('\n');
  }
  if (!spec && !template) {
    return 'The client is recorded but no briefs/<date>-client-setup.md exists: the client layer of /setup did not finish. Offer to finish it.';
  }
  return null;
}
