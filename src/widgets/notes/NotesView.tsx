import { i18n } from '#i18n';
import type { WidgetProps } from '@/core/registry/types';
import { NOTE_MAX_LENGTH, type NotesSettings } from './definition';
import styles from './NotesView.module.css';

/**
 * A note typed straight onto the page. Saved as it is typed: through the store's
 * debounce, and flushed when the tab is hidden or closed. There is no Save button.
 *
 * The one widget allowed to scroll (with Todo): a note is the user's text, and it
 * cannot be dropped to fit the way a clock drops its seconds.
 */
export default function NotesView({
  settings,
  isEditing,
  updateSettings,
}: WidgetProps<NotesSettings>) {
  return (
    <textarea
      className={styles.note}
      style={{ fontSize: `min(${settings.fontSize}px, 9cqw)` }}
      value={settings.text}
      onChange={(event) => {
        // Captured here: the recipe runs later, inside the store's update.
        const text = event.target.value;
        updateSettings?.((current) => ({ ...current, text }));
      }}
      aria-label={i18n.t('widget.notes.label')}
      placeholder={i18n.t('widget.notes.placeholder')}
      maxLength={NOTE_MAX_LENGTH}
      // In edit mode the note is something to move, not to type into.
      readOnly={isEditing || !updateSettings}
      tabIndex={isEditing ? -1 : undefined}
    />
  );
}
