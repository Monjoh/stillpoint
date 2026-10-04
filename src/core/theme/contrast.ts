import type { BackgroundConfig } from '@/core/config/schema';
import type { TokenSet } from './tokens';

/**
 * Whether the text a theme paints can actually be read on the background behind it.
 *
 * Themes and backgrounds are chosen independently — that is the point of keeping them
 * apart — which means nothing stops a user putting dark text on a dark page. Rather
 * than have the theme quietly change the background to prevent it, the two stay
 * separate and this measures the result.
 *
 * WCAG 2 relative luminance and contrast ratio. Not a guess at "is this dark": a
 * number with a published threshold behind it, so the warning fires on the pairings
 * that are genuinely unreadable and stays quiet on the ones that merely look unusual.
 */

/** WCAG AA for body text. Below this, a warning is warranted. */
export const MIN_CONTRAST = 4.5;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * `#rgb`, `#rrggbb`, `#rrggbbaa` and `rgb()` in both the legacy and the space-
 * separated forms. Anything else — a named colour, a `color-mix()`, a gradient
 * string — returns null, and a null anywhere means no warning rather than a wrong one.
 *
 * Alpha is parsed and discarded. Compositing a translucent colour needs to know what
 * is behind it, which is the question being asked, so the honest approximation is to
 * measure the colour at full strength.
 */
export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,8})$/.exec(value);
  if (hex) {
    const digits = hex[1]!;
    if (digits.length === 3 || digits.length === 4) {
      return {
        r: parseInt(digits[0]! + digits[0]!, 16),
        g: parseInt(digits[1]! + digits[1]!, 16),
        b: parseInt(digits[2]! + digits[2]!, 16),
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      return {
        r: parseInt(digits.slice(0, 2), 16),
        g: parseInt(digits.slice(2, 4), 16),
        b: parseInt(digits.slice(4, 6), 16),
      };
    }
    return null;
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1]!
      .replace(/\//g, ' ')
      .split(/[\s,]+/)
      .filter((p) => p !== '');
    if (parts.length < 3) return null;
    const channels = parts.slice(0, 3).map((p) => {
      if (p.endsWith('%')) return (Number(p.slice(0, -1)) / 100) * 255;
      return Number(p);
    });
    if (channels.some((c) => !Number.isFinite(c))) return null;
    return { r: channels[0]!, g: channels[1]!, b: channels[2]! };
  }

  return null;
}

/** WCAG 2 relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = Math.min(Math.max(value, 0), 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number | null {
  const first = parseColor(a);
  const second = parseColor(b);
  if (!first || !second) return null;

  const l1 = relativeLuminance(first);
  const l2 = relativeLuminance(second);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The worst contrast this theme's text has against this background, or null when it
 * cannot be measured.
 *
 * *Worst*, because a gradient is two colours and text has to be legible over both —
 * a ramp from white to black is comfortable at one end and invisible at the other,
 * and averaging the two would report it as fine.
 *
 * Image and Unsplash backgrounds return null. There is no way to know what a photo
 * looks like behind a particular widget, which is precisely why those kinds carry
 * `dim` and `blur` instead of a warning.
 */
export function backgroundContrast(
  tokens: TokenSet,
  background: BackgroundConfig,
): number | null {
  const text = tokens['--sp-text'];
  if (text === undefined) return null;

  switch (background.kind) {
    case 'solid':
      return contrastRatio(text, background.color);
    case 'gradient': {
      const from = contrastRatio(text, background.from);
      const to = contrastRatio(text, background.to);
      if (from === null || to === null) return null;
      return Math.min(from, to);
    }
    case 'image':
    case 'unsplash':
      return null;
  }
}
