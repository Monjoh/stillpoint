import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TODO_MAX_ITEMS,
  todoSettingsSchema,
  type TodoItem,
  type TodoSettings,
} from './definition';
import TodoView from './TodoView';

const size = { width: 300, height: 300 };

/**
 * The store's part, reduced to its contract: a recipe applied to the latest value.
 * `saved` holds what was last written, updated where the store would be: in the write.
 */
const saved = { current: todoSettingsSchema.parse({}) };

function Harness(props: { initial?: Partial<TodoSettings>; isEditing?: boolean }) {
  const [settings, setSettings] = useState(() =>
    todoSettingsSchema.parse(props.initial ?? {}),
  );
  return (
    <TodoView
      settings={settings}
      size={size}
      isEditing={props.isEditing ?? false}
      updateSettings={(recipe) =>
        setSettings((current) => (saved.current = recipe(current)))
      }
    />
  );
}

const task = (id: string, text: string, done = false): TodoItem => ({ id, text, done });
const texts = () => saved.current.items.map((item) => item.text);

describe('TodoView', () => {
  beforeEach(() => {
    saved.current = todoSettingsSchema.parse({});
  });

  it('adds a task on Enter and keeps the field ready for the next', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const add = screen.getByRole('textbox', { name: 'Add a task' });
    await user.type(add, 'Buy milk{Enter}Call Sam{Enter}');
    expect(texts()).toEqual(['Buy milk', 'Call Sam']);
    expect((add as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(add);
  });

  it('ignores an empty task', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('textbox', { name: 'Add a task' }), '   {Enter}');
    expect(saved.current.items).toEqual([]);
  });

  it('ticks a task off, and says so with more than colour', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ items: [task('a', 'Buy milk')] }} />);

    await user.click(screen.getByRole('checkbox', { name: 'Buy milk' }));
    expect(saved.current.items[0]!.done).toBe(true);
    expect(screen.getByRole('listitem').hasAttribute('data-done')).toBe(true);
  });

  it('edits a task where it is', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ items: [task('a', 'Buy mlk')] }} />);

    const row = screen.getByRole('textbox', { name: 'Task' });
    await user.clear(row);
    await user.type(row, 'Buy milk');
    expect(texts()).toEqual(['Buy milk']);
  });

  it('removes a task by its button, or by clearing it and moving on', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ items: [task('a', 'One'), task('b', 'Two')] }} />);

    await user.click(screen.getByRole('button', { name: 'Remove One' }));
    expect(texts()).toEqual(['Two']);

    const row = screen.getByRole('textbox', { name: 'Task' });
    await user.clear(row);
    // Still there while it is being retyped.
    expect(saved.current.items).toHaveLength(1);
    await user.tab();
    expect(saved.current.items).toEqual([]);
  });

  it('hides finished tasks when asked, and says when that is all of them', () => {
    const { unmount } = render(
      <Harness
        initial={{
          hideDone: true,
          items: [task('a', 'Done', true), task('b', 'Open')],
        }}
      />,
    );
    const list = screen.getByRole('list', { name: 'Tasks' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    unmount();

    render(<Harness initial={{ hideDone: true, items: [task('a', 'Done', true)] }} />);
    expect(screen.getByText('All done.')).toBeTruthy();
  });

  it('stops taking tasks at the limit the schema enforces', () => {
    const items = Array.from({ length: TODO_MAX_ITEMS }, (_, i) =>
      task(`t${i}`, `T${i}`),
    );
    render(<Harness initial={{ items }} />);
    const add = screen.getByRole('textbox', { name: 'Add a task' }) as HTMLInputElement;
    expect(add.disabled).toBe(true);
    expect(add.placeholder).toBe('The list is full');
    expect(
      todoSettingsSchema.safeParse({ items: [...items, task('x', 'X')] }).success,
    ).toBe(false);
  });

  it('is not editable in edit mode', () => {
    render(<Harness isEditing initial={{ items: [task('a', 'One')] }} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    for (const field of screen.getAllByRole('textbox')) {
      expect(field.hasAttribute('readonly')).toBe(true);
    }
  });
});
