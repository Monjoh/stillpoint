import { i18n } from '#i18n';
import { useRef, useState } from 'react';
import type { Profile } from '@/core/config/schema';
import { ShortcutHelp } from './ShortcutHelp';
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
  /** One line under the buttons: why an add did nothing. */
  notice?: string | null;
  onDismissNotice?: () => void;
  onAdd: (widgetId: string) => void;
  onTogglePanel: () => void;
  onExit: () => void;
}

export function EditToolbar({
  profile,
  panelOpen,
  notice,
  onDismissNotice,
  onAdd,
  onTogglePanel,
  onExit,
}: EditToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={styles.toolbar}
      data-panel={panelOpen || undefined}
      role="toolbar"
      aria-label={i18n.t('edit.toolbar')}
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
        {i18n.t('edit.addWidget')}
      </button>

      <span className={styles.profile} title={i18n.t('edit.profile')}>
        {profile.name}
      </span>

      {/* The shortcuts used to be spelled out here, which made the bar too wide for a
          half-screen window. Listed on demand instead: nothing depends on them. */}
      <button
        ref={helpButton}
        type="button"
        className={styles.help}
        aria-label={i18n.t('edit.shortcuts')}
        aria-expanded={helpOpen}
        onClick={() => setHelpOpen((open) => !open)}
      >
        ?
      </button>

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
        {i18n.t('edit.settings')}
      </button>

      <button type="button" className={styles.done} onClick={onExit}>
        {i18n.t('edit.done')}
      </button>

      {/* Always in the tree, so a screen reader hears it when the text arrives. */}
      <p className={styles.notice} role="status" hidden={!notice}>
        {notice && (
          <svg viewBox="0 0 24 24" className={styles.noticeIcon} aria-hidden="true">
            <path d="M12 4 2.5 20h19L12 4Z M12 10v4.5 M12 17.2v.3" />
          </svg>
        )}
        <span className={styles.noticeText}>{notice}</span>
        {notice && onDismissNotice && (
          <button
            type="button"
            className={styles.dismiss}
            aria-label={i18n.t('edit.dismiss')}
            onClick={onDismissNotice}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        )}
      </p>

      {helpOpen && (
        <ShortcutHelp
          onClose={() => {
            setHelpOpen(false);
            helpButton.current?.focus();
          }}
        />
      )}

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
