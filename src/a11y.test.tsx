import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { configStore } from '@/core/config/store';
import { widgetDefinitions } from '@/core/registry';
import { StorageKeys } from '@/core/storage/adapter';
import { NewTab } from '@/entrypoints/newtab/NewTab';
import { Options } from '@/entrypoints/options/Options';

/**
 * axe-core over every screen, against the real page (S29). It found the missing
 * `main` landmark, controls outside any landmark, and a widget picker whose headings
 * made it an invalid menu. A failure here prints what axe says and where.
 *
 * Colour contrast is off: jsdom has no layout or computed colours. Tool chrome is
 * checked by hand in `ui-tokens.css`; the canvas by `core/theme/contrast.ts`.
 */

async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations.flatMap((v) =>
    v.nodes.map((node) => `${v.id}: ${v.help} — ${node.target.join(' ')}`),
  );
}

/** One of every widget, with enough settings that each shows real content. */
const SETTINGS: Record<string, unknown> = {
  'stillpoint.links': { links: [{ url: 'https://example.com', label: 'Example' }] },
  'stillpoint.todo': { items: [{ id: 'a', text: 'Milk', done: false }] },
  'stillpoint.weather': {
    location: { name: 'Paris', latitude: 48.85, longitude: 2.35 },
  },
  'stillpoint.search': { autofocus: false },
};

async function seedEveryWidget() {
  await browser.storage.local.set({
    [StorageKeys.config]: {
      version: 1,
      activeProfileId: 'p1',
      profiles: [
        {
          id: 'p1',
          name: 'Desk',
          background: { kind: 'solid', color: '#000' },
          widgets: widgetDefinitions.map((definition, i) => ({
            instanceId: `w${i}`,
            type: definition.id,
            rect: { x: (i % 4) * 6, y: Math.floor(i / 4) * 4, w: 6, h: 4 },
            settings: SETTINGS[definition.id] ?? {},
          })),
        },
      ],
    },
  });
}

describe('accessibility (axe)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    localStorage.clear();
  });
  afterEach(() => configStore.getState().dispose());

  it('finds nothing on the new tab, in edit mode, the picker and every panel', async () => {
    const user = userEvent.setup();
    await seedEveryWidget();
    render(<NewTab />);
    await screen.findByRole('textbox', { name: 'Note' });
    // Lazy widget chunks settle.
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(await violations()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Edit layout' }));
    await screen.findByRole('toolbar');
    expect(await violations()).toEqual([]);

    for (const section of ['Profile', 'Theme', 'Background', 'Layout']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${section}`) }));
      expect(await violations(), section).toEqual([]);
    }

    await user.click(screen.getByRole('button', { name: 'Add widget' }));
    expect(await violations(), 'picker').toEqual([]);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(await violations(), 'shortcuts').toEqual([]);
    await user.keyboard('{Escape}');

    for (const definition of widgetDefinitions) {
      await user.click(
        screen.getByRole('button', { name: new RegExp(`^${definition.name}, column`) }),
      );
      expect(await violations(), definition.name).toEqual([]);
    }
  });

  it('finds nothing on the options page', async () => {
    render(<Options />);
    await screen.findByRole('heading', { name: 'Profiles' });
    expect(await violations()).toEqual([]);
  });
});
