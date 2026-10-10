import { describe, expect, it, vi } from 'vitest';
import {
  BATCH_SIZE,
  fetchRandomPhotos,
  photoUrl,
  thumbUrl,
  trackDownload,
  UnsplashError,
  type Fetch,
} from './api';
import { fakeUnsplash, rawPhoto } from './__fixtures__/fake-unsplash';

const respondWith =
  (body: unknown, status = 200): Fetch =>
  async () =>
    new Response(JSON.stringify(body), { status });

describe('fetchRandomPhotos', () => {
  it('asks for a landscape batch for the query, with the user’s key', async () => {
    const fetcher = vi.fn<Fetch>(respondWith([rawPhoto(1)]));
    await fetchRandomPhotos('my-key', '  snowy mountains ', fetcher);

    const [url, init] = fetcher.mock.calls[0]!;
    const params = new URL(String(url)).searchParams;
    expect(params.get('query')).toBe('snowy mountains');
    expect(params.get('count')).toBe(String(BATCH_SIZE));
    expect(params.get('orientation')).toBe('landscape');
    expect(params.get('content_filter')).toBe('high');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Client-ID my-key',
    );
    expect(init?.credentials).toBe('omit');
  });

  it('reads the fields a background needs', async () => {
    const [photo] = await fetchRandomPhotos('k', 'x', respondWith([rawPhoto(7)]));
    expect(photo).toEqual({
      source: 'unsplash',
      id: 'photo-7',
      color: '#a0b0c0',
      width: 6000,
      height: 4000,
      rawUrl: 'https://images.unsplash.com/photo-7?ixid=abc',
      downloadLocation: 'https://api.unsplash.com/photos/photo-7/download?ixid=abc',
      pageUrl: 'https://unsplash.com/photos/photo-7',
      author: { name: 'Author 7', profileUrl: 'https://unsplash.com/@author7' },
    });
  });

  // These strings land in a CSS url() and in hrefs. A photo pointing anywhere but
  // Unsplash's own hosts is dropped, not painted.
  it('drops photos whose URLs are not on Unsplash’s hosts', async () => {
    const evil = { ...rawPhoto(2), urls: { raw: 'https://evil.example/x.jpg' } };
    const plain = {
      ...rawPhoto(3),
      user: { name: 'A', links: { html: 'javascript:x' } },
    };
    const photos = await fetchRandomPhotos(
      'k',
      'x',
      respondWith([rawPhoto(1), evil, plain]),
    );
    expect(photos.map((p) => p.id)).toEqual(['photo-1']);
  });

  it.each([
    [401, 'key'],
    [403, 'rate'],
    [429, 'rate'],
    [404, 'empty'],
    [500, 'network'],
  ])('reads HTTP %i as a %s problem', async (status, kind) => {
    await expect(fetchRandomPhotos('k', 'x', respondWith({}, status))).rejects.toEqual(
      new UnsplashError(kind as UnsplashError['kind']),
    );
  });

  it('reads a failed request as a network problem, and an empty batch as empty', async () => {
    const offline = fakeUnsplash();
    offline.respond('offline');
    await expect(fetchRandomPhotos('k', 'x', offline.fetcher)).rejects.toMatchObject({
      kind: 'network',
    });
    await expect(fetchRandomPhotos('k', 'x', respondWith([]))).rejects.toMatchObject({
      kind: 'empty',
    });
  });
});

describe('sizing and tracking', () => {
  const photo = {
    source: 'unsplash' as const,
    id: 'p',
    color: '#000000',
    width: 10,
    height: 10,
    rawUrl: 'https://images.unsplash.com/photo-1?ixid=abc',
    downloadLocation: 'https://api.unsplash.com/photos/p/download',
    pageUrl: 'https://unsplash.com/photos/p',
    author: { name: 'A', profileUrl: 'https://unsplash.com/@a' },
  };

  it('asks imgix for the size it wants, keeping Unsplash’s own parameters', () => {
    const full = new URL(photoUrl(photo, 2560)).searchParams;
    expect(full.get('w')).toBe('2560');
    expect(full.get('fm')).toBe('webp');
    expect(full.get('ixid')).toBe('abc');
    expect(new URL(thumbUrl(photo)).searchParams.get('w')).toBe('128');
  });

  it('pings the download endpoint, and swallows a failure', async () => {
    const fetcher = vi.fn<Fetch>(async () => {
      throw new TypeError('offline');
    });
    await expect(trackDownload('k', photo, fetcher)).resolves.toBeUndefined();
    expect(String(fetcher.mock.calls[0]![0])).toBe(photo.downloadLocation);
  });
});

describe('Picsum photos', () => {
  const picsum = {
    source: 'picsum' as const,
    id: '10',
    color: null,
    width: 2500,
    height: 1667,
    rawUrl: 'https://picsum.photos/id/10',
    downloadLocation: null,
    pageUrl: 'https://unsplash.com/photos/x',
    author: { name: 'A', profileUrl: null },
  };

  // Picsum crops to the box asked for, so the box must keep the photo's shape, and
  // must not ask for more pixels than the photo has.
  it('sized by path, in the photo’s own shape, never past its own width', () => {
    expect(photoUrl(picsum, 1920)).toBe('https://picsum.photos/id/10/1920/1280.webp');
    expect(photoUrl(picsum, 3840)).toBe('https://picsum.photos/id/10/2500/1667.webp');
    expect(thumbUrl(picsum)).toBe('https://picsum.photos/id/10/128/85.jpg');
  });

  it('have no download ping to send', async () => {
    const fetcher = vi.fn<Fetch>();
    await trackDownload('k', picsum, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
