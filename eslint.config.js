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

/**
 * Every user-facing string goes through `i18n.t()` (src/locales/en.yml), so a
 * translation is a new file and not a code change. These catch the usual ways a
 * literal sneaks back in: JSX text, a text attribute, and the label/help/title-style
 * properties that settings metadata and notices are built from. A string that is
 * genuinely not language (a symbol, a brand, a CSS value) takes an eslint-disable
 * with the reason.
 */
const LETTERS = '/[A-Za-z]{2}/';
const TEXT_ATTRIBUTES = '/^(aria-label|aria-description|title|placeholder|alt|label)$/';
const TEXT_PROPERTIES = '/^(label|help|title|detail|description|placeholder|message)$/';
const noLiteralText = [
  'error',
  {
    selector: `JSXText[value=${LETTERS}]`,
    message: 'User-facing text goes through i18n.t(). See src/locales/en.yml.',
  },
  {
    selector: `JSXAttribute[name.name=${TEXT_ATTRIBUTES}] > Literal[value=${LETTERS}]`,
    message: 'User-facing text goes through i18n.t(). See src/locales/en.yml.',
  },
  {
    selector: `JSXAttribute[name.name=${TEXT_ATTRIBUTES}] TemplateLiteral`,
    message: 'User-facing text goes through i18n.t(). See src/locales/en.yml.',
  },
  {
    selector: `Property[key.name=${TEXT_PROPERTIES}] > Literal[value=${LETTERS}]`,
    message: 'User-facing text goes through i18n.t(). See src/locales/en.yml.',
  },
  {
    selector: `Property[key.name=${TEXT_PROPERTIES}] > TemplateLiteral`,
    message: 'User-facing text goes through i18n.t(). See src/locales/en.yml.',
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
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/__fixtures__/**'],
    rules: {
      'no-restricted-syntax': noLiteralText,
    },
  },
  {
    // What boot.ts reaches, before the first pixel. The i18n runtime there would cost
    // every new tab a module it cannot use: boot paints colour and geometry, no words.
    // Display names for presets and tokens live in settings/names.ts for this reason.
    files: [
      'src/entrypoints/boot.ts',
      'src/core/storage/paint-cache.ts',
      'src/core/theme/**/*.ts',
      'src/core/assets/image.ts',
      'src/core/unsplash/state.ts',
    ],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '#i18n',
              message:
                'boot.ts reaches this file. Look the string up in the settings layer instead (see settings/names.ts).',
            },
          ],
        },
      ],
    },
  },
);
