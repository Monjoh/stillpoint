import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { configStore } from '@/core/config/store';
import { createDefaultConfig } from '@/core/config/defaults';
import { exportConfig } from '@/core/config/transfer';
import { StorageKeys } from '@/core/storage/adapter';
import type { StillpointConfig } from '@/core/config/schema';
import { Options } from './Options';

/**
 * The options page against the real store and real storage. What is being checked is
 * that the buttons reach `storage.local` — the arithmetic behind them is covered,
 * without a DOM, in `profiles.test.ts` and `transfer.test.ts`.
 */

async function stored(): Promise<StillpointConfig> {
  const result = await browser.storage.local.get(StorageKeys.config);
  return result[StorageKeys.config] as StillpointConfig;
}

async function openPage() {
  render(<Options />);
  await screen.findByRole('heading', { name: 'Profiles' });
}

const profileRows = () => screen.getAllByRole('listitem');

beforeEach(() => {
  fakeBrowser.reset();
  localStorage.clear();
});

afterEach(() => {
  configStore.getState().dispose();
  vi.restoreAllMocks();
});

describe('profiles', () => {
  it('lists what is stored, with the active one marked', async () => {
    await openPage();

    const rows = profileRows();
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByLabelText(/^Name of profile/)).toHaveProperty(
      'value',
      'Default',
    );
    expect(within(rows[0]!).getByRole('radio')).toHaveProperty('checked', true);
    expect(within(rows[0]!).getByText('1 widget')).toBeTruthy();
  });

  it('adds a profile and persists it', async () => {
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: 'New profile' }));
    expect(profileRows()).toHaveLength(2);
    expect((await stored()).profiles).toHaveLength(2);
  });

  // The name is a draft until the field is left: writing per keystroke would have the
  // store reject the empty string mid-edit and fight the user over their own backspace.
  it('renames on blur, not on every keystroke', async () => {
    const user = userEvent.setup();
    await openPage();

    const input = screen.getByLabelText('Name of profile Default');
    await user.clear(input);
    await user.type(input, 'Focus');
    expect((await stored()).profiles[0]?.name).toBe('Default');

    await user.tab();
    expect((await stored()).profiles[0]?.name).toBe('Focus');
  });

  it('switches the active profile', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'New profile' }));

    await user.click(screen.getByRole('radio', { name: 'Use New profile' }));
    const config = await stored();
    expect(config.activeProfileId).toBe(config.profiles[1]?.id);
  });

  it('duplicates a profile with its widgets', async () => {
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: 'Duplicate Default' }));
    const config = await stored();
    expect(config.profiles.map((p) => p.name)).toEqual(['Default', 'Default 2']);
    expect(config.profiles[1]?.widgets).toHaveLength(1);
  });

  it('reorders, and disables the moves that would fall off the ends', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'New profile' }));

    expect(screen.getByRole('button', { name: 'Move Default up' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(screen.getByRole('button', { name: 'Move Default down' }));
    expect((await stored()).profiles.map((p) => p.name)).toEqual([
      'New profile',
      'Default',
    ]);
  });

  // Deleting the last profile would store a tree the schema rejects, which is
  // replaced by defaults on the next load — the whole setup gone to one button.
  it('will not delete the only profile', async () => {
    const user = userEvent.setup();
    await openPage();

    expect(screen.getByRole('button', { name: 'Delete Default' })).toHaveProperty(
      'disabled',
      true,
    );

    await user.click(screen.getByRole('button', { name: 'New profile' }));
    await user.click(screen.getByRole('button', { name: 'Delete Default' }));
    expect((await stored()).profiles.map((p) => p.name)).toEqual(['New profile']);
  });
});

describe('general settings', () => {
  it('is generated from appSettingsSchema and writes through', async () => {
    const user = userEvent.setup();
    await openPage();

    const toggle = screen.getByLabelText('Allow editing the layout');
    expect(toggle).toHaveProperty('checked', true);

    await user.click(toggle);
    expect((await stored()).app.editModeEnabled).toBe(false);
  });

  // Internal state and options for features that do not exist yet are carried by the
  // schema but never offered.
  it('leaves hidden fields out of the form', async () => {
    await openPage();
    expect(screen.queryByLabelText(/Has completed first run/i)).toBeNull();
    expect(screen.queryByLabelText(/Unsplash/i)).toBeNull();
    expect(screen.queryByLabelText(/Language/i)).toBeNull();
  });
});

describe('import and export', () => {
  it('replaces everything with an imported file and says what happened', async () => {
    const user = userEvent.setup();
    await openPage();

    const incoming = createDefaultConfig();
    incoming.profiles[0]!.name = 'From a backup';
    const file = new File([exportConfig(incoming).json], 'backup.json', {
      type: 'application/json',
    });

    await user.upload(screen.getByLabelText('Import a file'), file);

    expect(await screen.findByText('Imported.')).toBeTruthy();
    expect((await stored()).profiles.map((p) => p.name)).toEqual(['From a backup']);
  });

  it('refuses a bad file in a sentence, and changes nothing', async () => {
    const user = userEvent.setup();
    await openPage();

    const file = new File(['<html>'], 'page.html', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import a file'), file);

    expect(await screen.findByText(/not valid JSON/)).toBeTruthy();
    expect((await stored()).profiles.map((p) => p.name)).toEqual(['Default']);
  });

  it('takes two presses to reset everything', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'New profile' }));

    await user.click(screen.getByRole('button', { name: 'Reset everything' }));
    expect((await stored()).profiles).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Delete everything, really' }));
    expect((await stored()).profiles.map((p) => p.name)).toEqual(['Default']);
  });

  it('can be backed out of', async () => {
    const user = userEvent.setup();
    await openPage();

    await user.click(screen.getByRole('button', { name: 'Reset everything' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('button', { name: 'Delete everything, really' }),
    ).toBeNull();
  });
});
