import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { field } from '@/core/registry/types';
import {
  describeSchema,
  groupFields,
  isVisible,
  type FieldDescriptor,
} from './describe';

function byKey(fields: FieldDescriptor[], key: string): FieldDescriptor {
  const found = fields.find((f) => f.key === key);
  if (!found) throw new Error(`no field ${key}`);
  return found;
}

describe('the control mapping table', () => {
  const fields = describeSchema(
    z.object({
      flag: z
        .boolean()
        .default(false)
        .meta(field({ label: 'Flag' })),
      name: z
        .string()
        .default('')
        .meta(field({ label: 'Name' })),
      note: z
        .string()
        .default('')
        .meta(field({ label: 'Note', control: 'textarea' })),
      tint: z
        .string()
        .default('#fff')
        .meta(field({ label: 'Tint', control: 'color' })),
      bounded: z
        .number()
        .min(0)
        .max(10)
        .default(5)
        .meta(field({ label: 'Bounded' })),
      loose: z
        .number()
        .default(5)
        .meta(field({ label: 'Loose' })),
      pair: z
        .enum(['a', 'b'])
        .default('a')
        .meta(field({ label: 'Pair' })),
      many: z
        .enum(['a', 'b', 'c', 'd'])
        .default('a')
        .meta(field({ label: 'Many' })),
    }),
  );

  it('maps a boolean to a toggle', () => {
    expect(byKey(fields, 'flag').control).toBe('toggle');
  });

  it('maps a plain string to a text input', () => {
    expect(byKey(fields, 'name').control).toBe('text');
  });

  it('lets metadata override the inferred control', () => {
    expect(byKey(fields, 'note').control).toBe('textarea');
    expect(byKey(fields, 'tint').control).toBe('color');
  });

  it('maps a bounded number to a slider and an unbounded one to a number input', () => {
    const bounded = byKey(fields, 'bounded');
    expect(bounded.control).toBe('slider');
    expect(bounded.min).toBe(0);
    expect(bounded.max).toBe(10);
    expect(byKey(fields, 'loose').control).toBe('number');
  });

  // Three buttons fit in a 288px panel; a fourth makes them unreadable.
  it('maps a short enum to segmented and a long one to a select', () => {
    expect(byKey(fields, 'pair').control).toBe('segmented');
    expect(byKey(fields, 'many').control).toBe('select');
  });
});

describe('describeSchema', () => {
  it('carries the label, help and unit from metadata', () => {
    const [size] = describeSchema(
      z.object({
        size: z
          .number()
          .min(1)
          .max(9)
          .default(3)
          .meta(field({ label: 'Size', help: 'How big.', unit: 'px', step: 2 })),
      }),
    );
    expect(size).toMatchObject({
      label: 'Size',
      help: 'How big.',
      unit: 'px',
      step: 2,
    });
  });

  // An unlabelled control is a bug; a missing control is a worse one.
  it('falls back to a humanised key when a field has no metadata', () => {
    const [showSeconds] = describeSchema(z.object({ showSeconds: z.boolean() }));
    expect(showSeconds?.label).toBe('Show seconds');
  });

  it('resolves enum option labels, falling back to the raw value', () => {
    const [mode] = describeSchema(
      z.object({
        mode: z
          .enum(['on', 'off'])
          .default('on')
          .meta(field({ label: 'Mode', options: { on: 'Enabled' } })),
      }),
    );
    expect(mode?.options).toEqual([
      { value: 'on', label: 'Enabled' },
      { value: 'off', label: 'off' },
    ]);
  });

  it('keeps declaration order, and honours an explicit order', () => {
    const fields = describeSchema(
      z.object({
        first: z
          .string()
          .default('')
          .meta(field({ label: 'First' })),
        second: z
          .string()
          .default('')
          .meta(field({ label: 'Second', order: -1 })),
        third: z
          .string()
          .default('')
          .meta(field({ label: 'Third' })),
      }),
    );
    expect(fields.map((f) => f.key)).toEqual(['second', 'first', 'third']);
  });

  it('describes a nested object as a group of its own fields', () => {
    const [group] = describeSchema(
      z.object({
        frame: z
          .object({
            padded: z
              .boolean()
              .default(false)
              .meta(field({ label: 'Padded' })),
          })
          .prefault({})
          .meta(field({ label: 'Frame' })),
      }),
    );
    expect(group?.control).toBe('group');
    expect(group?.fields?.[0]).toMatchObject({ key: 'padded', path: 'frame.padded' });
  });

  it('describes an array of objects as a list of row fields', () => {
    const [list] = describeSchema(
      z.object({
        links: z
          .array(
            z.object({
              url: z
                .string()
                .default('')
                .meta(field({ label: 'URL' })),
            }),
          )
          .default([])
          .meta(field({ label: 'Links' })),
      }),
    );
    expect(list?.control).toBe('list');
    expect(list?.fields?.map((f) => f.key)).toEqual(['url']);
  });

  it('marks a shape it has no control for rather than dropping it', () => {
    const [odd] = describeSchema(
      z.object({
        odd: z.union([z.string(), z.number()]).meta(field({ label: 'Odd' })),
      }),
    );
    expect(odd?.control).toBe('unsupported');
    expect(odd?.label).toBe('Odd');
  });

  // For state the schema has to carry but the user has no business editing, and for
  // options belonging to a feature that is not built yet.
  it('drops hidden fields entirely', () => {
    const fields = describeSchema(
      z.object({
        shown: z
          .boolean()
          .default(true)
          .meta(field({ label: 'Shown' })),
        internal: z
          .boolean()
          .default(false)
          .meta(field({ label: 'Internal', hidden: true })),
      }),
    );
    expect(fields.map((f) => f.key)).toEqual(['shown']);
  });

  it('returns nothing for a schema that is not an object', () => {
    expect(describeSchema(z.string())).toEqual([]);
  });
});

describe('custom controls', () => {
  const Custom = () => null;

  it('uses the widget’s own component', () => {
    const [custom] = describeSchema(
      z.object({
        thing: z
          .string()
          .default('')
          .meta(field({ label: 'Thing', control: 'custom', component: Custom })),
      }),
    );
    expect(custom?.control).toBe('custom');
    expect(custom?.component).toBe(Custom);
  });

  // `control: 'custom'` with nothing to render is a mistake in the widget, and
  // falling back to a text input would silently feed it a value it cannot handle.
  it('degrades to unsupported when the component is missing', () => {
    const [custom] = describeSchema(
      z.object({
        thing: z
          .string()
          .default('')
          .meta(field({ label: 'Thing', control: 'custom' })),
      }),
    );
    expect(custom?.control).toBe('unsupported');
  });
});

describe('isVisible', () => {
  const dependent: FieldDescriptor = {
    key: 'showMeridiem',
    path: 'showMeridiem',
    label: 'Show AM/PM',
    control: 'toggle',
    optional: false,
    nullable: false,
    defaultValue: true,
    showIf: { field: 'format', equals: '12h' },
  };

  it('hides a field whose condition is unmet', () => {
    expect(isVisible(dependent, { format: '24h' })).toBe(false);
  });

  it('shows a field whose condition is met', () => {
    expect(isVisible(dependent, { format: '12h' })).toBe(true);
  });

  it('shows a field with no condition', () => {
    expect(isVisible({ ...dependent, showIf: undefined }, {})).toBe(true);
  });
});

describe('groupFields', () => {
  const make = (key: string, group?: string): FieldDescriptor => ({
    key,
    path: key,
    label: key,
    control: 'text',
    optional: false,
    nullable: false,
    defaultValue: '',
    group,
  });

  it('runs ungrouped fields first and then each heading', () => {
    const groups = groupFields([make('a'), make('b', 'Style'), make('c', 'Style')]);
    expect(groups.map((g) => g.name)).toEqual([null, 'Style']);
    expect(groups[1]?.fields.map((f) => f.key)).toEqual(['b', 'c']);
  });

  // Merging backwards would silently reorder the panel away from the declared order.
  it('reopens a group rather than merging it backwards', () => {
    const groups = groupFields([make('a', 'X'), make('b', 'Y'), make('c', 'X')]);
    expect(groups.map((g) => g.name)).toEqual(['X', 'Y', 'X']);
  });
});
