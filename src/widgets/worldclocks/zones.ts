/**
 * Time zone arithmetic for World clocks, through `Intl` only: no zone database ships
 * with the extension, the browser's is used.
 *
 * Every function survives a zone the browser doesn't know (an imported profile, a
 * typo): the row then shows the device's own time and no difference, the same
 * fallback as `formatClock`.
 */

/** "America/Argentina/Buenos_Aires" → "Buenos Aires". The user can name it instead. */
export function cityName(zone: string): string {
  const last = zone.split('/').pop() ?? zone;
  return last.replace(/_/g, ' ');
}

/** True when the browser can format times in this zone. */
export function isKnownZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day and the minutes since midnight UTC that `zone` is showing at `date`. */
function wallClock(date: Date, zone?: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const day = Date.UTC(get('year'), get('month') - 1, get('day')) / 86_400_000;
  return { day, minutes: get('hour') * 60 + get('minute') };
}

export interface Difference {
  /** -1 when the zone is on the previous calendar day, 1 on the next, else 0. */
  days: number;
  /** Hours ahead of this device (negative: behind). Quarter hours exist (Nepal). */
  hours: number;
}

/**
 * How far `zone` is from this device, at `date`. Measured from the two wall clocks
 * rather than from offsets, so daylight saving on either side is already in it.
 */
export function difference(date: Date, zone: string | null): Difference {
  if (!zone || !isKnownZone(zone)) return { days: 0, hours: 0 };
  const there = wallClock(date, zone);
  const here = wallClock(date);
  const days = there.day - here.day;
  const minutes = days * 1440 + there.minutes - here.minutes;
  return { days, hours: minutes / 60 };
}

/**
 * "tomorrow, +9 hr" in the browser's language, or `''` for the device's own time.
 * `Intl` writes every part, so there is nothing to translate.
 */
export function differenceText({ days, hours }: Difference, locale?: string): string {
  const parts: string[] = [];
  if (days !== 0) {
    parts.push(
      new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day'),
    );
  }
  if (hours !== 0) {
    parts.push(
      new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'hour',
        unitDisplay: 'short',
        signDisplay: 'exceptZero',
        maximumFractionDigits: 2,
      }).format(hours),
    );
  }
  return new Intl.ListFormat(locale, { type: 'unit', style: 'short' }).format(parts);
}
