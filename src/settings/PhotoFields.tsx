import { useEffect, useMemo, useRef, useState } from 'react';
import { saveImageAsset } from '@/core/assets/image';
import {
  imageBackgroundSchema,
  type BackgroundConfig,
  type ImageBackground,
} from '@/core/config/schema';
import { localAdapter } from '@/core/storage/local';
import { readImagePreview, writeImagePreview } from '@/core/storage/paint-cache';
import { backgroundToCss } from '@/core/theme/background';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';
import { ImageUploadError, prepareImage } from './image-upload';
import fields from './Fields.module.css';
import styles from './ThemeSettings.module.css';

/**
 * The photograph half of the Background section: upload, replace, and — once there
 * is one — fit, blur and dim, generated from `imageBackgroundSchema`.
 *
 * The order of an upload is the order that keeps every failure harmless: the asset is
 * written, then its preview, and only then does the config point at it. A failure
 * part-way leaves the old background on screen and, at worst, an unreferenced asset.
 * The reverse order could leave the config naming a photograph that was never stored.
 */

export interface PhotoFieldsProps {
  background: BackgroundConfig;
  onChangeBackground: (background: BackgroundConfig) => void;
}

export function PhotoFields({ background, onChangeBackground }: PhotoFieldsProps) {
  const image = background.kind === 'image' ? background : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageFields = useMemo(() => describeSchema(imageBackgroundSchema), []);

  // An upload takes a second or so. The handler in hand when it started closes over
  // the profile as it was then, and calling it would undo anything changed since.
  const latest = useRef({ background, onChangeBackground });
  useEffect(() => {
    latest.current = { background, onChangeBackground };
  });

  const preview = useMemo(
    () => (image ? readImagePreview(image.assetId) : null),
    [image],
  );

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const asset = await prepareImage(file);
      const assetId = await saveImageAsset(localAdapter, asset);
      writeImagePreview(assetId, asset.preview);

      // A replacement keeps the fit, blur and dim already chosen: the user tuned
      // those for their page, not for one particular photo.
      const current = latest.current.background;
      const kept = current.kind === 'image' ? current : null;
      latest.current.onChangeBackground({
        kind: 'image',
        assetId,
        fit: kept?.fit ?? 'cover',
        blur: kept?.blur ?? 0,
        dim: kept?.dim ?? 0,
      });
    } catch (caught) {
      setError(
        caught instanceof ImageUploadError
          ? caught.message
          : 'The photo could not be saved. There may not be enough storage space left.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.photo}>
      <div className={styles.photoRow}>
        {image && (
          <span
            className={styles.photoThumb}
            style={{
              background: (preview && backgroundToCss(image, preview)) ?? undefined,
            }}
            aria-hidden="true"
          />
        )}

        {/* A label, not a button: it is the one way to open a file picker that needs
            no script, and it takes keyboard focus through the input inside it. */}
        <label className={styles.upload} data-busy={busy || undefined}>
          {busy ? 'Preparing photo…' : image ? 'Replace photo' : 'Use your own photo'}
          <input
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so picking the same file twice fires change twice.
              event.target.value = '';
              if (file) void upload(file);
            }}
          />
        </label>
      </div>

      {error && (
        <p className={styles.warning} role="alert">
          {error}
        </p>
      )}

      {/* An image background whose photograph is not on this device: an export from
          before photos were exported, or storage cleared underneath us. */}
      {image && !preview && !busy && (
        <p className={styles.warning} role="status">
          This photo is no longer stored here. Upload it again, or choose another type
          above.
        </p>
      )}

      {image && (
        <GeneratedFields
          fields={imageFields}
          values={image}
          idPrefix="sp-background-image"
          onChange={(key, value) => {
            const next = imageBackgroundSchema.safeParse({ ...image, [key]: value });
            if (next.success) onChangeBackground(next.data satisfies ImageBackground);
          }}
        />
      )}

      {!image && (
        <p className={fields.help}>
          Kept on this device only, and included when you export your settings.
        </p>
      )}
    </div>
  );
}
