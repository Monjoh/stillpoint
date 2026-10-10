import type { ImagePreview } from '@/core/assets/image';
import type { UnsplashBackground } from '@/core/config/schema';
import type { PhotoSource, UnsplashErrorKind, UnsplashPhoto } from './api';

/**
 * Unsplash's rotation state, in `cache/unsplash`. Disposable: clearing it costs a
 * download, never a setting. The photos' bytes live in their own keys beside it, so
 * updating the queue does not rewrite two photographs.
 *
 * Zod-free and import-light: the paint cache needs `UNSPLASH_PREVIEW_ID` and the new
 * tab needs the types, both on the view path. The network code is in `refresh.ts`.
 */

/** The previews entry for whichever Unsplash photo the next tab should open on. */
export const UNSPLASH_PREVIEW_ID = 'unsplash';

export interface ShownPhoto {
  photo: UnsplashPhoto;
  preview: ImagePreview;
}

export interface UnsplashState {
  v: 1;
  /** The query these photos were fetched for. A different query starts over. */
  query: string;
  /** Where they came from. Gaining or losing a key starts over too. */
  source: PhotoSource;
  /** What the next tab opens on — and what the paint cache's preview describes. */
  current: ShownPhoto | null;
  /** When `current` became current, in ms. */
  shownAt: number;
  /** Already downloaded, so moving to it needs no network. */
  next: ShownPhoto | null;
  /** Details of photos not yet downloaded, from the last batch. */
  queue: UnsplashPhoto[];
  /**
   * Bumped when the user asks for another photo. Unlike a rotation, that is meant to
   * change the picture on screen — in this tab and any other open one.
   */
  skip: number;
  /** `key` is the access key the error was for, or null for Picsum. */
  error: { kind: UnsplashErrorKind; at: number; key: string | null } | null;
  /**
   * A tab downloading `next`, until when. Other tabs leave the download to it rather
   * than fetch a second photo that one of the two writes would orphan. Absent in
   * states written before it existed.
   */
  prefetching?: { by: string; until: number } | null;
}

export function emptyState(
  query: string,
  source: PhotoSource = 'unsplash',
): UnsplashState {
  return {
    v: 1,
    query,
    source,
    current: null,
    shownAt: 0,
    next: null,
    queue: [],
    skip: 0,
    error: null,
    prefetching: null,
  };
}

/** Loose: a wrong shape is treated as no state, and is rebuilt by the next refresh. */
export function isUnsplashState(value: unknown): value is UnsplashState {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    s.v === 1 &&
    typeof s.query === 'string' &&
    typeof s.shownAt === 'number' &&
    typeof s.skip === 'number' &&
    Array.isArray(s.queue)
  );
}

/** Case and spacing are not a different search. */
export function sameQuery(a: string, b: string): boolean {
  const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(a) === norm(b);
}

/** Appended to every link back to Unsplash, as their attribution guideline asks. */
const REFERRAL = 'utm_source=stillpoint&utm_medium=referral';

/**
 * A link back to Unsplash with the referral parameters. Here rather than in `api.ts`
 * because the credit on the canvas needs it, and the canvas must not pull in the
 * network code to get it.
 */
export function referralUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${REFERRAL}`;
}

const HOUR = 60 * 60 * 1000;

/**
 * Whether the photo should move on. "Daily" means a new calendar day where the user
 * is, not 24 hours: a photo picked at 23:00 should not stay up all the next day.
 */
export function isDue(
  refresh: UnsplashBackground['refresh'],
  shownAt: number,
  now: number,
): boolean {
  switch (refresh) {
    case 'tab':
      return true;
    case 'hourly':
      return now - shownAt >= HOUR;
    case 'daily':
      return new Date(shownAt).toDateString() !== new Date(now).toDateString();
  }
}
