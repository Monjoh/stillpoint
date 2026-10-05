import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResourceState } from '@/core/registry/types';
import type { WeatherData } from './api';
import { weatherSettingsSchema, type WeatherSettings } from './definition';
import WeatherView from './WeatherView';

const size = { width: 400, height: 300 };
const paris = { name: 'Paris, France', latitude: 48.85, longitude: 2.35 };
const settings = (overrides: Partial<WeatherSettings> = {}) =>
  weatherSettingsSchema.parse({ location: paris, ...overrides });

const weather: WeatherData = {
  units: 'metric',
  current: {
    temperature: 23.5,
    feelsLike: 22.6,
    humidity: 51,
    windSpeed: 7.4,
    code: 0,
    isDay: true,
  },
  days: [
    { date: '2026-10-05', code: 3, max: 24.3, min: 13.9 },
    { date: '2026-10-06', code: 61, max: 23.9, min: 13.4 },
    { date: '2026-10-07', code: 80, max: 16.4, min: 12.2 },
  ],
};
const ready = (data = weather): ResourceState<WeatherData> => ({
  status: 'ready',
  data,
  fetchedAt: Date.now(),
  stale: false,
});

describe('WeatherView', () => {
  it('shows the temperature, the condition, the place and the next days', () => {
    const { container } = render(
      <WeatherView
        settings={settings()}
        size={size}
        isEditing={false}
        data={ready()}
      />,
    );
    expect(container.textContent).toContain('24°');
    expect(screen.getByText('Clear · Paris')).toBeTruthy();
    expect(screen.getByText(/Feels 23° · Wind 7 km\/h · Humidity 51%/)).toBeTruthy();
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('uses mph for imperial data', () => {
    render(
      <WeatherView
        settings={settings()}
        size={size}
        isEditing={false}
        data={ready({ ...weather, units: 'imperial' })}
      />,
    );
    expect(screen.getByText(/Wind 7 mph/)).toBeTruthy();
  });

  it('leaves out what the settings turn off', () => {
    const { container } = render(
      <WeatherView
        settings={settings({ details: false, forecast: false })}
        size={size}
        isEditing={false}
        data={ready()}
      />,
    );
    expect(screen.queryByText(/Feels/)).toBeNull();
    expect(container.querySelector('li')).toBeNull();
  });

  it('asks for a place before there is one', () => {
    render(
      <WeatherView
        settings={weatherSettingsSchema.parse({})}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByText(/Choose a place/)).toBeTruthy();
  });

  it('keeps old weather up when a refresh fails, and says how old', () => {
    const { container } = render(
      <WeatherView
        settings={settings()}
        size={size}
        isEditing={false}
        data={{
          status: 'error',
          error: 'The weather service could not be reached.',
          data: weather,
          fetchedAt: Date.now() - 3 * 60 * 60 * 1000,
        }}
      />,
    );
    expect(container.textContent).toContain('24°');
    expect(screen.getByText('Not updated for 3 hr')).toBeTruthy();
  });

  it('says what is wrong when there is nothing to show', () => {
    render(
      <WeatherView
        settings={settings()}
        size={size}
        isEditing={false}
        data={{ status: 'error', error: 'The weather service could not be reached.' }}
      />,
    );
    expect(
      screen.getByText(
        /Weather unavailable\. The weather service could not be reached\./,
      ),
    ).toBeTruthy();
  });

  it('says when the weather was fetched, if asked to', () => {
    render(
      <WeatherView
        settings={settings({ showUpdated: true })}
        size={size}
        isEditing={false}
        data={ready()}
      />,
    );
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });
});
