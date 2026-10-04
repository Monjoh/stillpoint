import type { LayoutConfig, Rect } from '@/core/config/schema';

/**
 * The relative grid, in one pure module.
 *
 * Both axes are relative: `LayoutConfig` stores `columns` and `rows`, never a pixel
 * row height. Cell size is derived from the measured canvas every time it changes, so
 * a layout composed on a 27" monitor arrives intact on a laptop — scaled, not reflowed,
 * and never taller than the window. The canvas is exactly one viewport and the new tab
 * must never scroll. See docs/02-data-model.md, "Why both axes are relative".
 *
 * Kept free of React and of the DOM so the arithmetic can be tested directly; it is
 * the part of the canvas most likely to be quietly wrong.
 */

export interface Size {
  width: number;
  height: number;
}

export interface CanvasGeometry extends Size {
  columns: number;
  rows: number;
  /** The gap actually used, which can be below `layout.gap` — see `computeGeometry`. */
  gap: number;
  cellWidth: number;
  cellHeight: number;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The largest gap that still leaves every cell at least one pixel. On a normal window
 * this is far above the configured gap and does nothing; on a very small one it is
 * what stops `cellWidth` going to zero or negative and collapsing the layout.
 */
function maxGap(total: number, count: number): number {
  if (count <= 1) return Number.POSITIVE_INFINITY;
  return Math.max(0, (total - count) / (count - 1));
}

export function computeGeometry(layout: LayoutConfig, canvas: Size): CanvasGeometry {
  const { columns, rows } = layout;

  // One gap for both axes, so cells stay visually consistent when the window is the
  // constraint on only one of them.
  const gap = Math.min(
    layout.gap,
    maxGap(canvas.width, columns),
    maxGap(canvas.height, rows),
  );

  return {
    width: canvas.width,
    height: canvas.height,
    columns,
    rows,
    gap,
    cellWidth: Math.max(0, (canvas.width - gap * (columns - 1)) / columns),
    cellHeight: Math.max(0, (canvas.height - gap * (rows - 1)) / rows),
  };
}

/** Grid cells to absolute pixels within the canvas box. */
export function rectToPixels(rect: Rect, geometry: CanvasGeometry): PixelRect {
  const { cellWidth, cellHeight, gap } = geometry;
  return {
    left: rect.x * (cellWidth + gap),
    top: rect.y * (cellHeight + gap),
    width: Math.max(0, rect.w * cellWidth + (rect.w - 1) * gap),
    height: Math.max(0, rect.h * cellHeight + (rect.h - 1) * gap),
  };
}

/** The nearest grid cell to a point in canvas pixels. For drag and drop. */
export function pointToCell(
  point: { x: number; y: number },
  geometry: CanvasGeometry,
): { x: number; y: number } {
  const { cellWidth, cellHeight, gap, columns, rows } = geometry;
  const x = Math.round(point.x / Math.max(1, cellWidth + gap));
  const y = Math.round(point.y / Math.max(1, cellHeight + gap));
  return {
    x: Math.min(Math.max(0, x), columns - 1),
    y: Math.min(Math.max(0, y), rows - 1),
  };
}

/**
 * Pull a rect inside the grid, preserving size where possible and position otherwise.
 *
 * Needed on every render, not just on edit: a user who narrows their grid from 24
 * columns to 12, or imports a profile built on a larger one, must not end up with
 * widgets positioned off the canvas and no way to reach them.
 */
export function clampRect(rect: Rect, layout: LayoutConfig): Rect {
  const w = Math.min(Math.max(1, Math.round(rect.w)), layout.columns);
  const h = Math.min(Math.max(1, Math.round(rect.h)), layout.rows);
  return {
    w,
    h,
    x: Math.min(Math.max(0, Math.round(rect.x)), layout.columns - w),
    y: Math.min(Math.max(0, Math.round(rect.y)), layout.rows - h),
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
