import { describe, expect, it } from 'vitest';
import {
  averageColor,
  fitWithin,
  ImageUploadError,
  MAX_EDGE,
  MAX_FILE_BYTES,
  prepareImage,
} from './image-upload';

describe('fitWithin', () => {
  it('scales the longest edge down to the limit, keeping the shape', () => {
    expect(fitWithin(8000, 6000, MAX_EDGE)).toEqual({ width: 3840, height: 2880 });
    expect(fitWithin(3000, 6000, 32)).toEqual({ width: 16, height: 32 });
  });

  it('never enlarges a small image', () => {
    expect(fitWithin(800, 600, MAX_EDGE)).toEqual({ width: 800, height: 600 });
  });

  it('never rounds an edge to nothing', () => {
    expect(fitWithin(10000, 10, 32)).toEqual({ width: 32, height: 1 });
  });
});

describe('averageColor', () => {
  it('averages opaque pixels', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    expect(averageColor(pixels)).toBe('#800080');
  });

  // A cut-out on transparency is described by its subject, not by the black that
  // transparent pixels hold.
  it('ignores transparent pixels', () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]);
    expect(averageColor(pixels)).toBe('#ffffff');
  });

  it('falls back to black for an empty or fully transparent image', () => {
    expect(averageColor(new Uint8ClampedArray([9, 9, 9, 0]))).toBe('#000000');
  });
});

describe('prepareImage — refusals', () => {
  it('refuses a file that says it is not an image, before decoding it', async () => {
    const file = new File(['{}'], 'config.json', { type: 'application/json' });
    await expect(prepareImage(file)).rejects.toThrow(ImageUploadError);
  });

  it('refuses a very large file, before decoding it', async () => {
    const file = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: MAX_FILE_BYTES + 1 });
    await expect(prepareImage(file)).rejects.toThrow(/over 50 MB/);
  });
});
