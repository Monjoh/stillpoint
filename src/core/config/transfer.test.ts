import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './defaults';
import { createProfile } from './profiles';
import { CONFIG_VERSION } from './schema';
import { asset } from '@/core/assets/__fixtures__/asset';
import { EXPORT_FORMAT, exportConfig, importConfig } from './transfer';

describe('exportConfig', () => {
  it('writes the whole tree with an envelope that identifies it', () => {
    const config = createDefaultConfig();
    const parsed = JSON.parse(exportConfig(config).json);

    expect(parsed.format).toBe(EXPORT_FORMAT);
    expect(parsed.version).toBe(CONFIG_VERSION);
    expect(parsed.profiles).toHaveLength(1);
    expect(parsed.activeProfileId).toBe(config.activeProfileId);
  });

  it('pretty-prints, because an export is something a person may open', () => {
    expect(exportConfig(createDefaultConfig()).json).toContain('\n  ');
  });

  it('names the file by local date and time', () => {
    const at = new Date(2026, 9, 4, 9, 7);
    expect(exportConfig(createDefaultConfig(), at).filename).toBe(
      'stillpoint-2026-10-04-0907.json',
    );
  });
});

describe('importConfig', () => {
  it('round-trips an export, envelope and all', () => {
    const config = createProfile(createDefaultConfig(), 'Work');
    const result = importConfig(exportConfig(config).json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toEqual(config);
    expect(result.migratedFrom).toBeNull();
  });

  // The envelope is ours, not the config's. The schema must never have to know it.
  it('strips the envelope rather than failing validation on it', () => {
    const result = importConfig(exportConfig(createDefaultConfig()).json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('format' in result.config).toBe(false);
    expect('exportedAt' in result.config).toBe(false);
  });

  it('accepts a bare config with no envelope', () => {
    const result = importConfig(JSON.stringify(createDefaultConfig()));
    expect(result.ok).toBe(true);
  });
});

/**
 * Each failure returns a sentence written for the person who picked the file.
 * "Unexpected token < in JSON at position 0" tells someone who exported the wrong
 * thing nothing at all.
 */
describe('importConfig refuses clearly', () => {
  const reason = (raw: string) => {
    const result = importConfig(raw);
    return result.ok ? null : result.error;
  };

  it('on something that is not JSON', () => {
    expect(reason('<html>')).toMatch(/not valid JSON/);
  });

  it('on JSON that is not an object', () => {
    expect(reason('[1, 2, 3]')).toMatch(/does not contain a Stillpoint backup/);
    expect(reason('"hello"')).toMatch(/does not contain a Stillpoint backup/);
  });

  it('on an object with no version', () => {
    expect(reason('{"profiles":[]}')).toMatch(/no Stillpoint version number/);
  });

  // Forward only: guessing at fields we do not know about is how data gets destroyed.
  it('on a config from a newer build, naming both versions', () => {
    const message = reason(JSON.stringify({ version: CONFIG_VERSION + 5 }));
    expect(message).toMatch(new RegExp(`config version ${CONFIG_VERSION + 5}`));
    expect(message).toMatch(/Update the extension/);
  });

  it('on a Stillpoint file that does not fit the schema, saying where', () => {
    const broken = { ...createDefaultConfig(), activeProfileId: 'not-a-real-profile' };
    const message = reason(JSON.stringify(broken));
    expect(message).toMatch(/does not fit the current format/);
    expect(message).toMatch(/activeProfileId/);
  });

  it('on a file with no profiles at all', () => {
    const broken = { ...createDefaultConfig(), profiles: [] };
    expect(reason(JSON.stringify(broken))).toMatch(/does not fit the current format/);
  });
});

describe('photographs in a file', () => {
  const photoConfig = () => {
    const config = createDefaultConfig();
    return {
      ...config,
      profiles: config.profiles.map((p) => ({
        ...p,
        background: {
          kind: 'image' as const,
          assetId: 'a',
          fit: 'cover' as const,
          blur: 0,
          dim: 0,
        },
      })),
    };
  };

  // A backup that left the user's photos behind would not be a backup.
  it('travel with the export and come back on import', () => {
    const file = exportConfig(photoConfig(), new Date(), { a: asset });
    expect(JSON.parse(file.json).assets.a).toEqual(asset);

    const result = importConfig(file.json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assets).toEqual({ a: asset });
    expect('assets' in result.config).toBe(false);
  });

  it('are left out of an export that has none', () => {
    expect('assets' in JSON.parse(exportConfig(createDefaultConfig()).json)).toBe(
      false,
    );
  });

  // An imported file is a stranger, and its photographs end up inside a CSS `url()`.
  it('are dropped on import when malformed, without refusing the rest', () => {
    const tampered = JSON.parse(
      exportConfig(photoConfig(), new Date(), { a: asset }).json,
    );
    tampered.assets.a.dataUrl = 'https://example.com/tracker.gif';
    tampered.assets.b = 'not an asset';

    const result = importConfig(JSON.stringify(tampered));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assets).toEqual({});
  });
});
