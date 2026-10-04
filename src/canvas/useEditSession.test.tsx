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
      <span data-testid="panel">{session.panelOpen ? 'open' : 'closed'}</span>
      <input aria-label="field" />
      <button type="button" onClick={() => session.select('w1')}>
        select
      </button>
      <button type="button" onClick={session.togglePanel}>
        toggle
      </button>
    </div>
  );
}

const mode = () => screen.getByTestId('mode').textContent;
const panel = () => screen.getByTestId('panel').textContent;

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

describe('Escape is two-stage', () => {
  it('clears the selection first and leaves edit mode second', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<Harness enabled onExit={onExit} />);

    await user.keyboard('e');
    await user.click(screen.getByRole('button', { name: 'select' }));
    expect(screen.getByTestId('selected').textContent).toBe('w1');

    // The panel does not close with it; it falls back to the page settings.
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('selected').textContent).toBe('none');
    expect(mode()).toBe('editing');
    expect(panel()).toBe('open');
    expect(onExit).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(mode()).toBe('viewing');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  // A text field the user cannot back out of with Escape is a trap, and the panel is
  // full of text fields.
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

/**
 * The panel is a property of edit mode, not of the selection. It used to appear when
 * a widget was selected, and because the stage gives up its width rather than being
 * covered, appearing moved every widget — including the one under the cursor.
 */
describe('the settings panel', () => {
  const width = (px: number) => {
    const original = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: px,
    });
    return () => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: original,
      });
    };
  };

  it('starts open on a window wide enough to give up the width', () => {
    const restore = width(1280);
    render(<Harness enabled />);
    expect(panel()).toBe('open');
    restore();
  });

  // Below the breakpoint the panel overlays, so opening it unasked would cover the
  // thing it exists to edit.
  it('starts closed on a window that is not', () => {
    const restore = width(600);
    render(<Harness enabled />);
    expect(panel()).toBe('closed');
    restore();
  });

  it('is the user’s choice from then on, and survives the selection changing', async () => {
    const user = userEvent.setup();
    const restore = width(1280);
    render(<Harness enabled />);

    await user.keyboard('e');
    await user.click(screen.getByRole('button', { name: 'toggle' }));
    expect(panel()).toBe('closed');

    // Selecting a widget must not reopen it behind their back.
    await user.click(screen.getByRole('button', { name: 'select' }));
    expect(panel()).toBe('closed');

    await user.click(screen.getByRole('button', { name: 'toggle' }));
    expect(panel()).toBe('open');
    restore();
  });
});
