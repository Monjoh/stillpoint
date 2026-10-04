import { useState } from 'react';
import type { ControlProps } from '@/core/registry/types';
import styles from './Controls.module.css';

/**
 * A number input that can actually be typed in.
 *
 * The box holds text; the config holds a number. Feeding the input straight from the
 * config means `-`, `1.` and an empty box — every intermediate state of typing a
 * number — are erased the moment they are entered. So a draft is kept alongside the
 * value it was derived from, and is discarded the instant the stored value moves on
 * its own (a reset, an undo, the same field edited elsewhere). No effect, no
 * resyncing: the comparison happens during render, where it is always current.
 */
export function NumberControl({
  id,
  value,
  onChange,
  field,
}: ControlProps<number | null>) {
  const [draft, setDraft] = useState<{ text: string; of: number | null } | null>(null);
  const text = draft && draft.of === value ? draft.text : String(value ?? '');

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      className={styles.input}
      value={text}
      min={field.min}
      max={field.max}
      step={field.step}
      onChange={(event) => {
        const raw = event.target.value;
        const parsed = Number(raw);
        const empty = raw.trim() === '';
        // An empty box means null where the schema allows one — the only way a
        // nullable number can express "no value", and `maxWidth`'s help text promises
        // it. Where the schema does not, an empty box is a half-typed number and
        // nothing is written until it becomes one.
        const next = empty ? (field.nullable ? null : undefined) : parsed;
        const usable = next === null || (next !== undefined && Number.isFinite(next));
        setDraft({ text: raw, of: usable ? next : value });
        if (usable) onChange(next);
      }}
      // Leaving the field ends the edit: whatever is stored is what should be shown,
      // so a half-typed "1." does not linger next to a widget rendering 1.
      onBlur={() => setDraft(null)}
    />
  );
}

export function SliderControl({ id, value, onChange, field }: ControlProps<number>) {
  return (
    <div className={styles.sliderRow}>
      <input
        id={id}
        type="range"
        className={styles.slider}
        value={value}
        min={field.min ?? 0}
        max={field.max ?? 100}
        step={field.step ?? 1}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
      {/* aria-hidden: the range input announces its own value, and a screen reader
          reading the number a second time is worse than leaving it unstyled. */}
      <output htmlFor={id} className={styles.readout} aria-hidden="true">
        {value}
        {field.unit}
      </output>
    </div>
  );
}
