import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig } from '@/core/config/defaults';
import { configSchema } from '@/core/config/schema';
import fixtureV5 from '@/core/config/__fixtures__/config-v5.json';
import {
  clearPaintCache,
  forgetImagePreviews,
  PAINT_CACHE_VERSION,
  readImagePreview,
  readPaintCache,
  writeImagePreview,
  writePaintCache,
} from './paint-cache';

const preview = { color: '#336699', thumb: 'data:image/jpeg;base64,AA==' };

function withPhoto(assetId: string) {
  const config = configSchema.parse(fixtureV5);
  const [first, ...rest] = config.profiles;
  return {
    ...config,
    profiles: [
      {
        ...first!,
        background: {
          kind: 'image' as const,
          assetId,
          fit: 'cover' as const,
          blur: 6,
          dim: 0,
        },
      },
      ...rest,
    ],
  };
}

const KEY = 'stillpoint.paint';

describe('paint cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing has been written', () => {
    expect(readPaintCache()).toBeNull();
  });

  it('round-trips the paint-critical slice of the active profile', () => {
    const config = configSchema.parse(fixtureV5);
    writePaintCache(config);

    const cache = readPaintCache();
    expect(cache).not.toBeNull();
    expect(cache!.v).toBe(PAINT_CACHE_VERSION);
    // Resolved, not raw: boot writes these straight to :root without consulting a
    // preset table, which is what keeps the table out of boot.js.
    expect(cache!.tokens).toMatchObject({
      '--sp-background': 'linear-gradient(160deg, #11131c 0%, #1d2033 100%)',
      '--sp-grid-cols': '24',
      // The profile's own override, already merged over the preset.
      '--sp-accent': '#ff8800',
      // And a token the profile never mentions, from the preset underneath it.
      '--sp-radius': '10px',
    });
    expect(cache!.rects).toEqual([
      { x: 8, y: 4, w: 8, h: 3 },
      { x: 8, y: 7, w: 8, h: 1 },
    ]);
  });

  it('caches the ACTIVE profile, not the first one', () => {
    const config = configSchema.parse({
      ...fixtureV5,
      activeProfileId: '44444444-4444-4444-8444-444444444444',
    });
    writePaintCache(config);
    expect(readPaintCache()!.tokens['--sp-background']).toBe('#f4f1ea');
  });

  it('holds no user content — only geometry and colour', () => {
    writePaintCache(configSchema.parse(fixtureV5));
    const raw = localStorage.getItem(KEY)!;
    // Widget settings and names must not leak into a store we never validate.
    expect(raw).not.toContain('stillpoint.clock');
    expect(raw).not.toContain('Focus');
    expect(raw).not.toContain('duckduckgo');
  });

  it('treats a corrupt value as a miss rather than throwing', () => {
    localStorage.setItem(KEY, 'not json at all');
    expect(readPaintCache()).toBeNull();
  });

  it('treats a structurally wrong value as a miss', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: PAINT_CACHE_VERSION, layout: 'no' }));
    expect(readPaintCache()).toBeNull();
  });

  it('treats a stale cache version as a miss', () => {
    writePaintCache(createDefaultConfig());
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...stored, v: PAINT_CACHE_VERSION + 1 }),
    );
    expect(readPaintCache()).toBeNull();
  });

  it('rejects a cache with a malformed rect', () => {
    writePaintCache(configSchema.parse(fixtureV5));
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    stored.rects[0] = { x: 1, y: 2 };
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(readPaintCache()).toBeNull();
  });

  it('survives localStorage being unavailable, in both directions', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(readPaintCache()).toBeNull();
    expect(() => writePaintCache(createDefaultConfig())).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('clears', () => {
    writePaintCache(createDefaultConfig());
    expect(readPaintCache()).not.toBeNull();
    clearPaintCache();
    expect(readPaintCache()).toBeNull();
  });
});

describe('image previews', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips per asset, and forgets on request', () => {
    writeImagePreview('a', preview);
    writeImagePreview('b', { ...preview, color: '#000000' });
    expect(readImagePreview('a')).toEqual(preview);

    forgetImagePreviews(['a']);
    expect(readImagePreview('a')).toBeNull();
    expect(readImagePreview('b')).not.toBeNull();
  });

  it('refuses a preview that is not one', () => {
    localStorage.setItem(
      'stillpoint.previews',
      JSON.stringify({ a: { color: '#336699', thumb: 'https://example.com/x.jpg' } }),
    );
    expect(readImagePreview('a')).toBeNull();
  });

  // The whole point: a cold tab opens on the picture, not on the default gradient.
  it('puts a photograph’s preview into the cached tokens', () => {
    writeImagePreview('a', preview);
    writePaintCache(withPhoto('a'));
    const tokens = readPaintCache()!.tokens;
    expect(tokens['--sp-background']).toContain('data:image/jpeg;base64,AA==');
    expect(tokens['--sp-background']).toContain('#336699');
    expect(tokens['--sp-background-blur']).toBe('6px');
  });

  // Without a preview there is nothing correct to paint, and the boot script leaves
  // the background alone rather than painting something wrong.
  it('leaves the background out when the preview is missing', () => {
    writePaintCache(withPhoto('a'));
    expect(readPaintCache()!.tokens['--sp-background']).toBeUndefined();
  });

  // With or without a key: without one the photos come from Picsum, but they are
  // still photos, and the next tab should still open on one.
  it('caches the Unsplash photo the next tab should open on', () => {
    writeImagePreview('unsplash', preview);
    const config = configSchema.parse(fixtureV5);
    writePaintCache({
      ...config,
      profiles: config.profiles.map((p) => ({
        ...p,
        background: {
          kind: 'unsplash' as const,
          source: 'unsplash' as const,
          query: 'x',
          refresh: 'daily' as const,
          blur: 0,
          dim: 0,
        },
      })),
    });
    expect(readPaintCache()!.tokens['--sp-background']).toContain('#336699');
  });
});
