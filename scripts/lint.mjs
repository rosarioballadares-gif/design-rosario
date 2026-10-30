/**
 * `pnpm lint` — oxlint, with the scope on the first line and the verdict on
 * the last, as every other check here prints them.
 *
 * oxlint itself prints NOTHING when it finds nothing, so a run read with
 * `tail` showed an empty screen and only the exit code said it passed —
 * measured in the base's rehearsal, 2026-10-08, by three stages. And it exits
 * 0 over warnings, so the verdict counts them rather than trusting the code.
 * The rules are oxlint's and `.oxlintrc.json`'s; this adds two lines and
 * passes the exit code through untouched.
 *
 * Brief: briefs/2026-10-08-user-hooks.md
 */
import { spawnSync } from 'node:child_process';

console.log('lint - oxlint over the repository, with the rules in .oxlintrc.json. It reads code, never copy or a rendered screen.');

const run = spawnSync('oxlint', process.argv.slice(2), { encoding: 'utf8', shell: true });
const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
if (out.trim()) process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);

const code = run.status ?? 1;
const warnings = (out.match(/: warning /g) ?? []).length;

if (code !== 0) console.log(`FAIL — oxlint exited ${code}; its findings are above.`);
else if (warnings) console.log(`OK — no error; ${warnings} warning(s) above, which oxlint does not fail on.`);
else console.log('OK — oxlint found nothing to report.');
process.exit(code);
