import type { ControlProps } from '@/core/registry/types';
import styles from './Controls.module.css';

/**
 * A real checkbox, restyled. Not a `div role="switch"`: the native control already
 * carries the keyboard behaviour, the form semantics and the checked state that a
 * hand-rolled switch has to reimplement and usually gets half right.
 */
export function ToggleControl({ id, value, onChange }: ControlProps<boolean>) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      className={styles.switch}
      checked={value}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
