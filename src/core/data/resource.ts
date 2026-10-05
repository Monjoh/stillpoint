import { i18n } from '#i18n';
import { RateLimitError } from './errors';
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
 *
 * Every open tab runs this, so the tabs coordinate through storage rather than each
 * asking the service (S25):
 *
 * - **A claim.** Before fetching, a tab writes "fetching since …" beside the cache. A
 *   tab that finds a recent claim waits for the answer to arrive through `watch`.
 * - **A backoff.** A failure is written down with when to try again, so a new tab
 *   does not retry a service that just refused: 1, 2, 4… minutes up to the refresh
 *   interval, and from 15 minutes for a rate limit (`RateLimitError`).
 * - **Jitter.** A timed refresh waits a few random seconds more, so tabs that all
 *   expire together do not all wake in the same millisecond.
 */

export interface CachedResource<D> {
  v: 1;
  data: D;
  fetchedAt: number;
}

/** A request that hangs is a failure, not a skeleton forever. */
export const FETCH_TIMEOUT_MS = 15_000;

/** The last attempt to fetch one resource, shared by every tab beside its cache. */
export interface FetchAttempt {
  v: 1;
  /** A tab started a fetch at this time and has not finished it. */
  claimedAt?: number;
  /** Consecutive failures. */
  failures: number;
  /** Do not ask again before this. */
  retryAt?: number;
  /** The last failure's message, for tabs that open while waiting it out. */
  error?: string;
}

const MINUTE = 60_000;

/**
 * How long to wait after the `failures`-th failure in a row. Doubling, so a service
 * that is down is asked less and less, but never beyond the refresh interval for an
 * ordinary failure: the data would be due again by then anyway. A rate limit starts at
 * a quarter of an hour and goes to an hour.
 */
export function backoffMs(
  failures: number,
  rateLimited: boolean,
  ttlMs: number,
): number {
  const step = Math.max(0, failures - 1);
  if (rateLimited) return Math.min(60 * MINUTE, 15 * MINUTE * 2 ** step);
  return Math.min(Math.max(ttlMs, MINUTE), MINUTE * 2 ** step);
}

export type FetchPlan =
  /** The cache is fresh (another tab may just have fetched): take it. */
  | { kind: 'fresh' }
  /** A failure is being waited out, or another tab is fetching. Look again then. */
  | { kind: 'wait'; until: number }
  | { kind: 'fetch' };

/** What a tab whose data is due should do now. Pure, so the policy is testable. */
export function planFetch(
  entry: CachedResource<unknown> | null,
  attempt: FetchAttempt | null,
  ttlMs: number,
  now: number,
): FetchPlan {
  if (entry && now - entry.fetchedAt < ttlMs) return { kind: 'fresh' };
  if (attempt?.retryAt !== undefined && attempt.retryAt > now) {
    return { kind: 'wait', until: attempt.retryAt };
  }
  // A claim older than the timeout belongs to a tab that was closed mid-fetch.
  const claimEnds = (attempt?.claimedAt ?? -Infinity) + FETCH_TIMEOUT_MS + 1000;
  if (claimEnds > now) return { kind: 'wait', until: claimEnds };
  return { kind: 'fetch' };
}

export function isFetchAttempt(value: unknown): value is FetchAttempt {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.v === 1 && typeof v.failures === 'number';
}

/** Where a resource's `FetchAttempt` lives: beside its cache entry. */
export const attemptStorageKey = (storageKey: string) => `${storageKey}.fetch`;

/** The refresh interval for these settings. */
export function ttlFor<S>(
  spec: Pick<DataSourceSpec<S, unknown>, 'ttlMs'>,
  settings: S,
) {
  return typeof spec.ttlMs === 'function' ? spec.ttlMs(settings) : spec.ttlMs;
}

/** Up to 30 s, and never more than a tenth of the interval. */
const jitter = (ttlMs: number) => Math.random() * Math.min(30_000, ttlMs / 10);

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
  spec: { ttlMs: number; maxAgeMs?: number },
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
    return i18n.t('data.timeout');
  }
  return error instanceof Error && error.message
    ? error.message
    : i18n.t('data.failed');
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

    const policy = () => {
      const { spec: current, settings } = latest.current;
      return { ttlMs: ttlFor(current, settings), maxAgeMs: current.maxAgeMs };
    };
    const attemptKey = attemptStorageKey(storageKey);

    const at = (when: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void revalidate(), Math.max(0, when - Date.now()));
    };

    /** The next refresh: when the data expires, plus a little jitter. */
    const schedule = () => {
      if (!usable) return;
      const ttl = policy().ttlMs;
      at(usable.fetchedAt + ttl + jitter(ttl));
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

    const fail = (message: string) => {
      const old = stateFromCache(usable, policy(), Date.now()).usable;
      show({
        status: 'error',
        error: message,
        data: old?.data,
        fetchedAt: old?.fetchedAt,
      });
    };

    const revalidate = async () => {
      const { spec: s, settings: current } = latest.current;
      const ttl = policy().ttlMs;
      const [raw, rawAttempt] = await Promise.all([
        adapter.get<unknown>(storageKey).catch(() => null),
        adapter.get<unknown>(attemptKey).catch(() => null),
      ]);
      if (cancelled) return;
      const entry = isCachedResource(raw) ? (raw as CachedResource<D>) : null;
      const attempt = isFetchAttempt(rawAttempt) ? rawAttempt : null;

      const plan = planFetch(entry, attempt, ttl, Date.now());
      if (plan.kind === 'fresh') {
        accept(entry!);
        return;
      }
      if (plan.kind === 'wait') {
        // Waiting out a failure: say so, over whatever data there is. Waiting on
        // another tab's fetch: its answer arrives through `watch` well before this.
        if (attempt?.error && attempt.retryAt !== undefined) fail(attempt.error);
        at(plan.until);
        return;
      }

      const failures = attempt?.failures ?? 0;
      await adapter
        .set<FetchAttempt>(attemptKey, { v: 1, claimedAt: Date.now(), failures })
        .catch(() => {});
      try {
        const fetched = await fetchShared(
          storageKey,
          (signal) => s.fetch(current, signal),
          adapter,
        );
        await adapter
          .set<FetchAttempt>(attemptKey, { v: 1, failures: 0 })
          .catch(() => {});
        if (!cancelled) accept(fetched);
      } catch (error) {
        const message = messageOf(error);
        const retryAt =
          Date.now() + backoffMs(failures + 1, error instanceof RateLimitError, ttl);
        await adapter
          .set<FetchAttempt>(attemptKey, {
            v: 1,
            failures: failures + 1,
            retryAt,
            error: message,
          })
          .catch(() => {});
        if (cancelled) return;
        fail(message);
        at(retryAt);
      }
    };

    void adapter
      .get<unknown>(storageKey)
      .catch(() => null)
      .then((raw) => {
        if (cancelled) return;
        const entry = isCachedResource(raw) ? (raw as CachedResource<D>) : null;
        const result = stateFromCache(entry, policy(), Date.now());
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
