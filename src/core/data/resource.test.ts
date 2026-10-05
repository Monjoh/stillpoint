import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DataSourceSpec } from '@/core/registry/types';
import type { StorageAdapter } from '@/core/storage/adapter';
import { RateLimitError } from './errors';
import {
  attemptStorageKey,
  backoffMs,
  planFetch,
  resourceStorageKey,
  stateFromCache,
  useResource,
  type CachedResource,
} from './resource';

const MIN = 60 * 1000;

function memoryAdapter() {
  const data = new Map<string, unknown>();
  const watchers = new Map<string, Set<(value: unknown) => void>>();
  const adapter: StorageAdapter = {
    async get<T>(key: string) {
      return (data.get(key) as T) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
      for (const cb of watchers.get(key) ?? []) cb(value);
    },
    async remove(key) {
      data.delete(key);
    },
    watch<T>(key: string, cb: (value: T | null) => void) {
      const set = watchers.get(key) ?? new Set();
      set.add(cb as (value: unknown) => void);
      watchers.set(key, set);
      return () => set.delete(cb as (value: unknown) => void);
    },
  };
  return { adapter, data };
}

interface S {
  city: string | null;
}

function spec(fetch: (s: S) => Promise<string>): DataSourceSpec<S, string> {
  return {
    key: (s) => s.city,
    fetch: (s) => fetch(s),
    ttlMs: 30 * MIN,
    maxAgeMs: 24 * 60 * MIN,
  };
}

const keyFor = (city: string) => resourceStorageKey('test.widget', city);
const cached = (data: string, ageMs: number): CachedResource<string> => ({
  v: 1,
  data,
  fetchedAt: Date.now() - ageMs,
});

describe('stateFromCache', () => {
  const policy = { ttlMs: 10, maxAgeMs: 100 };

  it('is empty and due with nothing cached', () => {
    expect(stateFromCache(null, policy, 0)).toMatchObject({
      state: { status: 'empty' },
      due: true,
    });
  });

  it('serves fresh data without asking again', () => {
    const r = stateFromCache({ v: 1, data: 'x', fetchedAt: 0 }, policy, 5);
    expect(r.state).toMatchObject({ status: 'ready', stale: false });
    expect(r.due).toBe(false);
  });

  it('serves stale data and asks again', () => {
    const r = stateFromCache({ v: 1, data: 'x', fetchedAt: 0 }, policy, 50);
    expect(r.state).toMatchObject({ status: 'ready', data: 'x', stale: true });
    expect(r.due).toBe(true);
  });

  it('will not show data past its maximum age', () => {
    const r = stateFromCache({ v: 1, data: 'x', fetchedAt: 0 }, policy, 101);
    expect(r.state).toEqual({ status: 'empty' });
    expect(r.usable).toBeNull();
  });
});

describe('useResource', () => {
  it('fetches nothing when the widget is not configured', () => {
    const fetch = vi.fn(async () => 'x');
    const { adapter } = memoryAdapter();
    const { result } = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: null }, adapter),
    );
    expect(result.current).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches when nothing is cached, and caches the answer', async () => {
    const { adapter, data } = memoryAdapter();
    const fetch = vi.fn(async (s: S) => `weather in ${s.city}`);
    const { result } = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    expect(result.current).toBeNull();
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'ready',
        data: 'weather in Paris',
      }),
    );
    expect(data.get(keyFor('Paris'))).toMatchObject({ v: 1, data: 'weather in Paris' });
  });

  it('shows fresh cached data and does not fetch', async () => {
    const { adapter, data } = memoryAdapter();
    data.set(keyFor('Paris'), cached('cached', 5 * MIN));
    const fetch = vi.fn(async () => 'new');
    const { result } = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() => expect(result.current).toMatchObject({ data: 'cached' }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows stale data at once, then the new answer', async () => {
    const { adapter, data } = memoryAdapter();
    data.set(keyFor('Paris'), cached('old', 45 * MIN));
    let resolve!: (value: string) => void;
    const fetch = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const { result } = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'ready',
        data: 'old',
        stale: true,
      }),
    );
    await act(async () => resolve('new'));
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'ready',
        data: 'new',
        stale: false,
      }),
    );
  });

  it('keeps the old data when the fetch fails', async () => {
    const { adapter, data } = memoryAdapter();
    data.set(keyFor('Paris'), cached('old', 45 * MIN));
    const fetch = vi.fn(async () => {
      throw new Error('The weather service could not be reached.');
    });
    const { result } = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'error',
        error: 'The weather service could not be reached.',
        data: 'old',
        fetchedAt: expect.any(Number),
      }),
    );
  });

  it('reports a failure with no data to fall back on', async () => {
    const { adapter } = memoryAdapter();
    const fetch = vi.fn(async () => {
      throw new Error('Nope.');
    });
    const { result } = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'error',
        error: 'Nope.',
        data: undefined,
      }),
    );
  });

  it('starts over for a new key', async () => {
    const { adapter } = memoryAdapter();
    const fetch = vi.fn(async (s: S) => `weather in ${s.city}`);
    const { result, rerender } = renderHook(
      ({ city }) => useResource('test.widget', spec(fetch), { city }, adapter),
      { initialProps: { city: 'Paris' } },
    );
    await waitFor(() =>
      expect(result.current).toMatchObject({ data: 'weather in Paris' }),
    );
    rerender({ city: 'Oslo' });
    // Never the old city's weather under the new city's name.
    expect(result.current).toBeNull();
    await waitFor(() =>
      expect(result.current).toMatchObject({ data: 'weather in Oslo' }),
    );
  });

  it('shares one request between two instances with the same key', async () => {
    const { adapter } = memoryAdapter();
    const fetch = vi.fn(async () => 'x');
    const a = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    const b = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() => expect(a.result.current).toMatchObject({ data: 'x' }));
    await waitFor(() => expect(b.result.current).toMatchObject({ data: 'x' }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('takes another tab’s fresher answer', async () => {
    const { adapter, data } = memoryAdapter();
    data.set(keyFor('Paris'), cached('mine', 5 * MIN));
    const { result } = renderHook(() =>
      useResource(
        'test.widget',
        spec(async () => 'x'),
        { city: 'Paris' },
        adapter,
      ),
    );
    await waitFor(() => expect(result.current).toMatchObject({ data: 'mine' }));
    await act(() => adapter.set(keyFor('Paris'), cached('theirs', 0)));
    expect(result.current).toMatchObject({ data: 'theirs' });
  });
});

describe('backoffMs', () => {
  it('doubles from a minute, up to the refresh interval', () => {
    expect(backoffMs(1, false, 30 * MIN)).toBe(1 * MIN);
    expect(backoffMs(2, false, 30 * MIN)).toBe(2 * MIN);
    expect(backoffMs(4, false, 30 * MIN)).toBe(8 * MIN);
    expect(backoffMs(9, false, 30 * MIN)).toBe(30 * MIN);
  });

  it('waits far longer on a rate limit, up to an hour', () => {
    expect(backoffMs(1, true, 5 * MIN)).toBe(15 * MIN);
    expect(backoffMs(2, true, 5 * MIN)).toBe(30 * MIN);
    expect(backoffMs(5, true, 5 * MIN)).toBe(60 * MIN);
  });
});

describe('planFetch', () => {
  const now = 100 * MIN;
  const entry = (age: number): CachedResource<string> => ({
    v: 1,
    data: 'x',
    fetchedAt: now - age,
  });

  it('takes a cache another tab has just refreshed', () => {
    expect(planFetch(entry(1 * MIN), null, 30 * MIN, now)).toEqual({ kind: 'fresh' });
  });

  it('fetches when due and nobody else is', () => {
    expect(planFetch(entry(40 * MIN), null, 30 * MIN, now)).toEqual({ kind: 'fetch' });
    expect(planFetch(null, { v: 1, failures: 0 }, 30 * MIN, now)).toEqual({
      kind: 'fetch',
    });
  });

  it('waits out a failure', () => {
    const attempt = { v: 1 as const, failures: 1, retryAt: now + 5 * MIN };
    expect(planFetch(entry(40 * MIN), attempt, 30 * MIN, now)).toEqual({
      kind: 'wait',
      until: now + 5 * MIN,
    });
  });

  it('leaves the fetch to a tab that has claimed it', () => {
    const attempt = { v: 1 as const, failures: 0, claimedAt: now - 2000 };
    expect(planFetch(null, attempt, 30 * MIN, now).kind).toBe('wait');
  });

  it('ignores a claim from a tab that was closed mid-fetch', () => {
    const attempt = { v: 1 as const, failures: 0, claimedAt: now - 5 * MIN };
    expect(planFetch(null, attempt, 30 * MIN, now)).toEqual({ kind: 'fetch' });
  });
});

describe('useResource across tabs', () => {
  const attemptKey = (city: string) => attemptStorageKey(keyFor(city));

  it('writes a failure down, so the next tab does not ask again', async () => {
    const { adapter, data } = memoryAdapter();
    data.set(keyFor('Paris'), cached('old', 45 * MIN));
    const fetch = vi.fn(async (): Promise<string> => {
      throw new Error('Down.');
    });
    const first = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() =>
      expect(first.result.current).toMatchObject({ status: 'error' }),
    );
    first.unmount();

    // A new tab, a moment later.
    const second = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() =>
      expect(second.result.current).toMatchObject({
        status: 'error',
        error: 'Down.',
        data: 'old',
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(data.get(attemptKey('Paris'))).toMatchObject({ failures: 1 });
  });

  it('backs off for a quarter of an hour on a rate limit', async () => {
    const { adapter, data } = memoryAdapter();
    const fetch = vi.fn(async (): Promise<string> => {
      throw new RateLimitError('Too many.');
    });
    const before = Date.now();
    renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() => expect(data.get(attemptKey('Paris'))).toBeTruthy());
    await waitFor(() =>
      expect(
        (data.get(attemptKey('Paris')) as { retryAt: number }).retryAt - before,
      ).toBeGreaterThanOrEqual(15 * MIN),
    );
  });

  it('waits for the tab that is already fetching, and takes its answer', async () => {
    const { adapter, data } = memoryAdapter();
    data.set(attemptKey('Paris'), { v: 1, failures: 0, claimedAt: Date.now() });
    const fetch = vi.fn(async () => 'mine');
    const { result } = renderHook(() =>
      useResource('test.widget', spec(fetch), { city: 'Paris' }, adapter),
    );
    await waitFor(() => expect(result.current).toEqual({ status: 'empty' }));
    await act(() => adapter.set(keyFor('Paris'), cached('theirs', 0)));
    expect(result.current).toMatchObject({ data: 'theirs' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears the failure count after a success', async () => {
    const { adapter, data } = memoryAdapter();
    data.set(attemptKey('Paris'), { v: 1, failures: 3, retryAt: Date.now() - 1 });
    const { result } = renderHook(() =>
      useResource(
        'test.widget',
        spec(async () => 'x'),
        { city: 'Paris' },
        adapter,
      ),
    );
    await waitFor(() => expect(result.current).toMatchObject({ data: 'x' }));
    expect(data.get(attemptKey('Paris'))).toEqual({ v: 1, failures: 0 });
  });

  it('takes its refresh interval from the settings when given a function', async () => {
    const { adapter, data } = memoryAdapter();
    data.set(keyFor('Paris'), cached('old', 10 * MIN));
    const fetch = vi.fn(async () => 'new');
    const everyFive: DataSourceSpec<S, string> = {
      ...spec(fetch),
      ttlMs: () => 5 * MIN,
    };
    const { result } = renderHook(() =>
      useResource('test.widget', everyFive, { city: 'Paris' }, adapter),
    );
    // Ten minutes old is fresh at 30, stale at 5.
    await waitFor(() => expect(result.current).toMatchObject({ data: 'new' }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
