import { describe, expect, it, vi } from 'vitest';
import type { Fetch } from './api';
import { fetchPicsumBatch } from './picsum';
import { fakeUnsplash, rawPicsum } from './__fixtures__/fake-unsplash';

const respondWith =
  (body: unknown, status = 200): Fetch =>
  async () =>
    new Response(JSON.stringify(body), { status });

describe('fetchPicsumBatch', () => {
  it('reads one random page into ten photos, crediting Unsplash pages', async () => {
    const server = fakeUnsplash();
    const photos = await fetchPicsumBatch(server.fetcher, () => 0.35);

    expect(server.picsumPages).toHaveBeenCalledWith(
      'https://picsum.photos/v2/list?page=4&limit=100',
    );
    expect(photos).toHaveLength(10);
    expect(photos[0]).toMatchObject({
      source: 'picsum',
      color: null,
      downloadLocation: null,
      author: { profileUrl: null },
    });
    expect(photos[0]!.rawUrl).toMatch(/^https:\/\/picsum\.photos\/id\/\d+$/);
    expect(photos[0]!.pageUrl).toMatch(/^https:\/\/unsplash\.com\/photos\//);
  });

  it('keeps only photos wide enough for a landscape screen', async () => {
    const photos = await fetchPicsumBatch(
      respondWith([rawPicsum(1, 3000, 4000), rawPicsum(2, 4000, 4000), rawPicsum(3)]),
    );
    expect(photos.map((p) => p.id)).toEqual(['3']);
  });

  // The image is always built from Picsum's own base, and the credit link must be an
  // Unsplash page; a list entry that says otherwise is dropped.
  it('drops entries that do not look like Picsum’s', async () => {
    const photos = await fetchPicsumBatch(
      respondWith([
        { ...rawPicsum(1), url: 'https://evil.example/' },
        { ...rawPicsum(2), id: '../../x' },
        rawPicsum(3),
      ]),
    );
    expect(photos.map((p) => p.id)).toEqual(['3']);
  });

  it('reads a failure as a network problem', async () => {
    await expect(fetchPicsumBatch(respondWith([], 503))).rejects.toMatchObject({
      kind: 'network',
    });
    const offline = vi.fn<Fetch>(async () => {
      throw new TypeError('offline');
    });
    await expect(fetchPicsumBatch(offline)).rejects.toMatchObject({ kind: 'network' });
  });
});
