import { useEffect, useState, type PropsWithChildren } from 'react';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';
import { themes } from 'storybook/theming';

/**
 * A docs page is not a story, so the decorator in `preview.tsx` never wraps it. This
 * container gives it the same `data-theme`, and Storybook's own docs theme —
 * dark for a mode named `dark`, light for any other — so its text, tables and
 * code stay legible.
 *
 * The docs context exposes no globals, so the first mode is read off its store
 * — typed `protected` — and every later one arrives on `GLOBALS_UPDATED`.
 */
export function ModeDocsContainer({ context, children }: PropsWithChildren<DocsContainerProps>) {
  const store = (context as unknown as { store: { userGlobals: { get(): { theme?: string } } } }).store;
  const [mode, setMode] = useState<string | undefined>(store.userGlobals.get().theme);

  useEffect(() => {
    const onGlobals = ({ globals }: { globals: { theme?: string } }) => setMode(globals.theme);
    context.channel.on(GLOBALS_UPDATED, onGlobals);
    return () => context.channel.off(GLOBALS_UPDATED, onGlobals);
  }, [context.channel]);

  return (
    <div data-theme={mode} style={{ minHeight: '100vh' }}>
      <DocsContainer context={context} theme={themes[mode === 'dark' ? 'dark' : 'light']}>
        {children}
      </DocsContainer>
    </div>
  );
}
