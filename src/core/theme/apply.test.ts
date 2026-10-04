import { beforeEach, describe, expect, it } from 'vitest';
import { configSchema } from '@/core/config/schema';
import fixtureV1 from '@/core/config/__fixtures__/config-v1.json';
import { backgroundToCss } from './background';
import { applyCanvasTokens, isThemeableToken, profileToPaint } from './apply';

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

  it('writes background, grid geometry and scale', () => {
    const config = configSchema.parse(fixtureV1);
    applyCanvasTokens(profileToPaint(config.profiles[0]!), root);

    expect(root.style.getPropertyValue('--sp-background')).toBe(
      'linear-gradient(160deg, #11131c 0%, #1d2033 100%)',
    );
    expect(root.style.getPropertyValue('--sp-grid-cols')).toBe('24');
    expect(root.style.getPropertyValue('--sp-grid-rows')).toBe('12');
    expect(root.style.getPropertyValue('--sp-grid-gap')).toBe('12px');
    expect(root.style.getPropertyValue('--sp-canvas-max-width')).toBe('1600px');
    expect(root.style.getPropertyValue('--sp-scale')).toBe('1.2');
  });

  it('writes `none` for an uncapped canvas width', () => {
    const config = configSchema.parse(fixtureV1);
    applyCanvasTokens(profileToPaint(config.profiles[1]!), root);
    expect(root.style.getPropertyValue('--sp-canvas-max-width')).toBe('none');
  });

  it('applies canvas overrides', () => {
    const config = configSchema.parse(fixtureV1);
    applyCanvasTokens(profileToPaint(config.profiles[0]!), root);
    expect(root.style.getPropertyValue('--sp-accent')).toBe('#ff8800');
  });

  it('refuses overrides that would restyle the tool chrome', () => {
    applyCanvasTokens(
      {
        background: { kind: 'solid', color: '#000' },
        layout: { columns: 24, rows: 12, gap: 12, maxWidth: null },
        fontScale: 1,
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
        fontScale: 1,
        overrides: {},
      },
      root,
    );
    expect(root.style.getPropertyValue('--sp-background')).toBe('the-default');
  });
});
