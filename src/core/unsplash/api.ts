/**
 * The Unsplash API, as much of it as a background needs: random photos for a query,
 * the download ping the API terms require, and URLs for the two sizes we keep.
 *
 * Authenticated with an access key (`Client-ID`): the user's own, from General. With
 * none, photos come from Lorem Picsum instead (`picsum.ts`) — a curated set of
 * Unsplash photos that needs no key. Both produce an `UnsplashPhoto`, so the rotation
 * in `refresh.ts` does not care which it got. A built-in key, registered for
 * Stillpoint itself, is planned once the Unsplash app is approved.
 *
 * Both hosts send CORS headers, so an extension page can call them without a host
 * permission and without the install-time warning one would add.
 *
 * Nothing here runs before first paint. See `refresh.ts` for when it does run.
 */

import { PREVIEW_EDGE } from '@/core/assets/image';

const API = 'https://api.unsplash.com';

/**
 * Asked for in batches. One request returns this many photos' details, and only the
 * bytes of the next one or two are fetched — at "every tab", one request per tab
 * would spend a demo key's hourly allowance in fifty tabs.
 */
export const BATCH_SIZE = 10;

export type PhotoSource = 'unsplash' | 'picsum';

export interface UnsplashPhoto {
  /** Which service the bytes come from. Every photo is an Unsplash photo either way. */
  source: PhotoSource;
  id: string;
  /** Unsplash's own average colour, `#rrggbb`. Picsum has none; it is measured instead. */
  color: string | null;
  width: number;
  height: number;
  /**
   * Unsplash: the imgix base URL, sized with query parameters. Picsum: the photo's
   * `/id/<n>` base, sized with path segments. Never stored as bytes on a server.
   */
  rawUrl: string;
  /** Must be pinged when an Unsplash photo is used. Picsum asks for nothing: null. */
  downloadLocation: string | null;
  /** The photo's page on Unsplash. */
  pageUrl: string;
  /** Picsum gives the photographer's name but not their profile: null. */
  author: { name: string; profileUrl: string | null };
}

export type UnsplashErrorKind = 'key' | 'rate' | 'network' | 'empty';

export class UnsplashError extends Error {
  constructor(readonly kind: UnsplashErrorKind) {
    super(`Unsplash: ${kind}`);
    this.name = 'UnsplashError';
  }
}

export type Fetch = typeof fetch;

/** A batch of random photos for `query`. Landscape, with Unsplash's strict filter. */
export async function fetchRandomPhotos(
  key: string,
  query: string,
  fetcher: Fetch = fetch,
): Promise<UnsplashPhoto[]> {
  const params = new URLSearchParams({
    count: String(BATCH_SIZE),
    orientation: 'landscape',
    content_filter: 'high',
  });
  if (query.trim()) params.set('query', query.trim());

  const response = await request(fetcher, `${API}/photos/random?${params}`, key);
  // A query that matches nothing is a 404, not an empty list.
  if (response.status === 404) throw new UnsplashError('empty');
  checkStatus(response);

  const body: unknown = await response.json().catch(() => null);
  const photos = (Array.isArray(body) ? body : []).map(readPhoto).filter(isPhoto);
  if (photos.length === 0) throw new UnsplashError('empty');
  return photos;
}

/**
 * Tell Unsplash the photo was used. Required by the API guidelines whenever a photo
 * is put in front of a user, and counted for the photographer. Fire-and-forget: a
 * failed ping must never cost the user their background.
 */
export async function trackDownload(
  key: string,
  photo: UnsplashPhoto,
  fetcher: Fetch = fetch,
): Promise<void> {
  if (photo.downloadLocation === null) return;
  try {
    await request(fetcher, photo.downloadLocation, key);
  } catch {
    // Nothing to do. It is a counter, not a dependency.
  }
}

/** The photo, `width` pixels wide (never wider than it is), as WebP. */
export function photoUrl(photo: UnsplashPhoto, width: number): string {
  if (photo.source === 'picsum') {
    return picsumUrl(photo, Math.min(width, photo.width), 'webp');
  }
  return withParams(photo.rawUrl, {
    w: String(width),
    q: '80',
    fm: 'webp',
    fit: 'max',
  });
}

/** The first-paint thumbnail, the same size as an uploaded photo's. */
export function thumbUrl(photo: UnsplashPhoto): string {
  if (photo.source === 'picsum') return picsumUrl(photo, PREVIEW_EDGE, 'jpg');
  return withParams(photo.rawUrl, {
    w: String(PREVIEW_EDGE),
    q: '60',
    fm: 'jpg',
    fit: 'max',
  });
}

/** Picsum sizes by path and crops to the box given, so the box keeps the photo's shape. */
function picsumUrl(photo: UnsplashPhoto, width: number, ext: 'webp' | 'jpg'): string {
  const height = Math.max(1, Math.round((width * photo.height) / photo.width));
  return `${photo.rawUrl}/${width}/${height}.${ext}`;
}

async function request(fetcher: Fetch, url: string, key: string): Promise<Response> {
  try {
    return await fetcher(url, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
      // No cookies to send and none to receive. It is an API call, not a visit.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new UnsplashError('network');
  }
}

function checkStatus(response: Response): void {
  if (response.ok) return;
  if (response.status === 401) throw new UnsplashError('key');
  // Unsplash answers an exhausted allowance with 403 and "Rate Limit Exceeded".
  if (response.status === 403 || response.status === 429)
    throw new UnsplashError('rate');
  throw new UnsplashError('network');
}

function withParams(url: string, params: Record<string, string>): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params))
    parsed.searchParams.set(key, value);
  return parsed.toString();
}

/**
 * Structural, field by field. The response is a stranger's JSON, and two of these
 * strings end up inside a CSS `url()` and two inside an `href`: anything that is not
 * an https URL on the host we expect is refused.
 */
function readPhoto(raw: unknown): UnsplashPhoto | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const photo = {
    source: 'unsplash',
    id: r.id,
    color: r.color,
    width: r.width,
    height: r.height,
    rawUrl: r.urls?.raw,
    downloadLocation: r.links?.download_location,
    pageUrl: r.links?.html,
    author: { name: r.user?.name, profileUrl: r.user?.links?.html },
  };
  return isPhoto(photo) ? photo : null;
}

export function isPhoto(value: unknown): value is UnsplashPhoto {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  const author = p.author as Record<string, unknown> | undefined;
  const common =
    typeof p.id === 'string' &&
    /^[\w-]+$/.test(p.id) &&
    typeof p.width === 'number' &&
    p.width > 0 &&
    typeof p.height === 'number' &&
    p.height > 0 &&
    isHttpsOn(p.pageUrl, 'unsplash.com') &&
    typeof author?.name === 'string';
  if (!common) return false;

  if (p.source === 'picsum') {
    return (
      p.color === null &&
      p.rawUrl === `https://picsum.photos/id/${p.id}` &&
      p.downloadLocation === null &&
      author.profileUrl === null
    );
  }
  return (
    p.source === 'unsplash' &&
    typeof p.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(p.color) &&
    isHttpsOn(p.rawUrl, 'images.unsplash.com') &&
    isHttpsOn(p.downloadLocation, 'api.unsplash.com') &&
    isHttpsOn(author.profileUrl, 'unsplash.com')
  );
}

function isHttpsOn(value: unknown, host: string): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host;
  } catch {
    return false;
  }
}
