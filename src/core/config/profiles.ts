import { newId } from '@/lib/id';
import {
  configSchema,
  profileSchema,
  type Profile,
  type StillpointConfig,
} from './schema';

/**
 * Profile management as pure `Config → Config` functions.
 *
 * Same shape as `canvas/operations.ts`, and for the same reason: the interesting part
 * is the bookkeeping — which profile is active after a delete, what a duplicate's
 * widget ids are — and it is far easier to test without a page around it.
 *
 * Every function returns the config unchanged when asked to do something impossible,
 * rather than throwing. These are driven by buttons, and a button that throws takes
 * the options page down with it.
 */

const MAX_NAME = 60;

export function createProfile(
  config: StillpointConfig,
  name = 'New profile',
  options: { activate?: boolean } = {},
): StillpointConfig {
  // Parsed rather than built literally, so layout, theme and background come from the
  // schema's own defaults and cannot drift from what a fresh install gets.
  const profile = profileSchema.parse({
    id: newId(),
    name: uniqueName(config, trimName(name)),
    background: { kind: 'gradient', from: '#11131c', to: '#1d2033', angle: 160 },
  });

  return {
    ...config,
    profiles: [...config.profiles, profile],
    activeProfileId: options.activate ? profile.id : config.activeProfileId,
  };
}

export function renameProfile(
  config: StillpointConfig,
  id: string,
  name: string,
): StillpointConfig {
  const clean = trimName(name);
  // An empty name is a half-finished edit, not an instruction. Keeping the old one is
  // better than storing a profile the user cannot tell apart from the others.
  if (clean === '') return config;

  return {
    ...config,
    profiles: config.profiles.map((p) => (p.id === id ? { ...p, name: clean } : p)),
  };
}

/**
 * Copy a profile, widgets and all.
 *
 * Widget instance ids are regenerated. They only have to be unique within a profile
 * today, but a duplicate that shares ids with its source is a trap waiting for the
 * first feature that moves a widget between profiles.
 */
export function duplicateProfile(
  config: StillpointConfig,
  id: string,
): StillpointConfig {
  const source = config.profiles.find((p) => p.id === id);
  if (!source) return config;

  const copy: Profile = {
    ...source,
    id: newId(),
    name: uniqueName(config, source.name),
    widgets: source.widgets.map((w) => ({ ...w, instanceId: newId() })),
  };

  const at = config.profiles.indexOf(source) + 1;
  const profiles = [...config.profiles];
  profiles.splice(at, 0, copy);

  return { ...config, profiles };
}

/**
 * Remove a profile, and hand the active slot to a neighbour if it was the active one.
 *
 * The last profile cannot be deleted: `configSchema` requires at least one, and a
 * config with none would fail to parse and be replaced by defaults on the next load —
 * the user's entire setup gone because they pressed a button that looked ordinary.
 */
export function deleteProfile(config: StillpointConfig, id: string): StillpointConfig {
  if (config.profiles.length <= 1) return config;

  const at = config.profiles.findIndex((p) => p.id === id);
  if (at === -1) return config;

  const profiles = config.profiles.filter((p) => p.id !== id);
  const fallback = profiles[Math.min(at, profiles.length - 1)];

  return {
    ...config,
    profiles,
    activeProfileId:
      config.activeProfileId === id
        ? (fallback?.id ?? config.activeProfileId)
        : config.activeProfileId,
  };
}

/** Move a profile by `delta` places. A move off either end is simply not made. */
export function moveProfile(
  config: StillpointConfig,
  id: string,
  delta: number,
): StillpointConfig {
  const at = config.profiles.findIndex((p) => p.id === id);
  const to = at + delta;
  if (at === -1 || to < 0 || to >= config.profiles.length) return config;

  const profiles = [...config.profiles];
  const [moved] = profiles.splice(at, 1);
  if (moved) profiles.splice(to, 0, moved);

  return { ...config, profiles };
}

export function setActiveProfile(
  config: StillpointConfig,
  id: string,
): StillpointConfig {
  if (!config.profiles.some((p) => p.id === id)) return config;
  return { ...config, activeProfileId: id };
}

/** Replace the whole `app` block. The options page edits it as one object. */
export function setAppSettings(
  config: StillpointConfig,
  app: StillpointConfig['app'],
): StillpointConfig {
  return { ...config, app };
}

/**
 * True when this tree is something `configSchema` will accept.
 *
 * The options page checks before writing rather than after: the store refuses to
 * persist an invalid tree and sets an error, which from the user's side looks like a
 * button that did nothing.
 */
export function isValidConfig(config: StillpointConfig): boolean {
  return configSchema.safeParse(config).success;
}

function trimName(name: string): string {
  return name.trim().slice(0, MAX_NAME);
}

/** "Focus" next to an existing "Focus" becomes "Focus 2". */
function uniqueName(config: StillpointConfig, name: string): string {
  const taken = new Set(config.profiles.map((p) => p.name));
  if (!taken.has(name)) return name;

  for (let n = 2; n < 1000; n++) {
    const candidate = trimName(`${name} ${n}`);
    if (!taken.has(candidate)) return candidate;
  }
  return trimName(`${name} ${newId()}`);
}
