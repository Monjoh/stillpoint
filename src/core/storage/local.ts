import { browser } from 'wxt/browser';
import type { StorageAdapter } from './adapter';

/**
 * `StorageAdapter` over `browser.storage.local`.
 *
 * Absent and `undefined` both surface as `null`, so callers never have to distinguish
 * "never written" from "written as undefined" — a distinction that does not survive
 * JSON anyway.
 */
export const localAdapter: StorageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    const result = await browser.storage.local.get(key);
    const value = result[key];
    return value === undefined ? null : (value as T);
  },

  async set<T>(key: string, value: T): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },

  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },

  watch<T>(key: string, cb: (value: T | null) => void): () => void {
    const listener = (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName !== 'local') return;
      if (!Object.prototype.hasOwnProperty.call(changes, key)) return;
      const next = changes[key]?.newValue;
      cb(next === undefined ? null : (next as T));
    };

    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  },
};
