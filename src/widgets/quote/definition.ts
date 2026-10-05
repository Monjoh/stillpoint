import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

export const quoteSettingsSchema = z.object({
  refresh: z
    .enum(['tab', 'hourly', 'daily'])
    .default('daily')
    .meta(
      field({
        label: i18n.t('widget.quote.refresh.label'),
        control: 'segmented',
        options: {
          tab: i18n.t('widget.quote.refresh.option.tab'),
          hourly: i18n.t('widget.quote.refresh.option.hourly'),
          daily: i18n.t('widget.quote.refresh.option.daily'),
        },
        help: i18n.t('widget.quote.refresh.help'),
      }),
    ),

  builtIn: z
    .boolean()
    .default(true)
    .meta(
      field({
        label: i18n.t('widget.quote.builtIn.label'),
        help: i18n.t('widget.quote.builtIn.help'),
      }),
    ),

  mine: z
    .array(
      z.object({
        text: z
          .string()
          .max(400)
          .default('')
          .meta(
            field({
              label: i18n.t('widget.quote.mine.row.text.label'),
              control: 'textarea',
            }),
          ),
        author: z
          .string()
          .max(80)
          .default('')
          .meta(field({ label: i18n.t('widget.quote.mine.row.author.label') })),
      }),
    )
    .max(200)
    .default([])
    .meta(
      field({
        label: i18n.t('widget.quote.mine.label'),
        itemLabel: i18n.t('widget.quote.mine.itemLabel'),
      }),
    ),

  showAuthor: z
    .boolean()
    .default(true)
    .meta(field({ label: i18n.t('widget.quote.showAuthor.label') })),

  fontSize: z
    .number()
    .min(12)
    .max(64)
    .default(24)
    .meta(
      field({
        label: i18n.t('widget.quote.fontSize.label'),
        control: 'slider',
        step: 1,
        unit: 'px',
        help: i18n.t('widget.quote.fontSize.help'),
      }),
    ),

  style: z
    .enum(['normal', 'italic'])
    .default('normal')
    .meta(
      field({
        label: i18n.t('widget.quote.style.label'),
        control: 'segmented',
        options: {
          normal: i18n.t('widget.quote.style.option.normal'),
          italic: i18n.t('widget.quote.style.option.italic'),
        },
      }),
    ),
});

export type QuoteSettings = z.infer<typeof quoteSettingsSchema>;

export const quoteDefinition: WidgetDefinition<QuoteSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.quote',
  name: i18n.t('widget.quote.name'),
  description: i18n.t('widget.quote.description'),
  category: 'decoration',
  icon: 'M10 8H6.5A1.5 1.5 0 0 0 5 9.5v3A1.5 1.5 0 0 0 6.5 14H10V8Zm0 6c0 2-1 3.5-3 4 M19 8h-3.5A1.5 1.5 0 0 0 14 9.5v3a1.5 1.5 0 0 0 1.5 1.5H19V8Zm0 6c0 2-1 3.5-3 4',
  settingsSchema: quoteSettingsSchema,
  defaultSize: { w: 10, h: 2 },
  minSize: { w: 4, h: 1 },
  component: () => import('./QuoteView'),
};
