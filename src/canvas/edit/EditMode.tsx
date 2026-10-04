import { createPortal } from 'react-dom';
import type { Profile } from '@/core/config/schema';
import { widgetRegistry } from '@/core/registry';
import type { CanvasGeometry } from '../geometry';
import { addWidget } from '../operations';
import { EditLayer } from './EditLayer';
import { EditToolbar } from './EditToolbar';
import './ui-tokens.css';

/**
 * The whole of edit mode, behind one lazy import.
 *
 * Nothing in this folder — the toolbar, the picker, the drag arithmetic, the tool
 * chrome tokens — is fetched until someone actually edits. That is the point: view
 * mode runs on every new tab, and editing runs almost never.
 */

export interface EditModeProps {
  geometry: CanvasGeometry;
  profile: Profile;
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
  onChange: (profile: Profile) => void;
  onCommit: () => void;
  onExit: () => void;
}

export default function EditMode({
  geometry,
  profile,
  selectedId,
  onSelect,
  onChange,
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

  return (
    <>
      {/* Portalled to the body rather than left where it is rendered. The edit layer
          has to live inside the canvas to share its geometry, but the toolbar is
          viewport chrome — and a `position: fixed` element nested in the canvas would
          be silently clipped the day any ancestor grows a transform or a containment
          property. */}
      {createPortal(
        <EditToolbar profile={profile} onAdd={handleAdd} onExit={onExit} />,
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
