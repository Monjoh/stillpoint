import { isImageAsset, type ImageAsset } from '@/core/assets/image';
import { CONFIG_VERSION, configSchema, type StillpointConfig } from './schema';
import { ConfigVersionError, runMigrations } from './migrations';

/**
 * Import and export: the whole of Stillpoint's data portability, and the reason
 * ADR-0002 can say "no accounts, no server" without that meaning "no way out".
 *
 * Deliberately pure. The file picker and the download live in the options page; what
 * is testable is the parsing, the version handling and the error messages, and none
 * of that needs a DOM.
 */

/** Marks the file as ours, so an import can say *what* is wrong rather than "invalid". */
export const EXPORT_FORMAT = 'stillpoint.config';

export interface ExportFile {
  filename: string;
  /** Pretty-printed: an export is something a person may open and read. */
  json: string;
}

/**
 * Photographs travel under a top-level `assets` object, keyed by the id the config
 * uses. In storage they live apart from the config so that it stays small; in a file
 * self-containment matters more than size, and an export that silently left the
 * user's photos behind would not be a backup.
 */
export type ExportAssets = Record<string, ImageAsset>;

export function exportConfig(
  config: StillpointConfig,
  now: Date = new Date(),
  assets: ExportAssets = {},
): ExportFile {
  const payload = {
    format: EXPORT_FORMAT,
    exportedAt: now.toISOString(),
    ...config,
    ...(Object.keys(assets).length > 0 ? { assets } : {}),
  };

  return {
    filename: `stillpoint-${stamp(now)}.json`,
    json: JSON.stringify(payload, null, 2),
  };
}

export type ImportResult =
  | {
      ok: true;
      config: StillpointConfig;
      migratedFrom: number | null;
      /** Only the well-formed ones. A photo that fails the check is left behind. */
      assets: ExportAssets;
    }
  | { ok: false; error: string };

/**
 * Turn the contents of a file into a config, or into a sentence saying why not.
 *
 * Every failure path returns a message written for the person who picked the file,
 * not for us. "Unexpected token < in JSON at position 0" tells someone who exported
 * the wrong file nothing; "this does not look like a Stillpoint export" tells them
 * what to do next.
 */
export function importConfig(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: 'That file is not valid JSON, so there is nothing to import.',
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'That file does not contain a Stillpoint backup.' };
  }

  const found = (parsed as Record<string, unknown>).version;
  if (typeof found !== 'number') {
    return {
      ok: false,
      error:
        'That file has no Stillpoint version number, so it is probably not an export from this extension.',
    };
  }

  let migrated: unknown;
  let applied: number[];
  try {
    const result = runMigrations(parsed);
    migrated = result.config;
    applied = result.applied;
  } catch (error) {
    // The newer-version case has its own written message; keep it.
    if (error instanceof ConfigVersionError) return { ok: false, error: error.message };
    return {
      ok: false,
      error: `That backup could not be upgraded to the current format: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  // `format`, `exportedAt` and `assets` are the export envelope, not part of the
  // config. Dropped before validating, so the schema never has to know exports have one.
  const tree = { ...(migrated as Record<string, unknown>) };
  const assets = readAssets(tree.assets);
  delete tree.format;
  delete tree.exportedAt;
  delete tree.assets;

  const validated = configSchema.safeParse(tree);
  if (!validated.success) {
    const first = validated.error.issues[0];
    const where = first?.path.length ? ` (at \`${first.path.join('.')}\`)` : '';
    return {
      ok: false,
      error: `That backup is a Stillpoint file but does not fit the current format${where}: ${
        first?.message ?? 'unknown problem'
      }`,
    };
  }

  return {
    ok: true,
    config: validated.data,
    migratedFrom: applied.length > 0 ? found : null,
    assets,
  };
}

function readAssets(raw: unknown): ExportAssets {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const assets: ExportAssets = {};
  for (const [id, asset] of Object.entries(raw)) {
    if (id.length > 0 && isImageAsset(asset)) assets[id] = asset;
  }
  return assets;
}

/** Local date and time, not UTC: the filename is read by a person, in their timezone. */
function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

/** Exported for the options page's "what version am I on" line. */
export const CURRENT_CONFIG_VERSION = CONFIG_VERSION;
