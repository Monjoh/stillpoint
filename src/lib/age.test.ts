import { describe, expect, it } from 'vitest';
import { formatAge, unit } from './age';

const MINUTE = 60_000;

describe('formatAge', () => {
  it('counts minutes, then hours, then days', () => {
    // jsdom's locale is en-US.
    expect(formatAge(5 * MINUTE)).toBe('5 min');
    expect(formatAge(3 * 60 * MINUTE)).toBe('3 hr');
    expect(formatAge(72 * 60 * MINUTE)).toBe('3 days');
  });

  it('never says zero', () => {
    expect(formatAge(0)).toBe('1 min');
  });
});

describe('unit', () => {
  it('writes the unit the locale’s way', () => {
    expect(unit(12, 'kilometer-per-hour')).toBe('12 km/h');
    expect(unit(8, 'mile-per-hour')).toBe('8 mph');
  });
});
