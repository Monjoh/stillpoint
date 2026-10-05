import { i18n } from '#i18n';
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { DataCollection } from './data-collection';

/**
 * Optional permissions, asked for when a feature needs them and never at install.
 *
 * - **Host origins**, for a data source that sends no CORS headers. Each must also be
 *   under `optional_host_permissions` in `wxt.config.ts`.
 * - **Data collection**, Firefox's consent for data that leaves the browser — a place
 *   sent to a weather service, words sent to a photo search. Each category must also
 *   be in `OPTIONAL_DATA_COLLECTION`. Chrome has no such thing; there the categories
 *   are dropped from every call and count as granted.
 *
 * In both cases the browser refuses a request it was not told about in the manifest,
 * without asking.
 *
 * `checking` lasts one async call and is drawn as nothing. `missing` is shown as a
 * notice with an Allow button, and nothing is sent until the user grants it.
 */

export type PermissionState = 'checking' | 'granted' | 'missing';

export interface PermissionNeeds {
  origins?: readonly string[];
  dataCollection?: readonly DataCollection[];
}

interface Request {
  origins?: string[];
  data_collection?: string[];
}

export function usePermissions(needs: PermissionNeeds): {
  state: PermissionState;
  /** Must be called straight from a click. Firefox refuses a request made later. */
  request: () => void;
} {
  const origins = (needs.origins ?? []).join(' ');
  const categories = supportsDataCollection()
    ? (needs.dataCollection ?? []).join(' ')
    : '';
  const wanted = `${origins}|${categories}`;
  const none = wanted === NONE;
  const [checked, setChecked] = useState<{ wanted: string; granted: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (none) return;
    let cancelled = false;
    const check = () => {
      void contains(toRequest(wanted)).then((granted) => {
        if (!cancelled) setChecked({ wanted, granted });
      });
    };
    check();
    // The user may also grant or revoke it in about:addons, or in another tab.
    const api = browser.permissions;
    api?.onAdded?.addListener(check);
    api?.onRemoved?.addListener(check);
    return () => {
      cancelled = true;
      api?.onAdded?.removeListener(check);
      api?.onRemoved?.removeListener(check);
    };
  }, [wanted, none]);

  const request = useCallback(() => {
    if (wanted === NONE) return;
    // No await before this call: it has to run inside the click's user action.
    void ask(toRequest(wanted))
      .then((granted) => setChecked({ wanted, granted }))
      .catch(() => setChecked({ wanted, granted: false }));
  }, [wanted]);

  if (none) return { state: 'granted', request };
  if (checked?.wanted !== wanted) return { state: 'checking', request };
  return { state: checked.granted ? 'granted' : 'missing', request };
}

const NONE = '|';

/** The types predate `data_collection`; Firefox 140+ takes it in the same object. */
function ask(request: Request): Promise<boolean> {
  return browser.permissions.request(
    request as Parameters<typeof browser.permissions.request>[0],
  );
}

function toRequest(wanted: string): Request {
  const [origins = '', categories = ''] = wanted.split('|');
  const request: Request = {};
  if (origins) request.origins = origins.split(' ');
  if (categories) request.data_collection = categories.split(' ');
  return request;
}

async function contains(request: Request): Promise<boolean> {
  try {
    return await browser.permissions.contains(
      request as Parameters<typeof browser.permissions.contains>[0],
    );
  } catch {
    return false;
  }
}

/**
 * Whether this build declares data-collection permissions, read from its own manifest
 * rather than by sniffing the browser: Chrome rejects the unknown `data_collection`
 * key outright, and the Firefox build is the only one whose manifest carries it.
 */
export function supportsDataCollection(): boolean {
  try {
    const manifest = browser.runtime.getManifest() as {
      browser_specific_settings?: { gecko?: { data_collection_permissions?: unknown } };
    };
    return (
      manifest.browser_specific_settings?.gecko?.data_collection_permissions != null
    );
  } catch {
    return false;
  }
}

/** "query1.finance.yahoo.com" for "https://query1.finance.yahoo.com/*". */
export function originHost(pattern: string): string {
  return pattern.replace(/^[a-z*]+:\/\//, '').replace(/\/.*$/, '');
}

/** What a category means to the person asked, for a sentence like "It sends …". */
export function dataCollectionPhrase(category: DataCollection): string {
  return i18n.t(`permission.${category}`);
}
