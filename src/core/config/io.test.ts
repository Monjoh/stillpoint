import { describe, expect, it } from 'vitest';
import fixtureV4 from './__fixtures__/config-v4.json';
import { createDefaultConfig } from './defaults';
import {
  ConfigImportError,
  exportConfig,
  exportFilename,
  mergeProfiles,
  parseImport,
} from './io';
import { CONFIG_VERSION, configSchema } from './schema';

describe('export / import round trip', () => {
  it('imports back to an identical tree', () => {
    const config = configSchema.parse(fixtureV4);
    const result = parseImport(exportConfig(config));
    expect(result.config).toEqual(config);
  });

  it('writes a readable, hand-editable file', () => {
    const text = exportConfig(createDefaultConfig());
    expect(text).toContain('\n  ');
    expect(JSON.parse(text)).toHaveProperty('exportedAt');
  });

  it('carries assets alongside the config', () => {
    const text = exportConfig(createDefaultConfig(), {
      a1: 'data:image/png;base64,AA',
    });
    expect(parseImport(text).assets).toEqual({ a1: 'data:image/png;base64,AA' });
  });

  it('accepts a bare config tree, since people hand-edit these', () => {
    const config = configSchema.parse(fixtureV4);
    const result = parseImport(JSON.stringify(config));
    expect(result.config).toEqual(config);
    expect(result.assets).toEqual({});
  });
});

describe('import rejection', () => {
  it('rejects malformed JSON and says why', () => {
    expect(() => parseImport('{ not json')).toThrow(ConfigImportError);
    try {
      parseImport('{ not json');
    } catch (error) {
      expect((error as ConfigImportError).message).toMatch(/not valid JSON/);
      expect((error as ConfigImportError).detail).toBeTruthy();
    }
  });

  it('refuses a config from a newer version', () => {
    const text = JSON.stringify({ ...fixtureV4, version: CONFIG_VERSION + 1 });
    expect(() => parseImport(text)).toThrow(/newer version of Stillpoint/);
  });

  it('rejects a structurally invalid config and points at the field', () => {
    const broken = structuredClone(fixtureV4) as Record<string, unknown>;
    (broken.profiles as Record<string, unknown>[])[0]!.name = '';
    try {
      parseImport(JSON.stringify(broken));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigImportError);
      expect((error as ConfigImportError).detail).toMatch(/name/);
    }
  });

  it('rejects a config whose activeProfileId points nowhere', () => {
    const broken = { ...fixtureV4, activeProfileId: 'missing' };
    expect(() => parseImport(JSON.stringify(broken))).toThrow(ConfigImportError);
  });
});

describe('mergeProfiles', () => {
  it('adds profiles instead of replacing them', () => {
    const current = createDefaultConfig();
    const incoming = configSchema.parse(fixtureV4);

    const merged = mergeProfiles(current, incoming);

    expect(merged.profiles).toHaveLength(3);
    expect(merged.activeProfileId).toBe(current.activeProfileId);
    expect(configSchema.safeParse(merged).success).toBe(true);
  });

  it('gives imported profiles fresh ids so a double import does not overwrite', () => {
    const current = createDefaultConfig();
    const incoming = configSchema.parse(fixtureV4);

    const once = mergeProfiles(current, incoming);
    const twice = mergeProfiles(once, incoming);

    const ids = twice.profiles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(twice.profiles).toHaveLength(5);
  });

  it('disambiguates colliding names', () => {
    const current = createDefaultConfig();
    const incoming = configSchema.parse(fixtureV4);

    const merged = mergeProfiles(mergeProfiles(current, incoming), incoming);
    const names = merged.profiles.map((p) => p.name);

    expect(names).toContain('Focus');
    expect(names).toContain('Focus (2)');
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps the imported widgets intact', () => {
    const merged = mergeProfiles(createDefaultConfig(), configSchema.parse(fixtureV4));
    const focus = merged.profiles.find((p) => p.name === 'Focus')!;
    expect(focus.widgets).toHaveLength(2);
  });
});

describe('exportFilename', () => {
  it('slugs the active profile name and dates the file', () => {
    const config = configSchema.parse(fixtureV4);
    expect(exportFilename(config, new Date('2026-10-04T12:00:00Z'))).toBe(
      'stillpoint-focus-2026-10-04.json',
    );
  });

  it('survives a profile name with no usable characters', () => {
    const config = configSchema.parse({
      ...fixtureV4,
      profiles: [
        { ...(fixtureV4.profiles[0] as Record<string, unknown>), name: '•••' },
        fixtureV4.profiles[1],
      ],
    });
    expect(exportFilename(config, new Date('2026-10-04T12:00:00Z'))).toBe(
      'stillpoint-config-2026-10-04.json',
    );
  });
});
