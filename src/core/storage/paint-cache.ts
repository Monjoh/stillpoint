import { imageAssetId, isImagePreview, type ImagePreview } from '@/core/assets/image';
import type { Rect, StillpointConfig } from '@/core/config/schema';
import { paintToTokens, profileToPaint } from '@/core/theme/apply';
import type { TokenSet } from '@/core/theme/tokens';

/**
 * The synchronous first-paint cache.
 *
 * `browser.storage.local` is async, so anything depending on it lands *after* first
 * paint — the white flash that makes custom new tab pages feel cheap. `localStorage` is
 * synchronous on the `moz-extension://` origin, so a handful of values can be read
 * before the first pixel.
 *
 * The rules are narrow, and they are what keep two stores from becoming two truths:
 *
 * - It holds only what is needed to paint an empty but correctly-styled page.
 * - `browser.storage.local` stays the single source of truth. This is a derived,
 *   disposable copy, rewritten on every config save.
 * - Every access is wrapped. A missing or corrupt cache degrades to "paint the
 *   defaults", never to an error.
 * - Nothing outside `boot.ts` reads it.
 *
 * Deliberately zod-free: this module is on the critical path and must not pull a
 * validation library into the blocking boot script.
 */

const KEY = 'stillpoint.paint';

/**
 * Bump when the shape below changes. A mismatch is treated as a cache miss.
 *
 * 2 — the cache now holds a resolved token set rather than the pieces to resolve one
 * from. Before this the boot paint used whatever the inline CSS declared, which was
 * Midnight's palette under any theme: pick Paper, and every cold tab flashed dark
 * text on a dark background until React arrived.
 *
 * Resolved, and not `{ preset, overrides }`, so that the preset table stays out of
 * `boot.js`. Storing the question rather than the answer would mean shipping four
 * complete themes in front of the first pixel to use one of them.
 */
export const PAINT_CACHE_VERSION = 2;

export interface PaintCache {
  v: number;
  /** Every custom property the page needs, already merged. See `paintToTokens`. */
  tokens: TokenSet;
  /** Widget positions, so the skeleton can reserve cells and avoid layout shift. */
  rects: Rect[];
}

function isRect(value: unknown): value is Rect {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.w === 'number' &&
    typeof r.h === 'number'
  );
}

function isTokenSet(value: unknown): value is TokenSet {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every((v) => typeof v === 'string');
}

/**
 * Structural check, hand-written rather than schema-driven. It only has to be strict
 * enough that a bad value is rejected instead of painting something broken — anything
 * that gets through is still replaced by the real config milliseconds later.
 */
function isPaintCache(value: unknown): value is PaintCache {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  if (c.v !== PAINT_CACHE_VERSION) return false;
  if (!isTokenSet(c.tokens)) return false;
  if (!Array.isArray(c.rects) || !c.rects.every(isRect)) return false;
  return true;
}

export function readPaintCache(): PaintCache | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPaintCache(parsed) ? parsed : null;
  } catch {
    // Private windows, blocked site data, corrupt JSON. All mean the same thing here.
    return null;
  }
}

/** Derives the cache from the active profile. Called after every successful config write. */
export function writePaintCache(config: StillpointConfig): void {
  try {
    const profile =
      config.profiles.find((p) => p.id === config.activeProfileId) ??
      config.profiles[0];
    if (!profile) return;

    const cache: PaintCache = {
      v: PAINT_CACHE_VERSION,
      // Resolved here, on the write, because this runs after a config save where
      // nobody is waiting. Boot runs in front of the first pixel, where someone is.
      tokens: paintToTokens(
        profileToPaint(profile, imagePreviewFor(profile.background)),
      ),
      rects: profile.widgets.map((w) => w.rect),
    };

    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // A cache we cannot write is a slower first paint, not a failure. Say nothing.
  }
}

/**
 * Image previews, keyed by asset id, in their own key beside the paint cache.
 *
 * The cache is derived from the config, and the config holds only an asset id — the
 * photograph lives in `storage.local`, which is async and so useless before the first
 * pixel. Its average colour and a one-kilobyte thumbnail are what let a cold tab open
 * on the right picture, and they have to be somewhere synchronous for that.
 *
 * Kept per asset rather than per profile, so switching to a profile with a different
 * photograph resolves on the same write. Written by the upload and the import, and by
 * the new tab if it ever loads a photograph whose preview is missing here — so a lost
 * entry costs one cold tab, never a broken one.
 */
const PREVIEWS_KEY = 'stillpoint.previews';

function readPreviews(): Record<string, ImagePreview> {
  try {
    const raw = localStorage.getItem(PREVIEWS_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, ImagePreview>)
      : {};
  } catch {
    return {};
  }
}

function writePreviews(previews: Record<string, ImagePreview>): void {
  try {
    localStorage.setItem(PREVIEWS_KEY, JSON.stringify(previews));
  } catch {
    // As with the cache: a slower first paint, not a failure.
  }
}

export function readImagePreview(assetId: string): ImagePreview | null {
  const preview = readPreviews()[assetId];
  return isImagePreview(preview) ? preview : null;
}

export function writeImagePreview(assetId: string, preview: ImagePreview): void {
  writePreviews({ ...readPreviews(), [assetId]: preview });
}

export function forgetImagePreviews(assetIds: Iterable<string>): void {
  const previews = readPreviews();
  for (const id of assetIds) delete previews[id];
  writePreviews(previews);
}

function imagePreviewFor(
  background: StillpointConfig['profiles'][number]['background'],
): ImagePreview | undefined {
  const id = imageAssetId(background);
  return (id !== null && readImagePreview(id)) || undefined;
}

export function clearPaintCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do and nothing to report.
  }
}
