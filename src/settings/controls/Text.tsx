import type { ControlProps } from '@/core/registry/types';
import styles from './Controls.module.css';

/**
 * A nullable string field treats the empty input as "unset" rather than as `''`.
 * Without that, clearing `timezone` stores an empty string, which is not what the
 * schema means by null and not what the widget checks for.
 */
function emit(raw: string, field: ControlProps<string | null>['field']) {
  return field.nullable && raw === '' ? null : raw;
}

export function TextControl({
  id,
  value,
  onChange,
  field,
}: ControlProps<string | null>) {
  return (
    <input
      id={id}
      type="text"
      className={styles.input}
      value={value ?? ''}
      maxLength={field.maxLength}
      onChange={(event) => onChange(emit(event.target.value, field))}
    />
  );
}

export function TextareaControl({
  id,
  value,
  onChange,
  field,
}: ControlProps<string | null>) {
  return (
    <textarea
      id={id}
      className={styles.textarea}
      value={value ?? ''}
      rows={3}
      maxLength={field.maxLength}
      onChange={(event) => onChange(emit(event.target.value, field))}
    />
  );
}

/**
 * The browser's own date and time pickers. They hand back `YYYY-MM-DD` and `HH:mm`
 * whatever the language shows, which is what the schema stores; an incomplete entry
 * reads as `''`, "not set".
 */
export function DateControl({ id, value, onChange }: ControlProps<string | null>) {
  return (
    <input
      id={id}
      type="date"
      className={styles.input}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function TimeControl({ id, value, onChange }: ControlProps<string | null>) {
  return (
    <input
      id={id}
      type="time"
      className={styles.input}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
