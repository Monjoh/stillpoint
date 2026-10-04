import type { ImageAsset } from '@/core/assets/image';

/**
 * A picked file → an asset ready to store.
 *
 * Every photograph is decoded and re-encoded, never stored as picked:
 *
 * - **Size.** A phone photo is 4–12 MB, and stored as base64 it grows by a third.
 *   Scaled to fit 3840 px — 4K, and enough for a 5K display at a glance — and encoded
 *   as WebP, it is usually well under 2 MB.
 * - **Privacy.** Re-encoding drops EXIF, which on a phone photo includes where it was
 *   taken. The file is the user's; the location never needed to be copied anywhere.
 * - **Orientation.** `createImageBitmap` applies the EXIF rotation, so a portrait
 *   photo is portrait.
 *
 * Lives in the settings chunk, which is lazy: none of this is on the new tab's path.
 */

/** The longest edge kept. Bigger images are scaled down; smaller ones are not scaled up. */
export const MAX_EDGE = 3840;
/** Refused before decoding. A larger file is almost certainly not a photograph. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** The preview's longest edge. A kilobyte, and enough to read as a blurred copy. */
export const THUMB_EDGE = 32;

export class ImageUploadError extends Error {}

/** Fit `width × height` inside `max` on its longest edge, never enlarging. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

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

export async function prepareImage(file: File): Promise<ImageAsset> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new ImageUploadError('That file is not an image.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageUploadError('That image is over 50 MB. Try a smaller copy of it.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageUploadError(
      'That image could not be opened. JPEG, PNG, WebP and AVIF all work.',
    );
  }

  try {
    const size = fitWithin(bitmap.width, bitmap.height, MAX_EDGE);
    const full = draw(bitmap, size.width, size.height);
    const dataUrl = await blobToDataUrl(await encode(full));

    const thumbSize = fitWithin(bitmap.width, bitmap.height, THUMB_EDGE);
    const thumb = draw(bitmap, thumbSize.width, thumbSize.height);
    const pixels = thumb
      .getContext('2d')!
      .getImageData(0, 0, thumbSize.width, thumbSize.height).data;

    return {
      v: 1,
      kind: 'image',
      dataUrl,
      width: size.width,
      height: size.height,
      preview: {
        color: averageColor(pixels),
        thumb: thumb.toDataURL('image/jpeg', 0.7),
      },
    };
  } finally {
    bitmap.close();
  }
}

function draw(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageUploadError('This browser could not process the image.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

/**
 * WebP where the browser can encode it, JPEG where it cannot. An unsupported type
 * does not fail; `toBlob` quietly hands back a PNG, which for a photograph is the
 * largest choice of all, so the result's type is checked rather than trusted.
 */
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp', 0.85);
  if (webp?.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85);
  if (jpeg) return jpeg;
  throw new ImageUploadError('This browser could not process the image.');
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageUploadError('The image could not be read.'));
    reader.readAsDataURL(blob);
  });
}
