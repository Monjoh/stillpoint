import { describe, expect, it } from 'vitest';
import { stocksDefinition, stocksSettingsSchema } from './definition';
import { YAHOO_ORIGIN } from './origins';
import { fetchedSymbols, minRefreshMinutes, TWELVE_DATA_MAX_SYMBOLS } from './quotes';

const settings = (input: object) => stocksSettingsSchema.parse(input);
const key = (input: object) => stocksDefinition.dataSource!.key(settings(input));

describe('stocks definition', () => {
  it('starts on Yahoo with a short watchlist', () => {
    const defaults = settings({});
    expect(defaults.source).toBe('yahoo');
    expect(defaults.symbols.map((s) => s.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('needs the Yahoo permission for Yahoo only', () => {
    expect(stocksDefinition.origins!(settings({}))).toEqual([YAHOO_ORIGIN]);
    expect(stocksDefinition.origins!(settings({ source: 'twelvedata' }))).toEqual([]);
  });

  it('keys the cache on the symbols, ignoring case, blanks, repeats and names', () => {
    expect(
      key({
        symbols: [
          { symbol: ' aapl ', label: 'Apple' },
          { symbol: '', label: '' },
          { symbol: 'AAPL', label: '' },
          { symbol: '7203.t', label: '' },
        ],
      }),
    ).toBe(key({ symbols: [{ symbol: 'AAPL' }, { symbol: '7203.T' }] }));
  });

  it('fetches nothing without symbols, or without a Twelve Data key', () => {
    expect(key({ symbols: [] })).toBeNull();
    expect(key({ source: 'twelvedata', apiKey: '  ' })).toBeNull();
    expect(key({ source: 'twelvedata', apiKey: 'k' })).not.toBeNull();
  });

  it('asks again when the key changes', () => {
    expect(key({ source: 'twelvedata', apiKey: 'a' })).not.toBe(
      key({ source: 'twelvedata', apiKey: 'b' }),
    );
  });
});

describe('the refresh interval', () => {
  const ttl = (refresh?: string) => {
    const settings = stocksSettingsSchema.parse(refresh ? { refresh } : {});
    const { ttlMs } = stocksDefinition.dataSource!;
    return typeof ttlMs === 'function' ? ttlMs(settings) : ttlMs;
  };

  it('is the user’s choice, every 15 minutes unless changed', () => {
    expect(ttl()).toBe(15 * 60 * 1000);
    expect(ttl('30')).toBe(30 * 60 * 1000);
    expect(ttl('60')).toBe(60 * 60 * 1000);
  });

  it('is not part of the cache key: a new interval keeps the prices', () => {
    const { key } = stocksDefinition.dataSource!;
    const base = stocksSettingsSchema.parse({});
    expect(key({ ...base, refresh: '15' })).toBe(key({ ...base, refresh: '60' }));
  });
});

describe('what a watchlist can afford', () => {
  it('asks Twelve Data for the first eight symbols only', () => {
    const symbols = 'ABCDEFGHIJ'.split('').map((s) => ({ symbol: s, label: '' }));
    expect(fetchedSymbols('twelvedata', symbols)).toHaveLength(TWELVE_DATA_MAX_SYMBOLS);
    expect(fetchedSymbols('yahoo', symbols)).toHaveLength(10);
  });

  it('never refreshes faster than the service allows', () => {
    // 8 Twelve Data symbols × 1.8 min ≈ 15 min keeps a day under 800 credits.
    expect(minRefreshMinutes('twelvedata', 8)).toBe(15);
    // 20 Yahoo symbols at 30 s each: 10 min, about 120 requests an hour.
    expect(minRefreshMinutes('yahoo', 20)).toBe(10);
  });

  it('keeps every offered interval within those limits at the largest watchlists', () => {
    // The floor is a safety net: with 15 minutes the fastest choice, it never binds.
    expect(
      minRefreshMinutes('twelvedata', TWELVE_DATA_MAX_SYMBOLS),
    ).toBeLessThanOrEqual(15);
    expect(minRefreshMinutes('yahoo', 20)).toBeLessThanOrEqual(15);
  });
});
