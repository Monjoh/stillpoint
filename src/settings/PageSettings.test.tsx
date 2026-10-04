import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIG_VERSION,
  configSchema,
  profileSchema,
  type Profile,
  type StillpointConfig,
} from '@/core/config/schema';
import { PageSettings } from './PageSettings';

/**
 * The panel with nothing selected: the page you are editing, rather than a thing on
 * it. Two of these three sections had no UI at all before — the grid was reachable
 * only by hand-editing an export.
 */

function profile(id = 'p1', name = 'Focus'): Profile {
  return profileSchema.parse({
    id,
    name,
    background: { kind: 'solid', color: '#000' },
  });
}

function config(profiles: Profile[] = [profile()]): StillpointConfig {
  return configSchema.parse({
    version: CONFIG_VERSION,
    activeProfileId: profiles[0]!.id,
    profiles,
    app: {},
  });
}

/**
 * Opens one category, the way the panel does. Every test but the accordion's own
 * names the section it is about, because a collapsed section renders no fields —
 * which is the point of it.
 */
function setup(
  options: {
    config?: StillpointConfig;
    onOpenOptions?: () => void;
    open?: string | null;
  } = {},
) {
  const current = options.config ?? config();
  const active = current.profiles.find((p) => p.id === current.activeProfileId)!;
  const onChangeLayout = vi.fn();
  const onChangeTheme = vi.fn();
  const onChangeBackground = vi.fn();
  const onChangeConfig = vi.fn();

  function Harness() {
    const [openSection, setOpenSection] = useState<string | null>(
      options.open === undefined ? null : options.open,
    );
    return (
      <PageSettings
        config={current}
        profile={active}
        onChangeLayout={onChangeLayout}
        onChangeTheme={onChangeTheme}
        onChangeBackground={onChangeBackground}
        onChangeConfig={onChangeConfig}
        onOpenOptions={options.onOpenOptions}
        openSection={openSection}
        onToggleSection={(id) =>
          setOpenSection((current) => (current === id ? null : id))
        }
      />
    );
  }

  render(<Harness />);

  /** Runs the recipe the panel handed back, so the assertion is about the result. */
  const applied = () => {
    const recipe = onChangeConfig.mock.lastCall?.[0] as (
      c: StillpointConfig,
    ) => StillpointConfig;
    return recipe(current);
  };

  return {
    current,
    active,
    onChangeLayout,
    onChangeTheme,
    onChangeBackground,
    onChangeConfig,
    applied,
  };
}

describe('the profile section', () => {
  it('offers no switcher when there is only one profile', () => {
    setup({ open: 'profile' });
    expect(screen.queryByLabelText('Editing')).toBeNull();
    expect(screen.getByLabelText('Profile name')).toHaveProperty('value', 'Focus');
  });

  it('switches the active profile when there is a choice', async () => {
    const { applied } = setup({
      config: config([profile('p1', 'Focus'), profile('p2', 'Night')]),
      open: 'profile',
    });

    await userEvent.selectOptions(screen.getByLabelText('Editing'), 'p2');
    expect(applied().activeProfileId).toBe('p2');
  });

  // Every other control writes on each keystroke. This one cannot: `renameProfile`
  // refuses an empty name, so the store would fight the user over their own backspace.
  it('renames on the way out, not on every keystroke', async () => {
    const { onChangeConfig, applied } = setup({ open: 'profile' });

    await userEvent.type(screen.getByLabelText('Profile name'), '!');
    expect(onChangeConfig).not.toHaveBeenCalled();

    await userEvent.tab();
    expect(applied().profiles[0]!.name).toBe('Focus!');
  });

  it('keeps the old name when the field is emptied', async () => {
    const { onChangeConfig } = setup({ open: 'profile' });

    await userEvent.clear(screen.getByLabelText('Profile name'));
    await userEvent.tab();
    expect(onChangeConfig).not.toHaveBeenCalled();
  });

  it('adds and copies profiles, and does not offer to delete one', async () => {
    const { applied } = setup({ open: 'profile' });

    await userEvent.click(screen.getByRole('button', { name: 'New profile' }));
    expect(applied().profiles).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    const copies = applied().profiles;
    expect(copies).toHaveLength(2);
    expect(copies[1]!.name).not.toBe(copies[0]!.name);

    // Deleting the profile you are standing inside belongs on the options page.
    expect(screen.queryByRole('button', { name: /delete|remove/i })).toBeNull();
  });
});

describe('the layout section', () => {
  it('generates the grid fields from the schema', () => {
    setup({ open: 'layout' });
    expect(screen.getByLabelText('Columns')).toHaveProperty('value', '24');
    expect(screen.getByLabelText('Rows')).toHaveProperty('value', '12');
    expect(screen.getByLabelText('Gap')).toBeTruthy();
    expect(screen.getByLabelText('Maximum width')).toBeTruthy();
  });

  // A min/max pair would otherwise infer a slider, and a slider drag fires once per
  // step — a hundred rescales compounding their rounding into a mangled layout.
  it('gives the grid size a number box rather than a slider', () => {
    setup({ open: 'layout' });
    expect(screen.getByLabelText('Columns')).toHaveProperty('type', 'number');
    expect(screen.getByLabelText('Rows')).toHaveProperty('type', 'number');
  });

  it('passes a whole valid layout up, not the one field that changed', () => {
    const { onChangeLayout } = setup({ open: 'layout' });

    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '36' } });
    expect(onChangeLayout).toHaveBeenCalledWith(
      expect.objectContaining({ columns: 36, rows: 12, gap: 12 }),
    );
  });

  // `maxWidth` is nullable and its help text says to clear it. An empty box is the
  // only way a number field can say "no value", so it has to mean that where the
  // schema allows one — and go on meaning "still typing" where it does not.
  it('clears the maximum width to nothing, as its help text promises', () => {
    const { onChangeLayout } = setup({ open: 'layout' });

    fireEvent.change(screen.getByLabelText('Maximum width'), { target: { value: '' } });
    expect(onChangeLayout).toHaveBeenCalledWith(
      expect.objectContaining({ maxWidth: null }),
    );
  });

  it('writes nothing for an empty box the schema will not accept as empty', () => {
    const { onChangeLayout } = setup({ open: 'layout' });

    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '' } });
    expect(onChangeLayout).not.toHaveBeenCalled();
  });

  it('ignores a value the schema rejects instead of applying it', () => {
    const { onChangeLayout } = setup({ open: 'layout' });

    // Below the minimum of 4. A half-typed number must never reach the geometry.
    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '2' } });
    expect(onChangeLayout).not.toHaveBeenCalled();
  });
});

describe('the general section', () => {
  it('shows the app settings that are meant to be seen, and not the rest', async () => {
    const { applied } = setup({ open: 'general' });

    const toggle = screen.getByLabelText('Allow editing the layout');
    expect(toggle).toHaveProperty('checked', true);
    expect(screen.queryByLabelText('Language')).toBeNull();
    expect(screen.queryByLabelText('Unsplash access key')).toBeNull();

    await userEvent.click(toggle);
    expect(applied().app.editModeEnabled).toBe(false);
  });

  it('offers the full options page only where there is one to open', async () => {
    const onOpenOptions = vi.fn();
    setup({ onOpenOptions });

    await userEvent.click(
      screen.getByRole('button', { name: 'All settings and backups…' }),
    );
    expect(onOpenOptions).toHaveBeenCalled();
  });

  it('says nothing about an options page when there is none', () => {
    setup();
    expect(screen.queryByRole('button', { name: /all settings/i })).toBeNull();
  });
});

/**
 * The categories themselves. Five expanded at once were taller than the window, so
 * each collapses to one row — and that row still carries its value, which is what
 * keeps collapsing from being a hiding place.
 */
describe('the categories', () => {
  const trigger = (name: string) =>
    screen.getByRole('button', { name: new RegExp(`^${name}`) });

  it('starts with every category closed', () => {
    setup();
    for (const name of ['Profile', 'Theme', 'Background', 'Layout', 'General']) {
      expect(trigger(name).getAttribute('aria-expanded')).toBe('false');
    }
    // Closed means not rendered, so a collapsed category holds nothing focusable.
    expect(screen.queryByLabelText('Columns')).toBeNull();
  });

  it('says what each one is set to without being opened', () => {
    setup();
    expect(trigger('Theme').textContent).toContain('Midnight');
    // This fixture is a solid colour, which is none of the ten swatches.
    expect(trigger('Background').textContent).toContain('Custom');
    expect(trigger('Layout').textContent).toContain('24 \u00d7 12');
    expect(trigger('General').textContent).toContain('Editing allowed');
    expect(trigger('Profile').textContent).toContain('Focus');
  });

  it('opens one and closes it again', async () => {
    setup();
    await userEvent.click(trigger('Layout'));
    expect(screen.getByLabelText('Columns')).toBeTruthy();

    await userEvent.click(trigger('Layout'));
    expect(screen.queryByLabelText('Columns')).toBeNull();
  });

  it('keeps only one open at a time', async () => {
    setup();
    await userEvent.click(trigger('Layout'));
    await userEvent.click(trigger('General'));

    expect(screen.queryByLabelText('Columns')).toBeNull();
    expect(screen.getByLabelText('Allow editing the layout')).toBeTruthy();
  });

  // The value is the question's answer; once open, the section is saying it louder.
  it('drops the value from the row it has expanded', async () => {
    setup();
    await userEvent.click(trigger('Layout'));
    expect(trigger('Layout').textContent).not.toContain('24');
  });

  it('names the background when it is one of the curated ones', () => {
    setup({
      config: config([
        profileSchema.parse({
          id: 'p1',
          name: 'Focus',
          background: { kind: 'gradient', from: '#0f2027', to: '#2c5364', angle: 160 },
        }),
      ]),
    });
    expect(trigger('Background').textContent).toContain('Tide');
  });

  it('says when the theme has been customised', () => {
    setup({
      config: config([
        profileSchema.parse({
          id: 'p1',
          name: 'Focus',
          theme: { preset: 'paper', overrides: { '--sp-accent': '#f00' } },
          background: { kind: 'solid', color: '#fff' },
        }),
      ]),
    });
    expect(trigger('Theme').textContent).toContain('Paper, customised');
  });

  it('counts the profiles when there is more than one', () => {
    setup({ config: config([profile('p1', 'Focus'), profile('p2', 'Night')]) });
    expect(trigger('Profile').textContent).toContain('Focus of 2');
  });
});
