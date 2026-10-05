import { lineWidthEm } from '@/lib/fit-text';

/**
 * How World clocks fills its cell: one row per city (label left, time right), or one
 * column each (label, time, difference, stacked), whichever lets the time be larger.
 * A tall cell gets rows, a wide short one columns, without a setting to choose.
 *
 * The time's size is returned as CSS in container units, so it follows the cell in
 * the same layout pass, as `fitTextCss` does. The label and difference are fractions
 * of it (`LABEL`, `DIFF`), set in the stylesheet from `--time`.
 */

/** The label's size, and the difference line's, as a share of the time's. */
export const LABEL = 0.42;
export const DIFF = 0.32;

/** Below this the difference line can't be read, and is dropped first. */
const MIN_DIFF_PX = 9;

/** Long labels end in an ellipsis rather than shrink every row to fit one. */
const LABEL_EM_CAP = lineWidthEm('Los Angeles');

export interface WorldClocksLayout {
  direction: 'rows' | 'columns';
  /** `font-size` for the times. */
  timeSize: string;
  showDifference: boolean;
}

export function worldClocksLayout(input: {
  size: { width: number; height: number };
  count: number;
  /** The longest time on show, e.g. "11:04 PM". */
  time: string;
  /** The longest label. */
  label: string;
  maxPx: number;
  wantDifference: boolean;
}): WorldClocksLayout {
  const n = Math.max(1, input.count);
  const timeEm = lineWidthEm(input.time);
  const labelEm = Math.min(lineWidthEm(input.label), LABEL_EM_CAP) * LABEL;

  // Shares of the cell, as percentages, for each arrangement.
  // Rows: the time takes most of a row's height; label and time share its width.
  const rows = { cqh: 70 / n, cqw: 88 / (timeEm + labelEm + 0.5) };
  // Columns: label, time and difference stacked; each column a share of the width.
  const columns = {
    cqh: 100 / ((1 + LABEL + DIFF) * 1.2),
    cqw: 90 / n / Math.max(timeEm, labelEm),
  };

  const px = (shares: { cqh: number; cqw: number }) =>
    Math.min(
      input.maxPx,
      (shares.cqh * input.size.height) / 100,
      (shares.cqw * input.size.width) / 100,
    );

  const direction = n > 1 && px(columns) > px(rows) ? 'columns' : 'rows';
  const shares = direction === 'rows' ? rows : columns;

  return {
    direction,
    timeSize: `min(${input.maxPx}px, ${round(shares.cqh)}cqh, ${round(shares.cqw)}cqw)`,
    showDifference: input.wantDifference && px(shares) * DIFF >= MIN_DIFF_PX,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
