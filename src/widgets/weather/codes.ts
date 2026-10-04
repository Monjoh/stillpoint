/**
 * WMO weather interpretation codes, as Open-Meteo reports them, to words and an icon.
 * https://open-meteo.com/en/docs (the "WMO Weather interpretation codes" table).
 */

export type WeatherIcon =
  'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

const CODES: Record<number, [string, WeatherIcon]> = {
  0: ['Clear', 'clear'],
  1: ['Mainly clear', 'partly'],
  2: ['Partly cloudy', 'partly'],
  3: ['Overcast', 'cloudy'],
  45: ['Fog', 'fog'],
  48: ['Freezing fog', 'fog'],
  51: ['Light drizzle', 'drizzle'],
  53: ['Drizzle', 'drizzle'],
  55: ['Heavy drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'drizzle'],
  57: ['Freezing drizzle', 'drizzle'],
  61: ['Light rain', 'rain'],
  63: ['Rain', 'rain'],
  65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'],
  67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'],
  73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'],
  80: ['Light showers', 'rain'],
  81: ['Showers', 'rain'],
  82: ['Heavy showers', 'rain'],
  85: ['Snow showers', 'snow'],
  86: ['Heavy snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'],
  96: ['Thunderstorm with hail', 'storm'],
  99: ['Thunderstorm with hail', 'storm'],
};

/** A code the table does not know still gets words and an icon, never a blank. */
export function describeWeather(code: number): { label: string; icon: WeatherIcon } {
  const known = CODES[code];
  return known
    ? { label: known[0], icon: known[1] }
    : { label: 'Weather', icon: 'cloudy' };
}
