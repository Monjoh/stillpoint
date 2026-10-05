import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

export const calendarSettingsSchema = z.object({
  weekStart: z
    .enum(['locale', 'monday', 'sunday'])
    .default('locale')
    .meta(
      field({
        label: i18n.t('widget.calendar.weekStart.label'),
        control: 'segmented',
        options: {
          locale: i18n.t('widget.calendar.weekStart.option.locale'),
          monday: i18n.t('widget.calendar.weekStart.option.monday'),
          sunday: i18n.t('widget.calendar.weekStart.option.sunday'),
        },
        help: i18n.t('widget.calendar.weekStart.help'),
      }),
    ),

  showWeekNumbers: z
    .boolean()
    .default(false)
    .meta(
      field({
        label: i18n.t('widget.calendar.showWeekNumbers.label'),
        help: i18n.t('widget.calendar.showWeekNumbers.help'),
      }),
    ),

  showOtherMonths: z
    .boolean()
    .default(true)
    .meta(field({ label: i18n.t('widget.calendar.showOtherMonths.label') })),

  fontSize: z
    .number()
    .min(10)
    .max(72)
    .default(28)
    .meta(
      field({
        label: i18n.t('widget.calendar.fontSize.label'),
        control: 'slider',
        step: 2,
        unit: 'px',
        help: i18n.t('widget.calendar.fontSize.help'),
      }),
    ),
});

export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;

export const calendarDefinition: WidgetDefinition<CalendarSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.calendar',
  name: i18n.t('widget.calendar.name'),
  description: i18n.t('widget.calendar.description'),
  category: 'time',
  icon: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z M8 3v4 M16 3v4 M8 11h.01 M12 11h.01 M16 11h.01 M8 15h.01 M12 15h.01 M16 15h.01',
  settingsSchema: calendarSettingsSchema,
  defaultSize: { w: 5, h: 4 },
  minSize: { w: 3, h: 3 },
  component: () => import('./CalendarView'),
};
