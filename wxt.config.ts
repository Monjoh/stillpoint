import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import { thirdPartyNotices } from './scripts/third-party-notices';
import { OPTIONAL_DATA_COLLECTION } from './src/core/data-collection';

/**
 * Permanent. Firefox keys stored extension data to this id, so changing it after the
 * first signed release orphans every user's config. See docs/01-architecture.md.
 */
const GECKO_ID = 'stillpoint@monjoh';

const notices = thirdPartyNotices(import.meta.dirname);

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  vite: () => ({ plugins: [notices.plugin] }),
  hooks: {
    // The licence travels with the extension, with every bundled package's own.
    'build:publicAssets': (_wxt, files) => {
      files.push({
        absoluteSrc: resolve(import.meta.dirname, 'LICENSE'),
        relativeDest: 'LICENSE.txt',
      });
    },
    // Not in `npm run dev`: its build carries WXT's reload client, which never ships
    // and whose packages (@webext-core/match-patterns) have no licence file.
    'build:done': (wxt) => {
      if (wxt.config.command === 'build') notices.write(wxt.config.outDir);
    },
  },
  zip: {
    // An allowlist, not WXT's default of "everything not hidden": that default put
    // the gitignored docs/ and CLAUDE.md in the archive sent to Mozilla. Exactly what
    // building needs, plus the README that says how.
    includeSources: [
      'src/**',
      'public/**',
      'scripts/**',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'wxt.config.ts',
      'README.md',
      'LICENSE',
      'PRIVACY.md',
      'CHANGELOG.md',
    ],
  },
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    // Strings live in src/locales/<lang>.yml; the browser picks the language.
    default_locale: 'en',
    name: '__MSG_manifest_name__',
    short_name: '__MSG_manifest_name__',
    description: '__MSG_manifest_description__',
    homepage_url: 'https://github.com/Monjoh/stillpoint',
    // Photos live in storage.local as base64, up to ~2.7 MB each. Chrome caps the
    // area at 10 MB without unlimitedStorage, which is a few photos; Firefox has no
    // such cap, and would list the permission at install for nothing.
    permissions: browser === 'firefox' ? ['storage'] : ['storage', 'unlimitedStorage'],
    // No host permissions: every service a widget uses sends CORS headers. A widget
    // that needs one declares it in its definition's `origins`, and the origin must be
    // listed here as `optional_host_permissions`, asked for from a click.
    // Firefox-only keys. Chrome rejects unknown top-level manifest keys, so they are
    // added per-target rather than unconditionally.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: GECKO_ID,
              // 140 is the floor for data_collection_permissions below.
              strict_min_version: '140.0',
              // Required for new AMO listings since 2025-11-03. Nothing is sent to
              // the developer, and nothing leaves the browser by default. A few
              // features send data to a service the user picked — a place to the
              // weather service, search words to Unsplash — and Firefox asks for
              // those from the click that turns the feature on. See
              // src/core/data-collection.ts.
              data_collection_permissions: {
                required: ['none'],
                optional: [...OPTIONAL_DATA_COLLECTION],
              },
            },
          },
        }
      : {}),
  }),
});
