import { describe, expect, it } from 'vitest';
import {
  backgroundContrast,
  contrastRatio,
  MIN_CONTRAST,
  parseColor,
  relativeLuminance,
} from './contrast';
import { getPreset } from './presets';

describe('parseColor', () => {
  it('reads the hex forms', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#11131c')).toEqual({ r: 17, g: 19, b: 28 });
    expect(parseColor('#11131CFF')).toEqual({ r: 17, g: 19, b: 28 });
  });

  it('reads both rgb() spellings', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30 });
    expect(parseColor('rgb(10 20 30)')).toEqual({ r: 10, g: 20, b: 30 });
  });

  // Compositing needs to know what is behind, which is the question being asked.
  // Measuring the colour at full strength is the honest approximation.
  it('discards alpha rather than guessing what is under it', () => {
    expect(parseColor('rgb(242 242 242 / 0.62)')).toEqual({ r: 242, g: 242, b: 242 });
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual({ r: 1, g: 2, b: 3 });
  });

  // A null anywhere means no warning, which is better than a wrong one.
  it('returns null for anything it cannot be sure of', () => {
    expect(parseColor('rebeccapurple')).toBeNull();
    expect(parseColor('color-mix(in srgb, red, blue)')).toBeNull();
    expect(parseColor('linear-gradient(160deg, #000 0%, #fff 100%)')).toBeNull();
    expect(parseColor('#12')).toBeNull();
    expect(parseColor('')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('spans black to white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it('weights green above red above blue, as the eye does', () => {
    const red = relativeLuminance({ r: 255, g: 0, b: 0 });
    const green = relativeLuminance({ r: 0, g: 255, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 });
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe('contrastRatio', () => {
  // The two published anchors: identical colours are 1, black on white is 21.
  it('matches the WCAG endpoints', () => {
    expect(contrastRatio('#808080', '#808080')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('does not care which way round the pair is given', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBe(
      contrastRatio('#fedcba', '#123456'),
    );
  });

  it('returns null when either colour cannot be read', () => {
    expect(contrastRatio('#000', 'papayawhip')).toBeNull();
  });
});

describe('backgroundContrast', () => {
  const midnight = getPreset('midnight').tokens;
  const paper = getPreset('paper').tokens;

  it('measures light text against a dark solid as comfortable', () => {
    const ratio = backgroundContrast(midnight, { kind: 'solid', color: '#11131c' });
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThan(MIN_CONTRAST);
  });

  // The pairing that drove the whole separation: Paper over the default gradient.
  it('catches dark text on a dark background', () => {
    const ratio = backgroundContrast(paper, {
      kind: 'gradient',
      from: '#11131c',
      to: '#1d2033',
      angle: 160,
    });
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(MIN_CONTRAST);
  });

  /**
   * The worst of the two stops, not the average. A ramp from white to black is
   * comfortable at one end and invisible at the other; averaging would call it fine.
   */
  it('judges a gradient by its worse end', () => {
    const ratio = backgroundContrast(midnight, {
      kind: 'gradient',
      from: '#000000',
      to: '#ffffff',
      angle: 160,
    });
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(MIN_CONTRAST);
  });

  // No way to know what a photo looks like behind a given widget — which is exactly
  // why those kinds carry `dim` and `blur` instead.
  it('declines to judge a background it cannot see', () => {
    expect(
      backgroundContrast(midnight, {
        kind: 'image',
        assetId: 'a1',
        fit: 'cover',
        blur: 0,
        dim: 0,
      }),
    ).toBeNull();
    expect(
      backgroundContrast(midnight, {
        kind: 'unsplash',
        query: 'x',
        refresh: 'daily',
        blur: 0,
        dim: 0,
      }),
    ).toBeNull();
  });

  it('declines when the theme has no text colour to measure', () => {
    expect(backgroundContrast({}, { kind: 'solid', color: '#000' })).toBeNull();
  });
});
