/**
 * The arithmetic of Countdown, kept pure so the edges (today, the minute it arrives,
 * daylight saving) are testable without a clock.
 *
 * The target is a wall-clock time on this device, not an instant: "25 December" means
 * midnight where the user is, wherever that is when they look.
 */

/** `YYYY-MM-DD` and optional `HH:mm` → a local Date, or null if either is malformed. */
export function targetDate(date: string, time: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!day) return null;
  const clock = time === '' ? ['', '0', '0'] : /^(\d{2}):(\d{2})$/.exec(time);
  if (!clock) return null;
  const [, y, m, d] = day.map(Number) as [number, number, number, number];
  const target = new Date(y, m - 1, d, Number(clock[1]), Number(clock[2]));
  // new Date rolls 31 February over into March; a date input never sends one, but an
  // imported or hand-edited config might.
  return target.getDate() === d ? target : null;
}

/**
 * Whole calendar days from today to the target's day: 1 tomorrow, 0 today, -1
 * yesterday. Counted in calendar days, not 24-hour blocks, so it changes at
 * midnight and a daylight-saving night doesn't shift it.
 */
export function calendarDays(now: Date, target: Date): number {
  const day = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
  return day(target) - day(now);
}

export interface Span {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * The time left (or since), split into units. Rounded *up* while counting down, so
 * "1 minute" shows until the moment arrives rather than "0 minutes" for its last 59
 * seconds, and down once it has passed.
 */
export function span(now: Date, target: Date, withSeconds: boolean): Span {
  const ms = target.getTime() - now.getTime();
  const step = withSeconds ? 1_000 : 60_000;
  const steps = ms >= 0 ? Math.ceil(ms / step) : Math.floor(-ms / step);
  let seconds = withSeconds ? steps : steps * 60;
  const days = Math.floor(seconds / 86_400);
  seconds -= days * 86_400;
  const hours = Math.floor(seconds / 3_600);
  seconds -= hours * 3_600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  return { days, hours, minutes, seconds };
}

/**
 * "42d 3h 12m" in the browser's language. Leading zero units are left out; once one
 * is shown, the smaller ones always are, so the line doesn't jump width every hour.
 */
export function spanText(value: Span, withSeconds: boolean, locale?: string): string {
  const units: [number, string][] = [
    [value.days, 'day'],
    [value.hours, 'hour'],
    [value.minutes, 'minute'],
  ];
  if (withSeconds) units.push([value.seconds, 'second']);
  const first = units.findIndex(([n]) => n > 0);
  const shown = units.slice(first === -1 ? units.length - 1 : first);
  return new Intl.ListFormat(locale, { type: 'unit', style: 'narrow' }).format(
    shown.map(([n, unit]) =>
      new Intl.NumberFormat(locale, {
        style: 'unit',
        unit,
        unitDisplay: 'narrow',
      }).format(n),
    ),
  );
}

/** "42 days", in the browser's language. */
export function daysText(days: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'day',
    unitDisplay: 'long',
  }).format(Math.abs(days));
}
