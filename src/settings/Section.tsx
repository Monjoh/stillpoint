import type { ReactNode } from 'react';
import styles from './Section.module.css';

/**
 * A collapsible settings category.
 *
 * The panel grew past the height of the window once theme and background arrived,
 * and a sidebar you have to scroll to find the thing you came for is a worse sidebar.
 * Collapsed, each category is one row; the whole of page settings fits without
 * scrolling and reads as a menu.
 *
 * Built from a button and a conditional rather than `<details>`/`<summary>`, which
 * would have given the keyboard and screen-reader behaviour for free. The reason is
 * that only one section is open at a time, which means the open state has to live
 * above these components — and a controlled `<details>` fights its own internal
 * state. `aria-expanded` plus `aria-controls` is the same contract, written out.
 *
 * The `value` is what makes collapsing cheap rather than a hiding place: a collapsed
 * row still says Midnight, or 24 × 12, so the panel answers most questions without
 * being opened at all.
 */

export interface SectionProps {
  id: string;
  title: string;
  /** The current setting, shown on the collapsed row. Keep it to a few words. */
  value?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

export function Section({ id, title, value, open, onToggle, children }: SectionProps) {
  const bodyId = `${id}-body`;

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onToggle(id)}
        >
          <svg viewBox="0 0 24 24" className={styles.chevron} aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span className={styles.title}>{title}</span>
          {/* Hidden when open: the section itself is then saying it, louder. */}
          {value !== undefined && !open && (
            <span className={styles.value}>{value}</span>
          )}
        </button>
      </h3>

      {/* Unmounted rather than hidden. A closed section holds no focusable element,
          so Tab goes straight to the next category instead of through a form nobody
          can see. */}
      {open && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  );
}
