import { i18n } from '#i18n';
import { useState } from 'react';
import { colorAlpha, colorToHex, withAlpha } from '@/core/theme/color';
import type { ControlProps } from '@/core/registry/types';
import styles from './Controls.module.css';

/**
 * A native colour picker with the value beside it.
 *
 * Both halves are needed. `<input type="color">` cannot be typed into, and a user
 * matching a widget to a palette has the hex in their clipboard, not in their eye.
 *
 * The text box takes hex or `rgb()`, and nothing reaches the config until it parses:
 * `#7a` is a hex on its way somewhere, and writing it would repaint the page with a
 * broken token on every keystroke. A draft holds the half-typed text, exactly as
 * `NumberControl` does, and is dropped on blur or when the value moves on its own.
 *
 * The swatch only ever receives a valid six-digit hex — Firefox silently rewrites
 * anything else to black — and a pick keeps the opacity of the colour it replaces,
 * because the picker has no way to show alpha and must not quietly make a
 * translucent surface opaque.
 */
export function ColorControl({ id, value, onChange, field }: ControlProps<string>) {
  const [draft, setDraft] = useState<{ text: string; of: string } | null>(null);
  const current = value ?? '';
  const text = draft && draft.of === current ? draft.text : current;

  return (
    <div className={styles.colorRow} role="group" aria-labelledby={`${id}-label`}>
      <input
        id={id}
        type="color"
        className={styles.swatch}
        value={colorToHex(current) ?? '#000000'}
        aria-label={i18n.t('controls.colour.picker', { label: field.label })}
        onChange={(event) =>
          onChange(withAlpha(event.target.value, colorAlpha(current)))
        }
      />
      <input
        type="text"
        className={`${styles.input} ${styles.hex}`}
        value={text}
        spellCheck={false}
        aria-label={i18n.t('controls.colour.value', { label: field.label })}
        onChange={(event) => {
          const raw = event.target.value;
          const usable = colorToHex(raw) !== null;
          setDraft({ text: raw, of: usable ? raw.trim() : current });
          if (usable) onChange(raw.trim());
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}
