import { describe, expect, it } from 'vitest';
import { fitTextCss, lineWidthEm } from './fit-text';

describe('lineWidthEm', () => {
  it('charges narrow characters less than digits', () => {
    expect(lineWidthEm(':')).toBeLessThan(lineWidthEm('0'));
  });

  it('grows with the string, so seconds cost width', () => {
    expect(lineWidthEm('23:04:07')).toBeGreaterThan(lineWidthEm('23:04'));
  });

  it('errs high rather than low', () => {
    // Too high means slightly small text. Too low means the clipping this fixes.
    // Inter's tabular digits advance at 0.6em and the clock tightens tracking by
    // 0.02em on top, so the estimate must sit above 0.6 per digit.
    expect(lineWidthEm('0')).toBeGreaterThan(0.6);
  });
});

describe('fitTextCss', () => {
  it('caps at the requested size and at both axes of the cell', () => {
    const css = fitTextCss({ maxPx: 72, text: '23:04' });
    expect(css).toBe('min(calc(72px * var(--sp-scale, 1)), 90cqh, 35.97cqw)');
  });

  it('allows less width when the string is longer', () => {
    const short = fitTextCss({ maxPx: 72, text: '23:04' });
    const long = fitTextCss({ maxPx: 72, text: '11:04:07 PM' });
    const cqw = (css: string) => Number(/([\d.]+)cqw/.exec(css)?.[1]);
    expect(cqw(long)).toBeLessThan(cqw(short));
  });

  it('scales the requested size but never the cell bounds', () => {
    // --sp-scale is the accessibility lever. It raises what the user asked for; it
    // cannot make text overflow the cell it lives in.
    const css = fitTextCss({ maxPx: 72, text: '23:04' });
    expect(css).toContain('var(--sp-scale, 1)');
    expect(css).not.toMatch(/--sp-scale[^)]*\)\s*,\s*[\d.]+cqh/);
    expect(css).toMatch(/,\s*90cqh/);
  });

  it('can opt out of scaling', () => {
    expect(fitTextCss({ maxPx: 40, text: 'x', scaled: false })).toContain('40px,');
  });

  it('does not divide by zero on empty text', () => {
    expect(fitTextCss({ maxPx: 72, text: '' })).toMatch(/\d+cqw\)$/);
  });
});
