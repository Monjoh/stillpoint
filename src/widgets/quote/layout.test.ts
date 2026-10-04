import { describe, expect, it } from 'vitest';
import { layoutQuote, LINE_HEIGHT } from './layout';
import { QUOTES } from './quotes';

const short = 'Forever is composed of nows.';
const long = QUOTES.reduce((a, b) => (b.text.length > a.text.length ? b : a)).text;

describe('layoutQuote', () => {
  it('uses the size asked for when there is room', () => {
    const layout = layoutQuote({
      text: short,
      hasAuthor: true,
      width: 600,
      height: 200,
      maxPx: 24,
    });
    expect(layout).toMatchObject({ fontSize: 24, showAuthor: true });
  });

  it('shrinks a long quote rather than clipping it', () => {
    const layout = layoutQuote({
      text: long,
      hasAuthor: true,
      width: 400,
      height: 120,
      maxPx: 24,
    });
    expect(layout.fontSize).toBeLessThan(24);
    expect(layout.fontSize).toBeGreaterThanOrEqual(10);
    expect(layout.maxLines * LINE_HEIGHT * layout.fontSize).toBeLessThanOrEqual(120);
  });

  it('drops the author before the text gets unreadably small', () => {
    const withRoom = layoutQuote({
      text: short,
      hasAuthor: true,
      width: 600,
      height: 30,
      maxPx: 24,
    });
    expect(withRoom.showAuthor).toBe(false);
    expect(withRoom.fontSize).toBeGreaterThan(10);
  });

  it('never makes a word wider than the cell', () => {
    const layout = layoutQuote({
      text: 'Incomprehensibilities',
      hasAuthor: false,
      width: 120,
      height: 400,
      maxPx: 64,
    });
    expect(layout.fontSize).toBeLessThan(12);
  });

  it('falls back to the smallest size and an ellipsis in a tiny cell', () => {
    const layout = layoutQuote({
      text: long,
      hasAuthor: true,
      width: 80,
      height: 20,
      maxPx: 24,
    });
    expect(layout).toEqual({ fontSize: 10, showAuthor: false, maxLines: 1 });
  });

  it('never exceeds the size asked for, however large the cell', () => {
    const layout = layoutQuote({
      text: short,
      hasAuthor: true,
      width: 3000,
      height: 2000,
      maxPx: 40,
    });
    expect(layout.fontSize).toBe(40);
  });
});
