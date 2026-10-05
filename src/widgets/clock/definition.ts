import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

/**
 * The widget's settings, its validation and its settings UI, in one declaration.
 * There is no hand-written form anywhere in this folder, and there must never be —
 * the panel is generated from this schema in M3. See docs/03-widget-api.md.
 */
export const clockSettingsSchema = z.object({
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

  showSeconds: z
    .boolean()
    .default(false)
    .meta(field({ label: i18n.t('widget.clock.showSeconds.label') })),

  showMeridiem: z
    .boolean()
    .default(true)
    .meta(
      field({
        label: i18n.t('widget.clock.showMeridiem.label'),
        // Meaningless in 24-hour time, so the generator hides it there rather than
        // offering a switch that does nothing.
        showIf: { field: 'format', equals: '12h' },
      }),
    ),

  fontSize: z
    .number()
    .min(12)
    .max(220)
    .default(72)
    .meta(
      field({
        label: i18n.t('widget.clock.fontSize.label'),
        control: 'slider',
        step: 2,
        unit: 'px',
        help: i18n.t('widget.clock.fontSize.help'),
      }),
    ),

  weight: z
    .enum(['light', 'regular', 'medium'])
    .default('light')
    .meta(
      field({
        label: i18n.t('widget.clock.weight.label'),
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
        label: i18n.t('widget.clock.timezone.label'),
        control: 'timezone',
        help: i18n.t('widget.clock.timezone.help'),
      }),
    ),
});

export type ClockSettings = z.infer<typeof clockSettingsSchema>;

export const clockDefinition: WidgetDefinition<ClockSettings> = {
  // Permanent. It is written into every user's stored config; renaming it is a
  // migration, not a refactor.
  id: 'stillpoint.clock',
  name: i18n.t('widget.clock.name'),
  description: i18n.t('widget.clock.description'),
  category: 'time',
  icon: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z M12 6.5V12l3.5 2',
  settingsSchema: clockSettingsSchema,
  defaultSize: { w: 8, h: 3 },
  minSize: { w: 3, h: 1 },
  component: () => import('./Clock'),
};
