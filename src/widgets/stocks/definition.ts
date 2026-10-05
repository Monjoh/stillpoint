import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';
import { YAHOO_ORIGIN } from './origins';
import { watchlist, type StocksData } from './quotes';

export const stocksSettingsSchema = z.object({
  source: z
    .enum(['yahoo', 'twelvedata'])
    .default('yahoo')
    .meta(
      field({
        label: 'Prices from',
        control: 'select',
        options: { yahoo: 'Yahoo Finance', twelvedata: 'Twelve Data' },
        help: 'Yahoo needs no key and covers every market, but is unofficial and may stop working. Twelve Data needs a free key and covers US markets.',
      }),
    ),

  apiKey: z
    .string()
    .max(100)
    .default('')
    .meta(
      field({
        label: 'Twelve Data key',
        help: 'Free at twelvedata.com, for up to 8 symbols. It is saved with your settings, so exports include it.',
        showIf: { field: 'source', equals: 'twelvedata' },
      }),
    ),

  symbols: z
    .array(
      z.object({
        symbol: z
          .string()
          .max(32)
          .default('')
          .meta(
            field({
              label: 'Symbol',
              help: 'As Yahoo writes it: AAPL, 7203.T for Tokyo, MC.PA for Paris.',
            }),
          ),
        label: z
          .string()
          .max(40)
          .default('')
          .meta(field({ label: 'Name', help: 'Leave empty to show the symbol.' })),
      }),
    )
    .max(20)
    .default([
      { symbol: 'AAPL', label: '' },
      { symbol: 'MSFT', label: '' },
    ])
    .meta(field({ label: 'Watchlist' })),

  change: z
    .enum(['percent', 'amount'])
    .default('percent')
    .meta(
      field({
        label: 'Change',
        control: 'segmented',
        options: { percent: '%', amount: 'Amount' },
      }),
    ),

  fontSize: z
    .number()
    .min(12)
    .max(64)
    .default(20)
    .meta(
      field({
        label: 'Size',
        control: 'slider',
        step: 1,
        unit: 'px',
        help: 'An upper limit. Rows shrink to fit, and the change is dropped first.',
      }),
    ),
});

export type StocksSettings = z.infer<typeof stocksSettingsSchema>;

const MINUTE = 60 * 1000;

export const stocksDefinition: WidgetDefinition<StocksSettings, StocksData> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.stocks',
  name: 'Stocks',
  description: 'A watchlist with the latest prices.',
  category: 'info',
  icon: 'M4 19h16 M5 15l4-4 3 3 6-7 M15 7h3v3',
  settingsSchema: stocksSettingsSchema,
  defaultSize: { w: 5, h: 3 },
  minSize: { w: 2, h: 1 },
  component: () => import('./StocksView'),
  origins: (s) => (s.source === 'yahoo' ? [YAHOO_ORIGIN] : []),
  dataSource: {
    // The key is part of the identity: a new one deserves a new answer, not the
    // refusal cached for the old one. Hashed before it is stored.
    key: (s) => {
      const symbols = watchlist(s.symbols);
      if (symbols.length === 0) return null;
      if (s.source === 'twelvedata') {
        return s.apiKey.trim()
          ? `twelvedata:${s.apiKey.trim()}:${symbols.join(',')}`
          : null;
      }
      return `yahoo:${symbols.join(',')}`;
    },
    // The network code loads only when there is something to fetch.
    fetch: async (s, signal) => {
      const symbols = watchlist(s.symbols);
      if (s.source === 'twelvedata') {
        const { fetchTwelveData } = await import('./twelve-data');
        return fetchTwelveData(symbols, s.apiKey.trim(), signal);
      }
      const { fetchYahoo } = await import('./yahoo');
      return fetchYahoo(symbols, signal);
    },
    // Ten symbols every ten minutes, over a ten-hour day of open tabs, is 600 of
    // Twelve Data's 800 free credits.
    ttlMs: 10 * MINUTE,
    // Friday's close is still the price on Sunday.
    maxAgeMs: 4 * 24 * 60 * MINUTE,
  },
};
