import { useCallback, useEffect } from 'react';
import { Background } from '@/canvas/Background';
import { Canvas } from '@/canvas/Canvas';
import { removeWidget, withProfile } from '@/canvas/operations';
import { configStore, useConfig } from '@/core/config/store';
import { applyCanvasTokens, profileToPaint } from '@/core/theme/apply';
import styles from './NewTab.module.css';

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

  const handleRemoveWidget = useCallback((instanceId: string) => {
    configStore.getState().update((current) => {
      const active = current.profiles.find((p) => p.id === current.activeProfileId);
      if (!active) return current;
      return withProfile(current, removeWidget(active, instanceId));
    });
  }, []);

  return (
    <>
      <Background />

      {/* Nothing is rendered over the background until the real config is in: a
          placeholder that is replaced a frame later is a flicker on every new tab,
          and boot.ts has already made the page look correct. */}
      {status === 'ready' && profile && (
        <>
          <Canvas
            profile={profile}
            isEditing={false}
            onRemoveWidget={handleRemoveWidget}
          />
          {profile.widgets.length === 0 && <EmptyCanvas />}
        </>
      )}

      {error && (
        <p className={styles.error} role="status">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * A profile with no widgets is a legitimate state — the user may have removed them
 * all — but a blank page with no visible way forward is not. This is the only place
 * Stillpoint puts its own name on the canvas, and it disappears the moment there is
 * anything to show.
 */
function EmptyCanvas() {
  return (
    <div className={styles.empty}>
      <h1 className={styles.wordmark}>stillpoint</h1>
      <p className={styles.hint}>This profile has no widgets yet.</p>
    </div>
  );
}
