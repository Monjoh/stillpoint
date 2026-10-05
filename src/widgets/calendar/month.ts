/**
 * The arithmetic of Calendar, kept pure so the edges (a month starting on the week's
 * first day, week 53, the locale's own first weekday) are testable without a clock.
 *
 * Days are local wall-clock dates. Every Date here is built from year, month and day
 * at midnight, so daylight saving never moves one into the neighbouring day.
 */

/** 0 = Sunday … 6 = Saturday, as `Date.prototype.getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeekStart = 'locale' | 'monday' | 'sunday';

interface WeekInfo {
  /** 1 = Monday … 7 = Sunday. */
  firstDay: number;
}

/**
 * The first day of the week. `locale` asks the browser, which knows that the US starts
 * on Sunday and most of Europe on Monday. `getWeekInfo()` is the standard spelling,
 * `weekInfo` an older one some engines still ship. Monday, the ISO 8601 answer, when
 * the engine has neither.
 */
export function firstWeekday(setting: WeekStart, locale?: string): Weekday {
  if (setting === 'monday') return 1;
  if (setting === 'sunday') return 0;
  try {
    const tag = new Intl.Locale(
      locale ?? new Intl.DateTimeFormat().resolvedOptions().locale,
    );
    const withInfo = tag as Intl.Locale & {
      getWeekInfo?: () => WeekInfo;
      weekInfo?: WeekInfo;
    };
    const info = withInfo.getWeekInfo?.() ?? withInfo.weekInfo;
    if (info) return (info.firstDay % 7) as Weekday;
  } catch {
    // A malformed locale: fall through to ISO.
  }
  return 1;
}

export interface Day {
  date: Date;
  /** In the month on show, rather than the end of the last or start of the next. */
  inMonth: boolean;
}

export interface Week {
  /** ISO 8601 week number of the row. */
  number: number;
  days: Day[];
}

/**
 * The month as six weeks of seven days, starting on `weekStart`. Always six, so the
 * grid doesn't change height from one month to the next. Months that need fewer end
 * with days of the next month.
 */
export function monthGrid(year: number, month: number, weekStart: Weekday): Week[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStart + 7) % 7;
  const weeks: Week[] = [];
  for (let row = 0; row < 6; row++) {
    const days: Day[] = [];
    for (let col = 0; col < 7; col++) {
      const date = new Date(year, month, 1 - lead + row * 7 + col);
      days.push({ date, inMonth: date.getMonth() === first.getMonth() });
    }
    // Every row of seven days holds exactly one Monday, and ISO numbers weeks by it.
    const monday = days.find((day) => day.date.getDay() === 1)!.date;
    weeks.push({ number: isoWeek(monday), days });
  }
  return weeks;
}

/** ISO 8601 week number: week 1 is the one with the year's first Thursday. */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Move to the Thursday of the same Monday-to-Sunday week; its year is the week's.
  day.setUTCDate(day.getUTCDate() + 3 - ((day.getUTCDay() + 6) % 7));
  // Week 1 holds the year's first Thursday, so a Thursday's week is its day of the
  // year, counted in sevens.
  const january1 = Date.UTC(day.getUTCFullYear(), 0, 1);
  return 1 + Math.floor((day.getTime() - january1) / 604_800_000);
}

/** Two dates on the same calendar day. */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `YYYY-MM-DD`, for a `<time dateTime>`. */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
