import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createDefaultConfig } from './defaults';
import {
  CONFIG_VERSION,
  configSchema,
  layoutSchema,
  profileSchema,
  type Rect,
} from './schema';

const gradient = { kind: 'gradient', from: '#000', to: '#fff' } as const;

function minimalConfig(overrides: Record<string, unknown> = {}) {
  return {
    version: CONFIG_VERSION,
    activeProfileId: 'p1',
    profiles: [{ id: 'p1', name: 'Default', background: gradient }],
    ...overrides,
  };
}

describe('configSchema', () => {
  it('fills nested defaults from an omitted object', () => {
    // This is the `.prefault({})` vs `.default({})` trap: with `.default({})` these
    // come back as `{}` and nothing complains.
    const config = configSchema.parse(minimalConfig());
    const profile = config.profiles[0]!;

    expect(profile.layout).toEqual({
      columns: 24,
      rows: 12,
      gap: 12,
      maxWidth: null,
    });
    expect(profile.theme).toEqual({ preset: 'midnight', overrides: {} });
    expect(profile.widgets).toEqual([]);
    expect(profile.activation).toBeNull();
    expect(config.app.locale).toBe('en');
    expect(config.app.unsplashAccessKey).toBeNull();
  });

  it('stores rows rather than a pixel row height', () => {
    const layout = layoutSchema.parse({});
    expect(layout).toHaveProperty('rows');
    expect(layout).not.toHaveProperty('rowHeight');
  });

  it('rejects an activeProfileId that matches no profile', () => {
    const result = configSchema.safeParse(minimalConfig({ activeProfileId: 'nope' }));
    expect(result.success).toBe(false);
  });

  it('rejects duplicate profile ids', () => {
    const result = configSchema.safeParse(
      minimalConfig({
        profiles: [
          { id: 'p1', name: 'A', background: gradient },
          { id: 'p1', name: 'B', background: gradient },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an empty profile list', () => {
    expect(configSchema.safeParse(minimalConfig({ profiles: [] })).success).toBe(false);
  });

  it('rejects a config from a different version', () => {
    expect(configSchema.safeParse(minimalConfig({ version: 99 })).success).toBe(false);
  });

  it('keeps unknown widget settings untouched', () => {
    const config = configSchema.parse(
      minimalConfig({
        profiles: [
          {
            id: 'p1',
            name: 'Default',
            background: gradient,
            widgets: [
              {
                instanceId: 'w1',
                type: 'stillpoint.clock',
                rect: { x: 0, y: 0, w: 8, h: 4 },
                settings: { format: '24h', nonsense: true },
              },
            ],
          },
        ],
      }),
    );

    expect(config.profiles[0]!.widgets[0]!.settings).toEqual({
      format: '24h',
      nonsense: true,
    });
    expect(config.profiles[0]!.widgets[0]!.frame.align).toBe('center');
  });

  it('rejects a widget rect with a zero dimension', () => {
    const result = profileSchema.safeParse({
      id: 'p1',
      name: 'Default',
      background: gradient,
      widgets: [
        {
          instanceId: 'w1',
          type: 'stillpoint.clock',
          rect: { x: 0, y: 0, w: 0, h: 4 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('discriminates background kinds', () => {
    expect(
      profileSchema.safeParse({
        id: 'p1',
        name: 'D',
        background: { kind: 'image' },
      }).success,
    ).toBe(false);

    const ok = profileSchema.parse({
      id: 'p1',
      name: 'D',
      background: { kind: 'image', assetId: 'a1' },
    });
    expect(ok.background).toEqual({
      kind: 'image',
      assetId: 'a1',
      fit: 'cover',
      blur: 0,
      dim: 0,
    });
  });
});

describe('createDefaultConfig', () => {
  it('produces a tree that validates against the schema', () => {
    expect(configSchema.safeParse(createDefaultConfig()).success).toBe(true);
  });

  it('starts with one profile, a gradient, a clock, a date and a search box', () => {
    // Deliberate: Firefox asks the user whether to keep the new tab override, and an
    // empty page is a bad case to make. See defaults.ts.
    const config = createDefaultConfig();
    expect(config.profiles).toHaveLength(1);
    expect(config.activeProfileId).toBe(config.profiles[0]!.id);
    expect(config.profiles[0]!.background.kind).toBe('gradient');
    expect(config.profiles[0]!.widgets.map((w) => w.type)).toEqual([
      'stillpoint.clock',
      'stillpoint.date',
      'stillpoint.search',
    ]);
  });

  it('lays the first-run widgets out inside the grid, without overlap', () => {
    const { layout, widgets } = createDefaultConfig().profiles[0]!;
    for (const { rect } of widgets) {
      expect(rect.x + rect.w).toBeLessThanOrEqual(layout.columns);
      expect(rect.y + rect.h).toBeLessThanOrEqual(layout.rows);
    }
    const overlaps = (a: Rect, b: Rect) =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const [i, a] of widgets.entries()) {
      for (const b of widgets.slice(i + 1))
        expect(overlaps(a.rect, b.rect)).toBe(false);
    }
  });

  it('has not completed first run', () => {
    // The one-time "press E" hint in NewTab.tsx keys off this.
    expect(createDefaultConfig().app.hasCompletedFirstRun).toBe(false);
  });

  it('gives each call distinct ids', () => {
    expect(createDefaultConfig().profiles[0]!.id).not.toBe(
      createDefaultConfig().profiles[0]!.id,
    );
  });
});

describe('zod runtime configuration', () => {
  it('runs jitless, because the MV3 CSP forbids the Function constructor', () => {
    // Importing the schema module is what sets this. If it regresses, every new tab
    // logs a blocked-eval CSP violation.
    expect(z.config().jitless).toBe(true);
  });
});
