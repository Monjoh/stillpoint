import type { LayoutConfig, Profile, Rect, WidgetInstance } from '@/core/config/schema';
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

/** Replace one widget's frame. Validation is the caller's — the panel parses first. */
export function updateWidgetFrame(
  profile: Profile,
  instanceId: string,
  frame: WidgetInstance['frame'],
): Profile {
  return {
    ...profile,
    widgets: profile.widgets.map((i) =>
      i.instanceId === instanceId ? { ...i, frame } : i,
    ),
  };
}

/**
 * Change the grid, and bring every widget with it.
 *
 * Rects are rescaled, not clamped. Changing `columns` from 24 to 48 is a request for
 * finer placement, not for every widget to become half as wide, so each one keeps the
 * fraction of the page it occupied. Clamping instead — the obvious implementation —
 * would pile the whole layout into the top-left corner the moment the grid shrank,
 * and the original positions would be gone.
 *
 * Rounding to whole cells is still lossy, so a column count dragged down and back up
 * does not return the layout it started from. That is why `columns` and `rows` are
 * number fields rather than sliders in the edit panel: one deliberate step at a time,
 * instead of a hundred compounding ones during a drag.
 *
 * Rescaling can round two widgets into the same cells. Overlap is allowed here —
 * it is visible and the user can drag their way out of it, whereas refusing the whole
 * grid change because of one awkward widget is a dead end they cannot.
 */
export function setLayout(profile: Profile, layout: LayoutConfig): Profile {
  const scaleX = layout.columns / profile.layout.columns;
  const scaleY = layout.rows / profile.layout.rows;

  // Exactly 1 on both axes when only `gap` or `maxWidth` moved, so those leave every
  // rect byte-identical rather than quietly re-rounding it.
  if (scaleX === 1 && scaleY === 1) return { ...profile, layout };

  return {
    ...profile,
    layout,
    widgets: profile.widgets.map((i) => ({
      ...i,
      rect: clampRect(
        {
          x: Math.round(i.rect.x * scaleX),
          y: Math.round(i.rect.y * scaleY),
          w: Math.max(1, Math.round(i.rect.w * scaleX)),
          h: Math.max(1, Math.round(i.rect.h * scaleY)),
        },
        layout,
      ),
    })),
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
