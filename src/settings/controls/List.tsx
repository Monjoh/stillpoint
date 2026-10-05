import { i18n } from '#i18n';
import type { ReactNode } from 'react';
import styles from './Controls.module.css';

/**
 * Add, remove and reorder rows. The contents of a row are not this component's
 * business: the generator renders them, because a row is itself a set of generated
 * fields and the recursion belongs where the walker is.
 *
 * Reorder is by button, not by drag. Two arrows are operable by keyboard, by touch
 * and by screen reader on the first attempt, and a settings list is three or four
 * rows long — the ceremony of a drag implementation buys nothing here. The canvas is
 * where dragging earns its keep.
 */
export interface ListControlProps {
  id: string;
  label: string;
  rows: unknown[];
  renderRow: (index: number) => ReactNode;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, delta: number) => void;
}

export function ListControl({
  id,
  label,
  rows,
  renderRow,
  onAdd,
  onRemove,
  onMove,
}: ListControlProps) {
  return (
    <div className={styles.list} id={id}>
      {rows.length === 0 && (
        <p className={styles.listEmpty}>{i18n.t('controls.list.empty')}</p>
      )}

      {rows.map((_, index) => (
        <div key={index} className={styles.row}>
          <div className={styles.rowFields}>{renderRow(index)}</div>
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.iconButton}
              disabled={index === 0}
              aria-label={i18n.t('controls.list.moveUp', { item: label, n: index + 1 })}
              onClick={() => onMove(index, -1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 14l6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              disabled={index === rows.length - 1}
              aria-label={i18n.t('controls.list.moveDown', {
                item: label,
                n: index + 1,
              })}
              onClick={() => onMove(index, 1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 10l6 6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={i18n.t('controls.list.remove', { item: label, n: index + 1 })}
              onClick={() => onRemove(index)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      <button type="button" className={styles.addRow} onClick={onAdd}>
        {i18n.t('controls.list.add', { item: label })}
      </button>
    </div>
  );
}
