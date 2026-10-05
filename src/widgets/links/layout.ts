/**
 * How many links fit in the cell, and how big. Solved from the frame's content box
 * (the `size` prop), as the quote is: the answer depends on how the items wrap.
 *
 * Every column count is tried and the one with the largest icon wins. When the cell
 * is too small, parts are dropped rather than squeezed (docs/07-widget-design.md):
 * first the names under tiles, then the links that do not fit.
 */

export type LinksMode = 'tiles' | 'icons' | 'list';

export interface LinksLayout {
  mode: LinksMode;
  columns: number;
  /** Icon edge in px. */
  icon: number;
  /** How many links are shown, from the top. */
  visible: number;
}

/** A tile's footprint, in multiples of its icon size. */
export const FOOTPRINT: Record<LinksMode, { w: number; h: number }> = {
  tiles: { w: 2, h: 2 },
  icons: { w: 1.5, h: 1.5 },
  list: { w: 8, h: 1.6 },
};

export const MIN_ICON = 16;
/** Below this, a name under a tile is too small to read: drop the names. */
const MIN_TILE_ICON = 28;
/** A list row's icon is a little smaller than a tile's at the same setting. */
export const LIST_SCALE = 0.6;

export function layoutLinks(input: {
  count: number;
  width: number;
  height: number;
  mode: LinksMode;
  maxPx: number;
}): LinksLayout {
  const { count, width, height } = input;
  if (count === 0) return { mode: input.mode, columns: 1, icon: 0, visible: 0 };

  const maxPx = input.mode === 'list' ? input.maxPx * LIST_SCALE : input.maxPx;
  const best = largest(count, width, height, FOOTPRINT[input.mode], maxPx);

  if (input.mode === 'tiles' && best.icon < MIN_TILE_ICON) {
    return layoutLinks({ ...input, mode: 'icons' });
  }
  if (best.icon >= MIN_ICON) return { mode: input.mode, ...best, visible: count };

  // Not everything fits at a usable size: as many as fit, at the smallest one.
  const { w, h } = FOOTPRINT[input.mode];
  const columns = Math.max(1, Math.min(count, Math.floor(width / (MIN_ICON * w))));
  const rows = Math.max(1, Math.floor(height / (MIN_ICON * h)));
  return {
    mode: input.mode,
    columns,
    icon: MIN_ICON,
    visible: Math.min(count, columns * rows),
  };
}

function largest(
  count: number,
  width: number,
  height: number,
  footprint: { w: number; h: number },
  maxPx: number,
): { columns: number; icon: number } {
  let best = { columns: 1, icon: 0 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const icon = Math.floor(
      Math.min(maxPx, width / (columns * footprint.w), height / (rows * footprint.h)),
    );
    // On a tie, more columns: at the same size, a row reads better than a block.
    if (icon >= best.icon) best = { columns, icon };
  }
  return best;
}
