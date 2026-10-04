import { describe, expect, it } from 'vitest';
import { pickQuote } from './pick';
import type { Quote } from './quotes';

const pool: Quote[] = Array.from({ length: 7 }, (_, i) => ({
  text: `Quote ${i}`,
  author: `Author ${i}`,
}));
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Midnight UTC; with an offset of 0 that is local midnight too.
const day0 = Date.UTC(2026, 9, 5);

describe('pickQuote', () => {
  it('has nothing to show from an empty pool', () => {
    expect(pickQuote([], 'daily', day0, 0.5, 0)).toBeNull();
  });

  it('keeps one quote all day, in every tab', () => {
    const morning = pickQuote(pool, 'daily', day0 + 1 * HOUR, 0.1, 0);
    const evening = pickQuote(pool, 'daily', day0 + 23 * HOUR, 0.9, 0);
    expect(evening).toBe(morning);
  });

  it('shows every quote once before repeating one', () => {
    const week = pool.map((_, d) => pickQuote(pool, 'daily', day0 + d * DAY, 0, 0));
    expect(new Set(week).size).toBe(pool.length);
  });

  it('turns over at local midnight, not at UTC midnight', () => {
    // New York in October: UTC-4, an offset of +240 minutes.
    const lateEvening = day0 + 3 * HOUR; // 23:00 the day before, in New York
    const afterMidnight = day0 + 5 * HOUR; // 01:00, in New York
    expect(pickQuote(pool, 'daily', lateEvening, 0, 240)).not.toBe(
      pickQuote(pool, 'daily', afterMidnight, 0, 240),
    );
    expect(pickQuote(pool, 'daily', day0 + 5 * HOUR, 0, 240)).toBe(
      pickQuote(pool, 'daily', day0 + 20 * HOUR, 0, 240),
    );
  });

  it('moves on every hour when hourly', () => {
    const hours = pool.map((_, h) => pickQuote(pool, 'hourly', day0 + h * HOUR, 0, 0));
    expect(new Set(hours).size).toBe(pool.length);
  });

  it('uses the tab’s own random draw for every tab', () => {
    expect(pickQuote(pool, 'tab', day0, 0, 0)).toBe(pool[0]);
    expect(pickQuote(pool, 'tab', day0, 0.999, 0)).toBe(pool[6]);
  });
});
