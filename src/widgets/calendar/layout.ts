import { lineWidthEm } from '@/lib/fit-text';

/**
 * How Calendar fills its cell. The grid is one title row, an optional row of weekday
 * names and six weeks, all the same height, across seven columns (eight with week
 * numbers). The day numbers are sized to the smaller of a row's height and a column's
 * width, in container units, so the grid follows the cell in the same layout pass.
 *
 * When the cell gets small, parts are dropped rather than squeezed: week numbers
 * first, then the weekday names. Weekday names are short ("Mon") when they fit, and
 * narrow ("M") when they don't.
 */

/** The day numbers' share of a row's height, leaving room for today's ring. */
const DAY_OF_ROW = 0.5;
/** "28" must fit a column with room to spare. */
const DAY_EM = lineWidthEm('28') / 0.7;
/** The weekday names' size, as a share of the day numbers'. */
export const WEEKDAY = 0.72;

/** Below these, in px, the part is dropped. */
const MIN_WITH_WEEK_NUMBERS = 11;
const MIN_WITH_WEEKDAYS = 9;

export interface CalendarLayout {
  rows: number;
  columns: number;
  /** `font-size` for the day numbers. */
  daySize: string;
  /** `font-size` for the month's name, which shares its row with the two arrows. */
  titleSize: string;
  showWeekNumbers: boolean;
  showWeekdays: boolean;
  weekdayStyle: 'short' | 'narrow';
}

export function calendarLayout(input: {
  size: { width: number; height: number };
  maxPx: number;
  wantWeekNumbers: boolean;
  /** Each weekday's short name, as the browser writes it. */
  shortWeekdays: string[];
  /** The month on show, as the title writes it: "September 2026". */
  title: string;
}): CalendarLayout {
  const plan = (weekNumbers: boolean, weekdays: boolean) => {
    const rows = 1 + (weekdays ? 1 : 0) + 6;
    const columns = 7 + (weekNumbers ? 1 : 0);
    const cqh = (100 * DAY_OF_ROW) / rows;
    const cqw = 100 / columns / DAY_EM;
    const px = Math.min(
      input.maxPx,
      (cqh * input.size.height) / 100,
      (cqw * input.size.width) / 100,
    );
    return { rows, columns, cqh, cqw, px };
  };

  let showWeekNumbers = input.wantWeekNumbers;
  let showWeekdays = true;
  let chosen = plan(showWeekNumbers, showWeekdays);
  if (showWeekNumbers && chosen.px < MIN_WITH_WEEK_NUMBERS) {
    showWeekNumbers = false;
    chosen = plan(showWeekNumbers, showWeekdays);
  }
  if (chosen.px < MIN_WITH_WEEKDAYS) {
    showWeekdays = false;
    chosen = plan(showWeekNumbers, showWeekdays);
  }

  // Short names when the longest fits its column at the weekday size.
  const columnPx = input.size.width / chosen.columns;
  const longest = Math.max(...input.shortWeekdays.map(lineWidthEm));
  const weekdayStyle =
    longest * chosen.px * WEEKDAY <= columnPx * 0.9 ? 'short' : 'narrow';

  // The arrows take a column each and the title gets the rest. It is the day numbers'
  // size, unless a long month name needs it smaller to fit.
  const titleCqw =
    (100 * (chosen.columns - 2)) / chosen.columns / lineWidthEm(input.title);
  const daySize = `min(${input.maxPx}px, ${round(chosen.cqh)}cqh, ${round(chosen.cqw)}cqw)`;

  return {
    rows: chosen.rows,
    columns: chosen.columns,
    daySize,
    titleSize: `min(${daySize}, ${round(titleCqw * 0.9)}cqw)`,
    showWeekNumbers,
    showWeekdays,
    weekdayStyle,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
