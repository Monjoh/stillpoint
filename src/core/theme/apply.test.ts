import { beforeEach, describe, expect, it } from 'vitest';
import { configSchema } from '@/core/config/schema';
import fixtureV2 from '@/core/config/__fixtures__/config-v2.json';
import { backgroundToCss } from './background';
import { applyCanvasTokens, isThemeableToken, profileToPaint } from './apply';
import { getPreset } from './presets';
import { THEME_TOKEN_NAMES } from './tokens';

describe('backgroundToCss', () => {
  it('renders a solid colour', () => {
    expect(backgroundToCss({ kind: 'solid', color: '#123456' })).toBe('#123456');
  });

  it('renders a gradient with its angle', () => {
    expect(
      backgroundToCss({ kind: 'gradient', from: '#000', to: '#fff', angle: 90 }),
    ).toBe('linear-gradient(90deg, #000 0%, #fff 100%)');
  });

  it('returns null for kinds that need an asset, so the caller keeps the default', () => {
    expect(
      backgroundToCss({ kind: 'image', assetId: 'a1', fit: 'cover', blur: 0, dim: 0 }),
    ).toBeNull();
    expect(
      backgroundToCss({
        kind: 'unsplash',
        query: 'x',
        refresh: 'daily',
        blur: 0,
        dim: 0,
      }),
    ).toBeNull();
  });
});

describe('isThemeableToken', () => {
  it('allows canvas tokens and refuses tool chrome', () => {
    expect(isThemeableToken('--sp-accent')).toBe(true);
    expect(isThemeableToken('--sp-ui-accent')).toBe(false);
    expect(isThemeableToken('--other')).toBe(false);
    expect(isThemeableToken('color')).toBe(false);
  });
});

describe('applyCanvasTokens', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
  });

  it('writes background and grid geometry', () => {
    const config = configSchema.parse(fixtureV2);
    applyCanvasTokens(profileToPaint(config.profiles[0]!), root);

    expect(root.style.getPropertyValue('--sp-background')).toBe(
      'linear-gradient(160deg, #11131c 0%, #1d2033 100%)',
    );
    expect(root.style.getPropertyValue('--sp-grid-cols')).toBe('24');
    expect(root.style.getPropertyValue('--sp-grid-rows')).toBe('12');
    expect(root.style.getPropertyValue('--sp-grid-gap')).toBe('12px');
    expect(root.style.getPropertyValue('--sp-canvas-max-width')).toBe('1600px');
  });

  it('writes `none` for an uncapped canvas width', () => {
    const config = configSchema.parse(fixtureV2);
    applyCanvasTokens(profileToPaint(config.profiles[1]!), root);
    expect(root.style.getPropertyValue('--sp-canvas-max-width')).toBe('none');
  });

  it('applies canvas overrides', () => {
    const config = configSchema.parse(fixtureV2);
    applyCanvasTokens(profileToPaint(config.profiles[0]!), root);
    expect(root.style.getPropertyValue('--sp-accent')).toBe('#ff8800');
  });

  it('refuses overrides that would restyle the tool chrome', () => {
    applyCanvasTokens(
      {
        background: { kind: 'solid', color: '#000' },
        layout: { columns: 24, rows: 12, gap: 12, maxWidth: null },
        preset: 'midnight',
        overrides: { '--sp-ui-bg': '#ff00ff', '--sp-ui-text': '#ff00ff' },
      },
      root,
    );

    expect(root.style.getPropertyValue('--sp-ui-bg')).toBe('');
    expect(root.style.getPropertyValue('--sp-ui-text')).toBe('');
  });

  it('leaves the background token alone when the kind cannot be painted yet', () => {
    root.style.setProperty('--sp-background', 'the-default');
    applyCanvasTokens(
      {
        background: { kind: 'image', assetId: 'a1', fit: 'cover', blur: 0, dim: 0 },
        layout: { columns: 24, rows: 12, gap: 12, maxWidth: null },
        preset: 'midnight',
        overrides: {},
      },
      root,
    );
    expect(root.style.getPropertyValue('--sp-background')).toBe('the-default');
  });

  it('paints a resolved photograph and writes its blur', () => {
    applyCanvasTokens(
      {
        background: { kind: 'image', assetId: 'a1', fit: 'cover', blur: 8, dim: 0 },
        layout: { columns: 24, rows: 12, gap: 12, maxWidth: null },
        preset: 'midnight',
        overrides: {},
        image: {
          color: '#336699',
          thumb: 'data:image/jpeg;base64,AA==',
          url: 'blob:x',
        },
      },
      root,
    );
    expect(root.style.getPropertyValue('--sp-background')).toContain('url("blob:x")');
    expect(root.style.getPropertyValue('--sp-background-blur')).toBe('8px');
  });

  // With nothing downloaded yet, an Unsplash background waits rather than painting
  // something wrong: the last background stays until the first photo arrives.
  it('keeps what is on screen until an Unsplash photo is in', () => {
    root.style.setProperty('--sp-background', 'url("blob:old-photo")');
    const config = configSchema.parse(fixtureV2);
    const profile = {
      ...config.profiles[0]!,
      background: {
        kind: 'unsplash' as const,
        query: 'x',
        refresh: 'daily' as const,
        blur: 10,
        dim: 0,
      },
    };
    applyCanvasTokens(profileToPaint(profile), root);
    expect(root.style.getPropertyValue('--sp-background')).toBe(
      'url("blob:old-photo")',
    );
    expect(root.style.getPropertyValue('--sp-background-blur')).toBe('0px');
  });

  // Always written, so the sweep never leaves a photo's blur on the gradient after it.
  it('writes a zero blur for a background that is not a photo', () => {
    const config = configSchema.parse(fixtureV2);
    applyCanvasTokens(profileToPaint(config.profiles[0]!), root);
    expect(root.style.getPropertyValue('--sp-background-blur')).toBe('0px');
  });
});

describe('presets', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
  });

  const paint = (preset: string, overrides: Record<string, string> = {}) => ({
    background: { kind: 'solid' as const, color: '#000' },
    layout: { columns: 24, rows: 12, gap: 12, maxWidth: null },
    preset,
    overrides,
  });

  it('writes every token of the chosen preset', () => {
    applyCanvasTokens(paint('terminal'), root);
    for (const token of THEME_TOKEN_NAMES) {
      expect(root.style.getPropertyValue(token)).toBe(
        getPreset('terminal').tokens[token],
      );
    }
  });

  it('lets an override win over the preset it sits on', () => {
    applyCanvasTokens(paint('midnight', { '--sp-accent': '#ff8800' }), root);
    expect(root.style.getPropertyValue('--sp-accent')).toBe('#ff8800');
    // and leaves the rest of the preset intact
    expect(root.style.getPropertyValue('--sp-text')).toBe('#f2f2f2');
  });

  /**
   * The bug this pair of mechanisms exists to prevent: Terminal has square corners
   * and no shadow, and `setProperty` is not undone by a later theme that simply does
   * not mention the token.
   */
  it('does not leak a token from the theme that was on before', () => {
    applyCanvasTokens(paint('terminal'), root);
    expect(root.style.getPropertyValue('--sp-radius')).toBe('0px');

    applyCanvasTokens(paint('midnight'), root);
    expect(root.style.getPropertyValue('--sp-radius')).toBe('10px');
    expect(root.style.getPropertyValue('--sp-shadow')).toBe(
      '0 2px 20px rgb(0 0 0 / 0.25)',
    );
  });

  // Same mechanism, the case a user actually hits: set a custom accent, change your
  // mind, clear it. Without the sweep the old accent is inline on :root forever.
  it('drops an override that has been removed', () => {
    applyCanvasTokens(paint('midnight', { '--sp-accent': '#ff8800' }), root);
    applyCanvasTokens(paint('midnight'), root);
    expect(root.style.getPropertyValue('--sp-accent')).toBe('#7aa2f7');
  });

  it('sweeps away a token no preset defines, falling back to the stylesheet', () => {
    applyCanvasTokens(paint('midnight', { '--sp-space-2': '40px' }), root);
    expect(root.style.getPropertyValue('--sp-space-2')).toBe('40px');

    applyCanvasTokens(paint('midnight'), root);
    expect(root.style.getPropertyValue('--sp-space-2')).toBe('');
  });

  // The sweep must not reach the tool chrome: the panel is not the user's to restyle,
  // and it is also not ours to clear out from under whoever did set it.
  it('leaves tool chrome properties untouched', () => {
    root.style.setProperty('--sp-ui-bg', '#123456');
    applyCanvasTokens(paint('midnight'), root);
    expect(root.style.getPropertyValue('--sp-ui-bg')).toBe('#123456');
  });

  it('paints an unknown preset as the default rather than as nothing', () => {
    applyCanvasTokens(paint('from-the-future'), root);
    expect(root.style.getPropertyValue('--sp-text')).toBe('#f2f2f2');
  });
});
