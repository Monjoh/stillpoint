import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/**
 * Optional host permissions, for a widget whose data source sends no CORS headers.
 *
 * Every origin requested here must also be listed under `optional_host_permissions`
 * in `wxt.config.ts`, or the browser refuses the request without asking.
 *
 * `checking` lasts one async call and is drawn as nothing. `missing` is shown by the
 * frame as a notice with an Allow button, and nothing is fetched until the user grants
 * it: a request made without the permission would only fail.
 */

export type OriginsState = 'checking' | 'granted' | 'missing';

export function useOrigins(origins: readonly string[]): {
  state: OriginsState;
  /** Must be called straight from a click. Firefox refuses a request made later. */
  request: () => void;
} {
  const wanted = origins.join(' ');
  const [checked, setChecked] = useState<{ wanted: string; granted: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (wanted === '') return;
    let cancelled = false;
    const check = () => {
      void contains(wanted.split(' ')).then((granted) => {
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
  }, [wanted]);

  const request = useCallback(() => {
    if (wanted === '') return;
    // No await before this call: it has to run inside the click's user action.
    void browser.permissions
      .request({ origins: wanted.split(' ') })
      .then((granted) => setChecked({ wanted, granted }))
      .catch(() => setChecked({ wanted, granted: false }));
  }, [wanted]);

  if (wanted === '') return { state: 'granted', request };
  if (checked?.wanted !== wanted) return { state: 'checking', request };
  return { state: checked.granted ? 'granted' : 'missing', request };
}

async function contains(origins: string[]): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins });
  } catch {
    return false;
  }
}

/** "query1.finance.yahoo.com" for "https://query1.finance.yahoo.com/*". */
export function originHost(pattern: string): string {
  return pattern.replace(/^[a-z*]+:\/\//, '').replace(/\/.*$/, '');
}
