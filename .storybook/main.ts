import type { StorybookConfig } from '@storybook/react-vite';

/**
 * The project's `vite.config.ts` is loaded by the builder rather than restated
 * here, so anything that config defines crosses into the stories. A Storybook
 * with its own config fails at runtime with nothing failing at build.
 *
 * `stories` stays narrow on purpose. Widening a glob is how a Storybook fills
 * with stubs of components whose JSDoc was never written for a props table.
 */
const config: StorybookConfig = {
  stories: ['../src/ds/GetStarted.mdx', '../src/ds/**/*.stories.tsx', '../src/features/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      /**
       * Load-bearing, and its absence fails SILENTLY — which is why this
       * comment is longer than the option.
       *
       * `tsconfig.json` here is solution-style: `files: []` with references and
       * no `include` of its own. `react-docgen-typescript` builds a TypeScript
       * program from whichever config it is handed, so the default lookup finds
       * that file, builds a program over ZERO files, and produces no
       * documentation. The build still reports success and emits the chunk.
       * A props table with no rows reads as a component that takes no props.
       * Measured in design-ops, 2026-09-02.
       */
      tsconfigPath: './tsconfig.app.json',
      /**
       * Without this the table carries everything React declares, because
       * `react-docgen-typescript` follows an interface all the way up. The
       * parameter is typed rather than inferred because the published option
       * type does not resolve under pnpm's layout, so an inferred `prop` is
       * `any` and nothing above is checked.
       */
      propFilter: (prop: { parent?: { fileName: string } }) =>
        !prop.parent || !/node_modules/.test(prop.parent.fileName),
      shouldExtractLiteralValuesFromEnum: true,
      /** Every optional prop otherwise reads `boolean | undefined`, which says
       *  the same thing as the `required` column beside it. */
      shouldRemoveUndefinedFromOptional: true,
    },
  },
};

export default config;
