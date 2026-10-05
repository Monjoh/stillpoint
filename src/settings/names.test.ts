import { describe, expect, it } from 'vitest';
import { GRADIENT_PRESETS } from '@/core/theme/gradients';
import { THEME_PRESETS } from '@/core/theme/presets';
import { THEME_TOKENS } from '@/core/theme/tokens';
import { FONT_STACKS } from './fonts';
import {
  fontName,
  gradientName,
  presetDescription,
  presetName,
  tokenHelp,
  tokenLabel,
} from './names';

/**
 * The compiler cannot check these keys: they are built from ids in the data. This
 * does instead, so a new preset, gradient, token or font without a string in
 * src/locales/en.yml fails here and not as a blank swatch.
 */
describe('display names', () => {
  it('names and describes every theme preset', () => {
    for (const { id } of THEME_PRESETS) {
      expect(presetName(id), id).not.toBe('');
      expect(presetDescription(id), id).not.toBe('');
    }
    expect(presetName('paper')).toBe('Paper');
  });

  it('names every gradient', () => {
    for (const { id } of GRADIENT_PRESETS) expect(gradientName(id), id).not.toBe('');
  });

  it('labels every token, and helps where there is help', () => {
    for (const { token } of THEME_TOKENS) expect(tokenLabel(token), token).not.toBe('');
    expect(tokenLabel('--sp-text-muted')).toBe('Muted text');
    expect(tokenHelp('--sp-text-muted')).toMatch(/Secondary lines/);
    expect(tokenHelp('--sp-accent')).toBeUndefined();
  });

  it('names every font stack', () => {
    for (const { id } of FONT_STACKS) expect(fontName(id), id).not.toBe('');
  });
});
