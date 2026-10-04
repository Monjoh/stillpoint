import { useEffect, useRef, useState } from 'react';
import type { DataSourceSpec, ResourceState } from '@/core/registry/types';
import { StorageKeys, type StorageAdapter } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';

/**
 * Stale-while-revalidate for a widget's `dataSource`, over `storage.local`.
 *
 * 1. Read the cache. Present and fresh: show it, and fetch again when it expires.
 * 2. Present but stale: show it, marked `stale`, and fetch in the background.
 * 3. Missing (or older than `maxAgeMs`): `empty`, which the frame draws as a
 *    skeleton, and fetch.
 * 4. A failed fetch keeps whatever data there is, under `status: 'error'`. Yesterday's
 *    temperature beats a spinner.
 *
 * Runs after the widget's lazy chunk has loaded, so after first paint: a widget cannot
 * put a request in front of the first pixel, because it never makes one itself.
 *
 * Other tabs see a fetch through `adapter.watch`, and two instances in one page with
 * the same key share one request. The cache is disposable, like all of `cache/`.
 */

export interface CachedResource<D> {
  v: 1;
  data: D;
  fetchedAt: number;
}

/** A request that hangs is a failure, not a skeleton forever. */
export const FETCH_TIMEOUT_MS = 15_000;

/** The storage key for one cached result. The key itself is hashed: it may be long. */
export function resourceStorageKey(widgetType: string, key: string): string {
  return StorageKeys.widgetCache(widgetType, hash(key));
}

function hash(text: string): string {
  // FNV-1a, 32-bit. A cache key, not a secret: a collision costs one refetch.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function isCachedResource(value: unknown): value is CachedResource<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.v === 1 && 'data' in v && typeof v.fetchedAt === 'number';
}

/** What a cache entry means at `now`. Pure, so the policy is testable on its own. */
export function stateFromCache<D>(
  entry: CachedResource<D> | null,
  spec: Pick<DataSourceSpec<unknown, D>, 'ttlMs' | 'maxAgeMs'>,
  now: number,
): { state: ResourceState<D>; usable: CachedResource<D> | null; due: boolean } {
  const age = entry ? now - entry.fetchedAt : Infinity;
  if (!entry || age > (spec.maxAgeMs ?? Infinity)) {
    return { state: { status: 'empty' }, usable: null, due: true };
  }
  const stale = age >= spec.ttlMs;
  return {
    state: { status: 'ready', data: entry.data, fetchedAt: entry.fetchedAt, stale },
    usable: entry,
    due: stale,
  };
}

const inFlight = new Map<string, Promise<CachedResource<unknown>>>();

/**
 * One request per storage key per page. Not aborted when one of its callers goes
 * away, because another may still want it; each caller ignores a result it no longer
 * needs. The timeout is the only abort.
 */
function fetchShared<D>(
  storageKey: string,
  run: (signal: AbortSignal) => Promise<D>,
  adapter: StorageAdapter,
): Promise<CachedResource<D>> {
  const existing = inFlight.get(storageKey);
  if (existing) return existing as Promise<CachedResource<D>>;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const request = run(controller.signal)
    .then(async (data) => {
      const entry: CachedResource<D> = { v: 1, data, fetchedAt: Date.now() };
      // A cache that cannot be written still shows this tab the data.
      await adapter.set(storageKey, entry).catch(() => {});
      return entry;
    })
    .finally(() => {
      clearTimeout(timer);
      inFlight.delete(storageKey);
    });
  inFlight.set(storageKey, request);
  return request;
}

function messageOf(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The request took too long.';
  }
  return error instanceof Error && error.message ? error.message : 'Could not load.';
}

/**
 * The resolved state for one widget instance. `null` while the cache is being read,
 * which takes a few milliseconds and is drawn as nothing, so a cached widget does not
 * flash a skeleton. `undefined` when `key` is null: nothing to fetch.
 */
export function useResource<S, D>(
  widgetType: string,
  spec: DataSourceSpec<S, D>,
  settings: S,
  adapter: StorageAdapter = localAdapter,
): ResourceState<D> | null | undefined {
  const key = spec.key(settings);
  const storageKey = key === null ? null : resourceStorageKey(widgetType, key);
  const [resolved, setResolved] = useState<{
    storageKey: string;
    state: ResourceState<D>;
  } | null>(null);

  // The fetch reads the latest settings, but only a new key restarts the cycle: by
  // the contract, settings that are not in the key do not change the result.
  const latest = useRef({ spec, settings });
  useEffect(() => {
    latest.current = { spec, settings };
  });

  useEffect(() => {
    if (storageKey === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let usable: CachedResource<D> | null = null;
    const show = (state: ResourceState<D>) => {
      if (!cancelled) setResolved({ storageKey, state });
    };

    const schedule = () => {
      clearTimeout(timer);
      if (!usable) return;
      const wait = usable.fetchedAt + latest.current.spec.ttlMs - Date.now();
      timer = setTimeout(() => void revalidate(), Math.max(0, wait));
    };

    const accept = (entry: CachedResource<D>) => {
      usable = entry;
      show({
        status: 'ready',
        data: entry.data,
        fetchedAt: entry.fetchedAt,
        stale: false,
      });
      schedule();
    };

    const revalidate = async () => {
      const { spec: s, settings: current } = latest.current;
      try {
        const entry = await fetchShared(
          storageKey,
          (signal) => s.fetch(current, signal),
          adapter,
        );
        if (!cancelled) accept(entry);
      } catch (error) {
        if (cancelled) return;
        const old = stateFromCache(usable, s, Date.now()).usable;
        show({
          status: 'error',
          error: messageOf(error),
          data: old?.data,
          fetchedAt: old?.fetchedAt,
        });
      }
    };

    void adapter
      .get<unknown>(storageKey)
      .catch(() => null)
      .then((raw) => {
        if (cancelled) return;
        const entry = isCachedResource(raw) ? (raw as CachedResource<D>) : null;
        const result = stateFromCache(entry, latest.current.spec, Date.now());
        usable = result.usable;
        show(result.state);
        if (result.due) void revalidate();
        else schedule();
      });

    // Another tab fetched: take its answer instead of asking again.
    const unwatch = adapter.watch<unknown>(storageKey, (incoming) => {
      if (!isCachedResource(incoming)) return;
      if (usable && incoming.fetchedAt <= usable.fetchedAt) return;
      accept(incoming as CachedResource<D>);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unwatch();
    };
  }, [storageKey, adapter]);

  if (storageKey === null) return undefined;
  return resolved?.storageKey === storageKey ? resolved.state : null;
}
