/**
 * Every markdown link in a document, and whether the file it points at exists.
 *
 * **WHY THIS EXISTS.** The way this document gets smaller is by keeping the rule
 * and moving the evidence to `docs/`, leaving a pointer behind. That trade has
 * exactly one failure mode and it is silent: the pointer survives, the
 * destination is renamed or never written, and the reader is told the reasoning
 * is somewhere it is not. Nothing in this repository reads a link — no test, no
 * lint, no CI job — and `docs/README.md` says so about the filing rule it
 * states. A dangling pointer is worse than no pointer, because it reads as an
 * answer somebody could go and get.
 *
 * **It checks existence, never content.** A link to the right file about the
 * wrong thing passes, and so does a link to a file whose relevant paragraph was
 * deleted. That is printed on every run rather than filed here.
 *
 * Anchors (`#a-heading`) are stripped and NOT verified. A heading rename is a
 * real failure this does not catch, and catching it would mean parsing every
 * destination's headings — worth doing the day a broken anchor costs somebody
 * something, not before.
 *
 * The pure half lives here and the reading lives in `check-doc-links.mjs`, the
 * same split the siblings use.
 */

/**
 * A markdown inline link, capturing its target.
 *
 * Reference-style links and bare autolinks are deliberately out: this document
 * uses neither, and a pattern that matches shapes nobody writes is a pattern
 * whose failures nobody can predict.
 */
const LINK = /\[[^\]\n]+\]\(\s*([^)\s]+)\s*\)/g;

/** Fenced code blocks blanked, so an example link in a fence is not a claim. */
function withoutFences(text) {
  return String(text).replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ' '));
}

/**
 * The targets worth checking: the paths, as the document writes them.
 *
 * A path is relative to the document that carries it, which is the same thing as
 * repository-relative only for a document at the root. `resolveAgainst` is what
 * closes that gap.
 *
 * A URL is somebody else's uptime and this check has no network. An anchor with
 * no path (`#section`) points inside the document itself and has no file to
 * find.
 */
export function targets(text) {
  const found = [];
  for (const [, raw] of withoutFences(text).matchAll(LINK)) {
    if (/^(?:https?:|mailto:|#)/.test(raw)) continue;
    found.push({ raw, path: raw.split('#')[0] });
  }
  return found;
}

/**
 * A link's target as a repository-relative path, resolved from the document.
 *
 * `CLAUDE.md` sits at the root, so for it this returns the path unchanged and the
 * check measures exactly what it measured before. For a document in
 * `docs/research/`, `2026-09-22-shots/a.png` is a file beside it
 * and not a directory at the root — which is the whole reason the 15 links in
 * that folder were never checkable.
 *
 * A `..` with nothing left to remove is KEPT rather than dropped. Dropping it
 * turns a link that leaves the repository into a plausible path at the root, and
 * a path that plausibly exists is how this check would report green over a
 * pointer nobody can follow.
 */
export function resolveAgainst(doc, path) {
  const out = String(doc).split('/').slice(0, -1);
  for (const segment of String(path).split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..' && out.length && out.at(-1) !== '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

/**
 * Findings for the targets whose file is absent.
 *
 * `exists` is injected rather than imported so this module touches no
 * filesystem and the spec needs no fixtures on disk.
 */
export function danglingLinks(text, exists) {
  const found = [];
  const seen = new Set();
  for (const { raw, path } of targets(text)) {
    if (path === '' || seen.has(path)) continue;
    seen.add(path);
    if (!exists(path)) found.push(`${raw} — no file at ${path}`);
  }
  return found;
}
