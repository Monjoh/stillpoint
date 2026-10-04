import { parseColor, type Rgb } from './contrast';

/**
 * The small amount of colour arithmetic a colour picker needs.
 *
 * `<input type="color">` speaks six-digit hex and nothing else, while the presets are
 * written as `rgb(… / alpha)` — a widget surface is white at 6% opacity, not a grey.
 * These convert between the two without losing the part the picker cannot see.
 */

/** The opacity of a colour, 0–1. A colour this cannot read is treated as opaque. */
export function colorAlpha(input: string): number {
  const value = input.trim().toLowerCase();

  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/.exec(value);
  if (hex) {
    const digits = hex[1]!;
    const a = digits.length === 4 ? digits[3]! + digits[3]! : digits.slice(6, 8);
    return parseInt(a, 16) / 255;
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const body = rgb[1]!;
    // Space-separated: `r g b / a`. Legacy: `r, g, b, a`.
    const raw = body.includes('/')
      ? body.split('/')[1]
      : body.split(',').length === 4
        ? body.split(',')[3]
        : undefined;
    if (raw === undefined) return 1;
    const text = raw.trim();
    const alpha = text.endsWith('%') ? Number(text.slice(0, -1)) / 100 : Number(text);
    return Number.isFinite(alpha) ? Math.min(Math.max(alpha, 0), 1) : 1;
  }

  return 1;
}

/** `#rrggbb` for any colour `parseColor` understands, with the alpha dropped. */
export function colorToHex(input: string): string | null {
  const rgb = parseColor(input);
  return rgb === null ? null : rgbToHex(rgb);
}

/**
 * A picked hex, at the opacity of the colour it replaces.
 *
 * Picking white for a surface that was white at 6% must stay translucent — the
 * picker cannot show alpha, so it must not silently reset it to opaque.
 */
export function withAlpha(hex: string, alpha: number): string {
  if (alpha >= 1) return hex.toLowerCase();
  const rgb = parseColor(hex);
  if (rgb === null) return hex;
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${round(alpha)})`;
}

function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (c: number) =>
    Math.round(Math.min(Math.max(c, 0), 255))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
