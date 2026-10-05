import { i18n } from '#i18n';
import { z } from 'zod';
import { newId } from '@/lib/id';
import { runMigrations } from './migrations';
import { configSchema, type Profile, type StillpointConfig } from './schema';

/**
 * Export and import of the config tree.
 *
 * The transport file is a different thing from the runtime store: it is pretty-printed
 * because it is meant to be readable and hand-editable, and it carries background
 * images inline as base64 so that a shared file is self-contained. The runtime store
 * keeps blobs under their own keys for exactly the opposite reason.
 *
 * Everything in this module is pure. Nothing here touches storage; validation happens
 * entirely in memory and the caller writes only once the result is known to be good.
 */

export interface ExportFile {
  config: StillpointConfig;
  /** assetId -> base64 data URI. Empty until image backgrounds land in M4. */
  assets: Record<string, string>;
  exportedAt: string;
}

export function exportConfig(
  config: StillpointConfig,
  assets: Record<string, string> = {},
): string {
  const file: ExportFile = {
    config,
    assets,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(file, null, 2);
}

/** Suggested filename, e.g. `stillpoint-default-2026-10-04.json`. */
export function exportFilename(config: StillpointConfig, now = new Date()): string {
  const profile = config.profiles.find((p) => p.id === config.activeProfileId);
  const slug = (profile?.name ?? 'config')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = now.toISOString().slice(0, 10);
  return `stillpoint-${slug || 'config'}-${date}.json`;
}

export class ConfigImportError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'ConfigImportError';
  }
}

export interface ImportResult {
  config: StillpointConfig;
  assets: Record<string, string>;
  /** Versions the migration chain produced. Empty when the file was already current. */
  migrated: number[];
}

/**
 * Steps 1–4 of the import sequence: parse, version-check, migrate, validate.
 *
 * Accepts either a full export file (`{ config, assets }`) or a bare config tree, since
 * a hand-edited file is a thing people will produce.
 */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ConfigImportError(
      i18n.t('importError.notJson'),
      error instanceof Error ? error.message : undefined,
    );
  }

  const envelope = isExportEnvelope(raw) ? raw : { config: raw, assets: {} };

  let migratedTree: unknown;
  let migrated: number[];
  try {
    const result = runMigrations(envelope.config);
    migratedTree = result.config;
    migrated = result.applied;
  } catch (error) {
    throw new ConfigImportError(
      error instanceof Error ? error.message : i18n.t('importError.unreadable'),
    );
  }

  const parsed = configSchema.safeParse(migratedTree);
  if (!parsed.success) {
    throw new ConfigImportError(
      i18n.t('importError.invalid'),
      z.prettifyError(parsed.error),
    );
  }

  return { config: parsed.data, assets: envelope.assets, migrated };
}

function isExportEnvelope(
  raw: unknown,
): raw is { config: unknown; assets: Record<string, string> } {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  if (!('config' in r)) return false;
  const assets = r.assets;
  return assets === undefined || (typeof assets === 'object' && assets !== null);
}

/**
 * Step 5, "add these profiles" rather than "replace everything".
 *
 * Imported profiles get fresh ids so that importing a file twice, or importing a file
 * derived from your own config, adds profiles instead of silently overwriting them.
 * Names are disambiguated the way a file manager does it.
 */
export function mergeProfiles(
  current: StillpointConfig,
  incoming: StillpointConfig,
): StillpointConfig {
  const existingNames = new Set(current.profiles.map((p) => p.name));

  const added: Profile[] = incoming.profiles.map((profile) => ({
    ...profile,
    id: newId(),
    name: uniqueName(profile.name, existingNames),
  }));

  return configSchema.parse({
    ...current,
    profiles: [...current.profiles, ...added],
  });
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`.slice(0, 60);
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}
