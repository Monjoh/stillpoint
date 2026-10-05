import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { NOTE_MAX_LENGTH, notesSettingsSchema, type NotesSettings } from './definition';
import NotesView from './NotesView';

const size = { width: 300, height: 200 };

/**
 * The store's part, reduced to its contract: a recipe applied to the latest value.
 * `saved` holds what was last written, updated where the store would be: in the write.
 */
const saved = { current: notesSettingsSchema.parse({}) };

function Harness(props: { initial?: Partial<NotesSettings>; isEditing?: boolean }) {
  const [settings, setSettings] = useState(() =>
    notesSettingsSchema.parse(props.initial ?? {}),
  );
  return (
    <NotesView
      settings={settings}
      size={size}
      isEditing={props.isEditing ?? false}
      updateSettings={(recipe) =>
        setSettings((current) => (saved.current = recipe(current)))
      }
    />
  );
}

describe('NotesView', () => {
  beforeEach(() => {
    saved.current = notesSettingsSchema.parse({});
  });

  it('saves what is typed, every keystroke composing with the last', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ text: 'Milk' }} />);

    const note = screen.getByRole('textbox', { name: 'Note' });
    expect((note as HTMLTextAreaElement).value).toBe('Milk');
    await user.type(note, ', eggs');
    expect(saved.current.text).toBe('Milk, eggs');
  });

  it('starts empty with a prompt', () => {
    render(<Harness />);
    expect(screen.getByPlaceholderText('Write something…')).toBeTruthy();
  });

  it('cannot be typed into in edit mode, or where nothing can be saved', () => {
    const { unmount } = render(<Harness isEditing />);
    expect(screen.getByRole('textbox').hasAttribute('readonly')).toBe(true);
    unmount();

    render(
      <NotesView
        settings={notesSettingsSchema.parse({})}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByRole('textbox').hasAttribute('readonly')).toBe(true);
  });

  it('refuses text past the limit the schema enforces', () => {
    render(<Harness />);
    expect(screen.getByRole('textbox').getAttribute('maxlength')).toBe(
      String(NOTE_MAX_LENGTH),
    );
    expect(
      notesSettingsSchema.safeParse({ text: 'x'.repeat(NOTE_MAX_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('keeps the note out of the generated settings panel', () => {
    expect(notesSettingsSchema.shape.text.meta()).toMatchObject({ hidden: true });
  });
});
