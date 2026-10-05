import { defineConfig } from 'wxt';
import { YAHOO_ORIGIN } from './src/widgets/stocks/origins';

/**
 * Permanent. Firefox keys stored extension data to this id, so changing it after the
 * first signed release orphans every user's config. See docs/01-architecture.md.
 */
const GECKO_ID = 'stillpoint@monjoh';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Stillpoint',
    short_name: 'Stillpoint',
    description: 'A quiet, personalizable new tab page.',
    permissions: ['storage'],
    // Asked for only when a widget needs one, from a click; never at install. Each
    // widget declares the origins it uses in its definition's `origins`.
    optional_host_permissions: [YAHOO_ORIGIN],
    // Firefox-only keys. Chrome rejects unknown top-level manifest keys, so they are
    // added per-target rather than unconditionally.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: GECKO_ID,
              // 140 is the floor for data_collection_permissions below.
              strict_min_version: '140.0',
              // Required for new AMO listings since 2025-11-03. Stillpoint stores
              // everything locally and sends nothing anywhere, so: none.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
