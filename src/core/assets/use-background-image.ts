import { useEffect, useMemo, useState } from 'react';
import type { BackgroundConfig } from '@/core/config/schema';
import type { StorageAdapter } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import { readImagePreview, writeImagePreview } from '@/core/storage/paint-cache';
import { dataUrlToBlob, imageAssetId, loadImageAsset, type ImageSource } from './image';

/**
 * An image background's pixels, resolved for painting.
 *
 * Returns the cached preview on the first render, synchronously, so the page's own
 * paint agrees with the boot paint. Then reads the photograph from `storage.local`,
 * hands it to the page as an object URL, and revokes that URL when the background
 * changes or the page goes. An object URL rather than the data URL itself: a
 * custom property several megabytes long on `:root` would be copied by every
 * style recalculation and every `getComputedStyle`.
 *
 * `onPreviewHealed` fires when the photograph loaded but its preview was missing from
 * the paint cache — an import, a cleared `localStorage` — and has now been put back.
 * The caller rewrites the paint cache, so the *next* cold tab opens on the picture.
 *
 * `undefined` for any other background kind, and for a photograph that is not in
 * storage; `backgroundToCss` then keeps what is on screen.
 */
export function useBackgroundImage(
  background: BackgroundConfig | undefined,
  onPreviewHealed?: () => void,
  adapter: StorageAdapter = localAdapter,
): ImageSource | undefined {
  const assetId = background ? imageAssetId(background) : null;
  const [loaded, setLoaded] = useState<{ assetId: string; source: ImageSource } | null>(
    null,
  );
  // Memoised so the page's paint effect sees one object per photograph, not a fresh
  // one parsed out of localStorage on every render.
  const preview = useMemo(
    () => (assetId === null ? null : readImagePreview(assetId)),
    [assetId],
  );

  useEffect(() => {
    if (assetId === null) return;
    let cancelled = false;
    let url: string | null = null;

    void loadImageAsset(adapter, assetId)
      .then((asset) => {
        if (cancelled || !asset) return;
        url = URL.createObjectURL(dataUrlToBlob(asset.dataUrl));
        setLoaded({ assetId, source: { ...asset.preview, url } });
        if (!readImagePreview(assetId)) {
          writeImagePreview(assetId, asset.preview);
          onPreviewHealed?.();
        }
      })
      .catch(() => {
        // Unreadable storage: the preview, if any, stays up. Nothing to tell anyone.
      });

    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
    // `onPreviewHealed` is a notification, not an input: a new callback identity must
    // not re-read a photograph that has not changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, adapter]);

  if (assetId === null) return undefined;
  // Compared in render, like the draft controls: a source left over from the previous
  // photograph is never shown for the next one, not even for a frame.
  if (loaded?.assetId === assetId) return loaded.source;
  return preview ?? undefined;
}
