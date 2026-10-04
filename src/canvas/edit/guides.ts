import type { LayoutConfig, Rect, WidgetInstance } from '@/core/config/schema';

/**
 * Alignment guides, in grid cells.
 *
 * They appear only while something is being dragged, together with the grid dots, and
 * vanish with them. A permanent grid overlay is noise; a line that shows up at the
 * moment two edges agree is information.
 *
 * Computed against the canvas centre and against the other widgets' edges and centres,
 * because those are the alignments people actually reach for: "centred on the page",
 * "left edge matching that one", "same middle as the thing above".
 */

export interface Guide {
  /** `'x'` is a vertical line at a column offset; `'y'` is horizontal at a row offset. */
  axis: 'x' | 'y';
  /** Position in grid cells, measured from the canvas origin. Can be a half cell. */
  at: number;
  /** What the line refers to, which decides how prominently it is drawn. */
  kind: 'canvas' | 'widget';
}

/** Edges and centre of a rect on one axis. A centre can land on a half cell. */
function marks(rect: Rect, axis: 'x' | 'y'): number[] {
  const start = axis === 'x' ? rect.x : rect.y;
  const size = axis === 'x' ? rect.w : rect.h;
  return [start, start + size / 2, start + size];
}

export function alignmentGuides(
  rect: Rect,
  others: readonly WidgetInstance[],
  layout: LayoutConfig,
  draggedId?: string,
): Guide[] {
  const found = new Map<string, Guide>();

  for (const axis of ['x', 'y'] as const) {
    const mine = marks(rect, axis);
    const centre = (axis === 'x' ? layout.columns : layout.rows) / 2;

    if (mine.includes(centre)) {
      found.set(`${axis}:${centre}`, { axis, at: centre, kind: 'canvas' });
    }

    for (const other of others) {
      if (other.instanceId === draggedId) continue;
      for (const mark of marks(other.rect, axis)) {
        if (!mine.includes(mark)) continue;
        // A canvas-centre line already claimed here stays: it is the stronger hint.
        const key = `${axis}:${mark}`;
        if (!found.has(key)) found.set(key, { axis, at: mark, kind: 'widget' });
      }
    }
  }

  return [...found.values()];
}
