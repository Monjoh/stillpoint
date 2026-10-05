import { useEffect, useRef } from 'react';
import styles from './EditToolbar.module.css';

const SHORTCUTS: [keys: string[], action: string][] = [
  [['E'], 'Edit the layout'],
  [['Esc'], 'Close the panel, then leave edit mode'],
  [['←', '→', '↑', '↓'], 'Move the selected widget'],
  [['Shift', '+', 'arrows'], 'Resize it'],
  [['Delete'], 'Remove it (or Backspace)'],
  [['Ctrl', '+', 'D'], 'Duplicate it (⌘ on a Mac)'],
  [['/'], 'Jump to the search box'],
];

/** Keyboard shortcuts, on demand. Closes on Escape without leaving edit mode. */
export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Capture phase, ahead of useEditSession's Escape, as in WidgetPicker.
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div
      ref={panel}
      className={styles.shortcuts}
      role="dialog"
      aria-label="Keyboard shortcuts"
      tabIndex={-1}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className={styles.shortcutsLead}>
        Drag a widget to move it, or its edges to resize it.
      </p>
      <dl className={styles.shortcutList}>
        {SHORTCUTS.map(([keys, action]) => (
          <div key={action} className={styles.shortcut}>
            <dt>
              {keys.map((key, i) =>
                key === '+' ? (
                  <span key={i}> + </span>
                ) : (
                  <kbd key={i} className={styles.kbd}>
                    {key}
                  </kbd>
                ),
              )}
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
