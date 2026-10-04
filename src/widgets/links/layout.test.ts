import { describe, expect, it } from 'vitest';
import { layoutLinks } from './layout';

describe('layoutLinks', () => {
  it('uses the size asked for when there is room', () => {
    const layout = layoutLinks({
      count: 4,
      width: 800,
      height: 200,
      mode: 'tiles',
      maxPx: 48,
    });
    expect(layout).toEqual({ mode: 'tiles', columns: 4, icon: 48, visible: 4 });
  });

  it('wraps into rows when that gives bigger icons', () => {
    const layout = layoutLinks({
      count: 6,
      width: 300,
      height: 400,
      mode: 'tiles',
      maxPx: 96,
    });
    expect(layout.columns).toBeLessThan(6);
    expect(layout.visible).toBe(6);
  });

  it('drops the names before the icons get too small for them', () => {
    const layout = layoutLinks({
      count: 8,
      width: 600,
      height: 50,
      mode: 'tiles',
      maxPx: 48,
    });
    expect(layout.mode).toBe('icons');
    expect(layout.visible).toBe(8);
  });

  it('shows as many as fit, rather than shrinking them away', () => {
    const layout = layoutLinks({
      count: 40,
      width: 120,
      height: 40,
      mode: 'icons',
      maxPx: 48,
    });
    expect(layout.icon).toBe(16);
    expect(layout.visible).toBeLessThan(40);
    expect(layout.visible).toBeGreaterThan(0);
  });

  it('stacks a list in rows, with smaller icons than tiles', () => {
    const layout = layoutLinks({
      count: 3,
      width: 300,
      height: 300,
      mode: 'list',
      maxPx: 48,
    });
    expect(layout.columns).toBe(1);
    expect(layout.icon).toBeLessThan(48);
  });

  it('never exceeds the size asked for', () => {
    const layout = layoutLinks({
      count: 1,
      width: 3000,
      height: 3000,
      mode: 'icons',
      maxPx: 40,
    });
    expect(layout.icon).toBe(40);
  });

  it('has nothing to lay out with no links', () => {
    expect(
      layoutLinks({ count: 0, width: 300, height: 300, mode: 'tiles', maxPx: 48 })
        .visible,
    ).toBe(0);
  });
});
