import { describe, expect, it } from 'vitest';
import { firstWeekday, isoDate, isoWeek, monthGrid, sameDay } from './month';

describe('firstWeekday', () => {
  it('follows the setting when it names a day', () => {
    expect(firstWeekday('monday', 'en-US')).toBe(1);
    expect(firstWeekday('sunday', 'fr-FR')).toBe(0);
  });

  it('asks the locale on Auto', () => {
    expect(firstWeekday('locale', 'en-US')).toBe(0);
    expect(firstWeekday('locale', 'fr-FR')).toBe(1);
    expect(firstWeekday('locale', 'en-GB')).toBe(1);
  });

  it('falls back to Monday for a locale it cannot read', () => {
    expect(firstWeekday('locale', 'not a locale')).toBe(1);
  });
});

describe('monthGrid', () => {
  it('is always six weeks of seven days, starting on the given weekday', () => {
    // October 2026 starts on a Thursday.
    const weeks = monthGrid(2026, 9, 1);
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(isoDate(weeks[0]!.days[0]!.date)).toBe('2026-09-28');
    expect(weeks[0]!.days.map((day) => day.inMonth)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(isoDate(weeks[5]!.days[6]!.date)).toBe('2026-11-08');
  });

  it('starts on Sunday when asked', () => {
    const weeks = monthGrid(2026, 9, 0);
    expect(isoDate(weeks[0]!.days[0]!.date)).toBe('2026-09-27');
    expect(weeks[0]!.days[0]!.date.getDay()).toBe(0);
  });

  it('opens on the 1st when the month starts on the first weekday', () => {
    // February 2026 starts on a Sunday.
    const weeks = monthGrid(2026, 1, 0);
    expect(isoDate(weeks[0]!.days[0]!.date)).toBe('2026-02-01');
    // 28 days fill four rows exactly; the last two belong to March.
    expect(weeks[4]!.days.every((day) => !day.inMonth)).toBe(true);
  });

  it('numbers each row by its Monday, whichever day starts the week', () => {
    expect(monthGrid(2026, 9, 1).map((week) => week.number)).toEqual([
      40, 41, 42, 43, 44, 45,
    ]);
    // A Sunday-first row runs Sunday to Saturday; its Monday is the second day.
    expect(monthGrid(2026, 9, 0)[0]!.number).toBe(40);
  });
});

describe('isoWeek', () => {
  it('puts the first Thursday of the year in week 1', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1); // a Thursday
    expect(isoWeek(new Date(2021, 0, 3))).toBe(53); // a Sunday, still 2020's week
    expect(isoWeek(new Date(2021, 0, 4))).toBe(1);
  });

  it('gives late December to next year when its Thursday is there', () => {
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1);
    expect(isoWeek(new Date(2026, 11, 31))).toBe(53);
  });
});

describe('sameDay', () => {
  it('compares the calendar day, not the instant', () => {
    expect(sameDay(new Date(2026, 9, 6, 0, 0), new Date(2026, 9, 6, 23, 59))).toBe(
      true,
    );
    expect(sameDay(new Date(2026, 9, 6), new Date(2026, 10, 6))).toBe(false);
  });
});
