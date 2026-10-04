import { useEffect, useMemo, useState } from 'react';
import {
  unsplashBackgroundSchema,
  type BackgroundConfig,
  type UnsplashBackground,
} from '@/core/config/schema';
import { StorageKeys } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import type { UnsplashErrorKind } from '@/core/unsplash/api';
import { loadState, refreshUnsplash, wantedWidth } from '@/core/unsplash/refresh';
import { isUnsplashState, type UnsplashState } from '@/core/unsplash/state';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';
import fields from './Fields.module.css';
import styles from './ThemeSettings.module.css';

/**
 * The Unsplash half of the Background section.
 *
 * It works with no setup at all: without a key the photos come from Lorem Picsum, a
 * curated set of Unsplash photos, and only Search is missing. A key — under General,
 * since it is global — adds Unsplash search.
 */

export interface UnsplashFieldsProps {
  background: BackgroundConfig;
  onChangeBackground: (background: BackgroundConfig) => void;
  accessKey: string | null;
}

const PROBLEMS: Record<UnsplashErrorKind, string> = {
  key: 'Unsplash did not accept this key. Check that it is the Access Key, not the Secret key, and change it under General.',
  rate: 'This key has used its hourly allowance on Unsplash. The current photo stays up, and new ones resume within the hour.',
  network:
    'The photo service could not be reached. The last photo stays up until it can.',
  empty: 'Unsplash found no photos for that search. Try a broader word.',
};

export function UnsplashFields({
  background,
  onChangeBackground,
  accessKey,
}: UnsplashFieldsProps) {
  const unsplash = background.kind === 'unsplash' ? background : null;
  const schemaFields = useMemo(() => describeSchema(unsplashBackgroundSchema), []);
  const state = useUnsplashState(unsplash !== null);
  const [skipping, setSkipping] = useState(false);

  if (!unsplash) {
    return (
      <button
        type="button"
        className={styles.upload}
        onClick={() => {
          // Blur and dim carry over from a photo: they were tuned for this page.
          const kept = background.kind === 'image' ? background : { blur: 0, dim: 0 };
          onChangeBackground({
            kind: 'unsplash',
            query: 'landscape',
            refresh: 'daily',
            blur: kept.blur,
            dim: kept.dim,
          });
        }}
      >
        Photos from Unsplash
      </button>
    );
  }

  // Only a problem with the source in use now: a refused key says nothing about a
  // new one, or about Picsum.
  const problem =
    state?.error && state.error.key === (accessKey || null)
      ? PROBLEMS[state.error.kind]
      : null;
  // Picsum cannot search, so the field would do nothing.
  const shownFields = accessKey
    ? schemaFields
    : schemaFields.filter((field) => field.key !== 'query');

  const skip = async () => {
    setSkipping(true);
    try {
      // The canvas is watching the rotation state and swaps when this lands.
      await refreshUnsplash(
        {
          adapter: localAdapter,
          key: accessKey,
          background: unsplash,
          width: wantedWidth(),
        },
        { force: true },
      );
    } finally {
      setSkipping(false);
    }
  };

  return (
    <div className={styles.photo}>
      <p className={styles.sourceHeading}>Photos from Unsplash</p>

      <div className={styles.customiseRow}>
        <button
          type="button"
          className={styles.customise}
          disabled={skipping}
          onClick={() => void skip()}
        >
          {skipping ? 'Fetching a photo…' : 'Show another photo'}
        </button>
      </div>

      {!accessKey && (
        <p className={fields.help}>
          Random photos from a curated set of about a thousand on Unsplash, via Lorem
          Picsum. To search Unsplash for your own subject, add an Unsplash access key
          under General.
        </p>
      )}

      {problem && (
        <p className={styles.warning} role="status">
          {problem}
        </p>
      )}

      <GeneratedFields
        fields={shownFields}
        values={unsplash}
        idPrefix="sp-background-unsplash"
        onChange={(key, value) => {
          const next = unsplashBackgroundSchema.safeParse({
            ...unsplash,
            [key]: value,
          });
          if (next.success) onChangeBackground(next.data satisfies UnsplashBackground);
        }}
      />
    </div>
  );
}

/** The rotation state, kept current, so a failure shows up here as it happens. */
function useUnsplashState(enabled: boolean): UnsplashState | null {
  const [state, setState] = useState<UnsplashState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadState(localAdapter)
      .then((loaded) => {
        if (!cancelled) setState(loaded);
      })
      .catch(() => {});
    const unwatch = localAdapter.watch<unknown>(StorageKeys.unsplash, (incoming) => {
      setState(isUnsplashState(incoming) ? incoming : null);
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [enabled]);
  return enabled ? state : null;
}
