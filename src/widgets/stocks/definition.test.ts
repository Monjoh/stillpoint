import { describe, expect, it } from 'vitest';
import { stocksDefinition, stocksSettingsSchema } from './definition';
import { YAHOO_ORIGIN } from './origins';

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
