import { FOOTPRINT, LIST_SCALE, MIN_ICON, type LinksMode } from './layout';

/**
 * The size and place of an open folder. It is computed rather than measured: the
 * popover is positioned in the click that opens it, before it is drawn, so the first
 * frame is already in the right place.
 *
 * The folder sits outside the widget's cell, so it isn't bound by it. It is bound by
 * the window, and it never scrolls: when the links don't fit at the widget's icon
 * size, the icons shrink.
 */

/** Phone folders are three or four across; past that a folder reads as a page. */
const MAX_COLUMNS = 4;
/** Space between the window's edge and the folder, and between it and its tile. */
export const MARGIN = 8;
/** Padding inside the folder, in icons. */
const PADDING = 0.5;

export interface FolderBox {
  mode: LinksMode;
  columns: number;
  /** Icon edge in px. */
  icon: number;
  width: number;
  height: number;
}

export function folderBox(input: {
  count: number;
  /** The widget's own layout. Icons stay icons; tiles stay tiles. */
  mode: LinksMode;
  maxPx: number;
  viewport: { width: number; height: number };
}): FolderBox {
  const { mode } = input;
  const columns = mode === 'list' ? 1 : Math.min(input.count, MAX_COLUMNS);
  const rows = Math.ceil(input.count / columns);
  const { w, h } = FOOTPRINT[mode];
  // In icons: the grid, plus padding on both sides.
  const across = columns * w + 2 * PADDING;
  const down = rows * h + 2 * PADDING;

  const room = {
    width: input.viewport.width - 2 * MARGIN,
    height: input.viewport.height - 2 * MARGIN,
  };
  const maxPx = mode === 'list' ? input.maxPx * LIST_SCALE : input.maxPx;
  const icon = Math.max(
    MIN_ICON,
    Math.floor(Math.min(maxPx, room.width / across, room.height / down)),
  );
  return {
    mode,
    columns,
    icon,
    width: Math.round(icon * across),
    height: Math.round(icon * down),
  };
}

/**
 * Below the folder's tile, or above it when there isn't room below, centred on it
 * and kept inside the window. Over the tile when there is room on neither side.
 */
export function placeFolder(
  tile: { left: number; top: number; right: number; bottom: number },
  box: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const clamp = (value: number, max: number) =>
    Math.max(MARGIN, Math.min(value, max - MARGIN));

  const centre = (tile.left + tile.right) / 2;
  const left = clamp(centre - box.width / 2, viewport.width - box.width);

  const below = tile.bottom + MARGIN;
  const above = tile.top - MARGIN - box.height;
  const top =
    below + box.height <= viewport.height - MARGIN
      ? below
      : above >= MARGIN
        ? above
        : clamp(
            (tile.top + tile.bottom) / 2 - box.height / 2,
            viewport.height - box.height,
          );

  return { left: Math.round(left), top: Math.round(top) };
}
