import { i18n } from '#i18n';
import type { ComponentType } from 'react';
import type { ControlProps } from '@/core/registry/types';
import { groupFields, isVisible, type FieldDescriptor } from './describe';
import { ColorControl } from './controls/Color';
import { FontControl } from './controls/Font';
import { ListControl } from './controls/List';
import { NumberControl, SliderControl } from './controls/Number';
import { SegmentedControl, SelectControl } from './controls/Choice';
import {
  DateControl,
  TextControl,
  TextareaControl,
  TimeControl,
} from './controls/Text';
import { TimezoneControl } from './controls/Timezone';
import { ToggleControl } from './controls/Toggle';
import styles from './Fields.module.css';

/**
 * Descriptors → a form.
 *
 * The split that matters: `describe.ts` decides *what* each field is, this file
 * decides how it is drawn, and the controls know nothing about zod at all. Adding a
 * control is a row in the table below plus a component; it never means touching the
 * walker.
 *
 * The label, the `id` and the `<label for>` wiring are produced here rather than by
 * each control, which is the point of generating forms in the first place: a field
 * cannot ship unlabelled because no one is in a position to forget.
 */

/**
 * A control with its value type erased, which is what a table of heterogeneous
 * controls has to hold. `unknown` cannot stand in: `onChange` is contravariant in the
 * value, so `ControlProps<number>` is not assignable to `ControlProps<unknown>`. The
 * same deliberate `any` as `AnyWidgetDefinition`, and contained the same way — the
 * descriptor decided which control gets which field, and the schema re-validates
 * whatever comes back out.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Leaf = ComponentType<ControlProps<any>>;

/**
 * `label` wires a `<label for>` to a single focusable input. `group` is for controls
 * that are several elements — a radio group, two colour inputs — where `for` has
 * nothing single to point at and `aria-labelledby` is the honest wiring.
 */
const LEAF_CONTROLS: Record<string, { Control: Leaf; labelling: 'label' | 'group' }> = {
  text: { Control: TextControl as Leaf, labelling: 'label' },
  textarea: { Control: TextareaControl as Leaf, labelling: 'label' },
  number: { Control: NumberControl as Leaf, labelling: 'label' },
  slider: { Control: SliderControl as Leaf, labelling: 'label' },
  toggle: { Control: ToggleControl as Leaf, labelling: 'label' },
  select: { Control: SelectControl as Leaf, labelling: 'label' },
  segmented: { Control: SegmentedControl as Leaf, labelling: 'group' },
  color: { Control: ColorControl as Leaf, labelling: 'group' },
  font: { Control: FontControl as Leaf, labelling: 'label' },
  timezone: { Control: TimezoneControl as Leaf, labelling: 'label' },
  date: { Control: DateControl as Leaf, labelling: 'label' },
  time: { Control: TimeControl as Leaf, labelling: 'label' },
};

export interface GeneratedFieldsProps {
  fields: FieldDescriptor[];
  /** The values these fields describe — one object level, not the whole tree. */
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Namespaces generated `id`s, so two panels on screen cannot collide. */
  idPrefix: string;
}

export function GeneratedFields({
  fields,
  values,
  onChange,
  idPrefix,
}: GeneratedFieldsProps) {
  const sections = groupFields(fields.filter((field) => isVisible(field, values)));

  return (
    <div className={styles.fields}>
      {sections.map((section, index) => {
        const body = section.fields.map((field) => (
          <GeneratedField
            key={field.path}
            field={field}
            value={values[field.key]}
            onChange={(next) => onChange(field.key, next)}
            idPrefix={idPrefix}
          />
        ));

        if (!section.name)
          return (
            <div key={index} className={styles.fields}>
              {body}
            </div>
          );

        return (
          <section key={section.name} className={styles.section}>
            <h3 className={styles.sectionHeading}>{section.name}</h3>
            {body}
          </section>
        );
      })}
    </div>
  );
}

interface GeneratedFieldProps {
  field: FieldDescriptor;
  value: unknown;
  onChange: (next: unknown) => void;
  idPrefix: string;
}

function GeneratedField({ field, value, onChange, idPrefix }: GeneratedFieldProps) {
  const id = `${idPrefix}-${field.path}`;
  const labelId = `${id}-label`;
  const helpId = field.help ? `${id}-help` : undefined;

  if (field.control === 'group') {
    const nested = asRecord(value);
    return (
      <fieldset className={styles.group}>
        <legend className={styles.legend}>{field.label}</legend>
        {field.help && <p className={styles.help}>{field.help}</p>}
        <GeneratedFields
          fields={field.fields ?? []}
          values={nested}
          onChange={(key, next) => onChange({ ...nested, [key]: next })}
          idPrefix={idPrefix}
        />
      </fieldset>
    );
  }

  if (field.control === 'list') {
    return (
      <ListField field={field} value={value} onChange={onChange} idPrefix={idPrefix} />
    );
  }

  if (field.control === 'unsupported') {
    // Shown rather than skipped. A field that quietly fails to appear is a bug nobody
    // reports; a field that says it has no control is one someone can.
    return (
      <p className={styles.unsupported}>
        {i18n.t('controls.unsupported', { label: field.label })}
      </p>
    );
  }

  const leaf = LEAF_CONTROLS[field.control];
  // Both branches resolve to a module-level component, never one defined during
  // render — a fresh identity per render would remount the input and lose the caret.
  const Control = field.control === 'custom' ? field.component : leaf?.Control;
  if (!Control) return null;

  // A custom control is a single input as far as the generator can tell, so it is
  // labelled the ordinary way. If it is really a group it can set its own
  // aria-labelledby from the id it was given.
  const labelling = leaf?.labelling ?? 'label';
  const inline = field.control === 'toggle';

  return (
    <div
      className={styles.field}
      data-layout={inline ? 'inline' : 'stacked'}
      // The wrapper carries the group semantics so the control stays a plain input.
      {...(labelling === 'group'
        ? { role: 'group', 'aria-labelledby': labelId, 'aria-describedby': helpId }
        : {})}
    >
      {labelling === 'label' ? (
        <label className={styles.label} id={labelId} htmlFor={id}>
          {field.label}
        </label>
      ) : (
        <span className={styles.label} id={labelId}>
          {field.label}
        </span>
      )}

      <Control id={id} value={value} onChange={onChange} field={field} />

      {field.help && (
        <p className={styles.help} id={helpId}>
          {field.help}
        </p>
      )}
    </div>
  );
}

function ListField({ field, value, onChange, idPrefix }: GeneratedFieldProps) {
  const rowFields = field.fields ?? [];
  const rows = Array.isArray(value) ? value : [];
  const id = `${idPrefix}-${field.path}`;

  const write = (next: unknown[]) => onChange(next);

  return (
    <div className={styles.field} role="group" aria-labelledby={`${id}-label`}>
      <span className={styles.label} id={`${id}-label`}>
        {field.label}
      </span>
      {field.help && <p className={styles.help}>{field.help}</p>}

      <ListControl
        id={id}
        label={field.itemLabel ?? field.label}
        rows={rows}
        maxRows={field.maxLength}
        onAdd={() => write([...rows, blankRow(rowFields)])}
        onRemove={(index) => write(rows.filter((_, i) => i !== index))}
        onMove={(index, delta) => write(swap(rows, index, index + delta))}
        renderRow={(index) => {
          const row = asRecord(rows[index]);
          return (
            <GeneratedFields
              fields={rowFields}
              values={row}
              onChange={(key, next) =>
                write(
                  rows.map((r, i) =>
                    i === index ? { ...asRecord(r), [key]: next } : r,
                  ),
                )
              }
              idPrefix={`${idPrefix}-${field.key}-${index}`}
            />
          );
        }}
      />
    </div>
  );
}

/**
 * A new row, built from the row fields' own defaults rather than by re-parsing the
 * element schema. Descriptors are plain data by design — keeping a live schema on
 * them to make one blank object would mean every test fixture had to carry one too.
 */
function blankRow(fields: FieldDescriptor[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined) row[field.key] = field.defaultValue;
    else if (field.nullable) row[field.key] = null;
    else if (field.control === 'toggle') row[field.key] = false;
    else if (field.control === 'number' || field.control === 'slider') {
      row[field.key] = field.min ?? 0;
    } else if (field.control === 'list') row[field.key] = [];
    else if (field.control === 'group') row[field.key] = blankRow(field.fields ?? []);
    else row[field.key] = field.options?.[0]?.value ?? '';
  }
  return row;
}

function swap<T>(items: T[], a: number, b: number): T[] {
  if (b < 0 || b >= items.length) return items;
  const next = [...items];
  [next[a], next[b]] = [next[b] as T, next[a] as T];
  return next;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
