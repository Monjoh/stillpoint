import { describe, expect, it, vi } from 'vitest';
import { forecastBody, jsonResponse } from './__fixtures__/open-meteo';
import { fetchWeather } from './api';

const paris = { name: 'Paris, France', latitude: 48.8534, longitude: 2.3488 };

describe('fetchWeather', () => {
  it('asks for rounded coordinates and today plus three days', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(forecastBody));
    await fetchWeather(paris, 'metric', undefined, fetcher);
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('48.85');
    expect(url.searchParams.get('longitude')).toBe('2.35');
    expect(url.searchParams.get('forecast_days')).toBe('4');
    expect(url.searchParams.has('temperature_unit')).toBe(false);
  });

  it('asks for °F and mph in imperial units', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(forecastBody));
    await fetchWeather(paris, 'imperial', undefined, fetcher);
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit');
    expect(url.searchParams.get('wind_speed_unit')).toBe('mph');
  });

  it('reads the current conditions and the days after today', async () => {
    const data = await fetchWeather(paris, 'metric', undefined, async () =>
      jsonResponse(forecastBody),
    );
    expect(data).toEqual({
      units: 'metric',
      current: {
        temperature: 23.5,
        feelsLike: 23.3,
        humidity: 51,
        windSpeed: 7.4,
        code: 0,
        isDay: false,
      },
      days: [
        { date: '2026-10-05', code: 3, max: 24.3, min: 13.9 },
        { date: '2026-10-06', code: 3, max: 23.9, min: 13.4 },
        { date: '2026-10-07', code: 80, max: 16.4, min: 12.2 },
      ],
    });
  });

  it('says so when the service cannot be reached', async () => {
    await expect(
      fetchWeather(paris, 'metric', undefined, async () => {
        throw new TypeError('NetworkError');
      }),
    ).rejects.toThrow('The weather service could not be reached.');
  });

  it('says so when the service answers with an error', async () => {
    await expect(
      fetchWeather(paris, 'metric', undefined, async () =>
        jsonResponse({ error: true, reason: 'x' }, 400),
      ),
    ).rejects.toThrow('not answering');
  });

  it('refuses an answer it cannot read', async () => {
    await expect(
      fetchWeather(paris, 'metric', undefined, async () =>
        jsonResponse({ current: { temperature_2m: 'warm' }, daily: {} }),
      ),
    ).rejects.toThrow('unreadable');
  });
});
