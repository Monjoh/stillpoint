import { describe, expect, it } from 'vitest';
import { stocksDefinition, stocksSettingsSchema } from './definition';
import { fetchedSymbols, minRefreshMinutes, TWELVE_DATA_MAX_SYMBOLS } from './quotes';

const settings = (input: object) => stocksSettingsSchema.parse(input);
const key = (input: object) => stocksDefinition.dataSource!.key(settings(input));

describe('stocks definition', () => {
  it('starts with a short watchlist and no key', () => {
    const defaults = settings({});
    expect(defaults.apiKey).toBe('');
    expect(defaults.symbols.map((s) => s.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('needs no host permission', () => {
    expect(stocksDefinition.origins).toBeUndefined();
  });

  it('forgets the Yahoo source a widget may have saved', () => {
    expect(settings({ source: 'yahoo', apiKey: 'k' })).not.toHaveProperty('source');
  });

  it('keys the cache on the symbols, ignoring case, blanks, repeats and names', () => {
    expect(
      key({
        apiKey: 'k',
        symbols: [
          { symbol: ' aapl ', label: 'Apple' },
          { symbol: '', label: '' },
          { symbol: 'AAPL', label: '' },
          { symbol: 'eur/usd', label: '' },
        ],
      }),
    ).toBe(key({ apiKey: 'k', symbols: [{ symbol: 'AAPL' }, { symbol: 'EUR/USD' }] }));
  });

  it('fetches nothing without symbols, or without a key', () => {
    expect(key({ apiKey: 'k', symbols: [] })).toBeNull();
    expect(key({})).toBeNull();
    expect(key({ apiKey: '  ' })).toBeNull();
    expect(key({ apiKey: 'k' })).not.toBeNull();
  });

  it('asks again when the key changes', () => {
    expect(key({ apiKey: 'a' })).not.toBe(key({ apiKey: 'b' }));
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
    const base = stocksSettingsSchema.parse({ apiKey: 'k' });
    expect(key({ ...base, refresh: '15' })).toBe(key({ ...base, refresh: '60' }));
  });
});

describe('what a watchlist can afford', () => {
  it('asks Twelve Data for the first eight symbols only', () => {
    const symbols = 'ABCDEFGHIJ'.split('').map((s) => ({ symbol: s, label: '' }));
    expect(fetchedSymbols(symbols)).toHaveLength(TWELVE_DATA_MAX_SYMBOLS);
  });

  it('never refreshes faster than 800 credits a day allow', () => {
    // 8 symbols × 1.8 min ≈ 15 min.
    expect(minRefreshMinutes(8)).toBe(15);
    expect(minRefreshMinutes(4)).toBe(8);
  });

  it('keeps every offered interval within the limit at the largest watchlist', () => {
    // The floor is a safety net: with 15 minutes the fastest choice, it never binds.
    expect(minRefreshMinutes(TWELVE_DATA_MAX_SYMBOLS)).toBeLessThanOrEqual(15);
  });
});
