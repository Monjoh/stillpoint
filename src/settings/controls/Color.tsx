import type { ControlProps } from '@/core/registry/types';
import styles from './Controls.module.css';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * A native colour picker with the hex beside it.
 *
 * Both halves are needed. `<input type="color">` cannot be typed into, and a user
 * matching a widget to a palette has the hex in their clipboard, not in their eye.
 * The swatch only ever receives a valid six-digit hex: Firefox silently rewrites
 * anything else to black, which would eat the user's value mid-keystroke.
 */
export function ColorControl({ id, value, onChange, field }: ControlProps<string>) {
  const valid = HEX.test(value ?? '');

  return (
    <div className={styles.colorRow} role="group" aria-labelledby={`${id}-label`}>
      <input
        id={id}
        type="color"
        className={styles.swatch}
        value={valid ? value : '#000000'}
        aria-label={`${field.label}, colour picker`}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        className={`${styles.input} ${styles.hex}`}
        value={value ?? ''}
        spellCheck={false}
        aria-label={`${field.label}, hex value`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
