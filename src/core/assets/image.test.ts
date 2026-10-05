import { describe, expect, it } from 'vitest';
import { configSchema } from '@/core/config/schema';
import fixtureV4 from '@/core/config/__fixtures__/config-v4.json';
import { StorageKeys } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import {
  assetIdsIn,
  dataUrlToBlob,
  isImageAsset,
  loadImageAsset,
  saveImageAsset,
} from './image';
import { asset } from './__fixtures__/asset';

describe('isImageAsset', () => {
  it('accepts what the upload produces', () => {
    expect(isImageAsset(asset)).toBe(true);
  });

  // Imported files are strangers. Anything that is not plainly an image data URL is
  // refused, because it would otherwise end up inside a CSS `url()`.
  it.each([
    ['a non-image data URL', { ...asset, dataUrl: 'data:text/html;base64,PGI+' }],
    ['a remote URL', { ...asset, dataUrl: 'https://example.com/a.jpg' }],
    ['a bad preview colour', { ...asset, preview: { ...asset.preview, color: 'red' } }],
    [
      'a remote thumbnail',
      { ...asset, preview: { ...asset.preview, thumb: 'https://example.com/t.jpg' } },
    ],
    ['a future version', { ...asset, v: 2 }],
    ['nothing', null],
  ])('refuses %s', (_, value) => {
    expect(isImageAsset(value)).toBe(false);
  });
});

describe('the asset store', () => {
  it('stores under its own key, outside the config, and reads it back', async () => {
    const id = await saveImageAsset(localAdapter, asset);
    expect(await localAdapter.get(StorageKeys.asset(id))).toEqual(asset);
    expect(await loadImageAsset(localAdapter, id)).toEqual(asset);
  });

  it('reads a missing or malformed asset as null rather than throwing', async () => {
    expect(await loadImageAsset(localAdapter, 'nope')).toBeNull();
    await localAdapter.set(StorageKeys.asset('bad'), { v: 1 });
    expect(await loadImageAsset(localAdapter, 'bad')).toBeNull();
  });
});

describe('assetIdsIn', () => {
  it('collects photographs across every profile, not only the active one', () => {
    const config = configSchema.parse(fixtureV4);
    const [first, second] = config.profiles;
    const withPhotos = {
      ...config,
      profiles: [
        {
          ...first!,
          background: { kind: 'image', assetId: 'a', fit: 'cover', blur: 0, dim: 0 },
        },
        {
          ...second!,
          background: { kind: 'image', assetId: 'b', fit: 'cover', blur: 0, dim: 0 },
        },
      ],
    } as typeof config;
    expect(assetIdsIn(withPhotos)).toEqual(new Set(['a', 'b']));
    expect(assetIdsIn(config)).toEqual(new Set());
    expect(assetIdsIn(null)).toEqual(new Set());
  });
});

describe('dataUrlToBlob', () => {
  it('decodes the bytes and keeps the type', async () => {
    const blob = dataUrlToBlob(asset.dataUrl);
    expect(blob.type).toBe('image/webp');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 1, 2, 255]);
  });
});
