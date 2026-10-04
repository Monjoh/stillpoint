import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

export const quoteSettingsSchema = z.object({
  refresh: z
    .enum(['tab', 'hourly', 'daily'])
    .default('daily')
    .meta(
      field({
        label: 'New quote',
        control: 'segmented',
        options: { tab: 'Every tab', hourly: 'Hourly', daily: 'Daily' },
        help: 'A quote never changes while you are reading it. The next tab shows the new one.',
      }),
    ),

  builtIn: z
    .boolean()
    .default(true)
    .meta(
      field({
        label: 'Include built-in quotes',
        help: 'About sixty, all public domain. Turn off to show only your own.',
      }),
    ),

  mine: z
    .array(
      z.object({
        text: z
          .string()
          .max(400)
          .default('')
          .meta(field({ label: 'Quote', control: 'textarea' })),
        author: z
          .string()
          .max(80)
          .default('')
          .meta(field({ label: 'Author' })),
      }),
    )
    .max(200)
    .default([])
    .meta(field({ label: 'Your quotes' })),

  showAuthor: z
    .boolean()
    .default(true)
    .meta(field({ label: 'Show author' })),

  fontSize: z
    .number()
    .min(12)
    .max(64)
    .default(24)
    .meta(
      field({
        label: 'Size',
        control: 'slider',
        step: 1,
        unit: 'px',
        help: 'An upper limit. A long quote, or a small cell, gets smaller text.',
      }),
    ),

  style: z
    .enum(['normal', 'italic'])
    .default('normal')
    .meta(
      field({
        label: 'Style',
        control: 'segmented',
        options: { normal: 'Upright', italic: 'Italic' },
      }),
    ),
});

export type QuoteSettings = z.infer<typeof quoteSettingsSchema>;

export const quoteDefinition: WidgetDefinition<QuoteSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.quote',
  name: 'Quote',
  description: 'A quote to start on, from a built-in set or your own.',
  category: 'decoration',
  icon: 'M10 8H6.5A1.5 1.5 0 0 0 5 9.5v3A1.5 1.5 0 0 0 6.5 14H10V8Zm0 6c0 2-1 3.5-3 4 M19 8h-3.5A1.5 1.5 0 0 0 14 9.5v3a1.5 1.5 0 0 0 1.5 1.5H19V8Zm0 6c0 2-1 3.5-3 4',
  settingsSchema: quoteSettingsSchema,
  defaultSize: { w: 10, h: 2 },
  minSize: { w: 4, h: 1 },
  component: () => import('./QuoteView'),
};
