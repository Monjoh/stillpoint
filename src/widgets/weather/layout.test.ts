import { describe, expect, it } from 'vitest';
import { layoutWeather } from './layout';

const base = { maxPx: 64, temperature: '23°', details: true, forecastDays: 3 };

describe('layoutWeather', () => {
  it('shows everything at the size asked for when there is room', () => {
    expect(layoutWeather({ ...base, width: 400, height: 300 })).toMatchObject({
      tempPx: 64,
      showSummary: true,
      showDetails: true,
      showForecast: true,
    });
  });

  it('drops the next days first, then the details, then the summary', () => {
    const short = layoutWeather({ ...base, width: 400, height: 120 });
    expect(short).toMatchObject({ showForecast: false, showSummary: true });
    const shorter = layoutWeather({ ...base, width: 400, height: 70 });
    expect(shorter).toMatchObject({ showForecast: false, showDetails: false });
    const sliver = layoutWeather({ ...base, width: 400, height: 30 });
    expect(sliver).toMatchObject({ showSummary: false, showDetails: false });
  });

  it('drops the update time before anything else', () => {
    const roomy = layoutWeather({ ...base, width: 400, height: 300, updated: true });
    expect(roomy).toMatchObject({ showUpdated: true, showForecast: true });
    const tight = layoutWeather({ ...base, width: 400, height: 190, updated: true });
    expect(tight.showUpdated).toBe(false);
    expect(tight.showForecast).toBe(
      layoutWeather({ ...base, width: 400, height: 190 }).showForecast,
    );
  });

  it('keeps the temperature, smaller, in a cell too small for anything else', () => {
    const tiny = layoutWeather({ ...base, width: 60, height: 24 });
    expect(tiny.tempPx).toBeGreaterThanOrEqual(12);
    expect(tiny.tempPx).toBeLessThan(24);
  });

  it('leaves the next days out of a cell too narrow for them', () => {
    expect(layoutWeather({ ...base, width: 150, height: 600 }).showForecast).toBe(
      false,
    );
  });

  it('never exceeds the size asked for', () => {
    expect(layoutWeather({ ...base, width: 3000, height: 3000 }).tempPx).toBe(64);
  });
});
