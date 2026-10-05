import { i18n } from '#i18n';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { widgetRegistry } from '@/core/registry';
import type { WidgetCategory } from '@/core/registry/types';
import styles from './WidgetPicker.module.css';

/**
 * Everything the build can add, straight from the registry. No hand-maintained list —
 * that is the whole promise of "adding a widget costs one array entry", and a picker
 * with its own copy of the catalogue would quietly break it on the first new widget.
 *
 * A real ARIA menu (S29): categories are `group`s labelled by their title, since a
 * menu may hold only items and groups (headings made it invalid), and the keyboard
 * works as a screen reader user expects in one. Up and Down move (wrapping), Home and
 * End jump, a letter jumps to the next widget starting with it, Tab and Escape close.
 * Each item's name is the widget's name; its description is a description.
 */

/** The category's name, in the browser's language. Typed: a new category needs one. */
const categoryLabel = (category: WidgetCategory): string =>
  i18n.t(`picker.category.${category}`);

export interface WidgetPickerProps {
  onPick: (widgetId: string) => void;
  onClose: () => void;
}

export function WidgetPicker({ onPick, onClose }: WidgetPickerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...(panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ??
        []),
    ];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (index: number) => {
      event.preventDefault();
      items[(index + items.length) % items.length]?.focus();
    };

    if (event.key === 'ArrowDown') go(at + 1);
    else if (event.key === 'ArrowUp') go(at - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(items.length - 1);
    else if (event.key === 'Tab') {
      // A menu is one stop: Tab leaves it, closing it, as Escape does.
      event.preventDefault();
      onClose();
    } else if (/^\p{L}$/u.test(event.key)) {
      const letter = event.key.toLocaleLowerCase();
      const next = [...items.slice(at + 1), ...items.slice(0, at + 1)].find((item) =>
        item.dataset.name?.toLocaleLowerCase().startsWith(letter),
      );
      if (next) {
        event.preventDefault();
        next.focus();
      }
    }
  };

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
      aria-label={i18n.t('picker.label')}
      onKeyDown={onMenuKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {widgetRegistry.byCategory().map(({ category, widgets }) => (
        <div
          key={category}
          className={styles.group}
          role="group"
          aria-labelledby={`${idPrefix}-${category}`}
        >
          <div id={`${idPrefix}-${category}`} className={styles.groupTitle}>
            {categoryLabel(category)}
          </div>
          {widgets.map((widget) => (
            <button
              key={widget.id}
              type="button"
              role="menuitem"
              // Focus is moved by the arrow keys, not by Tab.
              tabIndex={-1}
              className={styles.item}
              data-name={widget.name}
              aria-labelledby={`${idPrefix}-${widget.id}-name`}
              aria-describedby={`${idPrefix}-${widget.id}`}
              onClick={() => onPick(widget.id)}
            >
              <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
                <path d={widget.icon} />
              </svg>
              <span className={styles.itemText}>
                <span id={`${idPrefix}-${widget.id}-name`} className={styles.itemName}>
                  {widget.name}
                </span>
                <span
                  id={`${idPrefix}-${widget.id}`}
                  className={styles.itemDescription}
                >
                  {widget.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
