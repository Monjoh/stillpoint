import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileSchema } from '@/core/config/schema';
import { EditToolbar } from './EditToolbar';

const profile = profileSchema.parse({
  id: 'p1',
  name: 'Work',
  background: { kind: 'solid', color: '#000' },
});

let removeListener = () => {};
afterEach(() => removeListener());

function setup() {
  const onExit = vi.fn();
  // Stands in for useEditSession's window-level Escape, which leaves edit mode.
  const outerEscape = vi.fn();
  const listener = (event: KeyboardEvent) => {
    if (event.key === 'Escape') outerEscape();
  };
  window.addEventListener('keydown', listener);
  removeListener = () => window.removeEventListener('keydown', listener);
  render(
    <EditToolbar
      profile={profile}
      onAdd={vi.fn()}
      onTogglePanel={vi.fn()}
      onExit={onExit}
    />,
  );
  return { outerEscape };
}

describe('EditToolbar', () => {
  it('keeps the shortcuts behind a button instead of spelling them out', async () => {
    setup();
    expect(screen.queryByText(/arrows nudge/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(help.textContent).toMatch(/Resize it/);
  });

  it('closes the shortcuts on Escape without leaving edit mode', async () => {
    const { outerEscape } = setup();
    const button = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outerEscape).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
  });
});
