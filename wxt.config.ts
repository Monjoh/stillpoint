import { defineConfig } from 'wxt';
import { OPTIONAL_DATA_COLLECTION } from './src/core/data-collection';

/**
 * Permanent. Firefox keys stored extension data to this id, so changing it after the
 * first signed release orphans every user's config. See docs/01-architecture.md.
 */
const GECKO_ID = 'stillpoint@monjoh';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    // Strings live in src/locales/<lang>.yml; the browser picks the language.
    default_locale: 'en',
    name: '__MSG_manifest_name__',
    short_name: '__MSG_manifest_name__',
    description: '__MSG_manifest_description__',
    permissions: ['storage'],
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
            // Android gained data_collection_permissions in 142. Without this the
            // desktop floor above is assumed for Android too, and web-ext lint warns.
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : {}),
  }),
});
