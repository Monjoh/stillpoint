import type { z } from 'zod';
import type { ControlField, FieldMeta } from '@/core/registry/types';
import {
  arrayElement,
  enumValues,
  numericRange,
  objectShape,
  maxLength,
  unwrap,
} from './unwrap';

/**
 * Schema → field descriptors. The control mapping table from docs/03-widget-api.md,
 * as a pure function so the decisions are testable without rendering anything.
 *
 * Nothing here touches React, and nothing here reads zod internals directly — that is
 * `unwrap.ts`'s job. This file only decides *which control* each field gets and what
 * it is told.
 */

export type ControlKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'toggle'
  | 'select'
  | 'segmented'
  | 'color'
  | 'font'
  | 'timezone'
  | 'date'
  | 'time'
  | 'list'
  | 'group'
  | 'custom'
  /** A schema shape with no control. Rendered as a disabled note, never dropped. */
  | 'unsupported';

export interface FieldDescriptor extends ControlField {
  /** The key within its own object — what `showIf.field` refers to. */
  key: string;
  /** Dotted path from the settings root, used for `id`s and React keys. */
  path: string;
  control: ControlKind;
  optional: boolean;
  defaultValue: unknown;
  showIf?: FieldMeta['showIf'];
  group?: string;
  order?: number;
  /** Dropped by `describeSchema`; present so `describeField` stays total. */
  hidden?: boolean;
  /** `group`: the nested fields. `list`: the fields of one row. */
  fields?: FieldDescriptor[];
  /** `list`: what one row is called. Defaults to `label`. */
  itemLabel?: string;
  /** `custom`: the widget's own control. */
  component?: FieldMeta['component'];
}

/** A segmented control past three options is a row of cramped, unreadable buttons. */
const MAX_SEGMENTS = 3;

export function describeSchema(schema: z.ZodType, prefix = ''): FieldDescriptor[] {
  const shape = objectShape(unwrap(schema).inner);
  if (!shape) return [];

  return Object.entries(shape)
    .map(([key, field], index) => ({ field: describeField(key, field, prefix), index }))
    .filter((entry) => !entry.field.hidden)
    .sort((a, b) => order(a) - order(b))
    .map((entry) => entry.field);
}

/** `order` when given, otherwise declaration order. Declared order is a real signal. */
function order(entry: { field: FieldDescriptor; index: number }): number {
  return entry.field.order ?? entry.index;
}

export function describeField(
  key: string,
  schema: z.ZodType,
  prefix = '',
): FieldDescriptor {
  const { inner, type, meta, optional, nullable, defaultValue } = unwrap(schema);
  const path = prefix ? `${prefix}.${key}` : key;

  const base: FieldDescriptor = {
    key,
    path,
    // A field with no `.meta()` still has to be usable: an unlabelled control is a
    // bug, but a *missing* control is a worse one.
    label: meta?.label ?? humanize(key),
    help: meta?.help,
    control: 'unsupported',
    optional,
    nullable,
    defaultValue,
    unit: meta?.unit,
    showIf: meta?.showIf,
    group: meta?.group,
    order: meta?.order,
    hidden: meta?.hidden,
    itemLabel: meta?.itemLabel,
  };

  // An explicit `control` in the metadata wins over anything inferred — that is the
  // whole point of it. `custom` additionally needs the component.
  if (meta?.control === 'custom') {
    return {
      ...base,
      control: meta.component ? 'custom' : 'unsupported',
      component: meta.component,
    };
  }

  switch (type) {
    case 'boolean':
      return { ...base, control: 'toggle' };

    case 'number': {
      const range = numericRange(inner);
      const step = meta?.step ?? range.step;
      const slider =
        meta?.control === 'slider' ||
        (meta?.control === undefined &&
          range.min !== undefined &&
          range.max !== undefined);
      return { ...base, control: slider ? 'slider' : 'number', ...range, step };
    }

    case 'enum': {
      const values = enumValues(inner) ?? [];
      const options = values.map((value) => ({
        value,
        label: meta?.options?.[value] ?? value,
      }));
      const control =
        meta?.control === 'select' || meta?.control === 'segmented'
          ? meta.control
          : values.length <= MAX_SEGMENTS
            ? 'segmented'
            : 'select';
      return { ...base, control, options };
    }

    case 'string': {
      const control =
        meta?.control === 'color' ||
        meta?.control === 'font' ||
        meta?.control === 'timezone' ||
        meta?.control === 'date' ||
        meta?.control === 'time' ||
        meta?.control === 'textarea' ||
        meta?.control === 'select'
          ? meta.control
          : 'text';
      const options = meta?.options
        ? Object.entries(meta.options).map(([value, label]) => ({ value, label }))
        : undefined;
      return { ...base, control, options, ...maxLength(inner) };
    }

    case 'array': {
      const element = arrayElement(inner);
      const rowFields = element ? describeSchema(element, path) : [];
      if (rowFields.length === 0) return base;
      // The row cap travels with the list, so Add stops there. A list past its `.max()`
      // fails to parse on read, and `resolveSettings` then drops the whole field.
      return { ...base, control: 'list', fields: rowFields, ...maxLength(inner) };
    }

    case 'object': {
      const fields = describeSchema(inner, path);
      if (fields.length === 0) return base;
      return { ...base, control: 'group', fields };
    }

    default:
      return base;
  }
}

/** `showSeconds` → `Show seconds`. Only ever a fallback for a missing label. */
function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * `showIf`, resolved against the values of the field's own object.
 *
 * Sibling-scoped rather than root-scoped on purpose: a field inside a list row that
 * referred to a key at the top of the settings tree would mean something different in
 * every row.
 */
export function isVisible(
  field: FieldDescriptor,
  values: Record<string, unknown>,
): boolean {
  if (!field.showIf) return true;
  return values[field.showIf.field] === field.showIf.equals;
}

export interface FieldGroup {
  /** `null` is the ungrouped run of fields before any heading. */
  name: string | null;
  fields: FieldDescriptor[];
}

/**
 * Collect fields under their `group` heading, in order of first appearance.
 *
 * Runs, not buckets: fields keep the order they were declared in, and a group that
 * reappears later reopens rather than being merged backwards — which would silently
 * reorder the panel.
 */
export function groupFields(fields: FieldDescriptor[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  for (const field of fields) {
    const name = field.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.fields.push(field);
    else groups.push({ name, fields: [field] });
  }
  return groups;
}
