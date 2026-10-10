import type { BackgroundConfig, StillpointConfig } from '@/core/config/schema';
import { StorageKeys, type StorageAdapter } from '@/core/storage/adapter';
import { newId } from '@/lib/id';

/**
 * The asset store: user photographs, each under its own `assets/<id>` key.
 *
 * Never inside the config tree. The config is read on every new tab and rewritten on
 * every drag; a photograph in it would make both cost megabytes.
 *
 * Stored as a data URL rather than a Blob. Firefox's `storage.local` would clone a
 * Blob, Chrome's is JSON-only, and ADR-0003 keeps core to what both can do. Base64 is
 * a third larger, which the upload pipeline pays for by re-encoding first.
 *
 * Deliberately zod-free: the new tab reads assets on its view path.
 */

/**
 * What the first frame of a cold tab can show before the photograph loads: its
 * average colour, and a tiny thumbnail that is near enough a blurred copy. Mirrored
 * into the synchronous paint cache — see `writeImagePreview`.
 */
export interface ImagePreview {
  /** `#rrggbb`. Painted underneath everything, so the first frame is never wrong. */
  color: string;
  /** A data URL, `PREVIEW_EDGE` pixels on its longest edge, about 6 KB. */
  thumb: string;
}

/**
 * The thumbnail's longest edge, for an uploaded photo and a web one alike. Stretched
 * over the screen for the frames before the photograph decodes, 128 px still shows
 * the scene; 32 px showed only its colours (S34, compared at screen size). It is
 * read before first paint, so it stays a few kilobytes: 192 px nearly doubled the
 * size for little more.
 */
export const PREVIEW_EDGE = 128;

export interface ImageAsset {
  v: 1;
  kind: 'image';
  /** The full image as a data URL, already downscaled and re-encoded. */
  dataUrl: string;
  width: number;
  height: number;
  preview: ImagePreview;
}

/**
 * An image background as far as it has been resolved. `url` arrives once the stored
 * photograph has been read; until then the preview stands in for it.
 */
export interface ImageSource extends ImagePreview {
  url?: string;
}

export function isImagePreview(value: unknown): value is ImagePreview {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(p.color) &&
    typeof p.thumb === 'string' &&
    p.thumb.startsWith('data:image/')
  );
}

/**
 * Structural, like the paint cache's check. An asset comes from our own upload or
 * from an imported file, and the second one is a stranger: anything that is not
 * plainly an image data URL is refused rather than painted.
 */
export function isImageAsset(value: unknown): value is ImageAsset {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    a.v === 1 &&
    a.kind === 'image' &&
    typeof a.dataUrl === 'string' &&
    /^data:image\/[a-z0-9.+-]+;base64,/i.test(a.dataUrl) &&
    typeof a.width === 'number' &&
    typeof a.height === 'number' &&
    isImagePreview(a.preview)
  );
}

export async function loadImageAsset(
  adapter: StorageAdapter,
  assetId: string,
): Promise<ImageAsset | null> {
  const stored = await adapter.get<unknown>(StorageKeys.asset(assetId));
  return isImageAsset(stored) ? stored : null;
}

/** Writes under a fresh id and returns it. The config is the caller's to change. */
export async function saveImageAsset(
  adapter: StorageAdapter,
  asset: ImageAsset,
  assetId: string = newId(),
): Promise<string> {
  await adapter.set(StorageKeys.asset(assetId), asset);
  return assetId;
}

/** Every asset a config refers to, across all profiles. */
export function assetIdsIn(config: StillpointConfig | null): Set<string> {
  const ids = new Set<string>();
  for (const profile of config?.profiles ?? []) {
    const id = imageAssetId(profile.background);
    if (id !== null) ids.add(id);
  }
  return ids;
}

export function imageAssetId(background: BackgroundConfig): string | null {
  return background.kind === 'image' ? background.assetId : null;
}

/**
 * A data URL as a Blob, decoded by hand rather than with `fetch(dataUrl)`. Nothing on
 * the new tab's path makes a request, and a reviewer should not have to check that
 * this one does not leave the machine.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const type = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? 'application/octet-stream';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
