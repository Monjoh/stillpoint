import { describe, expect, it } from 'vitest';
import { describeWeather } from './codes';
import { weatherDefinition, weatherSettingsSchema } from './definition';
import { resolveUnits } from './units';

describe('resolveUnits', () => {
  it('follows the browser’s region when set to auto', () => {
    expect(resolveUnits('auto', 'en-US')).toBe('imperial');
    expect(resolveUnits('auto', 'en-GB')).toBe('metric');
    expect(resolveUnits('auto', 'fr')).toBe('metric');
  });

  it('keeps an explicit choice', () => {
    expect(resolveUnits('metric', 'en-US')).toBe('metric');
    expect(resolveUnits('imperial', 'fr-FR')).toBe('imperial');
  });

  it('falls back to metric for a language tag Intl rejects', () => {
    expect(resolveUnits('auto', '!!')).toBe('metric');
  });
});

describe('describeWeather', () => {
  it('words and draws every code', () => {
    expect(describeWeather(0)).toEqual({ label: 'Clear', icon: 'clear' });
    expect(describeWeather(95)).toEqual({ label: 'Thunderstorm', icon: 'storm' });
  });

  it('never leaves an unknown code blank', () => {
    expect(describeWeather(42)).toEqual({ label: 'Weather', icon: 'cloudy' });
  });
});

describe('the data source', () => {
  const key = weatherDefinition.dataSource!.key;

  it('has nothing to fetch until a place is chosen', () => {
    expect(key(weatherSettingsSchema.parse({}))).toBeNull();
  });

  it('is keyed by place and units, so a change refetches', () => {
    const at = (units: 'metric' | 'imperial') =>
      key(
        weatherSettingsSchema.parse({
          location: { name: 'Paris', latitude: 48.8534, longitude: 2.3488 },
          units,
        }),
      );
    expect(at('metric')).toBe('48.85,2.35:metric');
    expect(at('imperial')).toBe('48.85,2.35:imperial');
  });
});

describe('weatherSettingsSchema', () => {
  it('parses an empty object, which is what a newly added widget stores', () => {
    expect(weatherSettingsSchema.parse({})).toEqual({
      location: null,
      units: 'auto',
      details: true,
      forecast: true,
      fontSize: 64,
    });
  });
});
