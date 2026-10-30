/**
 * A Figma file's comments, threaded and grouped by the node each is pinned to.
 *
 * **WHY THIS EXISTS.** Neither the Figma MCP server nor the Plugin API exposes
 * comments, and the email Figma sends carries other people's comments but never
 * your own. The REST endpoint `GET /v1/files/:key/comments` is the one route
 * that returns all of them, so the agent reads review notes from there rather
 * than from somebody copying them by hand.
 *
 * **Read only.** Nothing here replies to a comment or resolves one.
 *
 * The pure half lives here and the network lives in `figma-comments.mjs`, the
 * same split the siblings use.
 */

/** The path segments that carry a file key, in every URL shape Figma hands out. */
const KEYED = /figma\.com\/(?:design|file|board|proto|slides|make)\/([A-Za-z0-9]+)(?:\/branch\/([A-Za-z0-9]+))?/;

/** A bare file key, as pasted on its own. */
const BARE = /^[A-Za-z0-9]{10,}$/;

/**
 * The file key from a Figma URL or a bare key, or null.
 *
 * A branch URL answers with the BRANCH key: its comments are the branch's own,
 * and asking the main file's key would return the wrong set without saying so.
 */
export function fileKeyOf(input) {
  const text = String(input ?? '').trim();
  const url = KEYED.exec(text);
  if (url) return url[2] ?? url[1];
  return BARE.test(text) ? text : null;
}

/** `1:2` as the `?node-id=1-2` a Figma URL carries. */
export function nodeLink(fileKey, nodeId) {
  return `https://www.figma.com/design/${fileKey}/?node-id=${nodeId.replace(/:/g, '-')}`;
}

/**
 * The comments as threads, grouped by node.
 *
 * A root is a comment with no `parent_id`; a reply hangs under its root. A root
 * pinned to the canvas rather than to a node groups under `null`. A reply whose
 * root is missing from the response is kept as a root of its own, because
 * dropping it would lose a comment silently. `open` keeps only the threads whose
 * root is unresolved.
 *
 * Groups keep the order of their first thread; threads and replies run oldest
 * first.
 */
export function threadsByNode(comments, { open = false } = {}) {
  const list = [...(comments ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const ids = new Set(list.map((c) => c.id));
  const roots = list.filter((c) => !c.parent_id || !ids.has(c.parent_id));
  const replies = new Map();
  for (const c of list) {
    if (!c.parent_id || !ids.has(c.parent_id)) continue;
    replies.set(c.parent_id, [...(replies.get(c.parent_id) ?? []), c]);
  }
  const groups = new Map();
  for (const root of roots) {
    if (open && root.resolved_at) continue;
    const node = root.client_meta?.node_id ?? null;
    if (!groups.has(node)) groups.set(node, []);
    groups.get(node).push({ ...entry(root), replies: (replies.get(root.id) ?? []).map(entry) });
  }
  return [...groups].map(([node, threads]) => ({ node, threads }));
}

/** The fields a reader needs from one comment. */
function entry(c) {
  return {
    id: c.id,
    order: c.order_id ?? null,
    author: c.user?.handle ?? 'unknown',
    at: c.created_at,
    resolved: Boolean(c.resolved_at),
    message: String(c.message ?? ''),
  };
}

/** The grouped threads as plain text, one block per node. */
export function formatThreads(fileKey, groups) {
  const lines = [];
  for (const { node, threads } of groups) {
    lines.push(node ? `node ${node}  ${nodeLink(fileKey, node)}` : 'pinned to the canvas, no node');
    for (const t of threads) {
      lines.push(`  ${head(t)}${t.resolved ? '  [resolved]' : ''}`, ...body(t.message, '    '));
      for (const r of t.replies) lines.push(`    ↳ ${head(r)}`, ...body(r.message, '      '));
    }
    lines.push('');
  }
  return lines.join('\n');
}

function head(c) {
  return `${c.order ? `#${c.order} ` : ''}${c.author}, ${String(c.at).slice(0, 10)}`;
}

function body(message, indent) {
  return message.split('\n').map((line) => `${indent}${line}`);
}
