import { useEffect, useRef } from 'react';
import { widgetRegistry } from '@/core/registry';
import styles from './WidgetPicker.module.css';

/**
 * Everything the build can add, straight from the registry. No hand-maintained list —
 * that is the whole promise of "adding a widget costs one array entry", and a picker
 * with its own copy of the catalogue would quietly break it on the first new widget.
 */

const CATEGORY_LABELS: Record<string, string> = {
  time: 'Time',
  info: 'Information',
  navigation: 'Navigation',
  productivity: 'Productivity',
  decoration: 'Decoration',
};

export interface WidgetPickerProps {
  onPick: (widgetId: string) => void;
  onClose: () => void;
}

export function WidgetPicker({ onPick, onClose }: WidgetPickerProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Closing the picker, not leaving edit mode: the outer Escape handler would
      // otherwise drop the user all the way back to view mode.
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };

    // Capture phase, so this runs before the window-level binding in useEditSession.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div
      ref={panel}
      className={styles.picker}
      role="menu"
      aria-label="Add a widget"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {widgetRegistry.byCategory().map(({ category, widgets }) => (
        <section key={category} className={styles.group}>
          <h2 className={styles.groupTitle}>{CATEGORY_LABELS[category] ?? category}</h2>
          {widgets.map((widget) => (
            <button
              key={widget.id}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => onPick(widget.id)}
            >
              <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                <path d={widget.icon} />
              </svg>
              <span className={styles.itemText}>
                <span className={styles.itemName}>{widget.name}</span>
                <span className={styles.itemDescription}>{widget.description}</span>
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
