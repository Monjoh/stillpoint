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
  const handleAdd = (widgetId: string) => {
    const definition = widgetRegistry.get(widgetId);
    if (!definition) return;

    const next = addWidget(profile, definition);
    onChange(next);
    onCommit();
    // Select what was just added, so it can be nudged or resized immediately rather
    // than having to be found and clicked first.
    onSelect(next.widgets[next.widgets.length - 1]?.instanceId ?? null);
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
        <EditToolbar
          profile={profile}
          panelOpen={panelOpen}
          onAdd={handleAdd}
          onTogglePanel={onTogglePanel}
          onExit={onExit}
        />,
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
            onDuplicate={(instanceId) => {
              onChange(duplicateWidget(profile, instanceId));
              onCommit();
            }}
            onRemove={(instanceId) => {
              onChange(removeWidget(profile, instanceId));
              onSelect(null);
              onCommit();
            }}
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
        onCommit={onCommit}
      />
    </>
  );
}
