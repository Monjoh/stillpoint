import { describe, expect, it } from 'vitest';
import { dateSettingsSchema } from './definition';
import { formatDate, isoDate } from './format';

const settings = (overrides: Record<string, unknown> = {}) =>
  dateSettingsSchema.parse({ timezone: 'UTC', ...overrides });

// 23:30 UTC on a Sunday: already Monday east of Greenwich, still Sunday in New York.
const instant = new Date('2026-03-15T23:30:00Z');

describe('formatDate', () => {
  it('writes the full date with the weekday', () => {
    expect(formatDate(instant, settings(), 'en-GB')).toBe('Sunday 15 March');
  });

  it('abbreviates in the short style', () => {
    expect(formatDate(instant, settings({ style: 'short' }), 'en-GB')).toBe(
      'Sun 15 Mar',
    );
  });

  it('follows the locale’s order of day and month', () => {
    const numeric = settings({ style: 'numeric' });
    expect(formatDate(instant, numeric, 'en-GB')).toBe('15/03');
    expect(formatDate(instant, numeric, 'en-US')).toBe('03/15');
  });

  it('adds the year only when asked', () => {
    expect(formatDate(instant, settings({ showYear: true }), 'en-GB')).toBe(
      'Sunday, 15 March 2026',
    );
  });

  it('turns over in the chosen time zone, not the device’s', () => {
    expect(formatDate(instant, settings({ timezone: 'Asia/Tokyo' }), 'en-GB')).toBe(
      'Monday 16 March',
    );
  });

  it('falls back to local time for a time zone Intl rejects', () => {
    const local = formatDate(instant, settings({ timezone: null }), 'en-GB');
    expect(formatDate(instant, settings({ timezone: 'Mars/Olympus' }), 'en-GB')).toBe(
      local,
    );
  });
});

describe('isoDate', () => {
  it('is the date shown, not the UTC date', () => {
    expect(isoDate(instant, 'UTC')).toBe('2026-03-15');
    expect(isoDate(instant, 'Asia/Tokyo')).toBe('2026-03-16');
  });
});

describe('dateSettingsSchema', () => {
  it('parses an empty object, which is what a newly added widget stores', () => {
    expect(dateSettingsSchema.parse({})).toEqual({
      style: 'full',
      showYear: false,
      fontSize: 28,
      weight: 'regular',
      timezone: null,
    });
  });
});
