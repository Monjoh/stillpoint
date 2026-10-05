import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './defaults';
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  isValidConfig,
  moveProfile,
  renameProfile,
  setActiveProfile,
} from './profiles';
import type { StillpointConfig } from './schema';

const base = () => createDefaultConfig();

/** A config with `n` profiles, the first of which is active. */
function withProfiles(n: number): StillpointConfig {
  let config = base();
  for (let i = 1; i < n; i++) config = createProfile(config, `Profile ${i}`);
  return config;
}

describe('createProfile', () => {
  it('adds a profile without switching to it', () => {
    const config = createProfile(base(), 'Work');
    expect(config.profiles.map((p) => p.name)).toEqual(['Default', 'Work']);
    expect(config.activeProfileId).toBe(config.profiles[0]?.id);
  });

  it('switches to it when asked', () => {
    const config = createProfile(base(), 'Work', { activate: true });
    expect(config.activeProfileId).toBe(config.profiles[1]?.id);
  });

  // Parsed through the schema rather than built by hand, so a new profile gets
  // exactly what a fresh install's does and cannot drift from it.
  it('arrives schema-valid, with layout, theme and background filled in', () => {
    const config = createProfile(base(), 'Work');
    const added = config.profiles[1];
    expect(added?.layout.columns).toBe(24);
    expect(added?.theme.preset).toBe('midnight');
    expect(added?.background.kind).toBe('gradient');
    expect(added?.widgets).toEqual([]);
    expect(isValidConfig(config)).toBe(true);
  });

  it('does not hand two profiles the same name', () => {
    const config = createProfile(createProfile(base(), 'Work'), 'Work');
    expect(config.profiles.map((p) => p.name)).toEqual(['Default', 'Work', 'Work 2']);
  });
});

describe('renameProfile', () => {
  it('renames and trims', () => {
    const config = renameProfile(base(), base().profiles[0]!.id, '  Focus  ');
    const renamed = renameProfile(config, config.profiles[0]!.id, '  Focus  ')
      .profiles[0];
    expect(renamed?.name).toBe('Focus');
  });

  // An empty name is a half-finished edit, not an instruction.
  it('refuses an empty name rather than storing one', () => {
    const config = base();
    expect(renameProfile(config, config.profiles[0]!.id, '   ')).toBe(config);
  });

  it('ignores an id that is not there', () => {
    const config = base();
    expect(renameProfile(config, 'nope', 'X').profiles[0]?.name).toBe('Default');
  });
});

describe('duplicateProfile', () => {
  it('copies the widgets and places the copy next to its source', () => {
    const config = duplicateProfile(
      createProfile(base(), 'Last'),
      base().profiles[0]!.id,
    );
    const source = createProfile(base(), 'Last');
    const copied = duplicateProfile(source, source.profiles[0]!.id);

    expect(copied.profiles.map((p) => p.name)).toEqual([
      'Default',
      'Default 2',
      'Last',
    ]);
    expect(copied.profiles[1]?.widgets).toHaveLength(
      source.profiles[0]!.widgets.length,
    );
    expect(isValidConfig(config)).toBe(true);
  });

  // Unique within a profile is all that is required today. A copy sharing ids with
  // its source is a trap for the first feature that moves a widget between profiles.
  it('gives the copied widgets fresh instance ids', () => {
    const config = base();
    const copied = duplicateProfile(config, config.profiles[0]!.id);
    expect(copied.profiles[1]?.widgets[0]?.instanceId).not.toBe(
      copied.profiles[0]?.widgets[0]?.instanceId,
    );
  });

  it('does not move the active profile', () => {
    const config = base();
    const copied = duplicateProfile(config, config.profiles[0]!.id);
    expect(copied.activeProfileId).toBe(config.activeProfileId);
  });
});

describe('deleteProfile', () => {
  // configSchema requires at least one profile. A config with none fails to parse and
  // is replaced by defaults on the next load — the user's whole setup, gone.
  it('refuses to delete the last profile', () => {
    const config = base();
    expect(deleteProfile(config, config.profiles[0]!.id)).toBe(config);
  });

  it('hands the active slot to a neighbour when the active one goes', () => {
    const config = withProfiles(3);
    const deleted = deleteProfile(config, config.activeProfileId);
    expect(deleted.profiles).toHaveLength(2);
    expect(deleted.activeProfileId).toBe(deleted.profiles[0]?.id);
    expect(isValidConfig(deleted)).toBe(true);
  });

  it('leaves the active slot alone when another one goes', () => {
    const config = withProfiles(3);
    const deleted = deleteProfile(config, config.profiles[2]!.id);
    expect(deleted.activeProfileId).toBe(config.activeProfileId);
  });

  it('falls back to the new last profile when the last one was active', () => {
    const config = withProfiles(3);
    const last = config.profiles[2]!.id;
    const deleted = deleteProfile(setActiveProfile(config, last), last);

    expect(deleted.activeProfileId).toBe(deleted.profiles[1]?.id);
    expect(isValidConfig(deleted)).toBe(true);
  });
});

describe('moveProfile', () => {
  it('moves a profile one place', () => {
    const config = withProfiles(3);
    const moved = moveProfile(config, config.profiles[0]!.id, 1);
    expect(moved.profiles.map((p) => p.name)).toEqual([
      'Profile 1',
      'Default',
      'Profile 2',
    ]);
  });

  it('refuses a move off either end', () => {
    const config = withProfiles(3);
    expect(moveProfile(config, config.profiles[0]!.id, -1)).toBe(config);
    expect(moveProfile(config, config.profiles[2]!.id, 1)).toBe(config);
  });
});

describe('setActiveProfile', () => {
  it('switches to a profile that exists', () => {
    const config = withProfiles(2);
    expect(setActiveProfile(config, config.profiles[1]!.id).activeProfileId).toBe(
      config.profiles[1]?.id,
    );
  });

  // The schema's refine would reject it, and the store would then refuse to save at
  // all — a button that silently stops every later write from landing.
  it('ignores an id that is not there', () => {
    const config = withProfiles(2);
    expect(setActiveProfile(config, 'nope')).toBe(config);
  });
});
