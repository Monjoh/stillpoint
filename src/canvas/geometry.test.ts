import { describe, expect, it } from 'vitest';
import { layoutSchema } from '@/core/config/schema';
import {
  clampRect,
  computeGeometry,
  pointToCell,
  rectToPixels,
  rectsOverlap,
} from './geometry';

const layout = (overrides: Record<string, unknown> = {}) =>
  layoutSchema.parse(overrides);

describe('computeGeometry', () => {
  it('divides the canvas exactly, leaving no remainder on either axis', () => {
    const l = layout({ columns: 24, rows: 12, gap: 12 });
    const g = computeGeometry(l, { width: 1600, height: 900 });

    expect(g.cellWidth * 24 + g.gap * 23).toBeCloseTo(1600, 6);
    expect(g.cellHeight * 12 + g.gap * 11).toBeCloseTo(900, 6);
  });

  it('derives cell height from the viewport, not from a stored row height', () => {
    const l = layout({ columns: 24, rows: 12, gap: 0 });
    const short = computeGeometry(l, { width: 1200, height: 600 });
    const tall = computeGeometry(l, { width: 1200, height: 1200 });

    // The same layout on a shorter window produces shorter cells, which is the whole
    // reason rows are relative: a widget on row 11 stays on screen either way.
    expect(short.cellHeight).toBe(50);
    expect(tall.cellHeight).toBe(100);
    expect(short.cellWidth).toBe(tall.cellWidth);
  });

  it('keeps the bottom-right cell inside the canvas at any viewport', () => {
    const l = layout({ columns: 24, rows: 12, gap: 12 });
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 800, height: 500 },
      { width: 400, height: 300 },
    ]) {
      const g = computeGeometry(l, viewport);
      const corner = rectToPixels({ x: 23, y: 11, w: 1, h: 1 }, g);
      expect(corner.left + corner.width).toBeLessThanOrEqual(viewport.width + 1e-6);
      expect(corner.top + corner.height).toBeLessThanOrEqual(viewport.height + 1e-6);
    }
  });

  it('shrinks the gap rather than collapsing cells in a tiny window', () => {
    const l = layout({ columns: 24, rows: 12, gap: 12 });
    const g = computeGeometry(l, { width: 200, height: 160 });

    expect(g.gap).toBeLessThan(12);
    expect(g.cellWidth).toBeGreaterThan(0);
    expect(g.cellHeight).toBeGreaterThan(0);
  });

  it('uses one gap for both axes', () => {
    const l = layout({ columns: 24, rows: 12, gap: 12 });
    // Wide but very short: the height is the binding constraint, and the width pays
    // for it too rather than the two axes drifting apart visually.
    const g = computeGeometry(l, { width: 3000, height: 100 });
    expect(g.gap).toBe(8);
    expect(g.cellWidth * 24 + g.gap * 23).toBeCloseTo(3000, 6);
    expect(g.cellHeight * 12 + g.gap * 11).toBeCloseTo(100, 6);
  });
});

describe('rectToPixels', () => {
  it('spans the gaps a multi-cell widget covers', () => {
    const g = computeGeometry(layout({ columns: 10, rows: 10, gap: 10 }), {
      width: 190, // 10 cells of 10 + 9 gaps of 10
      height: 190,
    });
    expect(g.cellWidth).toBe(10);

    // Three cells wide means three cells plus the two gaps between them.
    expect(rectToPixels({ x: 0, y: 0, w: 3, h: 1 }, g).width).toBe(50);
    expect(rectToPixels({ x: 2, y: 0, w: 1, h: 1 }, g).left).toBe(40);
  });
});

describe('pointToCell', () => {
  it('snaps to the nearest cell and never leaves the grid', () => {
    const g = computeGeometry(layout({ columns: 10, rows: 10, gap: 10 }), {
      width: 190,
      height: 190,
    });

    expect(pointToCell({ x: 0, y: 0 }, g)).toEqual({ x: 0, y: 0 });
    expect(pointToCell({ x: 42, y: 42 }, g)).toEqual({ x: 2, y: 2 });
    expect(pointToCell({ x: -500, y: -500 }, g)).toEqual({ x: 0, y: 0 });
    expect(pointToCell({ x: 9999, y: 9999 }, g)).toEqual({ x: 9, y: 9 });
  });
});

describe('clampRect', () => {
  const l = layout({ columns: 24, rows: 12 });

  it('leaves an in-bounds rect alone', () => {
    expect(clampRect({ x: 3, y: 2, w: 6, h: 4 }, l)).toEqual({
      x: 3,
      y: 2,
      w: 6,
      h: 4,
    });
  });

  it('pulls a widget back on screen when the grid shrinks under it', () => {
    // Placed at column 40 on a 48-column profile, then imported into a 24-column one.
    expect(clampRect({ x: 40, y: 20, w: 6, h: 4 }, l)).toEqual({
      x: 18,
      y: 8,
      w: 6,
      h: 4,
    });
  });

  it('caps a widget larger than the whole grid', () => {
    expect(clampRect({ x: 0, y: 0, w: 99, h: 99 }, l)).toEqual({
      x: 0,
      y: 0,
      w: 24,
      h: 12,
    });
  });

  it('never produces a zero dimension, which the schema would reject', () => {
    expect(clampRect({ x: -5, y: -5, w: 0, h: 0 }, l)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });
});

describe('rectsOverlap', () => {
  it('treats edge-to-edge as not overlapping', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(
      false,
    );
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(
      true,
    );
  });
});
