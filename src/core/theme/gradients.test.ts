import { describe, expect, it } from 'vitest';
import { backgroundSchema } from '@/core/config/schema';
import { GRADIENT_PRESETS, gradientToBackground, matchGradient } from './gradients';

describe('the curated gradients', () => {
  it('ships ten, each with a unique id', () => {
    expect(GRADIENT_PRESETS).toHaveLength(10);
    const ids = GRADIENT_PRESETS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produces a background the schema accepts', () => {
    for (const preset of GRADIENT_PRESETS) {
      expect(backgroundSchema.safeParse(gradientToBackground(preset)).success).toBe(
        true,
      );
    }
  });

  // The first entry is also the "put it back" button, so it has to be what a fresh
  // install actually has. `defaults.test.ts` owns the other half of this pairing.
  it('leads with the default gradient', () => {
    expect(GRADIENT_PRESETS[0]).toMatchObject({
      from: '#11131c',
      to: '#1d2033',
      angle: 160,
    });
  });
});

describe('matchGradient', () => {
  it('recognises a stored background as the swatch it came from', () => {
    for (const preset of GRADIENT_PRESETS) {
      expect(matchGradient(gradientToBackground(preset))?.id).toBe(preset.id);
    }
  });

  it('ignores the case the colour happens to be written in', () => {
    expect(
      matchGradient({ kind: 'gradient', from: '#11131C', to: '#1D2033', angle: 160 })
        ?.id,
    ).toBe('midnight');
  });

  it('returns nothing for a hand-picked gradient or another kind', () => {
    expect(
      matchGradient({ kind: 'gradient', from: '#abc', to: '#def', angle: 160 }),
    ).toBeUndefined();
    // Same stops, different angle: a different gradient, and the picker should show
    // no swatch selected rather than lie about which one it is.
    expect(
      matchGradient({ kind: 'gradient', from: '#11131c', to: '#1d2033', angle: 20 }),
    ).toBeUndefined();
    expect(matchGradient({ kind: 'solid', color: '#000' })).toBeUndefined();
  });
});
