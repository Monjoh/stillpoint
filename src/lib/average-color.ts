/**
 * The mean colour of RGBA pixels as `#rrggbb`, ignoring transparent ones. Weighted by
 * alpha, so a cut-out on transparency is described by the subject, not by black.
 */
export function averageColor(pixels: Uint8ClampedArray): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3]! / 255;
    r += pixels[i]! * a;
    g += pixels[i + 1]! * a;
    b += pixels[i + 2]! * a;
    weight += a;
  }
  if (weight === 0) return '#000000';
  const hex = (sum: number) =>
    Math.round(sum / weight)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
