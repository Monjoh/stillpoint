import { describe, expect, it } from 'vitest';
import type { BackgroundConfig } from '@/core/config/schema';
import { backgroundBlur, backgroundToCss } from './background';

const photo: BackgroundConfig = {
  kind: 'image',
  assetId: 'a',
  fit: 'cover',
  blur: 0,
  dim: 0,
};
const preview = { color: '#336699', thumb: 'data:image/jpeg;base64,AA==' };

describe('backgroundToCss — images', () => {
  // Null means "keep what is on screen", which is the only safe answer for a photo
  // nobody has read yet.
  it('cannot paint a photograph it has no pixels for', () => {
    expect(backgroundToCss(photo)).toBeNull();
  });

  it('paints the preview over the average colour before the photograph arrives', () => {
    expect(backgroundToCss(photo, preview)).toBe(
      'url("data:image/jpeg;base64,AA==") center / cover no-repeat, #336699',
    );
  });

  it('puts the photograph above its preview, in the chosen fit', () => {
    const css = backgroundToCss(
      { ...photo, fit: 'contain' },
      { ...preview, url: 'blob:x' },
    );
    expect(css).toBe(
      'url("blob:x") center / contain no-repeat, url("data:image/jpeg;base64,AA==") center / cover no-repeat, #336699',
    );
  });

  // A layer, so the boot paint on `body` is dimmed too and the first frame matches.
  it('dims with a translucent layer on top of everything', () => {
    const css = backgroundToCss({ ...photo, dim: 0.4 }, preview)!;
    expect(
      css.startsWith('linear-gradient(rgb(0 0 0 / 0.4), rgb(0 0 0 / 0.4)), url('),
    ).toBe(true);
  });
});

describe('backgroundBlur', () => {
  it('is the photo’s blur, and zero for everything that is not a photo', () => {
    expect(backgroundBlur({ ...photo, blur: 12 })).toBe(12);
    expect(
      backgroundBlur({
        kind: 'unsplash',
        source: 'unsplash',
        query: 'x',
        refresh: 'daily',
        blur: 9,
        dim: 0,
      }),
    ).toBe(9);
    expect(backgroundBlur({ kind: 'solid', color: '#000' })).toBe(0);
  });

  // Its blur belongs to the photo, not to whatever is standing in for it.
  it('is zero while the photo has nothing painted', () => {
    expect(backgroundBlur({ ...photo, blur: 12 }, false)).toBe(0);
  });
});
