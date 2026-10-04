import { describe, expect, it } from 'vitest';
import { layoutSchema, type Rect, type WidgetInstance } from '@/core/config/schema';
import { computeGeometry } from '../geometry';
import {
  cellDelta,
  isPlacementValid,
  moveRect,
  resizeRect,
  type ResizeHandle,
} from './placement';

const layout = layoutSchema.parse({ columns: 24, rows: 12 });
const start: Rect = { x: 8, y: 4, w: 8, h: 3 };

describe('cellDelta', () => {
  it('snaps pointer travel to whole cells', () => {
    const geometry = computeGeometry(layout, { width: 1200, height: 600 });
    const pitch = geometry.cellWidth + geometry.gap;

    expect(cellDelta(0, 0, geometry)).toEqual({ dCols: 0, dRows: 0 });
    // Less than half a cell of travel must not move anything.
    expect(cellDelta(pitch * 0.4, 0, geometry).dCols).toBe(0);
    expect(cellDelta(pitch * 0.6, 0, geometry).dCols).toBe(1);
    expect(cellDelta(-pitch * 3, 0, geometry).dCols).toBe(-3);
  });
});

describe('moveRect', () => {
  it('moves by whole cells and keeps the size', () => {
    expect(moveRect(start, 2, -1, layout)).toEqual({ x: 10, y: 3, w: 8, h: 3 });
  });

  it('stops at the grid edge instead of leaving the canvas', () => {
    expect(moveRect(start, 99, 99, layout)).toEqual({ x: 16, y: 9, w: 8, h: 3 });
    expect(moveRect(start, -99, -99, layout)).toEqual({ x: 0, y: 0, w: 8, h: 3 });
  });
});

describe('resizeRect', () => {
  const grow: [ResizeHandle, number, number, Rect][] = [
    ['e', 2, 0, { x: 8, y: 4, w: 10, h: 3 }],
    ['w', -2, 0, { x: 6, y: 4, w: 10, h: 3 }],
    ['s', 0, 2, { x: 8, y: 4, w: 8, h: 5 }],
    ['n', 0, -2, { x: 8, y: 2, w: 8, h: 5 }],
    ['se', 2, 2, { x: 8, y: 4, w: 10, h: 5 }],
    ['nw', -2, -2, { x: 6, y: 2, w: 10, h: 5 }],
    ['ne', 2, -2, { x: 8, y: 2, w: 10, h: 5 }],
    ['sw', -2, 2, { x: 6, y: 4, w: 10, h: 5 }],
  ];

  it.each(grow)('grows from the %s handle', (handle, dx, dy, expected) => {
    expect(resizeRect(start, handle, dx, dy, layout)).toEqual(expected);
  });

  it('keeps the opposite edge fixed while the dragged one moves', () => {
    const resized = resizeRect(start, 'w', 3, 0, layout);
    expect(resized.x + resized.w).toBe(start.x + start.w);
  });

  it('collapses to the minimum rather than inverting when dragged past', () => {
    // West handle dragged far to the east: the widget must bottom out at its minimum
    // width against its own right edge, not turn inside out.
    const resized = resizeRect(start, 'w', 50, 0, layout, { w: 3, h: 1 });
    expect(resized).toEqual({ x: 13, y: 4, w: 3, h: 3 });
  });

  it('respects a minimum from every direction', () => {
    // East handle dragged west past the west edge: the west edge must not come with
    // it. The widget collapses in place.
    expect(resizeRect(start, 'e', -50, 0, layout, { w: 3, h: 1 })).toEqual({
      x: 8,
      y: 4,
      w: 3,
      h: 3,
    });
    expect(resizeRect(start, 'n', 0, 50, layout, { w: 1, h: 2 })).toEqual({
      x: 8,
      y: 5,
      w: 8,
      h: 2,
    });
    expect(resizeRect(start, 's', 0, -50, layout, { w: 1, h: 2 })).toEqual({
      x: 8,
      y: 4,
      w: 8,
      h: 2,
    });
  });

  it('stops at the grid boundary', () => {
    expect(resizeRect(start, 'se', 99, 99, layout)).toEqual({
      x: 8,
      y: 4,
      w: 16,
      h: 8,
    });
    expect(resizeRect(start, 'nw', -99, -99, layout)).toEqual({
      x: 0,
      y: 0,
      w: 16,
      h: 7,
    });
  });

  it('never produces a rect the schema would reject', () => {
    for (const handle of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const) {
      for (const d of [-99, -1, 0, 1, 99]) {
        const r = resizeRect(start, handle, d, d, layout);
        expect(r.w).toBeGreaterThanOrEqual(1);
        expect(r.h).toBeGreaterThanOrEqual(1);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(layout.columns);
        expect(r.y + r.h).toBeLessThanOrEqual(layout.rows);
      }
    }
  });
});

describe('isPlacementValid', () => {
  const widgets = [
    { instanceId: 'a', rect: { x: 0, y: 0, w: 4, h: 2 } },
    { instanceId: 'b', rect: { x: 10, y: 0, w: 4, h: 2 } },
  ] as WidgetInstance[];

  it('ignores the widget being moved', () => {
    expect(isPlacementValid({ x: 0, y: 0, w: 4, h: 2 }, 'a', widgets)).toBe(true);
  });

  it('refuses an overlap instead of pushing the neighbour aside', () => {
    // There is nowhere to push to: the canvas is exactly one viewport.
    expect(isPlacementValid({ x: 9, y: 0, w: 4, h: 2 }, 'a', widgets)).toBe(false);
  });

  it('allows a rect that only touches edges', () => {
    expect(isPlacementValid({ x: 6, y: 0, w: 4, h: 2 }, 'a', widgets)).toBe(true);
  });
});
