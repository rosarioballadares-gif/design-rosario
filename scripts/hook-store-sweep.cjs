'use strict';
/*
 * Removes a hook's own per-session stores older than seven days.
 *
 * The notice hooks and the skill router each write one small JSON file per
 * session into the temp directory, and nothing used to remove them. This runs
 * at a session's FIRST write, when its store does not exist yet, so it costs one
 * directory read per session rather than one per tool call.
 *
 * It touches only files beside the store whose name starts with the hook's own
 * prefix, and never throws: a cleanup that fails costs a stale file, never the
 * hook's answer.
 */
const fs = require('node:fs');
const path = require('node:path');

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function sweepOnce(store, prefix, now = Date.now()) {
  try {
    if (fs.existsSync(store)) return;
    const dir = path.dirname(store);
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
      try {
        const file = path.join(dir, name);
        if (now - fs.statSync(file).mtimeMs > MAX_AGE_MS) fs.unlinkSync(file);
      } catch {
        /* removed by another session already, or not ours to remove */
      }
    }
  } catch {
    /* an unreadable temp directory leaves the files where they are */
  }
}

module.exports = { MAX_AGE_MS, sweepOnce };
