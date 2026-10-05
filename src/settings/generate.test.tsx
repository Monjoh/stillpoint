import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { field, type ControlProps } from '@/core/registry/types';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';

/** Renders a schema the way the panel does, holding the values in state. */
function Form({
  schema,
  initial = {},
  onValues,
}: {
  schema: z.ZodType;
  initial?: Record<string, unknown>;
  onValues?: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const fields = describeSchema(schema);
  return (
    <GeneratedFields
      fields={fields}
      values={values}
      idPrefix="t"
      onChange={(key, value) => {
        const next = { ...values, [key]: value };
        setValues(next);
        onValues?.(next);
      }}
    />
  );
}

describe('label wiring', () => {
  // The whole argument for generating forms: a field cannot ship unlabelled because
  // no one is in a position to forget.
  it('wires every single-input control to its own label', async () => {
    render(
      <Form
        schema={z.object({
          name: z
            .string()
            .default('')
            .meta(field({ label: 'Name' })),
          size: z
            .number()
            .min(1)
            .max(9)
            .default(3)
            .meta(field({ label: 'Size' })),
          on: z
            .boolean()
            .default(false)
            .meta(field({ label: 'On' })),
        })}
      />,
    );

    expect(screen.getByLabelText('Name')).toHaveProperty('tagName', 'INPUT');
    expect(screen.getByLabelText('Size')).toHaveProperty('type', 'range');
    expect(screen.getByLabelText('On')).toHaveProperty('type', 'checkbox');
  });

  it('labels a multi-element control as a group', () => {
    render(
      <Form
        schema={z.object({
          mode: z
            .enum(['a', 'b'])
            .default('a')
            .meta(field({ label: 'Mode' })),
        })}
      />,
    );
    const group = screen.getByRole('group', { name: 'Mode' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
  });

  it('renders help text and points the control at it', () => {
    render(
      <Form
        schema={z.object({
          zone: z
            .string()
            .nullable()
            .default(null)
            .meta(field({ label: 'Zone', control: 'timezone', help: 'Leave empty.' })),
        })}
      />,
    );
    expect(screen.getByText('Leave empty.')).toBeTruthy();
  });

  it('gives two panels of the same schema distinct ids', () => {
    const schema = z.object({
      a: z
        .string()
        .default('')
        .meta(field({ label: 'A' })),
    });
    const fields = describeSchema(schema);
    const props = { fields, values: {}, onChange: () => {} };
    render(
      <>
        <GeneratedFields {...props} idPrefix="one" />
        <GeneratedFields {...props} idPrefix="two" />
      </>,
    );
    const ids = screen.getAllByLabelText('A').map((input) => input.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('controls emit values of the right type', () => {
  it('a toggle emits a boolean', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={z.object({
          on: z
            .boolean()
            .default(false)
            .meta(field({ label: 'On' })),
        })}
        initial={{ on: false }}
        onValues={onValues}
      />,
    );
    await userEvent.click(screen.getByLabelText('On'));
    expect(onValues).toHaveBeenCalledWith({ on: true });
  });

  // A number input that emitted "12" would store a string the schema rejects, and
  // the repair ladder would throw the user's value away on the next load.
  it('a number input emits a number, not the typed string', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={z.object({
          n: z
            .number()
            .default(0)
            .meta(field({ label: 'N' })),
        })}
        initial={{ n: 0 }}
        onValues={onValues}
      />,
    );
    await userEvent.type(screen.getByLabelText('N'), '7');
    expect(onValues).toHaveBeenLastCalledWith({ n: 7 });
  });

  it('a number input holds an unfinished value without emitting it', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={z.object({
          n: z
            .number()
            .default(5)
            .meta(field({ label: 'N' })),
        })}
        initial={{ n: 5 }}
        onValues={onValues}
      />,
    );
    const input = screen.getByLabelText('N');
    await userEvent.clear(input);
    expect(input).toHaveProperty('value', '');
    expect(onValues).not.toHaveBeenCalled();
  });

  it('a segmented control emits the chosen enum value and moves with arrows', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={z.object({
          mode: z
            .enum(['a', 'b', 'c'])
            .default('a')
            .meta(field({ label: 'Mode', options: { a: 'Ay', b: 'Bee', c: 'Cee' } })),
        })}
        initial={{ mode: 'a' }}
        onValues={onValues}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Bee' }));
    expect(onValues).toHaveBeenLastCalledWith({ mode: 'b' });

    await userEvent.keyboard('{ArrowRight}');
    expect(onValues).toHaveBeenLastCalledWith({ mode: 'c' });
  });

  it('a nullable text field emits null when it is emptied', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={z.object({
          zone: z
            .string()
            .nullable()
            .default(null)
            .meta(field({ label: 'Zone' })),
        })}
        initial={{ zone: 'UTC' }}
        onValues={onValues}
      />,
    );
    await userEvent.clear(screen.getByLabelText('Zone'));
    expect(onValues).toHaveBeenLastCalledWith({ zone: null });
  });

  it('a nested group writes back into its own object', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={z.object({
          frame: z
            .object({
              padded: z
                .boolean()
                .default(false)
                .meta(field({ label: 'Padded' })),
            })
            .prefault({})
            .meta(field({ label: 'Frame' })),
        })}
        initial={{ frame: { padded: false } }}
        onValues={onValues}
      />,
    );
    await userEvent.click(screen.getByLabelText('Padded'));
    expect(onValues).toHaveBeenLastCalledWith({ frame: { padded: true } });
  });
});

describe('showIf', () => {
  const schema = z.object({
    format: z
      .enum(['24h', '12h'])
      .default('24h')
      .meta(field({ label: 'Format' })),
    showMeridiem: z
      .boolean()
      .default(true)
      .meta(field({ label: 'Show AM/PM', showIf: { field: 'format', equals: '12h' } })),
  });

  it('hides a dependent field and shows it when the condition is met', async () => {
    render(<Form schema={schema} initial={{ format: '24h', showMeridiem: true }} />);
    expect(screen.queryByLabelText('Show AM/PM')).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: '12h' }));
    expect(screen.getByLabelText('Show AM/PM')).toBeTruthy();
  });
});

describe('the list control', () => {
  const schema = z.object({
    links: z
      .array(
        z.object({
          title: z
            .string()
            .default('')
            .meta(field({ label: 'Title' })),
          url: z
            .string()
            .default('https://')
            .meta(field({ label: 'URL' })),
        }),
      )
      .default([])
      .meta(field({ label: 'Links', itemLabel: 'link' })),
  });

  it('adds a row seeded from the row fields’ defaults', async () => {
    const onValues = vi.fn();
    render(<Form schema={schema} initial={{ links: [] }} onValues={onValues} />);

    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '+ Add link' }));
    expect(onValues).toHaveBeenLastCalledWith({
      links: [{ title: '', url: 'https://' }],
    });
  });

  it('removes the row that was asked for', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={schema}
        initial={{
          links: [
            { title: 'One', url: 'a' },
            { title: 'Two', url: 'b' },
          ],
        }}
        onValues={onValues}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove link 1' }));
    expect(onValues).toHaveBeenLastCalledWith({ links: [{ title: 'Two', url: 'b' }] });
  });

  it('reorders rows, and cannot move the ends past the ends', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={schema}
        initial={{
          links: [
            { title: 'One', url: 'a' },
            { title: 'Two', url: 'b' },
          ],
        }}
        onValues={onValues}
      />,
    );

    expect(screen.getByRole('button', { name: 'Move link 1 up' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Move link 2 down' })).toHaveProperty(
      'disabled',
      true,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Move link 1 down' }));
    expect(onValues).toHaveBeenLastCalledWith({
      links: [
        { title: 'Two', url: 'b' },
        { title: 'One', url: 'a' },
      ],
    });
  });

  it('edits one row without touching the others', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={schema}
        initial={{
          links: [
            { title: 'One', url: 'a' },
            { title: 'Two', url: 'b' },
          ],
        }}
        onValues={onValues}
      />,
    );
    const second = screen.getAllByLabelText('Title')[1]!;
    await userEvent.type(second, '!');
    expect(onValues).toHaveBeenLastCalledWith({
      links: [
        { title: 'One', url: 'a' },
        { title: 'Two!', url: 'b' },
      ],
    });
  });
});

describe('the custom escape hatch', () => {
  // Built before any widget needs it, deliberately: the failure mode is one widget
  // needing something unusual, nobody wanting to touch the generator, and that widget
  // hand-rolling a form the next one then copies.
  function Stars({ id, value, onChange, field: meta }: ControlProps<number>) {
    return (
      <button id={id} type="button" onClick={() => onChange(value + 1)}>
        {meta.label}: {value}
      </button>
    );
  }

  it('renders a widget-supplied control and feeds it the generated id', async () => {
    const onValues = vi.fn();
    render(
      <Form
        schema={z.object({
          rating: z
            .number()
            .default(1)
            .meta(field({ label: 'Rating', control: 'custom', component: Stars })),
        })}
        initial={{ rating: 1 }}
        onValues={onValues}
      />,
    );

    // Found by its label, not by its text: the generated `<label for>` is what names
    // it, which is the whole point — a custom control cannot ship unlabelled either.
    const button = screen.getByLabelText('Rating');
    expect(button.id).toBe('t-rating');
    expect(button).toHaveProperty('textContent', 'Rating: 1');

    await userEvent.click(button);
    expect(onValues).toHaveBeenLastCalledWith({ rating: 2 });
  });

  it('says so rather than vanishing when a field has no control', () => {
    render(
      <Form
        schema={z.object({
          odd: z.union([z.string(), z.number()]).meta(field({ label: 'Odd' })),
        })}
      />,
    );
    expect(screen.getByText(/Odd cannot be edited here yet/)).toBeTruthy();
  });
});
