import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';
import { fetchedSymbols, minRefreshMinutes, type StocksData } from './quotes';

export const stocksSettingsSchema = z.object({
  // Prices come from Twelve Data only. Yahoo Finance was a second source (S20–S26),
  // removed: it publishes no API and its terms forbid this use. A stored `source`
  // field is stripped on parse.
  apiKey: z
    .string()
    .max(100)
    .default('')
    .meta(
      field({
        label: i18n.t('widget.stocks.apiKey.label'),
        help: i18n.t('widget.stocks.apiKey.help'),
      }),
    ),

  // Minutes, as strings: an enum gives the panel a select with named choices. Five
  // minutes was offered at first (S25) and dropped: a stored '5' is pruned to the
  // default by resolveSettings.
  refresh: z
    .enum(['15', '30', '60'])
    .default('15')
    .meta(
      field({
        label: i18n.t('widget.stocks.refresh.label'),
        options: {
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

  showUpdated: z
    .boolean()
    .default(false)
    .meta(field({ label: i18n.t('widget.common.showUpdated') })),

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
  dataSource: {
    // The key is part of the identity: a new one deserves a new answer, not the
    // refusal cached for the old one. Hashed before it is stored.
    key: (s) => {
      const symbols = fetchedSymbols(s.symbols);
      if (symbols.length === 0 || !s.apiKey.trim()) return null;
      return `twelvedata:${s.apiKey.trim()}:${symbols.join(',')}`;
    },
    // The network code loads only when there is something to fetch.
    fetch: async (s, signal) => {
      const { fetchTwelveData } = await import('./twelve-data');
      return fetchTwelveData(fetchedSymbols(s.symbols), s.apiKey.trim(), signal);
    },
    // The user's choice, but never faster than the watchlist can afford: see
    // `minRefreshMinutes`. The setting's help says so.
    ttlMs: (s) =>
      Math.max(Number(s.refresh), minRefreshMinutes(fetchedSymbols(s.symbols).length)) *
      MINUTE,
    // Friday's close is still the price on Sunday.
    maxAgeMs: 4 * 24 * 60 * MINUTE,
  },
};
