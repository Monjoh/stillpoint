import {
  BATCH_SIZE,
  isPhoto,
  UnsplashError,
  type Fetch,
  type UnsplashPhoto,
} from './api';

/**
 * Lorem Picsum: the no-key source. A fixed, curated set of about a thousand Unsplash
 * photos, served free with no account, CORS-open, and sized to order. What it lacks
 * is search — every photo is random from the whole set — which is why the panel hides
 * the Search field while it is in use.
 *
 * Its list API pages through the set; there is no "random" endpoint. So a batch is
 * one page picked at random, shuffled, and trimmed to landscape photos, which is one
 * request for ten photos, exactly like an Unsplash batch.
 */

const LIST = 'https://picsum.photos/v2/list';
/** About 1,000 photos at 100 a page, checked 2026-10-05. A short last page is fine. */
const PAGES = 10;
const PER_PAGE = 100;
/** Wide enough to fill a landscape screen without most of it cropped away. */
const MIN_ASPECT = 1.2;

export async function fetchPicsumBatch(
  fetcher: Fetch = fetch,
  random: () => number = Math.random,
): Promise<UnsplashPhoto[]> {
  const page = 1 + Math.floor(random() * PAGES);
  let response: Response;
  try {
    response = await fetcher(`${LIST}?page=${page}&limit=${PER_PAGE}`, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new UnsplashError('network');
  }
  if (!response.ok) throw new UnsplashError('network');

  const body: unknown = await response.json().catch(() => null);
  const photos = (Array.isArray(body) ? body : [])
    .map(readPicsum)
    .filter((photo): photo is UnsplashPhoto => photo !== null)
    .filter((photo) => photo.width / photo.height >= MIN_ASPECT);

  // Fisher–Yates, so a page is not always shown in the same order.
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [photos[i], photos[j]] = [photos[j]!, photos[i]!];
  }
  if (photos.length === 0) throw new UnsplashError('empty');
  return photos.slice(0, BATCH_SIZE);
}

/**
 * One list entry. `url` is the photo's page on unsplash.com, which is what the credit
 * links to; the image itself is always fetched from Picsum's own `/id/<n>` base, built
 * here rather than taken from the response.
 */
function readPicsum(raw: unknown): UnsplashPhoto | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const photo = {
    source: 'picsum' as const,
    id: String(r.id),
    color: null,
    width: r.width,
    height: r.height,
    rawUrl: `https://picsum.photos/id/${String(r.id)}`,
    downloadLocation: null,
    pageUrl: r.url,
    author: { name: r.author, profileUrl: null },
  };
  return isPhoto(photo) ? photo : null;
}
