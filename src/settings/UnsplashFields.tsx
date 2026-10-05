import { i18n } from '#i18n';
import { useEffect, useMemo, useState } from 'react';
import {
  appSettingsSchema,
  unsplashBackgroundSchema,
  type BackgroundConfig,
  type UnsplashBackground,
} from '@/core/config/schema';
import { usePermissions } from '@/core/permissions';
import { StorageKeys } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import type { PhotoSource, UnsplashErrorKind } from '@/core/unsplash/api';
import { loadState, refreshUnsplash, wantedWidth } from '@/core/unsplash/refresh';
import { isUnsplashState, type UnsplashState } from '@/core/unsplash/state';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';
import fields from './Fields.module.css';
import styles from './ThemeSettings.module.css';

/**
 * Settings for a photo from the web: Lorem Picsum or Unsplash, whichever the
 * Background dropdown chose (`source`).
 *
 * Picsum works with no setup: a curated set of about a thousand Unsplash photos, no
 * search. Unsplash takes the user's own access key, shown here because this is where
 * it is used, though it is saved once for every profile. Without a key the Unsplash
 * view is that field and nothing else.
 */

export interface UnsplashFieldsProps {
  source: PhotoSource;
  background: BackgroundConfig;
  onChangeBackground: (background: BackgroundConfig) => void;
  accessKey: string | null;
  onChangeAccessKey: (key: string | null) => void;
}

const problemText = (kind: UnsplashErrorKind) => i18n.t(`web.problem.${kind}`);

export function UnsplashFields({
  source,
  background,
  onChangeBackground,
  accessKey,
  onChangeAccessKey,
}: UnsplashFieldsProps) {
  const isUnsplash = source === 'unsplash';
  const web =
    background.kind === 'unsplash' && background.source === source ? background : null;
  const schemaFields = useMemo(() => describeSchema(unsplashBackgroundSchema), []);
  const keyField = useMemo(
    () =>
      describeSchema(appSettingsSchema).filter(
        (field) => field.key === 'unsplashAccessKey',
      ),
    [],
  );
  const state = useUnsplashState(web !== null);
  const [skipping, setSkipping] = useState(false);
  // Asked of the key alone, not the query: keyed on the query, the field would
  // vanish as the user typed the first letter into an empty one.
  const consent = usePermissions({
    dataCollection: isUnsplash && accessKey ? SEARCH_TERMS : [],
  });

  const keyFields = isUnsplash && (
    <GeneratedFields
      fields={keyField}
      values={{ unsplashAccessKey: accessKey }}
      idPrefix="sp-unsplash"
      onChange={(_, value) => {
        const key = typeof value === 'string' && value.trim() !== '' ? value : null;
        onChangeAccessKey(key);
      }}
    />
  );

  if (!web) {
    return (
      <div className={styles.photo}>
        {keyFields}
        {isUnsplash && !accessKey && (
          <p className={fields.help}>{i18n.t('web.needsKey')}</p>
        )}
      </div>
    );
  }

  // Only a problem with the source in use now: a refused key says nothing about a
  // new one, or about Picsum.
  const problem =
    state?.error &&
    state.source === source &&
    state.error.key === (isUnsplash ? accessKey || null : null)
      ? problemText(state.error.kind)
      : null;
  // Picsum cannot search. Without consent Unsplash would send nothing either: the
  // Allow below takes the field's place.
  const searchable = isUnsplash && accessKey && consent.state === 'granted';
  const shownFields = searchable
    ? schemaFields
    : schemaFields.filter((field) => field.key !== 'query');
  const blocked = isUnsplash && (!accessKey || consent.state !== 'granted');

  const skip = async () => {
    setSkipping(true);
    try {
      // The canvas is watching the rotation state and swaps when this lands.
      await refreshUnsplash(
        {
          adapter: localAdapter,
          key: accessKey,
          background: web,
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
      {keyFields}

      <div className={styles.customiseRow}>
        <button
          type="button"
          className={styles.customise}
          disabled={skipping || blocked}
          onClick={() => void skip()}
        >
          {skipping ? i18n.t('web.fetching') : i18n.t('web.another')}
        </button>
      </div>

      {!isUnsplash && <p className={fields.help}>{i18n.t('web.picsumAbout')}</p>}

      {isUnsplash && accessKey && consent.state === 'missing' && (
        <div className={styles.consent}>
          <p className={fields.help}>{i18n.t('web.consent')}</p>
          <button type="button" className={styles.customise} onClick={consent.request}>
            {i18n.t('web.allowSearch')}
          </button>
        </div>
      )}

      {problem && (
        <p className={styles.warning} role="status">
          {problem}
        </p>
      )}

      <GeneratedFields
        fields={shownFields}
        values={web}
        idPrefix="sp-background-unsplash"
        onChange={(key, value) => {
          const next = unsplashBackgroundSchema.safeParse({ ...web, [key]: value });
          if (next.success) onChangeBackground(next.data satisfies UnsplashBackground);
        }}
      />
    </div>
  );
}

const SEARCH_TERMS = ['searchTerms'] as const;

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
