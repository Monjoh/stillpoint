import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { configStore } from '@/core/config/store';
import { StorageKeys } from '@/core/storage/adapter';
import { NewTab } from './NewTab';

/**
 * The one test that runs the whole spine end to end with nothing mocked: real store,
 * real storage, real registry, real clock. Everything else in M2 tests a part. This
 * catches the wiring — a widget that renders alone but not through the canvas, or a
 * config that loads but never reaches the page.
 */
describe('NewTab', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    localStorage.clear();
  });

  afterEach(() => {
    configStore.getState().dispose();
  });

  it('loads defaults on a first run and renders the clock they ship with', async () => {
    render(<NewTab />);

    const clock = await screen.findByText(/^\d{2}:\d{2}$/);
    expect(clock.tagName).toBe('TIME');

    const stored = await browser.storage.local.get(StorageKeys.config);
    expect(stored[StorageKeys.config]).toBeTruthy();
  });

  it('paints the profile background through the shared token, not its own CSS', async () => {
    render(<NewTab />);
    await screen.findByText(/^\d{2}:\d{2}$/);

    // boot.ts and React write the same custom property, which is what makes the first
    // and second paints agree. If this moves into a component's styles, they diverge.
    expect(document.documentElement.style.getPropertyValue('--sp-background')).toBe(
      'linear-gradient(160deg, #11131c 0%, #1d2033 100%)',
    );
    expect(document.documentElement.style.getPropertyValue('--sp-grid-cols')).toBe(
      '24',
    );
  });

  it('enters edit mode on "e" and loads the edit chunk only then', async () => {
    const user = userEvent.setup();
    render(<NewTab />);
    await screen.findByText(/^\d{2}:\d{2}$/);

    // Edit mode is a separate lazy import, so none of this exists until now.
    expect(screen.queryByRole('toolbar')).toBeNull();

    await user.keyboard('e');
    expect(await screen.findByRole('toolbar', { name: 'Edit layout' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('offers a way in that does not require knowing the shortcut', async () => {
    render(<NewTab />);
    await screen.findByText(/^\d{2}:\d{2}$/);
    // View mode shows nothing of ours, so the only visible affordance is this one.
    expect(screen.getByRole('button', { name: 'Edit layout' })).toBeTruthy();
  });

  describe('first run', () => {
    const storedApp = async () =>
      (
        (await browser.storage.local.get(StorageKeys.config))[StorageKeys.config] as {
          app: { hasCompletedFirstRun: boolean };
        }
      ).app;

    it('keeps the way in visible, with the shortcut, until the user edits', async () => {
      const user = userEvent.setup();
      render(<NewTab />);
      expect(await screen.findByText(/to customise this page/)).toBeTruthy();

      await user.keyboard('e');
      await screen.findByRole('toolbar', { name: 'Edit layout' });
      await user.keyboard('{Escape}');

      expect(screen.queryByText(/to customise this page/)).toBeNull();
      expect((await storedApp()).hasCompletedFirstRun).toBe(true);
    });

    it('can be dismissed without editing', async () => {
      const user = userEvent.setup();
      render(<NewTab />);
      await user.click(await screen.findByRole('button', { name: 'Got it' }));

      expect(screen.queryByText(/to customise this page/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Edit layout' })).toBeTruthy();
      expect((await storedApp()).hasCompletedFirstRun).toBe(true);
    });
  });

  it('shows the empty state when the profile has no widgets', async () => {
    await browser.storage.local.set({
      [StorageKeys.config]: {
        version: 1,
        activeProfileId: 'p1',
        profiles: [
          { id: 'p1', name: 'Bare', background: { kind: 'solid', color: '#000' } },
        ],
      },
    });

    render(<NewTab />);
    expect(await screen.findByText(/to add a widget/)).toBeTruthy();
  });
});

describe('typing in a generated settings field', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    localStorage.clear();
  });

  afterEach(() => {
    configStore.getState().dispose();
  });

  /**
   * A regression guard for a focus loss reported in Firefox: every character typed
   * into the time zone field dropped focus. This reproduces the path end to end —
   * real store, real debounce, real portal — and does **not** fail, which is the
   * finding worth recording: whatever causes it is not visible to jsdom. Keep the
   * test anyway; it fails loudly if the panel ever starts remounting for a reason
   * jsdom *can* see, which is the cheapest of the candidate explanations to rule out.
   */
  /**
   * The canvas gives up the panel's width instead of being covered by it. jsdom has
   * no layout, so what is asserted is the signal the stylesheet keys off — the rule
   * itself is in Canvas.module.css and only a browser can confirm it.
   */
  it('makes the stage reserve room for the panel, and give it back', async () => {
    const user = userEvent.setup();
    const { container } = render(<NewTab />);
    await screen.findByText(/^\d{2}:\d{2}$/);

    const stage = container.querySelector('[class*="stage"]');
    expect(stage?.hasAttribute('data-panel')).toBe(false);

    // The panel opens with edit mode, not with a selection, so the width is given up
    // once — before anything is clicked — rather than under the cursor mid-click.
    await user.keyboard('e');
    await screen.findByRole('complementary', { name: 'Page settings' });
    expect(stage?.hasAttribute('data-panel')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Hide settings' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(stage?.hasAttribute('data-panel')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(stage?.hasAttribute('data-panel')).toBe(true);

    // Leaving edit mode takes the panel with it, whatever state it was left in.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(stage?.hasAttribute('data-panel')).toBe(false);
  });

  // Selecting and deselecting is the common case, and the canvas must not move for
  // it. Deleting the selected widget also leaves its id in the session for a render.
  it('holds the stage still while the selection comes and goes', async () => {
    const user = userEvent.setup();
    const { container } = render(<NewTab />);
    await screen.findByText(/^\d{2}:\d{2}$/);

    await user.keyboard('e');
    await screen.findByRole('toolbar', { name: 'Edit layout' });
    const stage = container.querySelector('[class*="stage"]');
    expect(stage?.hasAttribute('data-panel')).toBe(true);

    const box = screen.getByRole('button', { name: /^Clock, column/ });
    await user.click(box);
    await screen.findByRole('complementary', { name: 'Clock settings' });
    expect(stage?.hasAttribute('data-panel')).toBe(true);

    box.focus();
    await user.keyboard('{Delete}');
    expect(stage?.hasAttribute('data-panel')).toBe(true);
    // The widget is gone, so the panel has nothing to show but the page itself.
    expect(screen.getByRole('complementary', { name: 'Page settings' })).toBeTruthy();
  });

  it('keeps focus and accumulates the value across keystrokes', async () => {
    const user = userEvent.setup();
    render(<NewTab />);
    await screen.findByText(/^\d{2}:\d{2}$/);

    await user.keyboard('e');
    await screen.findByRole('toolbar', { name: 'Edit layout' });
    await user.click(screen.getByRole('button', { name: /^Clock, column/ }));

    const input = await screen.findByLabelText('Time zone');
    await user.click(input);
    await user.keyboard('UTC');

    expect(screen.getByLabelText('Time zone')).toHaveProperty('value', 'UTC');
    expect(document.activeElement).toBe(screen.getByLabelText('Time zone'));
  });
});
