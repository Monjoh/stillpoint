import { describe, expect, it } from 'vitest';
import { colorAlpha, colorToHex, withAlpha } from './color';

describe('colorAlpha', () => {
  it('reads both rgb() syntaxes', () => {
    expect(colorAlpha('rgb(255 255 255 / 0.06)')).toBe(0.06);
    expect(colorAlpha('rgba(0, 0, 0, 0.5)')).toBe(0.5);
    expect(colorAlpha('rgb(0 0 0 / 40%)')).toBe(0.4);
  });

  it('reads hex alpha', () => {
    expect(colorAlpha('#00000080')).toBeCloseTo(0.502, 3);
    expect(colorAlpha('#0008')).toBeCloseTo(0.533, 3);
  });

  it('calls everything else opaque', () => {
    expect(colorAlpha('#7aa2f7')).toBe(1);
    expect(colorAlpha('rgb(1 2 3)')).toBe(1);
    expect(colorAlpha('rebeccapurple')).toBe(1);
  });
});

describe('colorToHex', () => {
  it('converts what the presets are written in', () => {
    expect(colorToHex('rgb(242 242 242 / 0.62)')).toBe('#f2f2f2');
    expect(colorToHex('#FFF')).toBe('#ffffff');
  });

  it('returns null for what it cannot read', () => {
    expect(colorToHex('color-mix(in srgb, red, blue)')).toBeNull();
    expect(colorToHex('#12')).toBeNull();
  });
});

describe('withAlpha', () => {
  it('keeps an opaque pick as hex', () => {
    expect(withAlpha('#FF8800', 1)).toBe('#ff8800');
  });

  it('keeps the old opacity on a translucent pick', () => {
    expect(withAlpha('#ff8800', 0.06)).toBe('rgb(255 136 0 / 0.06)');
  });
});
