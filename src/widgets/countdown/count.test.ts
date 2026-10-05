import { describe, expect, it } from 'vitest';
import { calendarDays, daysText, span, spanText, targetDate } from './count';

describe('targetDate', () => {
  it('reads the date and time inputs as local wall-clock time', () => {
    expect(targetDate('2026-12-25', '')).toEqual(new Date(2026, 11, 25, 0, 0));
    expect(targetDate('2026-12-25', '18:30')).toEqual(new Date(2026, 11, 25, 18, 30));
  });

  it('refuses what a date input would never send', () => {
    expect(targetDate('', '')).toBeNull();
    expect(targetDate('2026-02-31', '')).toBeNull();
    expect(targetDate('25/12/2026', '')).toBeNull();
    expect(targetDate('2026-12-25', '6pm')).toBeNull();
  });
});

describe('calendarDays', () => {
  it('counts calendar days, so late tonight is still 1 day before tomorrow', () => {
    const now = new Date(2026, 11, 24, 23, 59);
    expect(calendarDays(now, new Date(2026, 11, 25))).toBe(1);
    expect(calendarDays(now, new Date(2026, 11, 24, 0, 0))).toBe(0);
    expect(calendarDays(now, new Date(2026, 11, 20))).toBe(-4);
  });

  it('spans a year end', () => {
    expect(calendarDays(new Date(2026, 11, 31), new Date(2027, 0, 1))).toBe(1);
  });
});

describe('span', () => {
  const target = new Date(2026, 11, 25, 0, 0);

  it('rounds up while counting down, so the last minute still says 1', () => {
    expect(span(new Date(2026, 11, 24, 23, 59, 1), target, false)).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
      seconds: 0,
    });
  });

  it('splits into days, hours and minutes', () => {
    expect(span(new Date(2026, 11, 22, 20, 48), target, false)).toEqual({
      days: 2,
      hours: 3,
      minutes: 12,
      seconds: 0,
    });
  });

  it('counts the time since once it has passed', () => {
    expect(span(new Date(2026, 11, 25, 1, 30, 59), target, true)).toEqual({
      days: 0,
      hours: 1,
      minutes: 30,
      seconds: 59,
    });
  });
});

describe('spanText', () => {
  it('leaves out leading zero units, keeps the rest', () => {
    expect(spanText({ days: 2, hours: 0, minutes: 5, seconds: 0 }, false, 'en')).toBe(
      '2d 0h 5m',
    );
    expect(spanText({ days: 0, hours: 3, minutes: 12, seconds: 9 }, true, 'en')).toBe(
      '3h 12m 9s',
    );
    expect(spanText({ days: 0, hours: 0, minutes: 0, seconds: 0 }, false, 'en')).toBe(
      '0m',
    );
  });
});

describe('daysText', () => {
  it('is a plural the browser writes, never negative', () => {
    expect(daysText(42, 'en')).toBe('42 days');
    expect(daysText(1, 'en')).toBe('1 day');
    expect(daysText(-3, 'en')).toBe('3 days');
  });
});
