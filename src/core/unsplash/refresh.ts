import { dataUrlToBlob, isImageAsset, type ImageAsset } from '@/core/assets/image';
import type { UnsplashBackground } from '@/core/config/schema';
import { StorageKeys, type StorageAdapter } from '@/core/storage/adapter';
import { writeImagePreview } from '@/core/storage/paint-cache';
import { averageColor } from '@/lib/average-color';
import {
  fetchRandomPhotos,
  photoUrl,
  thumbUrl,
  trackDownload,
  UnsplashError,
  type Fetch,
  type PhotoSource,
  type UnsplashErrorKind,
  type UnsplashPhoto,
} from './api';
import { fetchPicsumBatch } from './picsum';
import {
  emptyState,
  isDue,
  isUnsplashState,
  sameQuery,
  UNSPLASH_PREVIEW_ID,
  type ShownPhoto,
  type UnsplashState,
} from './state';

/**
 * When the Unsplash photo moves on, and the one rule that keeps it calm:
 *
 * **A tab never changes the photo it opened with.** A due rotation promotes the
 * prefetched photo to `current` and updates the paint-cache preview, so the *next*
 * tab opens on it from its first frame. The tab that did the rotating keeps its
 * picture. The first tab of a new day therefore shows yesterday's photo, and the
 * second shows today's — one tab of lag, in exchange for never swapping a picture
 * under someone, and never flashing.
 *
 * The exceptions are when this tab has nothing to show for the query (first use, a
 * new search), and when the user asks for another photo. Both are reported as
 * `showNow`.
 *
 * The next photo is always downloaded ahead, so a rotation needs no network. Loaded
 * lazily by the new tab, after first paint; nothing here is on the critical path.
 */

export interface RefreshContext {
  adapter: StorageAdapter;
  /**
   * The user's Unsplash access key. Used only when `background.source` is
   * `'unsplash'`, and without it that source has nothing to fetch with. Lorem Picsum
   * needs none.
   */
  key: string | null;
  background: UnsplashBackground;
  /** The width to download at, in device pixels. */
  width: number;
  now?: number;
  fetcher?: Fetch;
}

export interface RefreshResult {
  state: UnsplashState;
  /** Set when this tab should change what it shows. See the module comment. */
  showNow: ShownPhoto | null;
  /** `current` changed, so the paint cache must be re-derived. */
  changed: boolean;
}

/**
 * How long to wait before asking again after a failure. A refused key is not retried
 * at all until the key changes: asking again cannot make it valid.
 */
const RETRY_AFTER_MS: Record<UnsplashErrorKind, number> = {
  key: Infinity,
  rate: 15 * 60 * 1000,
  network: 2 * 60 * 1000,
  empty: 60 * 60 * 1000,
};

export async function loadState(
  adapter: StorageAdapter,
): Promise<UnsplashState | null> {
  const stored = await adapter.get<unknown>(StorageKeys.unsplash);
  return isUnsplashState(stored) ? stored : null;
}

export async function loadPhotoImage(
  adapter: StorageAdapter,
  photoId: string,
): Promise<ImageAsset | null> {
  const stored = await adapter.get<unknown>(StorageKeys.unsplashImage(photoId));
  return isImageAsset(stored) ? stored : null;
}

/**
 * One refresh at a time per page. The canvas and the panel's "Show another photo" can
 * both start one, and two interleaved would promote twice and orphan a download.
 */
let running: Promise<unknown> = Promise.resolve();

export function refreshUnsplash(
  context: RefreshContext,
  options: { force?: boolean } = {},
): Promise<RefreshResult> {
  const result = running.then(() =>
    refresh(forSource(context), options.force ?? false),
  );
  running = result.catch(() => {});
  return result;
}

/**
 * The key belongs to the Unsplash source alone. With Picsum chosen, a saved key must
 * not decide which service is asked, be pinged with downloads, or be blamed for an
 * error, so from here on it is as if there were none.
 */
function forSource(context: RefreshContext): RefreshContext {
  return context.background.source === 'unsplash' ? context : { ...context, key: null };
}

async function refresh(
  context: RefreshContext,
  force: boolean,
): Promise<RefreshResult> {
  const { adapter, key, background } = context;
  const now = context.now ?? Date.now();
  const fetcher = context.fetcher ?? fetch;

  const source: PhotoSource = background.source;

  let state = await loadState(adapter);
  // Unsplash chosen but no key yet: nothing can be fetched, and the photos already
  // stored are left alone for when one arrives — or for a switch back to Picsum.
  if (source === 'unsplash' && !key) {
    return {
      state: state ?? emptyState(background.query, source),
      showNow: null,
      changed: false,
    };
  }
  if (
    !state ||
    state.source !== source ||
    // Picsum cannot search, so a new search changes nothing there.
    (source === 'unsplash' && !sameQuery(state.query, background.query))
  ) {
    if (state) await drop(adapter, [state.current, state.next]);
    state = emptyState(background.query, source);
  }
  const s: UnsplashState = { ...state, queue: [...state.queue] };
  const had = s.current;
  let showNow: ShownPhoto | null = null;

  const blocked =
    s.error !== null &&
    (s.error.kind !== 'key' || s.error.key === key) &&
    now - s.error.at < RETRY_AFTER_MS[s.error.kind];

  const promote = async (incoming: ShownPhoto) => {
    const previous = s.current;
    s.current = incoming;
    s.shownAt = now;
    if (s.next?.photo.id === incoming.photo.id) s.next = null;
    if (force) s.skip += 1;
    if (!had || force) showNow = incoming;
    // The tab showing `previous` holds it as an object URL; deleting the stored copy
    // does not take it off that screen.
    if (previous) await drop(adapter, [previous]);
    if (key) void trackDownload(key, incoming.photo, fetcher);
  };

  try {
    if (!had || force || isDue(background.refresh, s.shownAt, now)) {
      // The prefetched one costs nothing. Downloading on the spot is only worth it
      // when the picture has to change in this tab anyway.
      if (s.next) await promote(s.next);
      else if ((!had || force) && !blocked)
        await promote(await take(s, context, fetcher));
      // Otherwise due but nothing prefetched (the last prefetch failed): keep the
      // current photo, and let the prefetch below put the next tab right.
    }

    if (!s.next && !blocked) s.next = await take(s, context, fetcher);
    if (!blocked) s.error = null;
  } catch (error) {
    if (!(error instanceof UnsplashError)) throw error;
    s.error = { kind: error.kind, at: now, key };
  }

  await adapter.set(StorageKeys.unsplash, s);

  const changed = s.current !== null && s.current.photo.id !== had?.photo.id;
  if (changed) writeImagePreview(UNSPLASH_PREVIEW_ID, s.current!.preview);
  return { state: s, showNow, changed };
}

/** The next photo off the batch, downloaded and stored. Fetches a batch if empty. */
async function take(
  s: UnsplashState,
  context: RefreshContext,
  fetcher: Fetch,
): Promise<ShownPhoto> {
  const taken = new Set([s.current?.photo.id, s.next?.photo.id]);
  s.queue = s.queue.filter((photo) => !taken.has(photo.id));
  if (s.queue.length === 0) {
    const batch = context.key
      ? await fetchRandomPhotos(context.key, s.query, fetcher)
      : await fetchPicsumBatch(fetcher);
    s.queue = batch.filter((photo) => !taken.has(photo.id));
    if (s.queue.length === 0) throw new UnsplashError('empty');
  }

  const photo = s.queue.shift()!;
  const asset = await download(photo, context.width, fetcher);
  await context.adapter.set(StorageKeys.unsplashImage(photo.id), asset);
  return { photo, preview: asset.preview };
}

async function download(
  photo: UnsplashPhoto,
  width: number,
  fetcher: Fetch,
): Promise<ImageAsset> {
  const [dataUrl, thumb] = await Promise.all([
    fetchDataUrl(photoUrl(photo, width), fetcher),
    fetchDataUrl(thumbUrl(photo), fetcher),
  ]);
  const shown = Math.min(width, photo.width);
  const asset: ImageAsset = {
    v: 1,
    kind: 'image',
    dataUrl,
    width: shown,
    height: Math.round((shown * photo.height) / photo.width),
    preview: {
      color: photo.color?.toLowerCase() ?? (await measureColor(thumb)),
      thumb,
    },
  };
  if (!isImageAsset(asset)) throw new UnsplashError('network');
  return asset;
}

async function fetchDataUrl(url: string, fetcher: Fetch): Promise<string> {
  let response: Response;
  try {
    response = await fetcher(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new UnsplashError('network');
  }
  if (!response.ok) throw new UnsplashError('network');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new UnsplashError('network');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new UnsplashError('network'));
    reader.readAsDataURL(blob);
  });
}

/**
 * The average colour of a thumbnail, for a source that does not say (Picsum). It is
 * only the layer under everything, seen for the frames before the thumbnail decodes,
 * so black is an acceptable answer when the browser cannot measure.
 */
async function measureColor(thumb: string): Promise<string> {
  try {
    const bitmap = await createImageBitmap(dataUrlToBlob(thumb));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return averageColor(context.getImageData(0, 0, canvas.width, canvas.height).data);
  } catch {
    return '#000000';
  }
}

async function drop(
  adapter: StorageAdapter,
  shown: (ShownPhoto | null)[],
): Promise<void> {
  await Promise.all(
    shown
      .filter((s): s is ShownPhoto => s !== null)
      .map((s) =>
        adapter.remove(StorageKeys.unsplashImage(s.photo.id)).catch(() => {}),
      ),
  );
}

/** Device pixels across the screen, capped where an uploaded photo is. */
export function wantedWidth(): number {
  const edge = Math.max(screen.width, screen.height) * (devicePixelRatio || 1);
  return Math.min(3840, Math.max(1280, Math.round(edge)));
}
