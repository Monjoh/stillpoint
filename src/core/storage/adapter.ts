/**
 * The store talks to this, never to `browser.storage.local` directly.
 *
 * v1 is local-only, so this indirection buys nothing today. It costs about thirty
 * lines and is what makes optional sync a v2 feature rather than a v2 rewrite.
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  /**
   * Fires when another tab or page changes `key`, so open tabs stay in sync.
   * Returns an unsubscribe function.
   */
  watch<T>(key: string, cb: (value: T | null) => void): () => void;
}

/** Keys are lowercase and `/`-namespaced. These are permanent — renaming is a migration. */
export const StorageKeys = {
  config: 'config',
  /** The pre-migration tree, overwritten on each upgrade. */
  configBackup: (version: number) => `config.backup.v${version}`,
  asset: (assetId: string) => `assets/${assetId}`,
  widgetCache: (widgetType: string, hash: string) => `cache/${widgetType}/${hash}`,
} as const;
