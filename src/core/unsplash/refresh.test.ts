import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { UnsplashBackground } from '@/core/config/schema';
import { StorageKeys } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import { readImagePreview } from '@/core/storage/paint-cache';
import { fakeUnsplash } from './__fixtures__/fake-unsplash';
import { loadPhotoImage, loadState, refreshUnsplash } from './refresh';
import { UNSPLASH_PREVIEW_ID } from './state';

const background = (extra: Partial<UnsplashBackground> = {}): UnsplashBackground => ({
  kind: 'unsplash',
  query: 'mountains',
  refresh: 'daily',
  blur: 0,
  dim: 0,
  ...extra,
});

const DAY_ONE = new Date('2026-10-05T09:00:00').getTime();
const LATER_SAME_DAY = new Date('2026-10-05T18:00:00').getTime();
const DAY_TWO = new Date('2026-10-06T08:00:00').getTime();

describe('refreshUnsplash', () => {
  let server: ReturnType<typeof fakeUnsplash>;
  const run = (
    options: {
      background?: UnsplashBackground;
      now?: number;
      key?: string | null;
    } = {},
    force = false,
  ) =>
    refreshUnsplash(
      {
        adapter: localAdapter,
        key: options.key === undefined ? 'key' : options.key,
        background: options.background ?? background(),
        width: 2560,
        now: options.now ?? DAY_ONE,
        fetcher: server.fetcher,
      },
      { force },
    );

  beforeEach(() => {
    fakeBrowser.reset();
    localStorage.clear();
    server = fakeUnsplash();
  });

  it('shows a photo at once the first time, and downloads the next one ahead', async () => {
    const result = await run();

    expect(result.showNow?.photo.id).toBe('photo-1');
    expect(result.state.current?.photo.id).toBe('photo-1');
    expect(result.state.next?.photo.id).toBe('photo-2');
    expect(result.changed).toBe(true);
    // One batch request for both, and the bytes of both stored.
    expect(server.batches).toHaveBeenCalledTimes(1);
    expect(await loadPhotoImage(localAdapter, 'photo-1')).not.toBeNull();
    expect(await loadPhotoImage(localAdapter, 'photo-2')).not.toBeNull();
    // What the next cold tab paints first.
    expect(readImagePreview(UNSPLASH_PREVIEW_ID)?.color).toBe('#a0b0c0');
    expect(server.pings).toHaveBeenCalledWith(
      'https://api.unsplash.com/photos/photo-1/download?ixid=abc',
    );
  });

  it('does nothing on the network while the photo is not due', async () => {
    await run();
    server.batches.mockClear();
    server.images.mockClear();

    const result = await run({ now: LATER_SAME_DAY });
    expect(result.showNow).toBeNull();
    expect(result.changed).toBe(false);
    expect(server.batches).not.toHaveBeenCalled();
    expect(server.images).not.toHaveBeenCalled();
  });

  // The rule: the tab that rotates keeps its picture; the next tab opens on the new one.
  it('moves on when due, for the next tab, without changing this one', async () => {
    await run();
    const result = await run({ now: DAY_TWO });

    expect(result.showNow).toBeNull();
    expect(result.changed).toBe(true);
    expect(result.state.current?.photo.id).toBe('photo-2');
    expect(result.state.next?.photo.id).toBe('photo-3');
    // From the batch already in hand, not a new request.
    expect(server.batches).toHaveBeenCalledTimes(1);
    // The one that went is deleted; the tab showing it holds its own copy.
    expect(await loadPhotoImage(localAdapter, 'photo-1')).toBeNull();
  });

  it('moves on at every tab when asked to', async () => {
    await run({ background: background({ refresh: 'tab' }) });
    const second = await run({ background: background({ refresh: 'tab' }) });
    const third = await run({ background: background({ refresh: 'tab' }) });
    expect(second.state.current?.photo.id).toBe('photo-2');
    expect(third.state.current?.photo.id).toBe('photo-3');
  });

  // The first tab takes two (current and next), each later one takes one more, so
  // ten photos last nine tabs.
  it('asks for a new batch only when this one runs out', async () => {
    for (let i = 0; i < 9; i++)
      await run({ background: background({ refresh: 'tab' }) });
    expect(server.batches).toHaveBeenCalledTimes(1);
    await run({ background: background({ refresh: 'tab' }) });
    expect(server.batches).toHaveBeenCalledTimes(2);
  });

  it('starts over for a new search, and shows its first photo now', async () => {
    await run();
    const result = await run({ background: background({ query: 'ocean' }) });

    expect(result.showNow?.photo.id).toBe('photo-11');
    expect(result.state.query).toBe('ocean');
    expect(await loadPhotoImage(localAdapter, 'photo-1')).toBeNull();
    expect(await loadPhotoImage(localAdapter, 'photo-2')).toBeNull();
  });

  it('shows another photo now when the user asks, and says so to other tabs', async () => {
    await run();
    const result = await run({ now: LATER_SAME_DAY }, true);

    expect(result.showNow?.photo.id).toBe('photo-2');
    expect(result.state.skip).toBe(1);
  });

  describe('when Unsplash says no', () => {
    it('keeps the current photo through a spent allowance, and waits before asking again', async () => {
      await run({ background: background({ refresh: 'tab' }) });
      server.respond(403);
      // Eight more tabs use up the batch already in hand; the ninth needs a new one,
      // and the API refuses.
      for (let i = 0; i < 9; i++)
        await run({ background: background({ refresh: 'tab' }) });
      const state = (await loadState(localAdapter))!;
      expect(state.error?.kind).toBe('rate');
      expect(state.current).not.toBeNull();

      server.batches.mockClear();
      await run({ background: background({ refresh: 'tab' }) });
      expect(server.batches).not.toHaveBeenCalled();
    });

    it('does not retry a refused key, but does try a new one', async () => {
      server.respond(401);
      const refused = await run();
      expect(refused.state.error?.kind).toBe('key');
      expect(refused.showNow).toBeNull();

      server.batches.mockClear();
      await run();
      expect(server.batches).not.toHaveBeenCalled();

      server.respond(200);
      const fixed = await run({ key: 'new-key' });
      expect(fixed.showNow?.photo.id).toBe('photo-1');
      expect(fixed.state.error).toBeNull();
    });

    it('records being offline without throwing', async () => {
      server.respond('offline');
      const result = await run();
      expect(result.state.error?.kind).toBe('network');
      expect(await localAdapter.get(StorageKeys.unsplash)).not.toBeNull();
    });
  });

  describe('without a key', () => {
    it('shows Picsum photos, with nothing to ping', async () => {
      const result = await run({ key: null });

      expect(result.showNow?.photo.source).toBe('picsum');
      expect(result.state.next?.photo.source).toBe('picsum');
      expect(server.picsumPages).toHaveBeenCalledTimes(1);
      expect(server.batches).not.toHaveBeenCalled();
      expect(server.pings).not.toHaveBeenCalled();
      // Picsum gives no colour; jsdom cannot measure one, so it falls back to black.
      expect(result.state.current?.preview.color).toBe('#000000');
    });

    // Picsum cannot search, so there is nothing to start over for.
    it('keeps its photos through a change of search', async () => {
      await run({ key: null });
      const result = await run({
        key: null,
        background: background({ query: 'ocean' }),
      });
      expect(result.showNow).toBeNull();
      expect(server.picsumPages).toHaveBeenCalledTimes(1);
    });

    it('starts over on Unsplash once a key is added', async () => {
      await run({ key: null });
      const result = await run({ key: 'key' });
      expect(result.showNow?.photo.source).toBe('unsplash');
      expect(result.state.source).toBe('unsplash');
    });
  });
});
