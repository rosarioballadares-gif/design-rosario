/**
 * `pnpm figma:comments <url|key> [--open] [--json]` - a Figma file's comments,
 * threaded and grouped by node.
 *
 * Reads `FIGMA_TOKEN` from the environment or `.env.local`: a personal access
 * token with the `file_comments:read` scope. The token is sent to
 * api.figma.com and nowhere else, and never printed.
 */

import { existsSync } from 'node:fs';
import { fileKeyOf, formatThreads, threadsByNode } from './figma-comments-rules.mjs';

const args = process.argv.slice(2);
const open = args.includes('--open');
const json = args.includes('--json');
const input = args.find((a) => !a.startsWith('--'));

const fail = (message) => {
  console.error(`figma:comments - ${message}`);
  process.exit(1);
};

const key = fileKeyOf(input);
if (!key) fail('give a Figma file URL or its key: pnpm figma:comments <url|key> [--open] [--json]');
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const token = process.env.FIGMA_TOKEN;
if (!token) fail('no FIGMA_TOKEN in the environment or .env.local. Create a personal access token in Figma, Settings > Security, with the file_comments:read scope.');

const response = await fetch(`https://api.figma.com/v1/files/${key}/comments`, { headers: { 'X-Figma-Token': token } });
if (!response.ok) {
  const cause = {
    403: 'the token is expired, lacks the file_comments:read scope, or its account cannot open this file',
    404: 'no file with this key, or the token\'s account cannot see it',
    429: 'rate limited by Figma; wait and run it again',
  }[response.status] ?? 'unexpected answer from Figma';
  fail(`${response.status} for file ${key}: ${cause}.`);
}

const { comments } = await response.json();
const groups = threadsByNode(comments, { open });
if (json) {
  console.log(JSON.stringify({ fileKey: key, groups }, null, 2));
} else {
  const threads = groups.reduce((n, g) => n + g.threads.length, 0);
  console.log(`figma:comments - file ${key}, ${open ? 'unresolved threads only' : 'every thread, resolved included'}. Read only.\n`);
  console.log(formatThreads(key, groups));
  console.log(`${threads} threads in ${groups.length} places, from ${comments.length} comments.`);
}
