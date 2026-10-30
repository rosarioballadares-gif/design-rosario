import type { Preview } from '@storybook/react-vite';
import '../src/ds/tokens/build/tokens.css';
import config from '../src/ds/tokens/config.json';
import { ModeDocsContainer } from './ModeDocsContainer';
import { ViewportBand } from './ViewportBand';

/**
 * Every story sits in the mode the toolbar picks, one item per mode the token
 * set declares in `config.json` — none until the `tokens` skill builds a set.
 *
 * The mode is an attribute, `data-theme`, because that is how the token
 * stylesheet switches — the same attribute `index.html` sets for the app. A
 * story that shows several modes at once sets it again on its own cells, which
 * the stylesheet honours because each theme block redeclares every variable
 * that depends on the mode.
 *
 * The page ground is the `tokens` skill's to add here, once the set names the
 * semantic token that paints a page.
 */
const modes: string[] = config.modes;

const preview: Preview = {
  globalTypes: modes.length
    ? {
        theme: {
          description: 'Mode',
          toolbar: {
            title: 'Mode',
            icon: 'mirror',
            items: modes.map((mode) => ({ value: mode, title: mode[0].toUpperCase() + mode.slice(1) })),
            dynamicTitle: true,
          },
        },
      }
    : {},
  initialGlobals: modes.length ? { theme: config.defaultMode ?? modes[0] } : {},
  parameters: {
    layout: 'fullscreen',
    docs: { container: ModeDocsContainer },
    options: {
      // Get started first, then the Figma pages' order: raw values first, then what they mean,
      // then the component categories as they run in Figma.
      storySort: { order: ['Get started', 'Foundations', ['Primitives', 'Semantic', 'Component'], 'Controls', 'Overlays', 'Navigation', 'Data display', 'Layout'] },
    },
  },
  decorators: [
    (Story, { globals }) => (
      <div data-theme={globals.theme} style={{ minHeight: '100vh', boxSizing: 'border-box', padding: 32 }}>
        <ViewportBand />
        <Story />
      </div>
    ),
  ],
};

export default preview;
