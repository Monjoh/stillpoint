import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { AnyWidgetDefinition, WidgetCategory, WidgetProps } from './types';

export class DuplicateWidgetIdError extends Error {
  constructor(id: string) {
    super(
      `Two widgets are registered as "${id}". A widget id is part of stored config, so a duplicate would silently shadow one widget and corrupt every instance of it.`,
    );
    this.name = 'DuplicateWidgetIdError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LazyWidget = LazyExoticComponent<ComponentType<WidgetProps<any>>>;

export interface WidgetRegistry {
  get(id: string): AnyWidgetDefinition | null;
  has(id: string): boolean;
  list(): readonly AnyWidgetDefinition[];
  byCategory(): { category: WidgetCategory; widgets: AnyWidgetDefinition[] }[];
  /**
   * The lazy component for a widget, memoised per id. Memoisation is not an
   * optimisation here: `lazy()` returns a new component type each call, and a new type
   * in the same position unmounts and remounts the tree — a clock would restart every
   * render.
   */
  load(id: string): LazyWidget | null;
}

const CATEGORY_ORDER: readonly WidgetCategory[] = [
  'time',
  'info',
  'navigation',
  'productivity',
  'decoration',
];

export function createRegistry(
  definitions: readonly AnyWidgetDefinition[],
): WidgetRegistry {
  const byId = new Map<string, AnyWidgetDefinition>();
  for (const definition of definitions) {
    if (byId.has(definition.id)) throw new DuplicateWidgetIdError(definition.id);
    byId.set(definition.id, definition);
  }

  const components = new Map<string, LazyWidget>();

  return {
    get: (id) => byId.get(id) ?? null,
    has: (id) => byId.has(id),
    list: () => definitions,

    byCategory() {
      return CATEGORY_ORDER.map((category) => ({
        category,
        widgets: definitions.filter((d) => d.category === category),
      })).filter((group) => group.widgets.length > 0);
    },

    load(id) {
      const definition = byId.get(id);
      if (!definition) return null;

      let component = components.get(id);
      if (!component) {
        component = lazy(definition.component);
        components.set(id, component);
      }
      return component;
    },
  };
}
