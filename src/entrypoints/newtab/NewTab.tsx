import { i18n } from '#i18n';
import { lazy, Suspense, useCallback, useEffect } from 'react';
import { Background } from '@/canvas/Background';
import { Canvas } from '@/canvas/Canvas';
import { removeWidget, withProfile } from '@/canvas/operations';
import { useEditSession } from '@/canvas/useEditSession';
import { browser } from 'wxt/browser';
import { configStore, useConfig } from '@/core/config/store';
import type { Profile, StillpointConfig } from '@/core/config/schema';
import { UnsplashCredit } from '@/canvas/UnsplashCredit';
import { useBackgroundImage } from '@/core/assets/use-background-image';
import { useUnsplash } from '@/core/unsplash/use-unsplash';
import { writePaintCache } from '@/core/storage/paint-cache';
import { applyCanvasTokens, profileToPaint } from '@/core/theme/apply';
import { richText } from '@/lib/rich-text';
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

  const photo = useBackgroundImage(profile?.background, healPaintCache);
  const unsplashKey = config?.app.unsplashAccessKey ?? null;
  const unsplash = useUnsplash(profile?.background, unsplashKey, healPaintCache);
  const image = profile?.background.kind === 'unsplash' ? unsplash.source : photo;

  useEffect(() => {
    // The second paint. boot.ts already did the first one from the cache; this is the
    // authoritative pass, and it corrects the cache if the two ever disagree. A photo
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
   * Entering edit mode is what the first-run hint asks for, so doing it — by the
   * button, the shortcut or anything else — is what retires the hint.
   */
  const firstRun = status === 'ready' && config?.app.hasCompletedFirstRun === false;
  const completeFirstRun = useCallback(() => {
    configStore.getState().update((current) => ({
      ...current,
      app: { ...current.app, hasCompletedFirstRun: true },
    }));
    void configStore.getState().flush();
  }, []);
  useEffect(() => {
    if (session.isEditing && firstRun) completeFirstRun();
  }, [session.isEditing, firstRun, completeFirstRun]);

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
            <EditAffordance
              onEnter={session.enter}
              firstRun={firstRun}
              onDismiss={completeFirstRun}
            />
          )}
        </>
      )}

      {status === 'ready' && unsplash.credit && (
        <UnsplashCredit credit={unsplash.credit} />
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
      {/* eslint-disable-next-line no-restricted-syntax -- the wordmark, not language */}
      <h1 className={styles.wordmark}>stillpoint</h1>
      <p className={styles.hint}>
        {richText(i18n.t('newtab.emptyHint'), {
          key: <kbd className={styles.kbd}>E</kbd>,
        })}
      </p>
    </div>
  );
}

/**
 * View mode shows nothing of ours, which leaves the keyboard shortcut as the only way
 * in — and a shortcut nobody can discover is not a way in. A strip along the top edge
 * reveals the button on hover or on focus, and is otherwise invisible.
 *
 * Except on first run. Firefox has just asked whether to keep this page, and a page
 * whose only way in is invisible until hovered cannot be judged on what it can become.
 * Until the user first edits or dismisses it, the button stays in view with the
 * shortcut beside it.
 */
function EditAffordance({
  onEnter,
  firstRun,
  onDismiss,
}: {
  onEnter: () => void;
  firstRun: boolean;
  onDismiss: () => void;
}) {
  return (
    <div className={styles.editZone} data-first-run={firstRun || undefined}>
      <button type="button" className={styles.editButton} onClick={onEnter}>
        {i18n.t('newtab.editLayout')}
      </button>
      {firstRun && (
        <p className={styles.firstRun}>
          {richText(i18n.t('newtab.firstRunHint'), {
            key: <kbd className={styles.kbd}>E</kbd>,
          })}
          <button type="button" className={styles.dismiss} onClick={onDismiss}>
            {i18n.t('newtab.gotIt')}
          </button>
        </p>
      )}
    </div>
  );
}
