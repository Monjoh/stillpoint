import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { BackgroundConfig, UnsplashBackground } from '@/core/config/schema';
import { localAdapter } from '@/core/storage/local';
import { fakeUnsplash } from './__fixtures__/fake-unsplash';
import { refreshUnsplash } from './refresh';
import { useUnsplash } from './use-unsplash';

const unsplash: UnsplashBackground = {
  kind: 'unsplash',
  query: 'mountains',
  refresh: 'daily',
  blur: 0,
  dim: 0,
};

/** What a previous tab left behind: photo-1 up, photo-2 downloaded. */
async function previousTab(server: ReturnType<typeof fakeUnsplash>, force = false) {
  return refreshUnsplash(
    {
      adapter: localAdapter,
      key: 'k',
      background: unsplash,
      width: 2560,
      fetcher: server.fetcher,
    },
    { force },
  );
}

describe('useUnsplash', () => {
  let server: ReturnType<typeof fakeUnsplash>;

  beforeEach(() => {
    fakeBrowser.reset();
    localStorage.clear();
    server = fakeUnsplash();
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
    URL.revokeObjectURL = vi.fn();
  });

  // No key means Picsum, not "off": what the last tab left is shown either way.
  it('works without a key', async () => {
    await refreshUnsplash({
      adapter: localAdapter,
      key: null,
      background: unsplash,
      width: 2560,
      fetcher: server.fetcher,
    });
    const { result } = renderHook(() => useUnsplash(unsplash, null));
    await waitFor(() => expect(result.current.source?.url).toMatch(/^blob:test/));
    // Picsum names the photographer but has no profile to link.
    expect(result.current.credit?.profileUrl).toBeNull();
  });

  it('is nothing for another kind of background', () => {
    const solid: BackgroundConfig = { kind: 'solid', color: '#000' };
    const { result } = renderHook(() => useUnsplash(solid, 'k'));
    expect(result.current).toEqual({});
  });

  // The first render must match what boot.js painted, so it cannot wait for storage.
  it('opens on the cached preview, then the stored photo with its credit', async () => {
    await previousTab(server);
    const { result } = renderHook(() => useUnsplash(unsplash, 'k'));

    expect(result.current.source?.color).toBe('#a0b0c0');
    expect(result.current.source?.url).toBeUndefined();

    await waitFor(() => expect(result.current.source?.url).toMatch(/^blob:test/));
    expect(result.current.credit).toEqual({
      name: 'Author 1',
      profileUrl: 'https://unsplash.com/@author1',
      pageUrl: 'https://unsplash.com/photos/photo-1',
    });
  });

  it('changes the picture when another photo is asked for, here or in another tab', async () => {
    await previousTab(server);
    const { result } = renderHook(() => useUnsplash(unsplash, 'k'));
    await waitFor(() => expect(result.current.credit?.name).toBe('Author 1'));

    await act(() => previousTab(server, true));
    await waitFor(() => expect(result.current.credit?.name).toBe('Author 2'));
  });
});
