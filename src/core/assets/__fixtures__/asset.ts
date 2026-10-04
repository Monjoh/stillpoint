import type { ImageAsset } from '../image';

/** A well-formed stored photograph, four pixels' worth of bytes. Tests only. */
export const asset: ImageAsset = {
  v: 1,
  kind: 'image',
  dataUrl: 'data:image/webp;base64,AAEC/w==',
  width: 4,
  height: 3,
  preview: { color: '#336699', thumb: 'data:image/jpeg;base64,AA==' },
};
