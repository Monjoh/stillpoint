import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import autoImports from './.wxt/eslint-auto-imports.mjs';

/**
 * The widget import boundary. This is the rule that keeps the widget API honest:
 * a widget that can reach into the canvas or the settings panel will eventually do it,
 * and then the API stops being a contract. See docs/03-widget-api.md.
 */
const widgetBoundary = [
  'error',
  {
    patterns: [
      {
        group: ['@/canvas', '@/canvas/**', '@/settings', '@/settings/**'],
        message:
          'A widget must not import from src/canvas or src/settings. It is a pure function of its props — if it needs more, that is a finding about the widget API.',
      },
      {
        group: ['@/widgets/**', '../*', '../*/**'],
        message:
          'A widget must not import from another widget. Shared code belongs in src/lib or src/core.',
      },
      {
        group: ['@/entrypoints/**'],
        message: 'A widget must not import from an entrypoint.',
      },
    ],
  },
];

/**
 * The other half of the boundary. The canvas and the settings panel must reach widgets
 * only through the registry: a direct import is how "adding a widget costs one array
 * entry" quietly stops being true. `src/core/registry/index.ts` is the one file that
 * knows which widgets exist, and it sits outside the globs this rule applies to.
 */
const registryBoundary = [
  'error',
  {
    patterns: [
      {
        group: ['@/widgets/**'],
        message:
          'Reach widgets through the registry (@/core/registry), never by importing one directly.',
      },
    ],
  },
];

export default tseslint.config(
  {
    ignores: ['.output/', '.wxt/', 'node_modules/', 'coverage/', 'web-ext-artifacts/'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  autoImports,
  reactHooks.configs.flat['recommended-latest'],
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.config.{ts,js,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': widgetBoundary,
    },
  },
  {
    files: [
      'src/canvas/**/*.{ts,tsx}',
      'src/settings/**/*.{ts,tsx}',
      'src/entrypoints/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': registryBoundary,
    },
  },
);
