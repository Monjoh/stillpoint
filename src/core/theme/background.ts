import type { ImageSource } from '@/core/assets/image';
import type { BackgroundConfig } from '@/core/config/schema';

/**
 * The CSS value for a background, or `null` when it cannot be painted yet.
 *
 * An image background needs its `ImageSource`. Without one there is nothing to paint
 * — the photograph is in async storage and no preview is cached — and `null` tells the
 * caller to keep whatever is already on screen: a wrong-but-pleasant background beats
 * a white flash. Unsplash works the same way, with the photo it last downloaded —
 * from Unsplash with a key, from Lorem Picsum without one, so it never runs dry.
 *
 * An image is painted as layers, top first:
 *
 * 1. the dim, as a flat translucent black — a layer here rather than an overlay
 *    element, so the boot paint on `body` dims too and the first frame matches
 * 2. the photograph, once its object URL exists
 * 3. the thumbnail, stretched to cover, which reads as a blurred copy while the
 *    photograph decodes, and fills the margins of a `contain` fit
 * 4. the average colour, so even the frame before the thumbnail decodes is close
 *
 * Blur cannot be a layer. It is `--sp-background-blur`, a filter on the background
 * element — see `Background.module.css`.
 */
export function backgroundToCss(
  background: BackgroundConfig,
  image?: ImageSource,
): string | null {
  switch (background.kind) {
    case 'solid':
      return background.color;
    case 'gradient':
      return `linear-gradient(${background.angle}deg, ${background.from} 0%, ${background.to} 100%)`;
    case 'image':
      return image ? photoLayers(background.dim, background.fit, image) : null;
    case 'unsplash':
      return image ? photoLayers(background.dim, 'cover', image) : null;
  }
}

function photoLayers(
  dim: number,
  fit: 'cover' | 'contain',
  image: ImageSource,
): string {
  const layers: string[] = [];
  if (dim > 0) {
    const shade = `rgb(0 0 0 / ${dim})`;
    layers.push(`linear-gradient(${shade}, ${shade})`);
  }
  if (image.url) layers.push(`url("${image.url}") center / ${fit} no-repeat`);
  layers.push(`url("${image.thumb}") center / cover no-repeat`);
  return `${layers.join(', ')}, ${image.color}`;
}

/**
 * The background blur in px, as `--sp-background-blur` wants it. Zero while a photo
 * background has no pixels: its blur belongs to the photo, not to whatever is showing
 * in its place.
 */
export function backgroundBlur(background: BackgroundConfig, painted = true): number {
  if (!painted) return 0;
  return background.kind === 'image' || background.kind === 'unsplash'
    ? background.blur
    : 0;
}
