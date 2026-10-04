import type { BackgroundConfig } from '@/core/config/schema';

/**
 * The CSS value for a background, or `null` when it cannot be painted yet.
 *
 * `image` and `unsplash` resolve to `null` here: both need a blob or a cached file that
 * is not available synchronously, so they land in M4 along with the asset store. Until
 * then the caller keeps whatever the stylesheet already had, which is the default
 * gradient — a wrong-but-pleasant background beats a white flash.
 */
export function backgroundToCss(background: BackgroundConfig): string | null {
  switch (background.kind) {
    case 'solid':
      return background.color;
    case 'gradient':
      return `linear-gradient(${background.angle}deg, ${background.from} 0%, ${background.to} 100%)`;
    case 'image':
    case 'unsplash':
      return null;
  }
}
