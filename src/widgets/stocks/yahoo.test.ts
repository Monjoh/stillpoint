import { describe, expect, it, vi } from 'vitest';
import {
  jsonResponse,
  yahooApple,
  yahooNotFound,
  yahooToyota,
} from './__fixtures__/responses';
import { fetchYahoo } from './yahoo';

/** A fake Yahoo as strict as the real one: one symbol per path, nothing else. */
function fakeYahoo(answers: Record<string, () => Response>) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input as string);
    const match = /^\/v8\/finance\/chart\/([^/]+)$/.exec(url.pathname);
    if (url.origin !== 'https://query1.finance.yahoo.com' || !match) {
      return jsonResponse({}, 404);
    }
    const answer = answers[decodeURIComponent(match[1]!)];
    return answer ? answer() : jsonResponse(yahooNotFound, 404);
  });
}

describe('fetchYahoo', () => {
  it('reads each symbol’s price and its change since the previous close', async () => {
    const fetcher = fakeYahoo({
      AAPL: () => jsonResponse(yahooApple),
      '7203.T': () => jsonResponse(yahooToyota),
    });
    const data = await fetchYahoo(['AAPL', '7203.T'], undefined, fetcher);

    expect(data.missing).toEqual([]);
    expect(data.quotes.AAPL).toMatchObject({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 333.69,
      currency: 'USD',
      time: 1790971200 * 1000,
    });
    expect(data.quotes.AAPL!.change).toBeCloseTo(3.37);
    expect(data.quotes.AAPL!.changePercent).toBeCloseTo(1.0202, 3);
    expect(data.quotes['7203.T']).toMatchObject({ price: 2850, currency: 'JPY' });
    expect(data.quotes['7203.T']!.changePercent).toBeCloseTo(-1.724, 2);
  });

  it('asks for one day, and sends no cookies', async () => {
    const fetcher = fakeYahoo({ AAPL: () => jsonResponse(yahooApple) });
    await fetchYahoo(['AAPL'], undefined, fetcher);
    const [input, init] = fetcher.mock.calls[0]!;
    const url = new URL(input as string);
    expect(url.searchParams.get('range')).toBe('1d');
    expect(init?.credentials).toBe('omit');
  });

  it('lists a symbol Yahoo does not know, and still shows the rest', async () => {
    const fetcher = fakeYahoo({ AAPL: () => jsonResponse(yahooApple) });
    const data = await fetchYahoo(['AAPL', 'NOPE'], undefined, fetcher);
    expect(Object.keys(data.quotes)).toEqual(['AAPL']);
    expect(data.missing).toEqual(['NOPE']);
  });

  it('fails the whole answer when one symbol fails, so a partial one is never cached', async () => {
    const fetcher = fakeYahoo({
      AAPL: () => jsonResponse(yahooApple),
      MSFT: () => jsonResponse({}, 500),
    });
    await expect(fetchYahoo(['AAPL', 'MSFT'], undefined, fetcher)).rejects.toThrow(
      'not answering',
    );
  });

  it('says so when Yahoo is refusing requests', async () => {
    const fetcher = fakeYahoo({
      AAPL: () => new Response('Too Many Requests', { status: 429 }),
    });
    await expect(fetchYahoo(['AAPL'], undefined, fetcher)).rejects.toThrow(
      'refusing requests',
    );
  });

  it('says so when Yahoo cannot be reached', async () => {
    await expect(
      fetchYahoo(['AAPL'], undefined, async () => {
        throw new TypeError('NetworkError');
      }),
    ).rejects.toThrow('could not be reached');
  });

  it('refuses an answer it cannot read', async () => {
    const fetcher = fakeYahoo({
      AAPL: () => jsonResponse({ chart: { result: [{ meta: { symbol: 'AAPL' } }] } }),
    });
    await expect(fetchYahoo(['AAPL'], undefined, fetcher)).rejects.toThrow(
      'unreadable',
    );
  });
});
