import { useRef, useState } from 'react';
import type { Profile } from '@/core/config/schema';
import { WidgetPicker } from './WidgetPicker';
import styles from './EditToolbar.module.css';

/**
 * Edit mode's only permanent chrome. Everything else on screen stays the user's.
 *
 * Theme and background buttons are not here yet on purpose: they belong to M4, and a
 * disabled button that does nothing teaches the user less than no button at all.
 */

export interface EditToolbarProps {
  profile: Profile;
  /** The settings sidebar has taken its width out of the stage; recentre over what is left. */
  panelOpen?: boolean;
  onAdd: (widgetId: string) => void;
  onTogglePanel: () => void;
  onExit: () => void;
}

export function EditToolbar({
  profile,
  panelOpen,
  onAdd,
  onTogglePanel,
  onExit,
}: EditToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={styles.toolbar}
      data-panel={panelOpen || undefined}
      role="toolbar"
      aria-label="Edit layout"
    >
      <button
        ref={addButton}
        type="button"
        className={styles.action}
        aria-expanded={pickerOpen}
        aria-haspopup="menu"
        onClick={() => setPickerOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add widget
      </button>

      <span className={styles.separator} aria-hidden="true" />
      <span className={styles.profile}>{profile.name}</span>
      <span className={styles.separator} aria-hidden="true" />

      <span className={styles.hint}>
        Drag to move · arrows nudge · shift+arrows resize
      </span>

      {/* The panel is open for the whole of edit mode, so this is the only way to get
          the width back — and on a window too narrow to displace the canvas it is how
          the panel is opened in the first place. */}
      <button
        type="button"
        className={styles.action}
        aria-pressed={panelOpen ?? false}
        onClick={onTogglePanel}
      >
        <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
          <path d="M4 5h16v14H4zM15 5v14" />
        </svg>
        Settings
      </button>

      <button type="button" className={styles.done} onClick={onExit}>
        Done
      </button>

      {pickerOpen && (
        <WidgetPicker
          onPick={(widgetId) => {
            onAdd(widgetId);
            setPickerOpen(false);
            addButton.current?.focus();
          }}
          onClose={() => {
            setPickerOpen(false);
            addButton.current?.focus();
          }}
        />
      )}
    </div>
  );
}
