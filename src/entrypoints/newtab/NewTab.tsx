import { lazy, Suspense, useCallback, useEffect } from 'react';
import { Background } from '@/canvas/Background';
import { Canvas } from '@/canvas/Canvas';
import { removeWidget, withProfile } from '@/canvas/operations';
import { useEditSession } from '@/canvas/useEditSession';
import { browser } from 'wxt/browser';
import { configStore, useConfig } from '@/core/config/store';
import type { Profile, StillpointConfig } from '@/core/config/schema';
import { useBackgroundImage } from '@/core/assets/use-background-image';
import { writePaintCache } from '@/core/storage/paint-cache';
import { applyCanvasTokens, profileToPaint } from '@/core/theme/apply';
import styles from './NewTab.module.css';

/**
 * Edit mode is the whole of `src/canvas/edit` — toolbar, picker, drag arithmetic and
 * tool chrome tokens — and none of it is fetched until someone edits. View mode runs
 * on every new tab; editing runs almost never.
 */
const EditMode = lazy(() => import('@/canvas/edit/EditMode'));

export function NewTab() {
  const config = useConfig((state) => state.config);
  const status = useConfig((state) => state.status);
  const error = useConfig((state) => state.error);

  useEffect(() => {
    void configStore.getState().load();
  }, []);

  const profile = config?.profiles.find((p) => p.id === config.activeProfileId);

  const image = useBackgroundImage(profile?.background, healPaintCache);

  useEffect(() => {
    // The second paint. boot.ts already did the first one from the cache; this is the
    // authoritative pass, and it corrects the cache if the two ever disagree. An image
    // background paints here twice: its preview first, its photograph once read.
    if (profile) applyCanvasTokens(profileToPaint(profile, image));
  }, [profile, image]);

  /** Every layout edit funnels through here, so the store is the only writer. */
  const handleProfileChange = useCallback((next: Profile) => {
    configStore.getState().update((current) => withProfile(current, next));
  }, []);

  const handleRemoveWidget = useCallback((instanceId: string) => {
    configStore.getState().update((current) => {
      const active = current.profiles.find((p) => p.id === current.activeProfileId);
      return active ? withProfile(current, removeWidget(active, instanceId)) : current;
    });
  }, []);

  /** Writes are debounced; an interaction ending is the moment to stop waiting. */
  const handleCommit = useCallback(() => {
    void configStore.getState().flush();
  }, []);

  const session = useEditSession({
    enabled: status === 'ready' && config?.app.editModeEnabled === true,
    onExit: handleCommit,
  });

  /**
   * The panel belongs to edit mode, not to the selection. Asked of the session rather
   * than derived from `selectedId`, which is what it used to be: the stage gives up
   * the panel's width, so a panel that appeared on selection moved every widget on
   * the canvas at the exact moment one was being clicked.
   */
  const panelOpen = session.isEditing && session.panelOpen;

  /** Extension APIs belong to the entrypoint; the panel is handed a plain callback. */
  const handleOpenOptions = useCallback(() => {
    void browser.runtime.openOptionsPage();
  }, []);

  const handleConfigChange = useCallback(
    (recipe: (config: StillpointConfig) => StillpointConfig) => {
      configStore.getState().update(recipe);
      void configStore.getState().flush();
    },
    [],
  );

  return (
    <>
      <Background />

      {/* Nothing is rendered over the background until the real config is in: a
          placeholder that is replaced a frame later is a flicker on every new tab,
          and boot.ts has already made the page look correct. */}
      {status === 'ready' && config && profile && (
        <>
          <Canvas
            profile={profile}
            isEditing={session.isEditing}
            panelOpen={panelOpen}
            onRemoveWidget={handleRemoveWidget}
            overlay={
              session.isEditing
                ? (geometry) => (
                    <Suspense fallback={null}>
                      <EditMode
                        geometry={geometry}
                        config={config}
                        profile={profile}
                        selectedId={session.selectedId}
                        panelOpen={panelOpen}
                        onSelect={session.select}
                        onChange={handleProfileChange}
                        onChangeConfig={handleConfigChange}
                        onTogglePanel={session.togglePanel}
                        onOpenOptions={handleOpenOptions}
                        onCommit={handleCommit}
                        onExit={session.exit}
                      />
                    </Suspense>
                  )
                : undefined
            }
          />

          {profile.widgets.length === 0 && !session.isEditing && <EmptyCanvas />}

          {!session.isEditing && config?.app.editModeEnabled && (
            <EditAffordance onEnter={session.enter} />
          )}
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

/** A photograph's preview was missing from the paint cache and is back: re-derive it. */
function healPaintCache() {
  const config = configStore.getState().config;
  if (config) writePaintCache(config);
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
      <p className={styles.hint}>
        Press <kbd className={styles.kbd}>E</kbd> to add a widget.
      </p>
    </div>
  );
}

/**
 * View mode shows nothing of ours, which leaves the keyboard shortcut as the only way
 * in — and a shortcut nobody can discover is not a way in. A strip along the top edge
 * reveals the button on hover or on focus, and is otherwise invisible.
 */
function EditAffordance({ onEnter }: { onEnter: () => void }) {
  return (
    <div className={styles.editZone}>
      <button type="button" className={styles.editButton} onClick={onEnter}>
        Edit layout
      </button>
    </div>
  );
}
