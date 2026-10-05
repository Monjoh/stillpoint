import { i18n } from '#i18n';
import { RateLimitError } from '@/core/data/errors';
import type { WeatherLocation } from './definition';
import type { Units } from './units';

/**
 * The forecast, from Open-Meteo: no key, CORS-open, so no permission. Imported lazily
 * by the data source; never on the critical path. Sends the place's coordinates,
 * rounded to about a kilometre, and nothing else.
 */

export interface WeatherData {
  units: Units;
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    code: number;
    isDay: boolean;
  };
  /** The days after today, in the place's own calendar. */
  days: { date: string; code: number; max: number; min: number }[];
}

type Fetch = typeof fetch;

export async function fetchWeather(
  location: WeatherLocation,
  units: Units,
  signal?: AbortSignal,
  fetcher: Fetch = fetch,
): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', location.latitude.toFixed(2));
  url.searchParams.set('longitude', location.longitude.toFixed(2));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m',
  );
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '4');
  if (units === 'imperial') {
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('wind_speed_unit', 'mph');
  }

  let response: Response;
  try {
    response = await fetcher(url.href, { signal, credentials: 'omit' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(i18n.t('widget.weather.error.unreachable'), { cause: error });
  }
  if (response.status === 429) {
    throw new RateLimitError(i18n.t('widget.weather.error.down'));
  }
  if (!response.ok) throw new Error(i18n.t('widget.weather.error.down'));

  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const data = body ? parse(body, units) : null;
  if (!data) throw new Error(i18n.t('widget.weather.error.unreadable'));
  return data;
}

function parse(body: Record<string, unknown>, units: Units): WeatherData | null {
  const c = body.current as Record<string, unknown> | undefined;
  const d = body.daily as Record<string, unknown> | undefined;
  if (!c || !d) return null;

  const current = {
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    code: c.weather_code,
  };
  if (!Object.values(current).every(isNumber)) return null;

  const {
    time,
    weather_code: codes,
    temperature_2m_max: max,
    temperature_2m_min: min,
  } = d;
  if (![time, codes, max, min].every(Array.isArray)) return null;
  const days: WeatherData['days'] = [];
  // Index 0 is today, which "current" already describes.
  for (let i = 1; i < (time as unknown[]).length; i++) {
    const day = {
      date: (time as unknown[])[i],
      code: (codes as unknown[])[i],
      max: (max as unknown[])[i],
      min: (min as unknown[])[i],
    };
    if (typeof day.date !== 'string' || ![day.code, day.max, day.min].every(isNumber))
      continue;
    days.push(day as WeatherData['days'][number]);
  }

  return {
    units,
    current: {
      ...(current as Omit<WeatherData['current'], 'isDay'>),
      isDay: c.is_day !== 0,
    },
    days,
  };
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
