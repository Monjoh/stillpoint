import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackgroundConfig } from '@/core/config/schema';
import { localAdapter } from '@/core/storage/local';
import { readImagePreview, writeImagePreview } from '@/core/storage/paint-cache';
import { asset } from './__fixtures__/asset';
import { saveImageAsset } from './image';
import { useBackgroundImage } from './use-background-image';

const photo = (assetId: string): BackgroundConfig => ({
  kind: 'image',
  assetId,
  fit: 'cover',
  blur: 0,
  dim: 0,
});

describe('useBackgroundImage', () => {
  let created = 0;
  const revoke = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    created = 0;
    revoke.mockClear();
    // jsdom has no object URLs.
    URL.createObjectURL = vi.fn(() => `blob:test/${++created}`);
    URL.revokeObjectURL = revoke;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is nothing for a background that is not a photograph', () => {
    const { result } = renderHook(() =>
      useBackgroundImage({ kind: 'solid', color: '#000' }),
    );
    expect(result.current).toBeUndefined();
  });

  // The first render has to agree with the boot paint, so it cannot wait for storage.
  it('answers with the cached preview at once, then adds the photograph', async () => {
    const id = await saveImageAsset(localAdapter, asset);
    writeImagePreview(id, asset.preview);

    const { result } = renderHook(() => useBackgroundImage(photo(id)));
    expect(result.current).toEqual(asset.preview);

    await waitFor(() => expect(result.current?.url).toBe('blob:test/1'));
    expect(result.current?.color).toBe(asset.preview.color);
  });

  it('revokes the object URL when the photograph changes, and on unmount', async () => {
    const a = await saveImageAsset(localAdapter, asset);
    const b = await saveImageAsset(localAdapter, asset);
    const { result, rerender, unmount } = renderHook(
      ({ background }) => useBackgroundImage(background),
      { initialProps: { background: photo(a) } },
    );
    await waitFor(() => expect(result.current?.url).toBe('blob:test/1'));

    rerender({ background: photo(b) });
    expect(revoke).toHaveBeenCalledWith('blob:test/1');
    // Never the previous photograph's URL for the next one, not even for a render.
    expect(result.current?.url).not.toBe('blob:test/1');
    await waitFor(() => expect(result.current?.url).toBe('blob:test/2'));

    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:test/2');
  });

  it('puts back a missing preview and says so, so the paint cache can be redone', async () => {
    const id = await saveImageAsset(localAdapter, asset);
    const healed = vi.fn();
    renderHook(() => useBackgroundImage(photo(id), healed));

    await waitFor(() => expect(healed).toHaveBeenCalledTimes(1));
    expect(readImagePreview(id)).toEqual(asset.preview);
  });

  it('is nothing for a photograph that is not in storage', async () => {
    const { result } = renderHook(() => useBackgroundImage(photo('gone')));
    await act(async () => {});
    expect(result.current).toBeUndefined();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
