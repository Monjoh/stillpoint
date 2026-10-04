import type { LayoutConfig, Rect, StillpointConfig } from '@/core/config/schema';
import { profileToPaint, type CanvasPaint } from '@/core/theme/apply';

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

/** Bump when the shape below changes. A mismatch is treated as a cache miss. */
export const PAINT_CACHE_VERSION = 1;

export interface PaintCache extends CanvasPaint {
  v: number;
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

function isLayout(value: unknown): value is LayoutConfig {
  if (typeof value !== 'object' || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.columns === 'number' &&
    typeof l.rows === 'number' &&
    typeof l.gap === 'number' &&
    (l.maxWidth === null || typeof l.maxWidth === 'number')
  );
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
  if (typeof c.background !== 'object' || c.background === null) return false;
  if (typeof (c.background as Record<string, unknown>).kind !== 'string') return false;
  if (!isLayout(c.layout)) return false;
  if (typeof c.fontScale !== 'number') return false;
  if (typeof c.overrides !== 'object' || c.overrides === null) return false;
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
      ...profileToPaint(profile),
      rects: profile.widgets.map((w) => w.rect),
    };

    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // A cache we cannot write is a slower first paint, not a failure. Say nothing.
  }
}

export function clearPaintCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do and nothing to report.
  }
}
