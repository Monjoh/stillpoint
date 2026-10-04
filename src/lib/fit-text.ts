/**
 * A `font-size` value for a single line of text that is never wider or taller than the
 * widget's cell.
 *
 * Why this exists: the grid is relative on both axes, so a widget's pixel size changes
 * whenever the window does, even though the user never touched the widget. A font size
 * stored in pixels therefore has to be an *upper bound*, not an absolute — otherwise
 * the first narrow window clips the text, which is exactly the bug this was written
 * for.
 *
 * It is done in CSS with container query units rather than by measuring in JavaScript.
 * Measuring means render, measure, re-render: two passes, a visible flash of the wrong
 * size, and a `ResizeObserver` per widget on the page that opens most often. `cqw` and
 * `cqh` resolve against the frame's content box in the same layout pass, for free.
 * The frame opts in with `container-type: size` — without that the units resolve
 * against the small viewport and the result is wrong rather than merely imprecise.
 *
 * The width bound needs to know how wide the line is in `em`, which means estimating
 * from the characters. The estimate deliberately runs a little high: too high means
 * slightly smaller text, too low means the clipping we are fixing.
 */

/** Advance widths in `em`, for the proportions of Inter and the usual system UI faces. */
const NARROW_CHARS: Record<string, number> = {
  ':': 0.3,
  '.': 0.3,
  ',': 0.3,
  "'": 0.26,
  ' ': 0.26,
  ' ': 0.26, // narrow no-break space — Intl puts one before the meridiem
  ' ': 0.26,
};

const DEFAULT_CHAR_EM = 0.62;

export function lineWidthEm(text: string): number {
  let em = 0;
  for (const char of text) em += NARROW_CHARS[char] ?? DEFAULT_CHAR_EM;
  return em;
}

export interface FitTextOptions {
  /** The size the user asked for, in px. Never exceeded. */
  maxPx: number;
  /** The text that has to fit on one line. */
  text: string;
  /** Share of the container's height one line may take. */
  heightRatio?: number;
  /** Share of the container's width one line may take. */
  widthRatio?: number;
}

export function fitTextCss({
  maxPx,
  text,
  heightRatio = 0.9,
  widthRatio = 1,
}: FitTextOptions): string {
  const byHeight = round(100 * heightRatio);
  const byWidth = round((100 * widthRatio) / Math.max(0.1, lineWidthEm(text)));

  return `min(${maxPx}px, ${byHeight}cqh, ${byWidth}cqw)`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
