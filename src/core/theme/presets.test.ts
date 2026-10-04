import { describe, expect, it } from 'vitest';
import { backgroundSchema } from '@/core/config/schema';
import { DEFAULT_PRESET_ID, getPreset, presetTokens, THEME_PRESETS } from './presets';
import { isThemeableToken, THEME_TOKEN_NAMES } from './tokens';

describe('the built-in presets', () => {
  it('ships the four the design system names', () => {
    expect(THEME_PRESETS.map((p) => p.id)).toEqual([
      'midnight',
      'paper',
      'terminal',
      'glass',
    ]);
  });

  it('has a unique id and a non-empty name and description for each', () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of THEME_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });

  /**
   * The load-bearing one. `applyCanvasTokens` writes to `:root`'s inline style, and
   * an inline property is not cleared by the next theme failing to mention it. A
   * preset missing `--sp-radius` would inherit the previous theme's corners — so
   * every preset defines every token, and the sweep in `apply.ts` is the second half
   * of the same guarantee.
   */
  it('defines every themeable token, with nothing extra', () => {
    for (const preset of THEME_PRESETS) {
      expect(Object.keys(preset.tokens).sort()).toEqual([...THEME_TOKEN_NAMES].sort());
    }
  });

  it('sets only tokens a theme is allowed to set', () => {
    for (const preset of THEME_PRESETS) {
      for (const token of Object.keys(preset.tokens)) {
        expect(isThemeableToken(token)).toBe(true);
      }
    }
  });

  it('suggests a background the schema accepts', () => {
    for (const preset of THEME_PRESETS) {
      expect(backgroundSchema.safeParse(preset.suggestedBackground).success).toBe(true);
    }
  });

  /**
   * Nothing on the newtab critical path may hit the network, and a webfont is a
   * request in front of the first pixel. Every stack must therefore end in a generic
   * family the machine can always satisfy.
   */
  it('names no font it would have to download', () => {
    const generic = /(^|,)\s*(system-ui|sans-serif|serif|monospace|ui-monospace)\s*$/;
    for (const preset of THEME_PRESETS) {
      for (const key of ['--sp-font-display', '--sp-font-body', '--sp-font-mono']) {
        expect(preset.tokens[key]).toMatch(generic);
      }
    }
  });

  // Paper is dark text. Picked over the default near-black gradient it produces an
  // unreadable page, which is why a suggestion exists at all.
  it('gives the light themes a light background to suggest', () => {
    const paper = getPreset('paper');
    expect(paper.suggestedBackground.kind).toBe('gradient');
    expect(paper.tokens['--sp-text']).toBe('#23201c');
  });
});

describe('getPreset', () => {
  it('finds a preset by id', () => {
    expect(getPreset('terminal').name).toBe('Terminal');
  });

  // `themeSchema.preset` is a bare string, so an unknown id is an ordinary thing to
  // be handed — by a profile exported from a later version, or a theme since removed.
  it('falls back to the default rather than throwing on an unknown id', () => {
    expect(getPreset('no-such-theme').id).toBe(DEFAULT_PRESET_ID);
    expect(getPreset('').id).toBe(DEFAULT_PRESET_ID);
  });

  it('exposes the same tokens through presetTokens', () => {
    expect(presetTokens('glass')).toEqual(getPreset('glass').tokens);
  });
});
