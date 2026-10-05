/**
 * Sizes the watchlist from the cell, the way the quote and the weather do: the grid
 * is relative, so the cell is whatever the window makes it.
 *
 * In order of preference: every row with its change at a comfortable size; every row
 * without the change; then the rows that fit, at a size still worth reading. Text
 * does not shrink below half the size asked for before a part is dropped.
 */

export interface StocksLayout {
  fontPx: number;
  /** How many of the watchlist's rows fit, from the top. */
  rows: number;
  showChange: boolean;
}

export const LINE_HEIGHT = 1.6;
/** Average glyph advance in em, for tabular figures and short symbols. */
const CHAR_EM = 0.6;
/** Between columns. */
const GAP_EM = 1;
const MIN_PX = 10;

export function layoutStocks(input: {
  count: number;
  width: number;
  height: number;
  maxPx: number;
  /** The longest of each column, in characters. */
  labelChars: number;
  priceChars: number;
  changeChars: number;
}): StocksLayout {
  const { width, height, maxPx } = input;
  const count = Math.max(1, input.count);
  const floor = Math.max(MIN_PX, Math.min(maxPx, maxPx * 0.5));

  const widthEm = (withChange: boolean) =>
    (input.labelChars + input.priceChars + (withChange ? input.changeChars : 0)) *
      CHAR_EM +
    GAP_EM * (withChange ? 2 : 1);
  const byWidth = (withChange: boolean) => width / widthEm(withChange);

  for (const showChange of [true, false]) {
    const size = Math.min(maxPx, byWidth(showChange), height / (count * LINE_HEIGHT));
    if (size >= floor) return { fontPx: Math.floor(size), rows: count, showChange };
  }

  // Not all of them: keep the size and show as many rows as fit.
  const showChange = Math.min(maxPx, byWidth(true)) >= floor;
  let size = Math.min(maxPx, byWidth(showChange), floor);
  let rows = Math.floor(height / (size * LINE_HEIGHT));
  if (rows < 1) {
    size = Math.min(size, height / LINE_HEIGHT);
    rows = 1;
  }
  return {
    fontPx: Math.max(MIN_PX, Math.floor(size)),
    rows: Math.min(count, rows),
    showChange,
  };
}
