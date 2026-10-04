import type { Profile, Rect, WidgetInstance } from '@/core/config/schema';
import { widgetInstanceSchema } from '@/core/config/schema';
import type { AnyWidgetDefinition } from '@/core/registry/types';
import { newId } from '@/lib/id';
import { clampRect, rectsOverlap } from './geometry';

/**
 * Layout edits as pure `Profile → Profile` functions.
 *
 * Deliberately separate from the components that trigger them: placement and collision
 * are the parts worth testing, and they are much easier to test without a canvas,
 * a pointer and a store around them.
 */

/**
 * The first free slot for a widget of this size, scanning in reading order.
 *
 * Returns `null` when the grid is genuinely full; the caller decides what to do rather
 * than having an overlap forced on it here.
 */
export function findFreeRect(
  profile: Profile,
  size: { w: number; h: number },
): Rect | null {
  const { columns, rows } = profile.layout;
  const w = Math.min(Math.max(1, size.w), columns);
  const h = Math.min(Math.max(1, size.h), rows);

  for (let y = 0; y <= rows - h; y++) {
    for (let x = 0; x <= columns - w; x++) {
      const candidate = { x, y, w, h };
      if (!profile.widgets.some((i) => rectsOverlap(candidate, i.rect))) {
        return candidate;
      }
    }
  }
  return null;
}

/** Centre a rect of this size in the grid. The fallback when nothing is free. */
export function centredRect(profile: Profile, size: { w: number; h: number }): Rect {
  const { columns, rows } = profile.layout;
  const w = Math.min(Math.max(1, size.w), columns);
  const h = Math.min(Math.max(1, size.h), rows);
  return {
    w,
    h,
    x: Math.floor((columns - w) / 2),
    y: Math.floor((rows - h) / 2),
  };
}

export function addWidget(
  profile: Profile,
  definition: AnyWidgetDefinition,
  options: { rect?: Rect; instanceId?: string } = {},
): Profile {
  const size = options.rect ?? definition.defaultSize;
  const rect =
    options.rect ?? findFreeRect(profile, size) ?? centredRect(profile, size);

  // Parsed rather than built literally so `frame` and `settings` get their schema
  // defaults; a hand-built instance would drift the moment the schema grows a field.
  const instance = widgetInstanceSchema.parse({
    instanceId: options.instanceId ?? newId(),
    type: definition.id,
    rect: clampRect(rect, profile.layout),
  });

  return { ...profile, widgets: [...profile.widgets, instance] };
}

export function removeWidget(profile: Profile, instanceId: string): Profile {
  return {
    ...profile,
    widgets: profile.widgets.filter((i) => i.instanceId !== instanceId),
  };
}

/**
 * Copy a widget, settings and all, into the first free slot.
 *
 * Not offset by a cell from the original, which is the obvious implementation: the
 * copy would then overlap the thing it was copied from, and the user has to drag the
 * widget they just made before they can see either of them. Only when the grid has no
 * room at all does it fall back to an offset, so the copy is at least somewhere
 * reachable rather than silently not created.
 */
export function duplicateWidget(profile: Profile, instanceId: string): Profile {
  const source = profile.widgets.find((i) => i.instanceId === instanceId);
  if (!source) return profile;

  const rect =
    findFreeRect(profile, source.rect) ??
    clampRect(
      { ...source.rect, x: source.rect.x + 1, y: source.rect.y + 1 },
      profile.layout,
    );

  const copy: WidgetInstance = { ...source, instanceId: newId(), rect };
  return { ...profile, widgets: [...profile.widgets, copy] };
}

/** Move or resize an instance. The rect is clamped into the grid for the caller. */
export function placeWidget(profile: Profile, instanceId: string, rect: Rect): Profile {
  return {
    ...profile,
    widgets: profile.widgets.map((i) =>
      i.instanceId === instanceId ? { ...i, rect: clampRect(rect, profile.layout) } : i,
    ),
  };
}

export function updateWidgetSettings(
  profile: Profile,
  instanceId: string,
  settings: unknown,
): Profile {
  return {
    ...profile,
    widgets: profile.widgets.map((i) =>
      i.instanceId === instanceId ? { ...i, settings } : i,
    ),
  };
}

/** Replace the active profile inside a config tree. */
export function withProfile<C extends { profiles: Profile[] }>(
  config: C,
  profile: Profile,
): C {
  return {
    ...config,
    profiles: config.profiles.map((p) => (p.id === profile.id ? profile : p)),
  };
}
