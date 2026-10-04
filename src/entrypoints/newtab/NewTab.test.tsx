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
