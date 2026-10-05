import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

export const worldClocksSettingsSchema = z.object({
  clocks: z
    .array(
      z.object({
        timezone: z
          .string()
          .nullable()
          .default(null)
          .meta(
            field({
              label: i18n.t('widget.worldclocks.clocks.row.timezone.label'),
              control: 'timezone',
              help: i18n.t('widget.worldclocks.clocks.row.timezone.help'),
            }),
          ),
        label: z
          .string()
          .max(40)
          .default('')
          .meta(
            field({
              label: i18n.t('widget.worldclocks.clocks.row.label.label'),
              help: i18n.t('widget.worldclocks.clocks.row.label.help'),
            }),
          ),
      }),
    )
    .max(12)
    // Useful untouched: three cities most people have a reason to watch.
    .default([
      { timezone: 'Europe/London', label: '' },
      { timezone: 'America/New_York', label: '' },
      { timezone: 'Asia/Tokyo', label: '' },
    ])
    .meta(
      field({
        label: i18n.t('widget.worldclocks.clocks.label'),
        itemLabel: i18n.t('widget.worldclocks.clocks.itemLabel'),
      }),
    ),

  format: z
    .enum(['24h', '12h'])
    .default('24h')
    .meta(
      field({
        label: i18n.t('widget.clock.format.label'),
        control: 'segmented',
        options: { '24h': '23:04', '12h': i18n.t('widget.clock.format.option.12h') },
      }),
    ),

  showDifference: z
    .boolean()
    .default(true)
    .meta(
      field({
        label: i18n.t('widget.worldclocks.showDifference.label'),
        help: i18n.t('widget.worldclocks.showDifference.help'),
      }),
    ),

  fontSize: z
    .number()
    .min(12)
    .max(120)
    .default(40)
    .meta(
      field({
        label: i18n.t('widget.worldclocks.fontSize.label'),
        control: 'slider',
        step: 2,
        unit: 'px',
        help: i18n.t('widget.worldclocks.fontSize.help'),
      }),
    ),
});

export type WorldClocksSettings = z.infer<typeof worldClocksSettingsSchema>;

export const worldClocksDefinition: WidgetDefinition<WorldClocksSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.worldclocks',
  name: i18n.t('widget.worldclocks.name'),
  description: i18n.t('widget.worldclocks.description'),
  category: 'time',
  icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3Z',
  settingsSchema: worldClocksSettingsSchema,
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 1 },
  component: () => import('./WorldClocksView'),
};
