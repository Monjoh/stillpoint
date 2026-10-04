import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig } from '@/core/config/defaults';
import { configSchema } from '@/core/config/schema';
import fixtureV1 from '@/core/config/__fixtures__/config-v1.json';
import {
  clearPaintCache,
  PAINT_CACHE_VERSION,
  readPaintCache,
  writePaintCache,
} from './paint-cache';

const KEY = 'stillpoint.paint';

describe('paint cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing has been written', () => {
    expect(readPaintCache()).toBeNull();
  });

  it('round-trips the paint-critical slice of the active profile', () => {
    const config = configSchema.parse(fixtureV1);
    writePaintCache(config);

    const cache = readPaintCache();
    expect(cache).not.toBeNull();
    expect(cache!.v).toBe(PAINT_CACHE_VERSION);
    // Resolved, not raw: boot writes these straight to :root without consulting a
    // preset table, which is what keeps the table out of boot.js.
    expect(cache!.tokens).toMatchObject({
      '--sp-background': 'linear-gradient(160deg, #11131c 0%, #1d2033 100%)',
      '--sp-grid-cols': '24',
      '--sp-scale': '1.2',
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
      ...fixtureV1,
      activeProfileId: '44444444-4444-4444-8444-444444444444',
    });
    writePaintCache(config);
    expect(readPaintCache()!.tokens['--sp-background']).toBe('#f4f1ea');
  });

  it('holds no user content — only geometry and colour', () => {
    writePaintCache(configSchema.parse(fixtureV1));
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
    writePaintCache(configSchema.parse(fixtureV1));
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
