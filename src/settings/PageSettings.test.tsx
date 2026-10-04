import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
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
    version: 1,
    activeProfileId: profiles[0]!.id,
    profiles,
    app: {},
  });
}

function setup(
  options: { config?: StillpointConfig; onOpenOptions?: () => void } = {},
) {
  const current = options.config ?? config();
  const active = current.profiles.find((p) => p.id === current.activeProfileId)!;
  const onChangeLayout = vi.fn();
  const onChangeConfig = vi.fn();

  render(
    <PageSettings
      config={current}
      profile={active}
      onChangeLayout={onChangeLayout}
      onChangeConfig={onChangeConfig}
      onOpenOptions={options.onOpenOptions}
    />,
  );

  /** Runs the recipe the panel handed back, so the assertion is about the result. */
  const applied = () => {
    const recipe = onChangeConfig.mock.lastCall?.[0] as (
      c: StillpointConfig,
    ) => StillpointConfig;
    return recipe(current);
  };

  return { current, active, onChangeLayout, onChangeConfig, applied };
}

describe('the profile section', () => {
  it('offers no switcher when there is only one profile', () => {
    setup();
    expect(screen.queryByLabelText('Editing')).toBeNull();
    expect(screen.getByLabelText('Profile name')).toHaveProperty('value', 'Focus');
  });

  it('switches the active profile when there is a choice', async () => {
    const { applied } = setup({
      config: config([profile('p1', 'Focus'), profile('p2', 'Night')]),
    });

    await userEvent.selectOptions(screen.getByLabelText('Editing'), 'p2');
    expect(applied().activeProfileId).toBe('p2');
  });

  // Every other control writes on each keystroke. This one cannot: `renameProfile`
  // refuses an empty name, so the store would fight the user over their own backspace.
  it('renames on the way out, not on every keystroke', async () => {
    const { onChangeConfig, applied } = setup();

    await userEvent.type(screen.getByLabelText('Profile name'), '!');
    expect(onChangeConfig).not.toHaveBeenCalled();

    await userEvent.tab();
    expect(applied().profiles[0]!.name).toBe('Focus!');
  });

  it('keeps the old name when the field is emptied', async () => {
    const { onChangeConfig } = setup();

    await userEvent.clear(screen.getByLabelText('Profile name'));
    await userEvent.tab();
    expect(onChangeConfig).not.toHaveBeenCalled();
  });

  it('adds and copies profiles, and does not offer to delete one', async () => {
    const { applied } = setup();

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
    setup();
    expect(screen.getByLabelText('Columns')).toHaveProperty('value', '24');
    expect(screen.getByLabelText('Rows')).toHaveProperty('value', '12');
    expect(screen.getByLabelText('Gap')).toBeTruthy();
    expect(screen.getByLabelText('Maximum width')).toBeTruthy();
  });

  // A min/max pair would otherwise infer a slider, and a slider drag fires once per
  // step — a hundred rescales compounding their rounding into a mangled layout.
  it('gives the grid size a number box rather than a slider', () => {
    setup();
    expect(screen.getByLabelText('Columns')).toHaveProperty('type', 'number');
    expect(screen.getByLabelText('Rows')).toHaveProperty('type', 'number');
  });

  it('passes a whole valid layout up, not the one field that changed', () => {
    const { onChangeLayout } = setup();

    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '36' } });
    expect(onChangeLayout).toHaveBeenCalledWith(
      expect.objectContaining({ columns: 36, rows: 12, gap: 12 }),
    );
  });

  // `maxWidth` is nullable and its help text says to clear it. An empty box is the
  // only way a number field can say "no value", so it has to mean that where the
  // schema allows one — and go on meaning "still typing" where it does not.
  it('clears the maximum width to nothing, as its help text promises', () => {
    const { onChangeLayout } = setup();

    fireEvent.change(screen.getByLabelText('Maximum width'), { target: { value: '' } });
    expect(onChangeLayout).toHaveBeenCalledWith(
      expect.objectContaining({ maxWidth: null }),
    );
  });

  it('writes nothing for an empty box the schema will not accept as empty', () => {
    const { onChangeLayout } = setup();

    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '' } });
    expect(onChangeLayout).not.toHaveBeenCalled();
  });

  it('ignores a value the schema rejects instead of applying it', () => {
    const { onChangeLayout } = setup();

    // Below the minimum of 4. A half-typed number must never reach the geometry.
    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '2' } });
    expect(onChangeLayout).not.toHaveBeenCalled();
  });
});

describe('the general section', () => {
  it('shows the app settings that are meant to be seen, and not the rest', async () => {
    const { applied } = setup();

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
