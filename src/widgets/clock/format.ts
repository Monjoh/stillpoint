import type { ClockSettings } from './definition';

/**
 * Pure formatting, so the awkward parts are testable without a DOM or a fake clock.
 *
 * `hourCycle` rather than `hour12`: with `hour12: false` several locales render
 * midnight as "24:00". `h23` is the one that means what a user picking "24h" means.
 *
 * An unknown time zone is survivable. A user who typed a zone that `Intl` rejects, or
 * who imported a profile built on a browser with a larger zone database, should see
 * their local time — not a widget that throws on every tick.
 */
export function formatClock(
  date: Date,
  settings: Pick<ClockSettings, 'format' | 'showSeconds' | 'showMeridiem' | 'timezone'>,
  locale?: string,
): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: settings.format === '12h' ? 'h12' : 'h23',
  };
  if (settings.showSeconds) options.second = '2-digit';

  const format = (extra?: Intl.DateTimeFormatOptions) => {
    const formatter = new Intl.DateTimeFormat(locale, { ...options, ...extra });
    // The suffix is dropped by rebuilding from the parts rather than by stripping it
    // from the string: it is not always a trailing " PM", and in several locales it
    // comes first.
    if (settings.format === '12h' && settings.showMeridiem === false) {
      return formatter
        .formatToParts(date)
        .filter((part) => part.type !== 'dayPeriod')
        .map((part) => part.value)
        .join('')
        .trim();
    }
    return formatter.format(date);
  };

  if (settings.timezone) {
    try {
      return format({ timeZone: settings.timezone });
    } catch {
      // Fall through to local time.
    }
  }

  return format();
}

/** How often the display has to change, given the settings. */
export function tickIntervalMs(settings: Pick<ClockSettings, 'showSeconds'>): number {
  return settings.showSeconds ? 1_000 : 60_000;
}
