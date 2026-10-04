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
        label: 'Time format',
        control: 'segmented',
        options: { '24h': '23:04', '12h': '11:04 PM' },
      }),
    ),

  showSeconds: z
    .boolean()
    .default(false)
    .meta(field({ label: 'Show seconds' })),

  fontSize: z
    .number()
    .min(12)
    .max(220)
    .default(72)
    .meta(
      field({
        label: 'Size',
        control: 'slider',
        step: 2,
        unit: 'px',
        help: 'An upper limit. The clock shrinks to fit when its cell is too small.',
      }),
    ),

  weight: z
    .enum(['light', 'regular', 'medium'])
    .default('light')
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

export type ClockSettings = z.infer<typeof clockSettingsSchema>;

export const clockDefinition: WidgetDefinition<ClockSettings> = {
  // Permanent. It is written into every user's stored config; renaming it is a
  // migration, not a refactor.
  id: 'stillpoint.clock',
  name: 'Clock',
  description: 'The current time, in any time zone.',
  category: 'time',
  icon: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z M12 6.5V12l3.5 2',
  settingsSchema: clockSettingsSchema,
  defaultSize: { w: 8, h: 3 },
  minSize: { w: 3, h: 1 },
  component: () => import('./Clock'),
};
