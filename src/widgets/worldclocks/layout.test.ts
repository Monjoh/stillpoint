import { describe, expect, it } from 'vitest';
import { worldClocksLayout } from './layout';

const base = {
  count: 3,
  time: '23:04',
  label: 'New York',
  maxPx: 48,
  wantDifference: true,
};

describe('worldClocksLayout', () => {
  it('stacks rows in a tall cell, and puts cities side by side in a wide one', () => {
    expect(
      worldClocksLayout({ ...base, size: { width: 400, height: 300 } }).direction,
    ).toBe('rows');
    expect(
      worldClocksLayout({ ...base, size: { width: 900, height: 120 } }).direction,
    ).toBe('columns');
  });

  it('uses rows for a single city', () => {
    expect(
      worldClocksLayout({ ...base, count: 1, size: { width: 900, height: 120 } })
        .direction,
    ).toBe('rows');
  });

  it('sizes the time in container units, capped by the size asked for', () => {
    const { timeSize } = worldClocksLayout({
      ...base,
      size: { width: 400, height: 300 },
    });
    expect(timeSize).toMatch(/^min\(48px, [\d.]+cqh, [\d.]+cqw\)$/);
  });

  it('drops the difference line before it gets too small to read', () => {
    expect(
      worldClocksLayout({ ...base, size: { width: 400, height: 300 } }).showDifference,
    ).toBe(true);
    expect(
      worldClocksLayout({ ...base, size: { width: 160, height: 60 } }).showDifference,
    ).toBe(false);
    expect(
      worldClocksLayout({
        ...base,
        wantDifference: false,
        size: { width: 400, height: 300 },
      }).showDifference,
    ).toBe(false);
  });
});
