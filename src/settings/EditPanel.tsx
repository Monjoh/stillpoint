import { i18n } from '#i18n';
import { useCallback, useState } from 'react';
import type {
  BackgroundConfig,
  LayoutConfig,
  Profile,
  StillpointConfig,
  ThemeConfig,
  WidgetInstance,
} from '@/core/config/schema';
import { widgetRegistry } from '@/core/registry';
import { PageSettings } from './PageSettings';
import { WidgetSettings } from './WidgetSettings';
import styles from './EditPanel.module.css';

/**
 * Edit mode's settings surface: one sidebar, two states.
 *
 * With a widget selected it shows that widget's settings, generated from its schema.
 * With nothing selected it shows the page itself — which profile, the grid, and the
 * global settings. It does not come and go with the selection.
 *
 * That last part is the whole design. The panel used to appear when a widget was
 * selected, and because the stage gives up the panel's width rather than being
 * covered by it, appearing *moved every widget on the canvas* — including the one
 * being clicked, out from under the cursor. A panel that is simply always there for
 * as long as you are editing has nowhere to put that problem.
 *
 * There is no Apply button and no OK: every change is written straight through to the
 * config, so the canvas beside the panel is the preview. That is only safe because
 * `resolveSettings` repairs anything a widget schema rejects, and because the two
 * fields that cannot be repaired that way — a profile name, the grid size — are
 * handled by code that knows it.
 */

export interface EditPanelProps {
  config: StillpointConfig;
  /** The active profile. The same object the canvas is drawing; passed, not re-found. */
  profile: Profile;
  /** The selected widget, or undefined for the page-level settings. */
  instance?: WidgetInstance;
  onChangeSettings: (instanceId: string, settings: unknown) => void;
  onChangeFrame: (instanceId: string, frame: WidgetInstance['frame']) => void;
  /** Copies the widget beside itself. The original stays selected. */
  onDuplicate: (instanceId: string) => void;
  /** Removes the widget; the panel returns to the page settings. */
  onRemove: (instanceId: string) => void;
  /** A line in the widget footer: why Duplicate did nothing. */
  notice?: string | null;
  onChangeLayout: (layout: LayoutConfig) => void;
  onChangeTheme: (theme: ThemeConfig) => void;
  onChangeBackground: (background: BackgroundConfig) => void;
  onChangeConfig: (recipe: (config: StillpointConfig) => StillpointConfig) => void;
  /** Return from a widget's settings to the page's. Clears the selection. */
  onBack: () => void;
  /** Collapse the panel entirely, giving its width back to the canvas. */
  onHide: () => void;
  /** Opens the extension's own options page. Absent in contexts that have none. */
  onOpenOptions?: () => void;
  onCommit: () => void;
}

export function EditPanel({
  config,
  profile,
  instance,
  onChangeSettings,
  onChangeFrame,
  onDuplicate,
  onRemove,
  notice,
  onChangeLayout,
  onChangeTheme,
  onChangeBackground,
  onChangeConfig,
  onBack,
  onHide,
  onOpenOptions,
  onCommit,
}: EditPanelProps) {
  /**
   * Which page-settings category is open. Held here rather than in `PageSettings`,
   * where it belongs conceptually, because `PageSettings` unmounts the moment a
   * widget is selected — and losing the open category every time the user glances at
   * a widget is most of the friction the accordion was meant to remove.
   *
   * One at a time. Five open categories are taller than the window, which is the
   * problem being solved.
   */
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggleSection = useCallback(
    (id: string) => setOpenSection((current) => (current === id ? null : id)),
    [],
  );

  const definition = instance ? widgetRegistry.get(instance.type) : undefined;
  const title = instance
    ? (definition?.name ?? instance.type)
    : i18n.t('panel.pageSettings');

  return (
    <aside
      className={styles.panel}
      // `complementary`, not `dialog`: the canvas beside it stays live and the user is
      // meant to keep working there. A dialog would imply a focus trap and a modal
      // backdrop, both of which would get in the way of the live preview.
      aria-label={instance ? i18n.t('panel.widgetSettings', { name: title }) : title}
      // Writes are debounced by the store; focus leaving the panel is the moment to
      // stop waiting. Nothing is lost without it — the debounce fires on its own, and
      // leaving edit mode flushes — but a setting that reaches disk when the user
      // stops typing is a setting that survives the browser being killed.
      onBlur={onCommit}
    >
      <header className={styles.header}>
        {instance && (
          <button
            type="button"
            className={styles.back}
            aria-label={i18n.t('panel.back')}
            onClick={onBack}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}

        <h2 className={styles.title}>{title}</h2>

        <button
          type="button"
          className={styles.close}
          aria-label={i18n.t('panel.hide')}
          onClick={onHide}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {instance ? (
        <WidgetSettings
          key={instance.instanceId}
          instance={instance}
          onChangeSettings={onChangeSettings}
          onChangeFrame={onChangeFrame}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          notice={notice}
          onCommit={onCommit}
        />
      ) : (
        <PageSettings
          config={config}
          profile={profile}
          onChangeLayout={onChangeLayout}
          onChangeTheme={onChangeTheme}
          onChangeBackground={onChangeBackground}
          onChangeConfig={onChangeConfig}
          onOpenOptions={onOpenOptions}
          openSection={openSection}
          onToggleSection={toggleSection}
        />
      )}
    </aside>
  );
}
