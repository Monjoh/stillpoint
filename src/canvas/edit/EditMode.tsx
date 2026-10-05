import { i18n } from '#i18n';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  BackgroundConfig,
  LayoutConfig,
  Profile,
  StillpointConfig,
  ThemeConfig,
} from '@/core/config/schema';
import { widgetRegistry } from '@/core/registry';
import { EditPanel } from '@/settings/EditPanel';
import type { CanvasGeometry } from '../geometry';
import {
  addWidget,
  duplicateWidget,
  removeWidget,
  setLayout,
  updateWidgetSettings,
  updateWidgetFrame,
} from '../operations';
import { EditLayer } from './EditLayer';
import { EditToolbar } from './EditToolbar';
import layerStyles from './EditLayer.module.css';
import '@/core/theme/ui-tokens.css';

/**
 * The whole of edit mode, behind one lazy import.
 *
 * Nothing in this folder — the toolbar, the picker, the drag arithmetic, the tool
 * chrome tokens — is fetched until someone actually edits. That is the point: view
 * mode runs on every new tab, and editing runs almost never.
 */

export interface EditModeProps {
  geometry: CanvasGeometry;
  config: StillpointConfig;
  profile: Profile;
  selectedId: string | null;
  /** The settings sidebar is showing. Open for the whole of edit mode by default. */
  panelOpen: boolean;
  onSelect: (instanceId: string | null) => void;
  onChange: (profile: Profile) => void;
  onChangeConfig: (recipe: (config: StillpointConfig) => StillpointConfig) => void;
  onTogglePanel: () => void;
  onOpenOptions?: () => void;
  onCommit: () => void;
  onExit: () => void;
}

/** `focusAfterRemoval`'s target for the panel's heading rather than a widget. */
const PANEL = '\u0000panel';

export default function EditMode({
  geometry,
  config,
  profile,
  selectedId,
  panelOpen,
  onSelect,
  onChange,
  onChangeConfig,
  onTogglePanel,
  onOpenOptions,
  onCommit,
  onExit,
}: EditModeProps) {
  /**
   * Said when an add or a duplicate finds no room. Adding more columns or rows would
   * not help (the layout rescales with the grid), so it says what does.
   *
   * Shown beside whatever was used: under the toolbar for Add and ⌘D, in the panel's
   * footer for its Duplicate button. Under the toolbar only, it was a screen's height
   * away from the button and went unseen (S27, user).
   */
  const [noRoom, setNoRoom] = useState<{
    text: string;
    at: 'toolbar' | 'panel';
  } | null>(null);
  useEffect(() => {
    if (noRoom === null) return;
    const timer = setTimeout(() => setNoRoom(null), 8000);
    return () => clearTimeout(timer);
  }, [noRoom]);

  const handleAdd = (widgetId: string) => {
    const definition = widgetRegistry.get(widgetId);
    if (!definition) return;

    const next = addWidget(profile, definition);
    if (!next) {
      setNoRoom({
        text: i18n.t('edit.noRoom', { name: definition.name }),
        at: 'toolbar',
      });
      return;
    }
    setNoRoom(null);
    onChange(next);
    onCommit();
    // Select what was just added, so it can be nudged or resized immediately rather
    // than having to be found and clicked first.
    onSelect(next.widgets[next.widgets.length - 1]?.instanceId ?? null);
  };

  /**
   * From the panel's Duplicate and from ⌘D on the canvas alike. The copy is selected,
   * as an added widget is: it may have been shrunk into a gap far from the original,
   * and an unselected copy there looked like nothing had happened.
   */
  const handleDuplicate = (instanceId: string, at: 'toolbar' | 'panel') => {
    const type = profile.widgets.find((w) => w.instanceId === instanceId)?.type;
    const definition = type ? widgetRegistry.get(type) : null;
    const next = duplicateWidget(profile, instanceId, definition?.minSize);
    if (!next) {
      setNoRoom({
        text: i18n.t('edit.noRoom', { name: definition?.name ?? type ?? '' }),
        at,
      });
      return;
    }
    setNoRoom(null);
    onChange(next);
    onCommit();
    if (next === profile) return;
    const copy = next.widgets[next.widgets.length - 1]!;
    onSelect(copy.instanceId);
    announce(
      i18n.t('edit.announce.duplicated', {
        name: definition?.name ?? copy.type,
        column: copy.rect.x + 1,
        row: copy.rect.y + 1,
      }),
    );
  };

  /**
   * What a screen reader is told after a keyboard edit: a move, a resize, a removal.
   * The polite region below reads it out. The same text twice in a row would not be
   * read again, so a repeat gets an invisible difference.
   */
  const [announcement, setAnnouncement] = useState('');
  const announce = (text: string) =>
    setAnnouncement((previous) => (previous === text ? `${text}\u00a0` : text));

  /**
   * Where the keyboard focus goes once a removal has rendered. Without it, focus fell
   * to the page body with the removed element, and a keyboard user had to start again
   * from the top (S29). It stays where the action was: Delete on the canvas moves to
   * the next widget (or "Add widget" when none are left); the panel's Remove moves to
   * the panel's heading, now "Page settings". Focusing a widget selects it, so the
   * panel's Remove must not, or the panel would jump to another widget's settings.
   */
  const focusAfterRemoval = useRef<string | null>(null);
  useEffect(() => {
    const target = focusAfterRemoval.current;
    if (target === null) return;
    focusAfterRemoval.current = null;
    const next =
      target === PANEL
        ? document.querySelector<HTMLElement>('[data-panel-title]')
        : (document.querySelector<HTMLElement>(`[data-box="${CSS.escape(target)}"]`) ??
          document.querySelector<HTMLElement>('[role="toolbar"] button'));
    next?.focus();
  }, [profile]);

  const handleRemove = (instanceId: string, from: 'canvas' | 'panel') => {
    const index = profile.widgets.findIndex((w) => w.instanceId === instanceId);
    const removed = profile.widgets[index];
    if (!removed) return;
    const rest = profile.widgets.filter((w) => w.instanceId !== instanceId);
    focusAfterRemoval.current =
      from === 'panel' ? PANEL : ((rest[index] ?? rest[index - 1])?.instanceId ?? '');
    onChange(removeWidget(profile, instanceId));
    onSelect(null);
    onCommit();
    announce(
      i18n.t('edit.announce.removed', {
        name: widgetRegistry.get(removed.type)?.name ?? removed.type,
      }),
    );
  };

  const selected = profile.widgets.find((w) => w.instanceId === selectedId);

  return (
    <>
      {/* Portalled to the body rather than left where it is rendered. The edit layer
          has to live inside the canvas to share its geometry, but the toolbar is
          viewport chrome — and a `position: fixed` element nested in the canvas would
          be silently clipped the day any ancestor grows a transform or a containment
          property. */}
      {createPortal(
        // In a `header`, so the toolbar sits in a landmark (S29). The view-mode strip,
        // the other header, is never on screen at the same time.
        <header>
          <EditToolbar
            profile={profile}
            panelOpen={panelOpen}
            notice={noRoom?.at === 'toolbar' ? noRoom.text : null}
            onDismissNotice={() => setNoRoom(null)}
            onAdd={handleAdd}
            onTogglePanel={onTogglePanel}
            onExit={onExit}
          />
        </header>,
        document.body,
      )}
      {/* Portalled for the same reason as the toolbar, plus one of its own: the edit
          layer deselects on any pointer down that is not on a widget, and the panel
          has to be somewhere that is not inside it. The room it occupies is reserved
          by the stage — `panelOpen` in NewTab.tsx. */}
      {panelOpen &&
        createPortal(
          <EditPanel
            config={config}
            profile={profile}
            instance={selected}
            onChangeSettings={(instanceId, settings) =>
              onChange(updateWidgetSettings(profile, instanceId, settings))
            }
            onChangeFrame={(instanceId, frame) =>
              onChange(updateWidgetFrame(profile, instanceId, frame))
            }
            // The same operations as Delete and ⌘D on the canvas (EditLayer).
            onDuplicate={(instanceId) => handleDuplicate(instanceId, 'panel')}
            notice={noRoom?.at === 'panel' ? noRoom.text : null}
            onRemove={(instanceId) => handleRemove(instanceId, 'panel')}
            onChangeLayout={(layout: LayoutConfig) =>
              onChange(setLayout(profile, layout))
            }
            // Plain field replacements, unlike the layout: neither the theme nor the
            // background touches a widget's rect, so there is nothing to rescale and
            // an operation in `canvas/operations.ts` would be ceremony.
            onChangeTheme={(theme: ThemeConfig) => onChange({ ...profile, theme })}
            onChangeBackground={(background: BackgroundConfig) =>
              onChange({ ...profile, background })
            }
            onChangeConfig={onChangeConfig}
            onOpenOptions={onOpenOptions}
            onCommit={onCommit}
            onBack={() => onSelect(null)}
            onHide={onTogglePanel}
          />,
          document.body,
        )}

      <EditLayer
        geometry={geometry}
        profile={profile}
        selectedId={selectedId}
        onSelect={onSelect}
        onChange={onChange}
        onDuplicate={(instanceId) => handleDuplicate(instanceId, 'toolbar')}
        onRemove={(instanceId) => handleRemove(instanceId, 'canvas')}
        onAnnounce={announce}
        onCommit={onCommit}
      />

      {/* Always in the tree, so its changes are read out. Polite: after whatever the
          screen reader is saying. */}
      <p className={layerStyles.hidden} role="status">
        {announcement}
      </p>
    </>
  );
}
