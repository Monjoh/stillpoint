import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

export const dateSettingsSchema = z.object({
  style: z
    .enum(['full', 'short', 'numeric'])
    .default('full')
    .meta(
      field({
        label: 'Format',
        control: 'segmented',
        // Names, not samples: the order of day and month is the browser's locale.
        options: { full: 'Full', short: 'Short', numeric: 'Numbers' },
      }),
    ),

  showYear: z
    .boolean()
    .default(false)
    .meta(field({ label: 'Show year' })),

  fontSize: z
    .number()
    .min(12)
    .max(160)
    .default(28)
    .meta(
      field({
        label: 'Size',
        control: 'slider',
        step: 2,
        unit: 'px',
        help: 'An upper limit. The date shrinks to fit when its cell is too small.',
      }),
    ),

  weight: z
    .enum(['light', 'regular', 'medium'])
    .default('regular')
    .meta(field({ label: 'Weight', control: 'segmented' })),

  timezone: z
    .string()
    .nullable()
    .default(null)
    .meta(
      field({
        label: 'Time zone',
        control: 'timezone',
        help: 'Leave empty to use this device’s time zone.',
      }),
    ),
});

export type DateSettings = z.infer<typeof dateSettingsSchema>;

export const dateDefinition: WidgetDefinition<DateSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.date',
  name: 'Date',
  description: 'Today’s date, in any time zone.',
  category: 'time',
  icon: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z M4 10h16 M8 3v4 M16 3v4',
  settingsSchema: dateSettingsSchema,
  defaultSize: { w: 8, h: 1 },
  minSize: { w: 3, h: 1 },
  component: () => import('./DateView'),
};
