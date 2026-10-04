/**
 * Where a site's icon is, tried in order, and which ones are known to be missing.
 *
 * Straight from the site, never through an icon service: no third party learns what
 * is on someone's new tab. The large "touch" icon first, because it is sharp at tile
 * size where a 16 px favicon is a blur; then `/favicon.ico`; then a letter tile.
 *
 * The browser caches the icons that exist, but a 404 is usually not cached, so a site
 * with no touch icon would cost a failed request on every new tab. Misses are
 * remembered here instead, for a week, in localStorage. It is a cache: losing it costs
 * one request per link, never a setting.
 */

export const ICON_PATHS = ['/apple-touch-icon.png', '/favicon.ico'] as const;

const KEY = 'stillpoint.favicons';
const FORGET_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type Misses = Record<string, { skip: number; at: number }>;

function read(): Misses {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Misses) : {};
  } catch {
    return {};
  }
}

/** How many of `ICON_PATHS` to skip for this origin. */
export function knownMisses(origin: string, now = Date.now()): number {
  const entry = read()[origin];
  if (!entry || typeof entry.skip !== 'number' || now - entry.at > FORGET_AFTER_MS)
    return 0;
  return Math.min(Math.max(0, Math.floor(entry.skip)), ICON_PATHS.length);
}

export function rememberMiss(origin: string, skip: number, now = Date.now()): void {
  try {
    const misses = read();
    for (const [key, entry] of Object.entries(misses)) {
      if (now - entry.at > FORGET_AFTER_MS) delete misses[key];
    }
    misses[origin] = { skip, at: now };
    localStorage.setItem(KEY, JSON.stringify(misses));
  } catch {
    // A full or blocked localStorage costs a repeated request, nothing more.
  }
}
