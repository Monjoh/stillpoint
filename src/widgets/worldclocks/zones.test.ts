import { describe, expect, it } from 'vitest';
import { cityName, difference, differenceText, isKnownZone } from './zones';

describe('cityName', () => {
  it('takes the last part of the zone, with spaces', () => {
    expect(cityName('Europe/London')).toBe('London');
    expect(cityName('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(cityName('UTC')).toBe('UTC');
  });
});

describe('isKnownZone', () => {
  it('accepts what the browser knows and nothing else', () => {
    expect(isKnownZone('Asia/Tokyo')).toBe(true);
    expect(isKnownZone('Mars/Olympus')).toBe(false);
  });
});

// The difference is measured from this device, so each test sets the device's zone
// (Node re-reads TZ when it is assigned) rather than depend on the machine's.
describe('difference', () => {
  const original = process.env.TZ;
  const asDevice = (zone: string, run: () => void) => {
    process.env.TZ = zone;
    try {
      run();
    } finally {
      // Assigning undefined would store the string "undefined".
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  };

  it('is the hours ahead, and the day when the date differs', () => {
    asDevice('UTC', () => {
      // 23:00 in London (winter, UTC) is 08:00 the next day in Tokyo.
      const at = new Date('2026-01-15T23:00:00Z');
      expect(difference(at, 'Asia/Tokyo')).toEqual({ days: 1, hours: 9 });
      expect(difference(at, 'America/New_York')).toEqual({ days: 0, hours: -5 });
    });
  });

  it('follows daylight saving on the other side', () => {
    asDevice('UTC', () => {
      expect(difference(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toEqual({
        days: 0,
        hours: -4,
      });
    });
  });

  it('keeps quarter hours', () => {
    asDevice('UTC', () => {
      expect(difference(new Date('2026-01-15T12:00:00Z'), 'Asia/Kathmandu').hours).toBe(
        5.75,
      );
    });
  });

  it('is nothing for the device zone, or one the browser does not know', () => {
    const at = new Date('2026-01-15T12:00:00Z');
    expect(difference(at, null)).toEqual({ days: 0, hours: 0 });
    expect(difference(at, 'Mars/Olympus')).toEqual({ days: 0, hours: 0 });
  });
});

describe('differenceText', () => {
  it('says the day in words and the hours with a sign', () => {
    expect(differenceText({ days: 1, hours: 9 }, 'en')).toBe('tomorrow, +9 hr');
    expect(differenceText({ days: 0, hours: -5 }, 'en')).toBe('-5 hr');
    expect(differenceText({ days: -1, hours: -10.5 }, 'en')).toBe(
      'yesterday, -10.5 hr',
    );
  });

  it('says nothing for the same time', () => {
    expect(differenceText({ days: 0, hours: 0 }, 'en')).toBe('');
  });
});
