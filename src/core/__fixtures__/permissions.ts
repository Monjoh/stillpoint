import { vi } from 'vitest';
import { browser } from 'wxt/browser';

/**
 * WXT's fake browser implements neither the `permissions` events nor a Firefox
 * manifest. Without the manifest, `usePermissions` behaves as on Chrome and counts
 * every data-collection category as granted.
 */
export function stubPermissionEvents() {
  for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
    vi.spyOn(event, 'addListener').mockImplementation(() => {});
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
}

/** As the Firefox build: consent for data collection is asked for, and checked. */
export function actAsFirefox({ granted }: { granted: boolean }) {
  stubPermissionEvents();
  vi.spyOn(browser.runtime, 'getManifest').mockReturnValue({
    manifest_version: 3,
    name: 'Stillpoint',
    version: '1.0.0',
    browser_specific_settings: {
      gecko: { data_collection_permissions: { required: ['none'] } },
    },
  });
  vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => granted);
  return {
    request: vi
      .spyOn(browser.permissions, 'request')
      .mockImplementation(async () => true),
  };
}
