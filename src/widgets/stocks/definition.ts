import { i18n } from '#i18n';
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
        label: i18n.t('widget.stocks.source.label'),
        control: 'select',
        options: {
          yahoo: i18n.t('widget.stocks.source.option.yahoo'),
          twelvedata: i18n.t('widget.stocks.source.option.twelvedata'),
        },
        help: i18n.t('widget.stocks.source.help'),
      }),
    ),

  apiKey: z
    .string()
    .max(100)
    .default('')
    .meta(
      field({
        label: i18n.t('widget.stocks.apiKey.label'),
        help: i18n.t('widget.stocks.apiKey.help'),
        showIf: { field: 'source', equals: 'twelvedata' },
      }),
    ),

  // Minutes, as strings: an enum gives the panel a select with named choices.
  refresh: z
    .enum(['5', '15', '30', '60'])
    .default('15')
    .meta(
      field({
        label: i18n.t('widget.stocks.refresh.label'),
        options: {
          '5': i18n.t('widget.stocks.refresh.option.m5'),
          '15': i18n.t('widget.stocks.refresh.option.m15'),
          '30': i18n.t('widget.stocks.refresh.option.m30'),
          '60': i18n.t('widget.stocks.refresh.option.m60'),
        },
        help: i18n.t('widget.stocks.refresh.help'),
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
              label: i18n.t('widget.stocks.symbols.row.symbol.label'),
              help: i18n.t('widget.stocks.symbols.row.symbol.help'),
            }),
          ),
        label: z
          .string()
          .max(40)
          .default('')
          .meta(
            field({
              label: i18n.t('widget.stocks.symbols.row.label.label'),
              help: i18n.t('widget.stocks.symbols.row.label.help'),
            }),
          ),
      }),
    )
    .max(20)
    .default([
      { symbol: 'AAPL', label: '' },
      { symbol: 'MSFT', label: '' },
    ])
    .meta(
      field({
        label: i18n.t('widget.stocks.symbols.label'),
        itemLabel: i18n.t('widget.stocks.symbols.itemLabel'),
      }),
    ),

  change: z
    .enum(['percent', 'amount'])
    .default('percent')
    .meta(
      field({
        label: i18n.t('widget.stocks.change.label'),
        control: 'segmented',
        options: { percent: '%', amount: i18n.t('widget.stocks.change.option.amount') },
      }),
    ),

  fontSize: z
    .number()
    .min(12)
    .max(64)
    .default(20)
    .meta(
      field({
        label: i18n.t('widget.stocks.fontSize.label'),
        control: 'slider',
        step: 1,
        unit: 'px',
        help: i18n.t('widget.stocks.fontSize.help'),
      }),
    ),
});

export type StocksSettings = z.infer<typeof stocksSettingsSchema>;

const MINUTE = 60 * 1000;

export const stocksDefinition: WidgetDefinition<StocksSettings, StocksData> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.stocks',
  name: i18n.t('widget.stocks.name'),
  description: i18n.t('widget.stocks.description'),
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
    // The user's choice. Prices only move while markets are open, and Twelve Data
    // charges a credit per symbol per refresh: see the setting's help.
    ttlMs: (s) => Number(s.refresh) * MINUTE,
    // Friday's close is still the price on Sunday.
    maxAgeMs: 4 * 24 * 60 * MINUTE,
  },
};
