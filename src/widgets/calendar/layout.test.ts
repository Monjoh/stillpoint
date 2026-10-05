import { describe, expect, it } from 'vitest';
import { calendarLayout } from './layout';

const shortWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const layout = (
  width: number,
  height: number,
  overrides: Partial<Parameters<typeof calendarLayout>[0]> = {},
) =>
  calendarLayout({
    size: { width, height },
    maxPx: 28,
    wantWeekNumbers: false,
    shortWeekdays,
    title: 'September 2026',
    ...overrides,
  });

describe('calendarLayout', () => {
  it('shows the weekday names, short, in a roomy cell', () => {
    const result = layout(320, 280);
    expect(result).toMatchObject({
      rows: 8,
      columns: 7,
      showWeekdays: true,
      weekdayStyle: 'short',
    });
  });

  it('adds a column for week numbers when asked', () => {
    expect(layout(400, 320, { wantWeekNumbers: true })).toMatchObject({
      columns: 8,
      showWeekNumbers: true,
    });
  });

  it('writes the weekdays narrow when short names would not fit', () => {
    // Some languages abbreviate to four or five characters.
    const long = ['Mon.', 'Tues.', 'Wed.', 'Thurs.', 'Fri.', 'Sat.', 'Sun.'];
    expect(layout(320, 280, { shortWeekdays: long }).weekdayStyle).toBe('narrow');
    expect(layout(700, 280, { shortWeekdays: long }).weekdayStyle).toBe('short');
  });

  it('drops week numbers first, then the weekday names, as the cell shrinks', () => {
    const small = layout(200, 160, { wantWeekNumbers: true });
    expect(small.showWeekNumbers).toBe(false);
    expect(small.showWeekdays).toBe(true);

    const tiny = layout(160, 120, { wantWeekNumbers: true });
    expect(tiny).toMatchObject({
      showWeekNumbers: false,
      showWeekdays: false,
      rows: 7,
    });
  });

  it('never sizes past the setting, and sizes in container units', () => {
    expect(layout(2000, 2000).daySize).toMatch(/^min\(28px, [\d.]+cqh, [\d.]+cqw\)$/);
  });
});
