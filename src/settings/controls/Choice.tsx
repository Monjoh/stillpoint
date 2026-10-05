import { i18n } from '#i18n';
import type { ControlProps } from '@/core/registry/types';
import styles from './Controls.module.css';

export function SelectControl({
  id,
  value,
  onChange,
  field,
}: ControlProps<string | null>) {
  return (
    <select
      id={id}
      className={styles.select}
      value={value ?? ''}
      onChange={(event) =>
        onChange(
          field.nullable && event.target.value === '' ? null : event.target.value,
        )
      }
    >
      {field.nullable && <option value="">{i18n.t('controls.notSet')}</option>}
      {field.options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A radio group drawn as a row of buttons.
 *
 * `role="radiogroup"` with roving `tabIndex` rather than a `<select>`: with three or
 * fewer options every choice is visible at once, which is worth the extra markup. The
 * group's label comes from the generator, which sets `aria-labelledby` on the wrapper.
 */
export function SegmentedControl({ id, value, onChange, field }: ControlProps<string>) {
  const options = field.options ?? [];
  const index = options.findIndex((option) => option.value === value);

  // Arrows must move focus as well as selection, or the user is left tabbed onto a
  // button that is no longer the checked one and the roving tabIndex points elsewhere.
  const move = (from: HTMLElement, delta: number) => {
    if (options.length === 0) return;
    const at = (index + delta + options.length) % options.length;
    const next = options[at];
    if (!next) return;
    onChange(next.value);
    const sibling = from.parentElement?.children[at];
    if (sibling instanceof HTMLElement) sibling.focus();
  };

  return (
    <div className={styles.segmented} role="radiogroup" id={id}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            className={styles.segment}
            // Roving tabIndex: the group is one tab stop, arrows move within it.
            // Falls back to the first option when the stored value matches none.
            tabIndex={checked || (index === -1 && option === options[0]) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                move(event.currentTarget, 1);
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(event.currentTarget, -1);
              }
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
