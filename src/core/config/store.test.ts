import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageKeys, type StorageAdapter } from '@/core/storage/adapter';
import { readPaintCache } from '@/core/storage/paint-cache';
import fixtureV4 from './__fixtures__/config-v4.json';
import { createConfigStore } from './store';
import { CONFIG_VERSION, configSchema, type StillpointConfig } from './schema';

/**
 * An in-memory `StorageAdapter`. The real one is covered by `storage/local.test.ts`;
 * using it here too would make these tests about `browser.storage` rather than about
 * the store's own load / debounce / sync behaviour.
 */
function createMemoryAdapter() {
  const data = new Map<string, unknown>();
  const watchers = new Map<string, Set<(value: unknown) => void>>();
  const sets = vi.fn<(key: string, value: unknown) => void>();

  const adapter: StorageAdapter = {
    async get<T>(key: string) {
      return data.has(key) ? (data.get(key) as T) : null;
    },
    async set<T>(key: string, value: T) {
      sets(key, value);
      data.set(key, JSON.parse(JSON.stringify(value)) as unknown);
      for (const cb of watchers.get(key) ?? []) cb(data.get(key));
    },
    async remove(key: string) {
      data.delete(key);
      for (const cb of watchers.get(key) ?? []) cb(null);
    },
    watch<T>(key: string, cb: (value: T | null) => void) {
      const set = watchers.get(key) ?? new Set();
      watchers.set(key, set);
      set.add(cb as (value: unknown) => void);
      return () => set.delete(cb as (value: unknown) => void);
    },
  };

  return { adapter, data, sets };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('config store — load', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds defaults on first run and persists them', async () => {
    const { adapter, data } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 0 });

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().error).toBeNull();
    expect(store.getState().config?.profiles).toHaveLength(1);
    expect(data.get(StorageKeys.config)).toBeDefined();
    expect(readPaintCache()).not.toBeNull();

    store.getState().dispose();
  });

  it('loads an existing config without rewriting it', async () => {
    const { adapter, data, sets } = createMemoryAdapter();
    data.set(StorageKeys.config, fixtureV4);
    const store = createConfigStore({ adapter, debounceMs: 0 });

    await store.getState().load();

    expect(store.getState().config?.profiles).toHaveLength(2);
    expect(sets).not.toHaveBeenCalled();
    expect(readPaintCache()?.tokens['--sp-accent']).toBe('#ff8800');

    store.getState().dispose();
  });

  it('falls back to defaults and keeps a backup when the stored config is unreadable', async () => {
    const { adapter, data } = createMemoryAdapter();
    data.set(StorageKeys.config, { version: CONFIG_VERSION, profiles: 'not an array' });
    const store = createConfigStore({ adapter, debounceMs: 0 });

    await store.getState().load();

    // The page still renders.
    expect(store.getState().status).toBe('ready');
    expect(store.getState().config).not.toBeNull();
    expect(store.getState().error).toMatch(/could not be read/i);

    // And the user's data is still there.
    expect(data.get(StorageKeys.configBackup(CONFIG_VERSION))).toEqual({
      version: CONFIG_VERSION,
      profiles: 'not an array',
    });

    store.getState().dispose();
  });

  it('refuses a config from a newer version and says so', async () => {
    const { adapter, data } = createMemoryAdapter();
    data.set(StorageKeys.config, { ...fixtureV4, version: CONFIG_VERSION + 1 });
    const store = createConfigStore({ adapter, debounceMs: 0 });

    await store.getState().load();

    expect(store.getState().error).toMatch(/newer version of Stillpoint/);
    expect(store.getState().config).not.toBeNull();
    expect(data.get(StorageKeys.configBackup(CONFIG_VERSION + 1))).toBeDefined();

    store.getState().dispose();
  });

  it('renders defaults when storage itself throws', async () => {
    const { adapter } = createMemoryAdapter();
    const broken: StorageAdapter = {
      ...adapter,
      get: () => Promise.reject(new Error('storage is on fire')),
    };
    const store = createConfigStore({ adapter: broken, debounceMs: 0 });

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().config).not.toBeNull();
    expect(store.getState().error).toMatch(/storage is on fire/);

    store.getState().dispose();
  });
});

describe('config store — writes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('debounces a burst of updates into one write', async () => {
    const { adapter, sets } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 20 });
    await store.getState().load();
    sets.mockClear();

    for (let i = 1; i <= 5; i++) {
      store.getState().update((config) => renameProfile(config, `Name ${i}`));
    }

    expect(sets).not.toHaveBeenCalled();
    await store.getState().flush();

    expect(sets).toHaveBeenCalledTimes(1);
    expect(store.getState().config?.profiles[0]!.name).toBe('Name 5');

    store.getState().dispose();
  });

  it('refreshes the paint cache on every write', async () => {
    const { adapter } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 0 });
    await store.getState().load();

    store.getState().update((config) => ({
      ...config,
      profiles: config.profiles.map((p) => ({
        ...p,
        background: { kind: 'solid' as const, color: '#123456' },
      })),
    }));
    await store.getState().flush();

    expect(readPaintCache()?.tokens['--sp-background']).toBe('#123456');

    store.getState().dispose();
  });

  it('refuses to persist a tree that no longer validates', async () => {
    const { adapter, sets } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 0 });
    await store.getState().load();
    sets.mockClear();

    store.getState().update((config) => ({ ...config, profiles: [] }));
    await store.getState().flush();

    expect(sets).not.toHaveBeenCalled();
    expect(store.getState().error).toMatch(/invalid config/i);

    store.getState().dispose();
  });

  it('ignores update() before load() has resolved', () => {
    const { adapter, sets } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 0 });

    store.getState().update((config) => config);

    expect(sets).not.toHaveBeenCalled();
    expect(store.getState().config).toBeNull();

    store.getState().dispose();
  });

  it('reset() returns to defaults and writes immediately', async () => {
    const { adapter } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 1000 });
    await store.getState().load();

    store.getState().update((config) => renameProfile(config, 'Edited'));
    await store.getState().reset();

    expect(store.getState().config?.profiles[0]!.name).toBe('Default');

    store.getState().dispose();
  });
});

describe('config store — photographs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const photo = (assetId: string) => ({
    kind: 'image' as const,
    assetId,
    fit: 'cover' as const,
    blur: 0,
    dim: 0,
  });
  const withBackground =
    (background: StillpointConfig['profiles'][number]['background']) =>
    (config: StillpointConfig): StillpointConfig => ({
      ...config,
      profiles: config.profiles.map((p) => ({ ...p, background })),
    });

  async function seeded() {
    const memory = createMemoryAdapter();
    memory.data.set(StorageKeys.asset('a'), { stored: 'a' });
    memory.data.set(StorageKeys.asset('b'), { stored: 'b' });
    localStorage.setItem(
      'stillpoint.previews',
      JSON.stringify({ a: { color: '#000000', thumb: 'data:image/jpeg;base64,AA==' } }),
    );
    const store = createConfigStore({ adapter: memory.adapter, debounceMs: 0 });
    await store.getState().load();
    store.getState().update(withBackground(photo('a')));
    await store.getState().flush();
    return { ...memory, store };
  }

  // Every way a photograph stops being used ends in a write, so the write is where it
  // is let go: a new background, a deleted profile, an import, a reset.
  it('deletes a photograph, and its preview, once no profile uses it', async () => {
    const { store, data } = await seeded();
    store.getState().update(withBackground({ kind: 'solid', color: '#000' }));
    await store.getState().flush();

    expect(data.has(StorageKeys.asset('a'))).toBe(false);
    expect(localStorage.getItem('stillpoint.previews')).not.toContain('"a"');
    // Never referenced by this store, so not its to delete.
    expect(data.has(StorageKeys.asset('b'))).toBe(true);
    store.getState().dispose();
  });

  it('keeps a photograph that is still in use', async () => {
    const { store, data } = await seeded();
    store.getState().update((config) => renameProfile(config, 'Renamed'));
    await store.getState().flush();

    expect(data.has(StorageKeys.asset('a'))).toBe(true);
    store.getState().dispose();
  });

  it('deletes nothing when the write is refused', async () => {
    const { store, data } = await seeded();
    store.getState().update((config) => ({ ...config, profiles: [] }));
    await store.getState().flush();

    expect(data.has(StorageKeys.asset('a'))).toBe(true);
    store.getState().dispose();
  });

  it('lets go of every photograph on reset', async () => {
    const { store, data } = await seeded();
    await store.getState().reset();

    expect(data.has(StorageKeys.asset('a'))).toBe(false);
    store.getState().dispose();
  });

  // A config that could not be read is kept as a backup, and its photographs with it:
  // the store never knew them, so it never deletes them.
  it('touches no photograph when the stored config was unreadable', async () => {
    const { adapter, data } = createMemoryAdapter();
    data.set(StorageKeys.config, { version: CONFIG_VERSION, garbage: true });
    data.set(StorageKeys.asset('a'), { stored: 'a' });
    const store = createConfigStore({ adapter, debounceMs: 0 });
    await store.getState().load();
    store.getState().update((config) => renameProfile(config, 'Fresh'));
    await store.getState().flush();

    expect(data.has(StorageKeys.asset('a'))).toBe(true);
    store.getState().dispose();
  });
});

describe('config store — cross-tab sync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adopts a config written by another tab', async () => {
    const { adapter } = createMemoryAdapter();

    const tabA = createConfigStore({ adapter, debounceMs: 0 });
    const tabB = createConfigStore({ adapter, debounceMs: 0 });
    await tabA.getState().load();
    await tabB.getState().load();

    tabA.getState().update((config) => renameProfile(config, 'Renamed in tab A'));
    await tabA.getState().flush();
    await tick();

    expect(tabB.getState().config?.profiles[0]!.name).toBe('Renamed in tab A');

    tabA.getState().dispose();
    tabB.getState().dispose();
  });

  it('ignores the echo of its own write', async () => {
    const { adapter } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 0 });
    await store.getState().load();

    store.getState().update((config) => renameProfile(config, 'Mine'));
    await store.getState().flush();
    const afterWrite = store.getState().config;
    await tick();

    // Same object identity: the watcher did not replace state with a parsed copy.
    expect(store.getState().config).toBe(afterWrite);

    store.getState().dispose();
  });

  it('ignores an invalid config written by someone else', async () => {
    const { adapter } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 0 });
    await store.getState().load();
    const before = store.getState().config;

    await adapter.set(StorageKeys.config, { version: CONFIG_VERSION, profiles: [] });
    await tick();

    expect(store.getState().config).toBe(before);

    store.getState().dispose();
  });

  it('stops syncing after dispose()', async () => {
    const { adapter } = createMemoryAdapter();
    const store = createConfigStore({ adapter, debounceMs: 0 });
    await store.getState().load();
    const before = store.getState().config;

    store.getState().dispose();
    await adapter.set(StorageKeys.config, configSchema.parse(fixtureV4));
    await tick();

    expect(store.getState().config).toBe(before);
  });
});

function renameProfile(config: StillpointConfig, name: string): StillpointConfig {
  return {
    ...config,
    profiles: config.profiles.map((profile, index) =>
      index === 0 ? { ...profile, name } : profile,
    ),
  };
}
