import { i18n } from '#i18n';
/**
 * WMO weather interpretation codes, as Open-Meteo reports them, to words and an icon.
 * https://open-meteo.com/en/docs (the "WMO Weather interpretation codes" table).
 */

type Condition =
  | 'clear'
  | 'mainlyClear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'freezingFog'
  | 'lightDrizzle'
  | 'drizzle'
  | 'heavyDrizzle'
  | 'freezingDrizzle'
  | 'lightRain'
  | 'rain'
  | 'heavyRain'
  | 'freezingRain'
  | 'lightSnow'
  | 'snow'
  | 'heavySnow'
  | 'snowGrains'
  | 'lightShowers'
  | 'showers'
  | 'heavyShowers'
  | 'snowShowers'
  | 'heavySnowShowers'
  | 'thunderstorm'
  | 'thunderstormWithHail';

export type WeatherIcon =
  'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

/** Code → condition (a key under `widget.weather.condition` in en.yml) and icon. */
const CODES: Record<number, [Condition, WeatherIcon]> = {
  0: ['clear', 'clear'],
  1: ['mainlyClear', 'partly'],
  2: ['partlyCloudy', 'partly'],
  3: ['overcast', 'cloudy'],
  45: ['fog', 'fog'],
  48: ['freezingFog', 'fog'],
  51: ['lightDrizzle', 'drizzle'],
  53: ['drizzle', 'drizzle'],
  55: ['heavyDrizzle', 'drizzle'],
  56: ['freezingDrizzle', 'drizzle'],
  57: ['freezingDrizzle', 'drizzle'],
  61: ['lightRain', 'rain'],
  63: ['rain', 'rain'],
  65: ['heavyRain', 'rain'],
  66: ['freezingRain', 'rain'],
  67: ['freezingRain', 'rain'],
  71: ['lightSnow', 'snow'],
  73: ['snow', 'snow'],
  75: ['heavySnow', 'snow'],
  77: ['snowGrains', 'snow'],
  80: ['lightShowers', 'rain'],
  81: ['showers', 'rain'],
  82: ['heavyShowers', 'rain'],
  85: ['snowShowers', 'snow'],
  86: ['heavySnowShowers', 'snow'],
  95: ['thunderstorm', 'storm'],
  96: ['thunderstormWithHail', 'storm'],
  99: ['thunderstormWithHail', 'storm'],
};

/** A code the table does not know still gets words and an icon, never a blank. */
export function describeWeather(code: number): { label: string; icon: WeatherIcon } {
  const known = CODES[code];
  return known
    ? { label: i18n.t(`widget.weather.condition.${known[0]}`), icon: known[1] }
    : { label: i18n.t('widget.weather.condition.unknown'), icon: 'cloudy' };
}
