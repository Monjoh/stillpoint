import type { LayoutConfig, Rect, WidgetInstance } from '@/core/config/schema';
import { clampRect, rectsOverlap, type CanvasGeometry } from '../geometry';

/**
 * The arithmetic behind dragging and resizing, with no pointer events, no React and
 * no DOM in sight. Everything interactive about edit mode reduces to these four
 * functions, which is what makes the fiddly cases — a west handle dragged past the
 * east edge, a widget pushed off the grid, a resize below the widget's minimum —
 * testable instead of hopeful.
 */

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const RESIZE_HANDLES: readonly ResizeHandle[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

/** Pointer travel in pixels, as whole grid cells. Snapping is not optional. */
export function cellDelta(
  dx: number,
  dy: number,
  geometry: CanvasGeometry,
): { dCols: number; dRows: number } {
  return {
    dCols: Math.round(dx / Math.max(1, geometry.cellWidth + geometry.gap)),
    dRows: Math.round(dy / Math.max(1, geometry.cellHeight + geometry.gap)),
  };
}

export function moveRect(
  start: Rect,
  dCols: number,
  dRows: number,
  layout: LayoutConfig,
): Rect {
  return clampRect({ ...start, x: start.x + dCols, y: start.y + dRows }, layout);
}

/**
 * Resize from one handle.
 *
 * Expressed as four independent edges rather than as x/y/w/h, because the alternative
 * is a thicket of special cases: dragging the west handle east past the east edge has
 * to collapse the widget to its minimum width and stop, not invert it, and the same
 * logic has to hold for every one of the eight handles.
 */
export function resizeRect(
  start: Rect,
  handle: ResizeHandle,
  dCols: number,
  dRows: number,
  layout: LayoutConfig,
  minSize: { w: number; h: number } = { w: 1, h: 1 },
): Rect {
  const minW = Math.min(Math.max(1, minSize.w), layout.columns);
  const minH = Math.min(Math.max(1, minSize.h), layout.rows);

  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;

  // Only the edges this handle owns move, and each is clamped as it is set. Clamping
  // all four afterwards looks tidier and is wrong: dragging the east handle far to the
  // west would drag the untouched west edge along with it.
  if (handle.includes('w')) {
    left = Math.max(0, Math.min(start.x + dCols, right - minW));
  }
  if (handle.includes('e')) {
    right = Math.min(layout.columns, Math.max(start.x + start.w + dCols, left + minW));
  }
  if (handle.includes('n')) {
    top = Math.max(0, Math.min(start.y + dRows, bottom - minH));
  }
  if (handle.includes('s')) {
    bottom = Math.min(layout.rows, Math.max(start.y + start.h + dRows, top + minH));
  }

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * Whether a rect can be dropped where it is.
 *
 * Overlap is refused rather than resolved by pushing neighbours aside. On a canvas
 * that is exactly one viewport there is nowhere to push to — a displaced widget would
 * have to go off the bottom, which does not exist — and silently rearranging widgets
 * the user placed deliberately is the behaviour this project set out not to have.
 */
export function isPlacementValid(
  rect: Rect,
  instanceId: string,
  widgets: readonly WidgetInstance[],
): boolean {
  return !widgets.some(
    (other) => other.instanceId !== instanceId && rectsOverlap(rect, other.rect),
  );
}
