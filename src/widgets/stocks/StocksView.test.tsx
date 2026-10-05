import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResourceState } from '@/core/registry/types';
import { stocksSettingsSchema, type StocksSettings } from './definition';
import type { Quote, StocksData } from './quotes';
import StocksView from './StocksView';

const size = { width: 400, height: 300 };
const settings = (overrides: Partial<StocksSettings> = {}) =>
  stocksSettingsSchema.parse(overrides);

const quote = (symbol: string, price: number, changePercent: number): Quote => ({
  symbol,
  name: `${symbol} Inc.`,
  price,
  change: (price * changePercent) / 100,
  changePercent,
  currency: 'USD',
  time: Date.now(),
});

const stocks: StocksData = {
  quotes: { AAPL: quote('AAPL', 333.69, 1.02), MSFT: quote('MSFT', 400, -0.4) },
  missing: [],
};
const ready = (data = stocks): ResourceState<StocksData> => ({
  status: 'ready',
  data,
  fetchedAt: Date.now(),
  stale: false,
});

const rows = () => screen.getAllByRole('row').map((row) => row.textContent);

describe('StocksView', () => {
  it('shows each symbol with its price and change, in the watchlist’s order', () => {
    render(
      <StocksView settings={settings()} size={size} isEditing={false} data={ready()} />,
    );
    expect(rows()).toEqual([
      expect.stringMatching(/^AAPL.*333\.69.*▲\+1\.02%$/),
      expect.stringMatching(/^MSFT.*400\.00.*▼-0\.40%$/),
    ]);
  });

  it('uses the names given, and the symbol where there is none', () => {
    render(
      <StocksView
        settings={settings({
          symbols: [
            { symbol: 'aapl', label: 'Apple' },
            { symbol: 'MSFT', label: '' },
          ],
        })}
        size={size}
        isEditing={false}
        data={ready()}
      />,
    );
    expect(screen.getByRole('rowheader', { name: 'Apple' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'MSFT' })).toBeTruthy();
  });

  it('marks a symbol the source does not have, rather than hiding it', () => {
    render(
      <StocksView
        settings={settings({
          symbols: [
            { symbol: 'AAPL', label: '' },
            { symbol: 'NOPE', label: '' },
          ],
        })}
        size={size}
        isEditing={false}
        data={ready({ quotes: { AAPL: stocks.quotes.AAPL! }, missing: ['NOPE'] })}
      />,
    );
    expect(rows()[1]).toContain('Not available');
  });

  it('keeps old prices up when a refresh fails, and says how old', () => {
    render(
      <StocksView
        settings={settings()}
        size={size}
        isEditing={false}
        data={{
          status: 'error',
          error: 'Twelve Data could not be reached.',
          data: stocks,
          fetchedAt: Date.now() - 2 * 60 * 60 * 1000,
        }}
      />,
    );
    expect(rows()).toHaveLength(2);
    expect(screen.getByText('Not updated for 2 hr')).toBeTruthy();
  });

  it('says what is wrong when there is nothing to show', () => {
    render(
      <StocksView
        settings={settings()}
        size={size}
        isEditing={false}
        data={{ status: 'error', error: 'Twelve Data did not accept this key.' }}
      />,
    );
    expect(
      screen.getByText(/Prices unavailable\. Twelve Data did not accept/),
    ).toBeTruthy();
  });

  it('asks for a Twelve Data key, or for symbols, before fetching anything', () => {
    const { rerender } = render(
      <StocksView settings={settings({})} size={size} isEditing={false} />,
    );
    expect(screen.getByText(/Add your Twelve Data key/)).toBeTruthy();
    rerender(
      <StocksView
        settings={settings({ apiKey: 'k', symbols: [] })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByText(/Add symbols/)).toBeTruthy();
  });

  it('shows only the rows that fit a short cell', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ symbol: `S${i}`, label: '' }));
    render(
      <StocksView
        settings={settings({ symbols: many })}
        size={{ width: 400, height: 60 }}
        isEditing={false}
        data={ready({ quotes: {}, missing: many.map((m) => m.symbol) })}
      />,
    );
    expect(rows().length).toBeLessThan(10);
  });

  it('says when the prices were fetched, if asked to', () => {
    const at = new Date();
    at.setHours(14, 5, 0, 0);
    render(
      <StocksView
        settings={settings({ showUpdated: true })}
        size={size}
        isEditing={false}
        data={{ ...ready(), fetchedAt: at.getTime() } as ResourceState<StocksData>}
      />,
    );
    expect(screen.getByText(/^Updated 2:05\sPM$/)).toBeTruthy();
  });

  it('puts the failure ahead of the update time', () => {
    render(
      <StocksView
        settings={settings({ showUpdated: true })}
        size={size}
        isEditing={false}
        data={{
          status: 'error',
          error: 'x',
          data: stocks,
          fetchedAt: Date.now() - 2 * 60 * 60 * 1000,
        }}
      />,
    );
    expect(screen.getByText('Not updated for 2 hr')).toBeTruthy();
    expect(screen.queryByText(/^Updated/)).toBeNull();
  });

  it('shows Twelve Data’s first eight, and says why the rest are missing', () => {
    const symbols = 'ABCDEFGHIJ'.split('').map((s) => ({ symbol: s, label: '' }));
    render(
      <StocksView
        settings={settings({ apiKey: 'k', symbols })}
        size={{ width: 400, height: 600 }}
        isEditing={false}
        data={ready({ quotes: {}, missing: [] })}
      />,
    );
    expect(rows()).toHaveLength(8);
    expect(screen.getByText(/only the first 8 are shown/)).toBeTruthy();
  });
});
