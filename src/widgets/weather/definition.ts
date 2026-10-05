import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';
import type { WeatherData } from './api';
import { LocationField } from './location-field';
import { resolveUnits } from './units';

export const weatherLocationSchema = z.object({
  name: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type WeatherLocation = z.infer<typeof weatherLocationSchema>;

export const weatherSettingsSchema = z.object({
  location: weatherLocationSchema
    .nullable()
    .default(null)
    .meta(
      field({
        label: i18n.t('widget.weather.location.label'),
        control: 'custom',
        component: LocationField,
      }),
    ),

  units: z
    .enum(['auto', 'metric', 'imperial'])
    .default('auto')
    .meta(
      field({
        label: i18n.t('widget.weather.units.label'),
        control: 'segmented',
        options: {
          auto: i18n.t('widget.weather.units.option.auto'),
          metric: '°C',
          imperial: '°F',
        },
        help: i18n.t('widget.weather.units.help'),
      }),
    ),

  details: z
    .boolean()
    .default(true)
    .meta(
      field({
        label: i18n.t('widget.weather.details.label'),
        help: i18n.t('widget.weather.details.help'),
      }),
    ),

  forecast: z
    .boolean()
    .default(true)
    .meta(field({ label: i18n.t('widget.weather.forecast.label') })),

  fontSize: z
    .number()
    .min(24)
    .max(160)
    .default(64)
    .meta(
      field({
        label: i18n.t('widget.weather.fontSize.label'),
        control: 'slider',
        step: 2,
        unit: 'px',
        help: i18n.t('widget.weather.fontSize.help'),
      }),
    ),
});

export type WeatherSettings = z.infer<typeof weatherSettingsSchema>;

const MINUTE = 60 * 1000;

export const weatherDefinition: WidgetDefinition<WeatherSettings, WeatherData> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.weather',
  name: i18n.t('widget.weather.name'),
  description: i18n.t('widget.weather.description'),
  category: 'info',
  icon: 'M7 18h10.5a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 7.3 10 4 4 0 0 0 7 18Z',
  settingsSchema: weatherSettingsSchema,
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 2, h: 1 },
  component: () => import('./WeatherView'),
  dataSource: {
    key: (s) =>
      s.location
        ? `${s.location.latitude.toFixed(2)},${s.location.longitude.toFixed(2)}:${resolveUnits(s.units)}`
        : null,
    // The network code loads only when there is something to fetch.
    fetch: async (s, signal) => {
      const { fetchWeather } = await import('./api');
      return fetchWeather(s.location!, resolveUnits(s.units), signal);
    },
    ttlMs: 30 * MINUTE,
    // A forecast older than a day says more about yesterday than today.
    maxAgeMs: 24 * 60 * MINUTE,
  },
  // The forecast request carries the place's coordinates.
  dataCollection: (s) => (s.location ? ['locationInfo'] : []),
};
