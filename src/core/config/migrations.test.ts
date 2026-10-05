import { describe, expect, it } from 'vitest';
import fixtureV1 from './__fixtures__/config-v1.json';
import fixtureV2 from './__fixtures__/config-v2.json';
import fixtureV3 from './__fixtures__/config-v3.json';
import fixtureV4 from './__fixtures__/config-v4.json';
import { ConfigVersionError, migrations, runMigrations } from './migrations';
import { CONFIG_VERSION, configSchema } from './schema';

describe('runMigrations', () => {
  it('passes a current-version tree through untouched', () => {
    const input = { version: CONFIG_VERSION, anything: true };
    const result = runMigrations(input);
    expect(result.applied).toEqual([]);
    expect(result.config).toBe(input);
  });

  it('refuses a config from a newer version rather than guessing', () => {
    expect(() => runMigrations({ version: CONFIG_VERSION + 1 })).toThrow(
      ConfigVersionError,
    );
  });

  it('names the versions in the refusal message', () => {
    try {
      runMigrations({ version: 99 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigVersionError);
      expect((error as ConfigVersionError).found).toBe(99);
      expect((error as ConfigVersionError).supported).toBe(CONFIG_VERSION);
    }
  });

  it('rejects input that is not an object', () => {
    expect(() => runMigrations(null)).toThrow(/not an object/);
    expect(() => runMigrations('{}')).toThrow(/not an object/);
  });

  it('rejects input with no usable version', () => {
    expect(() => runMigrations({})).toThrow(/version/);
    expect(() => runMigrations({ version: '1' })).toThrow(/version/);
    expect(() => runMigrations({ version: 0 })).toThrow(/version/);
  });

  it('reports a gap in the chain instead of silently skipping it', () => {
    // Simulates CONFIG_VERSION bumped to 3 with no migrations registered — the shape
    // of the bug where a release ships a version bump and forgets the migration.
    expect(() =>
      runMigrations({ version: CONFIG_VERSION }, CONFIG_VERSION + 2),
    ).toThrow(/No migration registered to produce config version/);
  });

  it('walks the chain in order, one version at a time', () => {
    const calls: number[] = [];
    const added = [CONFIG_VERSION + 1, CONFIG_VERSION + 2];
    for (const version of added) {
      migrations[version] = (old: { version: number }) => {
        calls.push(old.version);
        return { ...old, version };
      };
    }

    try {
      const result = runMigrations({ version: CONFIG_VERSION }, CONFIG_VERSION + 2);
      expect(calls).toEqual(added.map((v) => v - 1));
      expect(result.applied).toEqual(added);
      expect(result.config).toEqual({ version: CONFIG_VERSION + 2 });
    } finally {
      for (const version of added) delete migrations[version];
    }
  });
});

describe('fixtures', () => {
  // One fixture per version. Each must still migrate to a tree the current schema
  // accepts — this is the test that catches a migration that quietly loses a field.
  it('config-v1 migrates to the current version and parses', () => {
    const { config } = runMigrations(fixtureV1);
    const parsed = configSchema.safeParse(config);
    expect(parsed.success).toBe(true);
  });

  it('config-v1 keeps its widgets and their settings', () => {
    const parsed = configSchema.parse(runMigrations(fixtureV1).config);
    const focus = parsed.profiles.find((p) => p.name === 'Focus')!;
    expect(focus.widgets).toHaveLength(2);
    expect(focus.widgets[0]!.settings).toEqual({
      format: '24h',
      showSeconds: false,
      fontSize: 72,
    });
    expect(focus.theme.overrides).toEqual({ '--sp-accent': '#ff8800' });
  });

  it('config-v1 loses the page-wide text size and nothing else', () => {
    expect(migrations[2]!(fixtureV1)).toEqual(fixtureV2);
    expect(runMigrations(fixtureV1).applied).toEqual([2, 3, 4]);
  });

  it('config-v2 loses the frame padding and gets opacity in percent', () => {
    expect(migrations[3]!(fixtureV2)).toEqual(fixtureV3);
    expect(runMigrations(fixtureV2).applied).toEqual([3, 4]);
  });

  it('config-v3 has no web-photo background, so only its version changes', () => {
    const { config, applied } = runMigrations(fixtureV3);
    expect(applied).toEqual([4]);
    expect(config).toEqual(fixtureV4);
  });

  it('config-v4 is current and parses as-is', () => {
    expect(runMigrations(fixtureV4).applied).toEqual([]);
    expect(configSchema.safeParse(fixtureV4).success).toBe(true);
  });
});

describe('migration 2', () => {
  it('leaves a malformed tree for the schema to reject', () => {
    expect(() => migrations[2]!({ version: 1, profiles: 'nope' })).not.toThrow();
    expect(() => migrations[2]!({ version: 1, profiles: [null, {}] })).not.toThrow();
  });
});

describe('migration 3', () => {
  const frame = (opacity: unknown) =>
    migrations[3]!({
      version: 2,
      profiles: [{ widgets: [{ frame: { opacity, padding: 8, align: 'center' } }] }],
    }).profiles[0].widgets[0].frame;

  it('raises an invisible widget to the new floor', () => {
    expect(frame(0)).toEqual({ opacity: 20, align: 'center' });
    expect(frame(0.05)).toEqual({ opacity: 20, align: 'center' });
  });

  it('turns a fraction into a whole percent', () => {
    expect(frame(0.35).opacity).toBe(35);
    expect(frame(1).opacity).toBe(100);
  });

  it('leaves an unreadable opacity for the schema default', () => {
    expect(frame('half')).toEqual({ align: 'center' });
  });

  it('leaves a malformed tree for the schema to reject', () => {
    expect(() => migrations[3]!({ version: 2, profiles: 'nope' })).not.toThrow();
    expect(() =>
      migrations[3]!({ version: 2, profiles: [null, { widgets: [null, {}] }] }),
    ).not.toThrow();
  });
});

describe('migration 4', () => {
  const tree = (key: unknown) => ({
    version: 3,
    profiles: [
      { background: { kind: 'unsplash', query: 'sea' } },
      { background: { kind: 'gradient', from: '#000', to: '#111' } },
    ],
    app: { unsplashAccessKey: key },
  });

  it('keeps Unsplash for a background that had a key to search with', () => {
    const out = migrations[4]!(tree('abc'));
    expect(out.profiles[0].background).toEqual({
      kind: 'unsplash',
      query: 'sea',
      source: 'unsplash',
    });
    expect(out.profiles[1].background).toEqual(tree('abc').profiles[1]!.background);
  });

  it('names Lorem Picsum where there was no key, as was being shown', () => {
    expect(migrations[4]!(tree(null)).profiles[0].background.source).toBe('picsum');
    expect(migrations[4]!(tree('  ')).profiles[0].background.source).toBe('picsum');
  });

  it('leaves a malformed tree for the schema to reject', () => {
    expect(() => migrations[4]!({ version: 3, profiles: 'nope' })).not.toThrow();
    expect(() => migrations[4]!({ version: 3, profiles: [null] })).not.toThrow();
  });
});
