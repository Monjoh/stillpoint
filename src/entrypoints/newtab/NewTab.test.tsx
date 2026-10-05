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
    // The keyboard moves on to the next widget (S29), which selects it: the panel
    // follows the focus, and the stage still does not move.
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Date, column/);
    expect(screen.getByRole('complementary', { name: 'Date settings' })).toBeTruthy();
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

describe('a widget saving its own content', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    localStorage.clear();
  });

  afterEach(() => {
    configStore.getState().dispose();
  });

  async function seedNote(text: string) {
    await browser.storage.local.set({
      [StorageKeys.config]: {
        version: 1,
        activeProfileId: 'p1',
        profiles: [
          {
            id: 'p1',
            name: 'Desk',
            background: { kind: 'solid', color: '#000' },
            widgets: [
              {
                instanceId: 'n1',
                type: 'stillpoint.notes',
                rect: { x: 0, y: 0, w: 6, h: 4 },
                settings: { text },
              },
            ],
          },
        ],
      },
    });
  }

  const storedNote = async () => {
    const stored = await browser.storage.local.get(StorageKeys.config);
    const config = stored[StorageKeys.config] as {
      profiles: { widgets: { settings: { text?: string } }[] }[];
    };
    return config.profiles[0]!.widgets[0]!.settings.text;
  };

  it('writes a note through the store, and saves it when the tab goes away', async () => {
    const user = userEvent.setup();
    await seedNote('Milk');
    render(<NewTab />);

    const note = await screen.findByRole('textbox', { name: 'Note' });
    await user.type(note, ', eggs');
    expect(
      configStore.getState().config?.profiles[0]?.widgets[0]?.settings,
    ).toMatchObject({ text: 'Milk, eggs' });

    // Closing the tab inside the debounce window must not lose the last keystrokes.
    window.dispatchEvent(new Event('pagehide'));
    // Inside 150 ms: the debounce alone would write at 300.
    await expect.poll(storedNote, { timeout: 150 }).toBe('Milk, eggs');
  });

  it('keeps the rest of the widget’s settings when it saves', async () => {
    const user = userEvent.setup();
    await seedNote('');
    render(<NewTab />);
    await user.type(await screen.findByRole('textbox', { name: 'Note' }), 'Hi');

    expect(configStore.getState().config?.profiles[0]?.widgets[0]?.settings).toEqual({
      text: 'Hi',
      fontSize: 16,
    });
  });
});
