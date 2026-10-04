import { CONFIG_VERSION } from './schema';

/**
 * Migrations take a tree of an unknown older shape and return the next one.
 *
 * `any` is deliberate and is one of the two places the project allows it (see
 * docs/06-conventions.md): a migration input is by definition a shape the current
 * types no longer describe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Migration = (old: any) => any;

/**
 * Keyed by the version each migration produces. `migrations[2]` takes a v1 tree and
 * returns a v2 tree.
 *
 * Rules, in priority order:
 * 1. Never lose user data. If a value cannot be interpreted, keep the original under
 *    `_unmigrated` rather than dropping it.
 * 2. Pure. No storage access, no clock, no randomness — the caller handles backups.
 * 3. One fixture per version in `__fixtures__/`, with a test asserting the result
 *    parses against the current schema.
 */
export const migrations: Record<number, Migration> = {
  // 2: (v1) => ({ ...v1, version: 2, ... }),
};

export class ConfigVersionError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(
      `This config was written by a newer version of Stillpoint (config version ${found}, this build understands up to ${supported}). Update the extension, then import it again.`,
    );
    this.name = 'ConfigVersionError';
  }
}

export interface MigrationResult {
  config: unknown;
  /** Versions produced, in order. Empty when the input was already current. */
  applied: number[];
}

function readVersion(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Config is not an object.');
  }
  const version = (raw as Record<string, unknown>).version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('Config has no usable `version` field.');
  }
  return version;
}

/**
 * Runs the chain from the tree's own version up to `CONFIG_VERSION`.
 *
 * Forward only: a config from a newer version is refused rather than downgraded, since
 * guessing at fields we do not know about is how data gets quietly destroyed.
 * The result is NOT schema-validated here — the caller does that, so that a migration
 * bug and a malformed input produce distinguishable errors.
 */
export function runMigrations(
  raw: unknown,
  /** Overridable so the chain itself is testable while only one version exists. */
  targetVersion: number = CONFIG_VERSION,
): MigrationResult {
  const from = readVersion(raw);

  if (from > targetVersion) throw new ConfigVersionError(from, targetVersion);
  if (from === targetVersion) return { config: raw, applied: [] };

  let config = raw;
  const applied: number[] = [];

  for (let target = from + 1; target <= targetVersion; target++) {
    const migration = migrations[target];
    if (!migration) {
      throw new Error(
        `No migration registered to produce config version ${target}. The chain from ${from} to ${targetVersion} is broken.`,
      );
    }
    config = migration(config);
    applied.push(target);
  }

  return { config, applied };
}
