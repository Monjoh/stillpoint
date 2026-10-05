import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

export const dateSettingsSchema = z.object({
  style: z
    .enum(['full', 'short', 'numeric'])
    .default('full')
    .meta(
      field({
        label: i18n.t('widget.date.style.label'),
        control: 'segmented',
        // Names, not samples: the order of day and month is the browser's locale.
        options: {
          full: i18n.t('widget.date.style.option.full'),
          short: i18n.t('widget.date.style.option.short'),
          numeric: i18n.t('widget.date.style.option.numeric'),
        },
      }),
    ),

  showYear: z
    .boolean()
    .default(false)
    .meta(field({ label: i18n.t('widget.date.showYear.label') })),

  fontSize: z
    .number()
    .min(12)
    .max(160)
    .default(28)
    .meta(
      field({
        label: i18n.t('widget.date.fontSize.label'),
        control: 'slider',
        step: 2,
        unit: 'px',
        help: i18n.t('widget.date.fontSize.help'),
      }),
    ),

  weight: z
    .enum(['light', 'regular', 'medium'])
    .default('regular')
    .meta(
      field({
        label: i18n.t('widget.date.weight.label'),
        control: 'segmented',
        options: {
          light: i18n.t('fontWeight.light'),
          regular: i18n.t('fontWeight.regular'),
          medium: i18n.t('fontWeight.medium'),
        },
      }),
    ),

  timezone: z
    .string()
    .nullable()
    .default(null)
    .meta(
      field({
        label: i18n.t('widget.date.timezone.label'),
        control: 'timezone',
        help: i18n.t('widget.date.timezone.help'),
      }),
    ),
});

export type DateSettings = z.infer<typeof dateSettingsSchema>;

export const dateDefinition: WidgetDefinition<DateSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.date',
  name: i18n.t('widget.date.name'),
  description: i18n.t('widget.date.description'),
  category: 'time',
  icon: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z M4 10h16 M8 3v4 M16 3v4',
  settingsSchema: dateSettingsSchema,
  defaultSize: { w: 8, h: 1 },
  minSize: { w: 3, h: 1 },
  component: () => import('./DateView'),
};
