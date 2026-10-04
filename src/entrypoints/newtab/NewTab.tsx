import { useEffect } from 'react';
import { configStore, useConfig } from '@/core/config/store';
import { applyCanvasTokens, profileToPaint } from '@/core/theme/apply';
import styles from './NewTab.module.css';

/**
 * M1 placeholder. There is no canvas yet — this exists so the persistence spine is
 * observable: it proves the config loaded, the tokens applied, and cross-tab sync
 * works. The grid and widgets replace all of it in M2.
 */
export function NewTab() {
  const config = useConfig((state) => state.config);
  const status = useConfig((state) => state.status);
  const error = useConfig((state) => state.error);

  useEffect(() => {
    void configStore.getState().load();
  }, []);

  const profile = config?.profiles.find((p) => p.id === config.activeProfileId);

  useEffect(() => {
    // The second paint. boot.ts already did the first one from the cache; this is the
    // authoritative pass, and it corrects the cache if the two ever disagree.
    if (profile) applyCanvasTokens(profileToPaint(profile));
  }, [profile]);

  return (
    <main className={styles.page}>
      <h1 className={styles.wordmark}>stillpoint</h1>

      {status === 'ready' && profile ? (
        <p className={styles.hint}>
          {profile.name} · {profile.layout.columns}×{profile.layout.rows} ·{' '}
          {profile.widgets.length === 0
            ? 'no widgets yet'
            : `${profile.widgets.length} widget${profile.widgets.length === 1 ? '' : 's'}`}
        </p>
      ) : (
        <p className={styles.hint}>&nbsp;</p>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </main>
  );
}
