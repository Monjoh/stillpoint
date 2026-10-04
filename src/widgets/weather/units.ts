export type Units = 'metric' | 'imperial';

/** The three countries that still measure weather in °F. */
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

/** "Auto" from the browser's language: en-US gets °F and mph, everyone else °C. */
export function resolveUnits(
  units: Units | 'auto',
  language: string = typeof navigator === 'undefined' ? 'en' : navigator.language,
): Units {
  if (units !== 'auto') return units;
  try {
    const region = new Intl.Locale(language).maximize().region;
    return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}
