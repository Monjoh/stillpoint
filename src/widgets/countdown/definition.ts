import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

export const countdownSettingsSchema = z.object({
  title: z
    .string()
    .max(60)
    .default('')
    .meta(
      field({
        label: i18n.t('widget.countdown.title.label'),
        help: i18n.t('widget.countdown.title.help'),
      }),
    ),

  // As the browser's date and time inputs write them. An invalid value is pruned to
  // the default on read, which the view shows as "pick a date".
  date: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .default('')
    .meta(field({ label: i18n.t('widget.countdown.date.label'), control: 'date' })),

  time: z
    .string()
    .regex(/^(\d{2}:\d{2})?$/)
    .default('')
    .meta(
      field({
        label: i18n.t('widget.countdown.time.label'),
        control: 'time',
        help: i18n.t('widget.countdown.time.help'),
      }),
    ),

  display: z
    .enum(['days', 'full'])
    .default('days')
    .meta(
      field({
        label: i18n.t('widget.countdown.display.label'),
        control: 'segmented',
        options: {
          days: i18n.t('widget.countdown.display.option.days'),
          full: i18n.t('widget.countdown.display.option.full'),
        },
      }),
    ),

  showSeconds: z
    .boolean()
    .default(false)
    .meta(
      field({
        label: i18n.t('widget.countdown.showSeconds.label'),
        showIf: { field: 'display', equals: 'full' },
      }),
    ),

  fontSize: z
    .number()
    .min(12)
    .max(160)
    .default(56)
    .meta(
      field({
        label: i18n.t('widget.countdown.fontSize.label'),
        control: 'slider',
        step: 2,
        unit: 'px',
        help: i18n.t('widget.countdown.fontSize.help'),
      }),
    ),
});

export type CountdownSettings = z.infer<typeof countdownSettingsSchema>;

export const countdownDefinition: WidgetDefinition<CountdownSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.countdown',
  name: i18n.t('widget.countdown.name'),
  description: i18n.t('widget.countdown.description'),
  category: 'time',
  icon: 'M10 2h4 M12 14l3-3 M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  settingsSchema: countdownSettingsSchema,
  defaultSize: { w: 6, h: 2 },
  minSize: { w: 3, h: 1 },
  component: () => import('./CountdownView'),
};
