/** A forecast shaped exactly like Open-Meteo's (captured 2026-10-04 for Paris). */
export const forecastBody = {
  latitude: 48.84,
  longitude: 2.36,
  timezone: 'Europe/Paris',
  current: {
    time: '2026-10-04T19:30',
    interval: 900,
    temperature_2m: 23.5,
    apparent_temperature: 23.3,
    relative_humidity_2m: 51,
    weather_code: 0,
    is_day: 0,
    wind_speed_10m: 7.4,
  },
  daily: {
    time: ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'],
    weather_code: [3, 3, 3, 80],
    temperature_2m_max: [24.9, 24.3, 23.9, 16.4],
    temperature_2m_min: [13.9, 13.9, 13.4, 12.2],
  },
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
