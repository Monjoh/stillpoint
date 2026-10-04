import { lineWidthEm } from '@/lib/fit-text';

/**
 * How big a quote can be in its cell. Unlike the clock, a quote wraps, so `fitTextCss`
 * (one line, in CSS) cannot size it: the size depends on how many lines it breaks into,
 * which depends on the size. Solved here instead, from the frame's content box, which
 * the widget is given as a prop. No measuring, no second render.
 *
 * Pessimistic on purpose, as `lineWidthEm` is: a line breaks at a word, not exactly at
 * the edge, so each line is assumed to be only `FILL` full. Too small is a little less
 * pretty; too big is a clipped quote.
 */

export const LINE_HEIGHT = 1.35;
/** The author line, relative to the quote's size. */
export const AUTHOR_SCALE = 0.7;
const AUTHOR_GAP = 0.6;
const FILL = 0.85;
const MIN_PX = 10;
/** Keep the author if the quote keeps at least this share of its size. */
const KEEP_AUTHOR = 0.8;

export interface QuoteLayout {
  fontSize: number;
  /** Dropped first when the cell is short: the words matter more than the name. */
  showAuthor: boolean;
  /** Lines the quote may use. Past it, the text ends in an ellipsis. */
  maxLines: number;
}

export function layoutQuote(input: {
  text: string;
  hasAuthor: boolean;
  width: number;
  height: number;
  maxPx: number;
}): QuoteLayout {
  const { text, width, height } = input;
  const textEm = lineWidthEm(text);
  const longestWordEm = Math.max(0, ...text.split(/\s+/).map(lineWidthEm));

  const fits = (px: number, withAuthor: boolean) => {
    if (longestWordEm * px > width) return false;
    const lines = Math.ceil((textEm * px) / (width * FILL));
    const author = withAuthor ? (AUTHOR_SCALE * LINE_HEIGHT + AUTHOR_GAP) * px : 0;
    return lines * LINE_HEIGHT * px + author <= height;
  };

  const largest = (withAuthor: boolean): number | null => {
    for (let px = Math.floor(input.maxPx); px >= MIN_PX; px--) {
      if (fits(px, withAuthor)) return px;
    }
    return null;
  };

  const bare = largest(false);
  const credited = input.hasAuthor ? largest(true) : null;
  // The author stays while it costs the quote little. When keeping it would shrink
  // the words much further, the name goes and the words stay readable.
  if (credited !== null && (bare === null || credited >= bare * KEEP_AUTHOR)) {
    return {
      fontSize: credited,
      showAuthor: true,
      maxLines: linesIn(height, credited),
    };
  }
  if (bare !== null) {
    return { fontSize: bare, showAuthor: false, maxLines: linesIn(height, bare) };
  }
  // Too small for the whole quote at any readable size: as much as fits, then "…".
  return { fontSize: MIN_PX, showAuthor: false, maxLines: linesIn(height, MIN_PX) };
}

function linesIn(height: number, px: number): number {
  return Math.max(1, Math.floor(height / (LINE_HEIGHT * px)));
}
