import { describe, expect, it } from 'vitest';
import { formatClock, tickIntervalMs, type ClockFormat } from './clock-format';

const settings = (overrides: Partial<ClockFormat> = {}): ClockFormat => ({
  format: '24h',
  showSeconds: false,
  showMeridiem: true,
  timezone: null,
  ...overrides,
});

// 2026-03-15T23:04:07Z — late enough in the day that 24h and 12h clearly differ, and
// that a westward time zone falls on the previous date.
const instant = new Date('2026-03-15T23:04:07Z');

describe('formatClock', () => {
  it('renders midnight as 00:00 in 24h, not 24:00', () => {
    // The reason this uses hourCycle rather than hour12: several locales render
    // midnight as "24:00" under `hour12: false`.
    const midnight = new Date('2026-03-15T00:00:00Z');
    const text = formatClock(midnight, settings({ timezone: 'UTC' }), 'en-GB');
    expect(text).toBe('00:00');
  });

  it('renders 12h with a meridiem', () => {
    const text = formatClock(
      instant,
      settings({ format: '12h', timezone: 'UTC' }),
      'en-US',
    );
    expect(text).toMatch(/^11:04\s*PM$/);
  });

  it('adds seconds only when asked', () => {
    const base = settings({ timezone: 'UTC' });
    expect(formatClock(instant, base, 'en-GB')).toBe('23:04');
    expect(formatClock(instant, { ...base, showSeconds: true }, 'en-GB')).toBe(
      '23:04:07',
    );
  });

  it('honours an explicit time zone', () => {
    expect(
      formatClock(instant, settings({ timezone: 'America/New_York' }), 'en-GB'),
    ).toBe('19:04');
  });

  it('falls back to local time for a time zone Intl rejects', () => {
    // A profile imported from a browser with a larger zone database must not make the
    // widget throw on every tick.
    const local = formatClock(instant, settings(), 'en-GB');
    expect(formatClock(instant, settings({ timezone: 'Mars/Olympus' }), 'en-GB')).toBe(
      local,
    );
  });
});

describe('tickIntervalMs', () => {
  it('ticks once a minute unless seconds are shown', () => {
    expect(tickIntervalMs({ showSeconds: false })).toBe(60_000);
    expect(tickIntervalMs({ showSeconds: true })).toBe(1_000);
  });
});

describe('the AM/PM suffix', () => {
  const at = new Date(Date.UTC(2026, 0, 2, 23, 4));
  const base = { showSeconds: false, timezone: 'UTC', showMeridiem: true } as const;

  it('is there by default in 12-hour time', () => {
    expect(formatClock(at, { ...base, format: '12h' }, 'en-US')).toMatch(/PM/);
  });

  it('can be dropped without disturbing the digits', () => {
    const off = formatClock(
      at,
      { ...base, format: '12h', showMeridiem: false },
      'en-US',
    );
    expect(off).toBe('11:04');
  });

  // Dropped by rebuilding from the formatted parts, not by stripping a trailing
  // " PM" — in several locales the day period comes first.
  it('drops a leading day period too', () => {
    const on = formatClock(at, { ...base, format: '12h' }, 'ja-JP');
    const off = formatClock(
      at,
      { ...base, format: '12h', showMeridiem: false },
      'ja-JP',
    );
    expect(on).toMatch(/午後/);
    expect(off).not.toMatch(/午後/);
    expect(off).toMatch(/11/);
  });

  it('is irrelevant to 24-hour time', () => {
    expect(
      formatClock(at, { ...base, format: '24h', showMeridiem: false }, 'en-GB'),
    ).toBe('23:04');
  });
});
