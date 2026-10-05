import { i18n } from '#i18n';
import { useEffect, useRef } from 'react';
import styles from './EditToolbar.module.css';

/** Key caps, then what they do. `+` joins a chord. Key names are translated too. */
const shortcuts = (): [keys: string[], action: string][] => [
  [['E'], i18n.t('shortcuts.edit')],
  [[i18n.t('keys.esc')], i18n.t('shortcuts.escape')],
  [['←', '→', '↑', '↓'], i18n.t('shortcuts.move')],
  [[i18n.t('keys.shift'), '+', i18n.t('keys.arrows')], i18n.t('shortcuts.resize')],
  [[i18n.t('keys.delete')], i18n.t('shortcuts.remove')],
  [[i18n.t('keys.ctrl'), '+', 'D'], i18n.t('shortcuts.duplicate')],
  [['/'], i18n.t('shortcuts.search')],
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
      aria-label={i18n.t('edit.shortcuts')}
      tabIndex={-1}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className={styles.shortcutsLead}>{i18n.t('shortcuts.lead')}</p>
      <dl className={styles.shortcutList}>
        {shortcuts().map(([keys, action]) => (
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
