import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // `.claude/worktrees/` holds whole checkouts of this repository, made by
    // the agent runtime when work is isolated. They are untracked, they carry
    // their own `src/` with their own specs, and vitest's default glob has no
    // reason to know that — so a run reports another session's branch as this
    // one's, failures included. Measured in design-ops, 2026-08-21.
    //
    // `defaultExclude` is spread rather than replaced: assigning this key
    // REPLACES the default list, dropping `node_modules` and `dist` with it.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
