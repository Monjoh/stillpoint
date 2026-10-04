import { useId, useMemo } from 'react';
import { timezoneNames } from '../timezones';
import type { ControlProps } from '@/core/registry/types';
import styles from './Controls.module.css';

/**
 * An IANA time zone, with the browser's own list behind a `<datalist>`.
 *
 * A text input rather than a select of six hundred options: typing "paris" and
 * picking from four matches beats scrolling. It stays a free text field on purpose —
 * a zone this browser does not know may still be valid on the machine the profile was
 * exported from, and `formatClock` already falls back to local time for one it cannot
 * resolve, so there is nothing to protect the user from by rejecting it here.
 *
 * Empty means the device's own zone, which is why this field is nullable.
 */
export function TimezoneControl({
  id,
  value,
  onChange,
  field,
}: ControlProps<string | null>) {
  const listId = useId();

  // The element, not the array. `Intl.supportedValuesOf` returns some six hundred
  // zones, and rebuilding six hundred React elements on every keystroke is waste
  // whether or not React ends up touching the DOM. Memoised here, the whole subtree
  // is skipped on re-render.
  const suggestions = useMemo(
    () => (
      <datalist id={listId}>
        {timezoneNames().map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    ),
    [listId],
  );

  return (
    <div className={styles.withButton}>
      <input
        id={id}
        type="text"
        className={styles.input}
        list={listId}
        value={value ?? ''}
        spellCheck={false}
        autoComplete="off"
        placeholder={localZone()}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : event.target.value)
        }
      />
      {suggestions}
      <button
        type="button"
        className={styles.iconButton}
        disabled={value === null || value === ''}
        aria-label={`Use this device’s time zone for ${field.label.toLowerCase()}`}
        onClick={() => onChange(null)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Device time zone';
  } catch {
    return 'Device time zone';
  }
}
