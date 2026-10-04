import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DataSourceSpec } from '@/core/registry/types';
import type { StorageAdapter } from '@/core/storage/adapter';
import {
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
