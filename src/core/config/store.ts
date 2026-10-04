import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { StorageKeys, type StorageAdapter } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import { assetIdsIn } from '@/core/assets/image';
import { forgetImagePreviews, writePaintCache } from '@/core/storage/paint-cache';
import { createDefaultConfig } from './defaults';
import { ConfigVersionError, runMigrations } from './migrations';
import { configSchema, type StillpointConfig } from './schema';

export type ConfigStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ConfigState {
  config: StillpointConfig | null;
  status: ConfigStatus;
  /** Set when something went wrong but the page still rendered. Not fatal. */
  error: string | null;
}

export interface ConfigStore extends ConfigState {
  load: () => Promise<void>;
  /** Replace the whole tree. Persisted after the debounce window. */
  set: (next: StillpointConfig) => void;
  /** Derive the next tree from the current one. No-op before load() resolves. */
  update: (recipe: (config: StillpointConfig) => StillpointConfig) => void;
  /** Write immediately, cancelling any pending debounce. Call on leaving edit mode. */
  flush: () => Promise<void>;
  /** Discard everything and start over from defaults. */
  reset: () => Promise<void>;
  /** Stop listening for cross-tab changes. Tests and teardown only. */
  dispose: () => void;
}

export interface ConfigStoreOptions {
  adapter?: StorageAdapter;
  /**
   * Whole-tree writes are debounced: dragging a widget should produce one write when
   * the drag ends, not one per frame.
   */
  debounceMs?: number;
}

export function createConfigStore(
  options: ConfigStoreOptions = {},
): StoreApi<ConfigStore> {
  const adapter = options.adapter ?? localAdapter;
  const debounceMs = options.debounceMs ?? 300;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<void> | null = null;
  /**
   * The last tree this store wrote, serialized. `watch` fires for our own writes too,
   * and re-applying them would clobber edits made in the debounce window.
   */
  let lastWritten: string | null = null;
  let unwatch: (() => void) | null = null;
  /** Dedupes concurrent load() calls — React StrictMode mounts effects twice. */
  let loading: Promise<void> | null = null;
  /** The tree as storage last had it, for working out which photographs it dropped. */
  let persisted: StillpointConfig | null = null;

  /**
   * Remove the photographs `next` no longer refers to.
   *
   * Here, on the write, because every way a photograph stops being used ends in one:
   * a new background, a deleted profile, an import that replaced everything, a reset.
   * Done after the config is safely written, never before — a failed write must not
   * leave the old config pointing at a deleted asset. Best effort: an asset that
   * survives is a few wasted megabytes, not a fault.
   */
  async function pruneAssets(next: StillpointConfig): Promise<void> {
    const keep = assetIdsIn(next);
    const dropped = [...assetIdsIn(persisted)].filter((id) => !keep.has(id));
    persisted = next;
    if (dropped.length === 0) return;
    forgetImagePreviews(dropped);
    await Promise.all(
      dropped.map((id) => adapter.remove(StorageKeys.asset(id)).catch(() => {})),
    );
  }

  const store = createStore<ConfigStore>((set, get) => {
    async function persist(): Promise<void> {
      const config = get().config;
      if (!config) return;

      // Validated here rather than on every interaction: `update` runs once per drag
      // frame, and parsing the tree that often is a cost with no payoff.
      const parsed = configSchema.safeParse(config);
      if (!parsed.success) {
        set({
          error: 'Refused to save an invalid config. Your last change was not kept.',
        });
        return;
      }

      const serialized = JSON.stringify(parsed.data);
      lastWritten = serialized;
      await adapter.set(StorageKeys.config, parsed.data);
      writePaintCache(parsed.data);
      await pruneAssets(parsed.data);
    }

    function schedulePersist(): void {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        pending = persist().catch((error: unknown) => {
          set({
            error: `Could not save your changes: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        });
      }, debounceMs);
    }

    function startWatching(): void {
      if (unwatch) return;
      unwatch = adapter.watch<unknown>(StorageKeys.config, (incoming) => {
        if (incoming === null) return;
        // Our own write coming back around.
        if (JSON.stringify(incoming) === lastWritten) return;

        const parsed = configSchema.safeParse(incoming);
        if (!parsed.success) return;

        // Adopt without re-persisting: whichever tab wrote this already did that, and
        // already refreshed the shared paint cache.
        lastWritten = JSON.stringify(parsed.data);
        persisted = parsed.data;
        set({ config: parsed.data, status: 'ready' });
      });
    }

    async function doLoad(): Promise<void> {
      set({ status: 'loading', error: null });

      let stored: unknown;
      try {
        stored = await adapter.get<unknown>(StorageKeys.config);
      } catch (error) {
        // Storage unreadable. Render defaults rather than nothing — a new tab that
        // shows an error page is worse than a new tab that shows the default one.
        const config = createDefaultConfig();
        set({
          config,
          status: 'ready',
          error: `Could not read your settings: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        startWatching();
        return;
      }

      if (stored === null) {
        const config = createDefaultConfig();
        set({ config, status: 'ready', error: null });
        lastWritten = JSON.stringify(config);
        await adapter.set(StorageKeys.config, config);
        writePaintCache(config);
        startWatching();
        return;
      }

      let migratedTree: unknown = stored;
      let applied: number[] = [];
      let failure: string | null = null;

      try {
        const result = runMigrations(stored);
        migratedTree = result.config;
        applied = result.applied;
      } catch (error) {
        failure =
          error instanceof ConfigVersionError
            ? error.message
            : `Could not upgrade your settings: ${
                error instanceof Error ? error.message : String(error)
              }`;
      }

      const parsed = failure ? null : configSchema.safeParse(migratedTree);

      if (!parsed?.success) {
        // Keep the unreadable tree. It is the user's data even if we cannot read it,
        // and a bug on our side must not be the reason they lose a layout.
        const version = readVersionLoosely(stored);
        try {
          await adapter.set(StorageKeys.configBackup(version), stored);
        } catch {
          // If even the backup write fails there is nothing further to try.
        }

        const config = createDefaultConfig();
        set({
          config,
          status: 'ready',
          error:
            failure ??
            'Your saved settings could not be read, so Stillpoint started fresh. The old file was kept as a backup.',
        });
        startWatching();
        return;
      }

      if (applied.length > 0) {
        try {
          await adapter.set(
            StorageKeys.configBackup(readVersionLoosely(stored)),
            stored,
          );
        } catch {
          // Best effort. A failed backup is not a reason to refuse the upgrade.
        }
      }

      set({ config: parsed.data, status: 'ready', error: null });
      lastWritten = JSON.stringify(parsed.data);
      persisted = parsed.data;

      if (applied.length > 0) {
        await adapter.set(StorageKeys.config, parsed.data);
      }
      writePaintCache(parsed.data);
      startWatching();
    }

    return {
      config: null,
      status: 'idle',
      error: null,

      load() {
        // Deduped: React StrictMode mounts effects twice, and a double first-run would
        // otherwise write defaults twice.
        loading ??= doLoad();
        return loading;
      },

      set(next) {
        set({ config: next });
        schedulePersist();
      },

      update(recipe) {
        const current = get().config;
        if (!current) return;
        set({ config: recipe(current) });
        schedulePersist();
      },

      async flush() {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
          await persist();
          return;
        }
        if (pending) await pending;
      },

      async reset() {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        const config = createDefaultConfig();
        set({ config, status: 'ready', error: null });
        lastWritten = JSON.stringify(config);
        await adapter.set(StorageKeys.config, config);
        writePaintCache(config);
        await pruneAssets(config);
      },

      dispose() {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        unwatch?.();
        unwatch = null;
        loading = null;
      },
    };
  });

  return store;
}

function readVersionLoosely(raw: unknown): number {
  if (typeof raw === 'object' && raw !== null) {
    const version = (raw as Record<string, unknown>).version;
    if (typeof version === 'number' && Number.isInteger(version)) return version;
  }
  return 0;
}

/** The app-wide store. Lives outside React so `boot.ts` can start the load early. */
export const configStore = createConfigStore();

export function useConfig<T>(selector: (state: ConfigStore) => T): T {
  return useStore(configStore, selector);
}
