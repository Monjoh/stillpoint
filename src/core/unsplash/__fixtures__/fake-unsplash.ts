import { vi } from 'vitest';
import type { Fetch } from '../api';

/**
 * A stand-in for api.unsplash.com, images.unsplash.com and picsum.photos, for tests
 * only. Photos are
 * numbered; each batch hands out the next ten. `respond` overrides the API's status
 * for the next calls, to play a bad key, a spent allowance or a dead network.
 */
export function rawPhoto(n: number) {
  return {
    id: `photo-${n}`,
    color: '#a0b0c0',
    width: 6000,
    height: 4000,
    urls: { raw: `https://images.unsplash.com/photo-${n}?ixid=abc` },
    links: {
      html: `https://unsplash.com/photos/photo-${n}`,
      download_location: `https://api.unsplash.com/photos/photo-${n}/download?ixid=abc`,
    },
    user: { name: `Author ${n}`, links: { html: `https://unsplash.com/@author${n}` } },
  };
}

export function rawPicsum(n: number, width = 5000, height = 3333) {
  return {
    id: String(n),
    author: `Picsum Author ${n}`,
    width,
    height,
    url: `https://unsplash.com/photos/picsum-${n}`,
    download_url: `https://picsum.photos/id/${n}/${width}/${height}`,
  };
}

export function fakeUnsplash() {
  let served = 0;
  let status: number | 'offline' = 200;
  const batches = vi.fn<(url: string) => void>();
  const pings = vi.fn<(url: string) => void>();
  const images = vi.fn<(url: string) => void>();
  const picsumPages = vi.fn<(url: string) => void>();

  const fetcher: Fetch = async (input) => {
    const url = String(input);
    if (status === 'offline') throw new TypeError('NetworkError');
    if (url.startsWith('https://api.unsplash.com/photos/random')) {
      batches(url);
      if (status !== 200) return new Response('{}', { status });
      const batch = Array.from({ length: 10 }, () => rawPhoto(++served));
      return new Response(JSON.stringify(batch), { status: 200 });
    }
    if (url.includes('/download')) {
      pings(url);
      return new Response('{}', { status: 200 });
    }
    if (url.startsWith('https://picsum.photos/v2/list')) {
      picsumPages(url);
      if (status !== 200) return new Response('[]', { status });
      const page = Number(new URL(url).searchParams.get('page'));
      const list = Array.from({ length: 100 }, (_, i) =>
        rawPicsum((page - 1) * 100 + i),
      );
      return new Response(JSON.stringify(list), { status: 200 });
    }
    // Picsum sizes by path only, as /id/<n>/<w>/<h>.<ext>. Anything else is a 404
    // there, so it is here too.
    if (
      url.startsWith('https://picsum.photos/id/') &&
      !/^https:\/\/picsum\.photos\/id\/\d+\/\d+\/\d+\.(webp|jpg)$/.test(url)
    ) {
      return new Response('', { status: 404 });
    }
    if (
      url.startsWith('https://images.unsplash.com/') ||
      url.startsWith('https://picsum.photos/id/')
    ) {
      images(url);
      const type =
        url.includes('fm=jpg') || url.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
      // Bytes and a header, not a Blob: Node's Response does not recognise jsdom's
      // Blob and would send the string "[object Blob]".
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': type },
      });
    }
    return new Response('', { status: 404 });
  };

  return {
    fetcher,
    batches,
    pings,
    images,
    picsumPages,
    respond(next: number | 'offline') {
      status = next;
    },
  };
}
