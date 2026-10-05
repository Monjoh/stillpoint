import { describe, expect, it } from 'vitest';
import { LINE_HEIGHT, layoutStocks } from './layout';

const base = { maxPx: 20, labelChars: 4, priceChars: 7, changeChars: 6 };

describe('layoutStocks', () => {
  it('shows every row and its change at the size asked for when there is room', () => {
    expect(layoutStocks({ ...base, count: 4, width: 400, height: 300 })).toEqual({
      fontPx: 20,
      rows: 4,
      showChange: true,
    });
  });

  it('never exceeds the size asked for', () => {
    expect(layoutStocks({ ...base, count: 2, width: 3000, height: 3000 }).fontPx).toBe(
      20,
    );
  });

  it('drops the change before shrinking below half the size', () => {
    // 17 characters plus two gaps need ~12em; without the change, ~7.6em.
    const narrow = layoutStocks({ ...base, count: 2, width: 90, height: 300 });
    expect(narrow.showChange).toBe(false);
    expect(narrow.rows).toBe(2);
    expect(narrow.fontPx).toBeGreaterThanOrEqual(10);
  });

  it('shows the rows that fit, at a readable size, in a short cell', () => {
    const short = layoutStocks({ ...base, count: 10, width: 400, height: 80 });
    expect(short.fontPx).toBeGreaterThanOrEqual(10);
    expect(short.rows).toBeLessThan(10);
    expect(short.rows * short.fontPx * LINE_HEIGHT).toBeLessThanOrEqual(80);
  });

  it('keeps one row, smaller, in a sliver', () => {
    const sliver = layoutStocks({ ...base, count: 3, width: 400, height: 14 });
    expect(sliver.rows).toBe(1);
  });
});
