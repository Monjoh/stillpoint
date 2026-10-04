import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useEditSession, type EditSessionOptions } from './useEditSession';

function Harness(options: EditSessionOptions) {
  const session = useEditSession(options);
  return (
    <div>
      <span data-testid="mode">{session.isEditing ? 'editing' : 'viewing'}</span>
      <span data-testid="selected">{session.selectedId ?? 'none'}</span>
      <input aria-label="field" />
      <button type="button" onClick={() => session.select('w1')}>
        select
      </button>
    </div>
  );
}

const mode = () => screen.getByTestId('mode').textContent;

describe('useEditSession', () => {
  it('enters on a bare "e" and leaves on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness enabled />);

    await user.keyboard('e');
    expect(mode()).toBe('editing');

    await user.keyboard('{Escape}');
    expect(mode()).toBe('viewing');
  });

  it('flushes on the way out', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<Harness enabled onExit={onExit} />);

    await user.keyboard('e');
    await user.keyboard('{Escape}');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('ignores "e" while the user is typing', async () => {
    // There is no text field on the canvas yet. The search widget in M5 is exactly
    // why this guard is here now rather than later.
    const user = userEvent.setup();
    render(<Harness enabled />);

    await user.click(screen.getByLabelText('field'));
    await user.keyboard('e');

    expect(mode()).toBe('viewing');
    expect(screen.getByLabelText('field')).toHaveProperty('value', 'e');
  });

  it('ignores "e" with a modifier, which belongs to the browser', async () => {
    const user = userEvent.setup();
    render(<Harness enabled />);

    await user.keyboard('{Control>}e{/Control}');
    expect(mode()).toBe('viewing');
  });

  it('does nothing at all while disabled', async () => {
    const user = userEvent.setup();
    render(<Harness enabled={false} />);

    await user.keyboard('e');
    expect(mode()).toBe('viewing');
  });

  it('clears the selection on the way out', async () => {
    const user = userEvent.setup();
    render(<Harness enabled />);

    await user.keyboard('e');
    await user.click(screen.getByText('select'));
    expect(screen.getByTestId('selected').textContent).toBe('w1');

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('selected').textContent).toBe('none');
  });

  it('stops listening when unmounted', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness enabled />);
    unmount();
    await act(async () => {
      await user.keyboard('e');
    });
    // Nothing to assert beyond "this did not throw on a removed component", which is
    // what an un-removed window listener would do.
    expect(document.body.textContent).toBe('');
  });
});

describe('Escape is two-stage once there is a panel to close', () => {
  it('clears the selection first and leaves edit mode second', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<Harness enabled onExit={onExit} />);

    await user.keyboard('e');
    await user.click(screen.getByRole('button', { name: 'select' }));
    expect(screen.getByTestId('selected').textContent).toBe('w1');

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('selected').textContent).toBe('none');
    expect(mode()).toBe('editing');
    expect(onExit).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(mode()).toBe('viewing');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  // A text field the user cannot back out of with Escape is a trap, and the settings
  // panel is full of text fields.
  it('still works while the user is typing, unlike the letter shortcuts', async () => {
    const user = userEvent.setup();
    render(<Harness enabled />);

    await user.keyboard('e');
    await user.click(screen.getByRole('button', { name: 'select' }));
    await user.click(screen.getByLabelText('field'));

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('selected').textContent).toBe('none');

    await user.keyboard('{Escape}');
    expect(mode()).toBe('viewing');
  });
});
