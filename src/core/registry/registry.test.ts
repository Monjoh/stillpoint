import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@/core/config/defaults';
import {
  createRegistry,
  DuplicateWidgetIdError,
  widgetDefinitions,
  widgetRegistry,
  type AnyWidgetDefinition,
} from './index';

function definition(overrides: Partial<AnyWidgetDefinition> = {}): AnyWidgetDefinition {
  return {
    id: 'test.widget',
    name: 'Test',
    description: '',
    category: 'info',
    icon: 'M0 0',
    settingsSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
    defaultSize: { w: 2, h: 2 },
    component: () => Promise.resolve({ default: () => null }),
    ...overrides,
  };
}

describe('createRegistry', () => {
  it('refuses two widgets with the same id', () => {
    expect(() => createRegistry([definition(), definition({ name: 'Other' })])).toThrow(
      DuplicateWidgetIdError,
    );
  });

  it('returns null for an unknown id rather than throwing', () => {
    const registry = createRegistry([definition()]);
    expect(registry.get('nope')).toBeNull();
    expect(registry.load('nope')).toBeNull();
    expect(registry.has('test.widget')).toBe(true);
  });

  it('returns the same lazy component every call', () => {
    // Not an optimisation: a new component type in the same tree position unmounts and
    // remounts, which would restart a clock on every render of the canvas.
    const registry = createRegistry([definition()]);
    expect(registry.load('test.widget')).toBe(registry.load('test.widget'));
  });

  it('groups by category in a fixed order, skipping empty groups', () => {
    const registry = createRegistry([
      definition({ id: 'a', category: 'decoration' }),
      definition({ id: 'b', category: 'time' }),
    ]);
    expect(registry.byCategory().map((g) => g.category)).toEqual([
      'time',
      'decoration',
    ]);
  });
});

describe('the real registry', () => {
  it('has unique ids', () => {
    const ids = widgetDefinitions.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('namespaces every id', () => {
    for (const d of widgetDefinitions) expect(d.id).toMatch(/^stillpoint\./);
  });

  it('gives every widget a default size that fits the default grid', () => {
    for (const d of widgetDefinitions) {
      expect(d.defaultSize.w).toBeGreaterThan(0);
      expect(d.defaultSize.w).toBeLessThanOrEqual(24);
      expect(d.defaultSize.h).toBeGreaterThan(0);
      expect(d.defaultSize.h).toBeLessThanOrEqual(12);
    }
  });

  it('resolves every widget type the default config ships with', () => {
    // defaults.ts names widget types as string literals so the config module does not
    // import the registry. This is what stops a typo there shipping as a silent
    // "widget not available" placeholder on first run.
    for (const profile of createDefaultConfig().profiles) {
      for (const instance of profile.widgets) {
        expect(widgetRegistry.has(instance.type)).toBe(true);
      }
    }
  });

  it('accepts the default settings of every widget', () => {
    for (const d of widgetDefinitions) {
      expect(d.settingsSchema.safeParse({}).success).toBe(true);
    }
  });
});
