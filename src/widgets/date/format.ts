import type { DateSettings } from './definition';

const STYLES: Record<DateSettings['style'], Intl.DateTimeFormatOptions> = {
  full: { weekday: 'long', day: 'numeric', month: 'long' },
  short: { weekday: 'short', day: 'numeric', month: 'short' },
  numeric: { day: '2-digit', month: '2-digit' },
};

/**
 * A formatter in the given time zone. One `Intl` rejects falls back to local time, as
 * the clock's does: an imported profile must not make the widget throw.
 */
function formatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
  timezone: string | null,
): Intl.DateTimeFormat {
  if (timezone) {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone });
    } catch {
      // Fall through to local time.
    }
  }
  return new Intl.DateTimeFormat(locale, options);
}

export function formatDate(
  date: Date,
  settings: Pick<DateSettings, 'style' | 'showYear' | 'timezone'>,
  locale?: string,
): string {
  const options: Intl.DateTimeFormatOptions = { ...STYLES[settings.style] };
  if (settings.showYear) options.year = 'numeric';
  return formatter(locale, options, settings.timezone).format(date);
}

/**
 * `YYYY-MM-DD` for `<time dateTime>`, in the same time zone as the text. Not
 * `toISOString()`, which is the UTC date and a day out for half the evening.
 */
export function isoDate(date: Date, timezone: string | null): string {
  const parts = formatter(
    'en-CA',
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    timezone,
  ).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
