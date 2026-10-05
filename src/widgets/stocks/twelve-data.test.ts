import { describe, expect, it, vi } from 'vitest';
import { RateLimitError } from '@/core/data/errors';
import {
  jsonResponse,
  twelveBadKey,
  twelveNotFound,
  twelveOutOfCredits,
  twelveQuote,
} from './__fixtures__/responses';
import { fetchTwelveData } from './twelve-data';

const answer = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => jsonResponse(body, status));

describe('fetchTwelveData', () => {
  it('asks for the whole watchlist in one request, with the key', async () => {
    const fetcher = answer({
      AAPL: twelveQuote('AAPL', '333.69', '330.32'),
      MSFT: twelveQuote('MSFT', '400.00', '410.00'),
    });
    const data = await fetchTwelveData(['AAPL', 'MSFT'], 'k3y', undefined, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://api.twelvedata.com/quote');
    expect(url.searchParams.get('symbol')).toBe('AAPL,MSFT');
    expect(url.searchParams.get('apikey')).toBe('k3y');

    expect(data.quotes.AAPL).toMatchObject({
      symbol: 'AAPL',
      price: 333.69,
      currency: 'USD',
      time: 1790971140 * 1000,
    });
    expect(data.quotes.AAPL!.change).toBeCloseTo(3.37);
    expect(data.quotes.MSFT!.changePercent).toBeCloseTo(-2.439, 2);
  });

  it('reads a single symbol, which Twelve Data answers without the wrapper', async () => {
    const data = await fetchTwelveData(
      ['AAPL'],
      'k',
      undefined,
      answer(twelveQuote('AAPL', '333.69', '330.32')),
    );
    expect(data.quotes.AAPL?.price).toBe(333.69);
  });

  it('lists an unknown symbol, alone or among others', async () => {
    const alone = await fetchTwelveData(
      ['NOPE'],
      'k',
      undefined,
      answer(twelveNotFound),
    );
    expect(alone).toEqual({ quotes: {}, missing: ['NOPE'] });

    const among = await fetchTwelveData(
      ['AAPL', 'NOPE'],
      'k',
      undefined,
      answer({ AAPL: twelveQuote('AAPL', '1', '1'), NOPE: twelveNotFound }),
    );
    expect(Object.keys(among.quotes)).toEqual(['AAPL']);
    expect(among.missing).toEqual(['NOPE']);
  });

  it('says when the key is refused, even with HTTP 200', async () => {
    await expect(
      fetchTwelveData(['AAPL', 'MSFT'], 'bad', undefined, answer(twelveBadKey)),
    ).rejects.toThrow('did not accept this key');
    await expect(
      fetchTwelveData(['AAPL'], 'bad', undefined, answer(twelveBadKey, 401)),
    ).rejects.toThrow('did not accept this key');
  });

  it('says when the key has used its allowance', async () => {
    await expect(
      fetchTwelveData(['AAPL'], 'k', undefined, answer(twelveOutOfCredits)),
    ).rejects.toThrow('8 symbols a minute');
    await expect(
      fetchTwelveData(['AAPL'], 'k', undefined, answer(twelveOutOfCredits)),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('says so when Twelve Data cannot be reached', async () => {
    await expect(
      fetchTwelveData(['AAPL'], 'k', undefined, async () => {
        throw new TypeError('NetworkError');
      }),
    ).rejects.toThrow('could not be reached');
  });
});
