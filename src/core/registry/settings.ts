import type { z } from 'zod';

export interface SettingsResolution<S> {
  /** `null` only when the schema cannot produce a value even from `{}`. */
  settings: S | null;
  /** True when the stored settings were not usable as-is. */
  repaired: boolean;
}

/**
 * Turn whatever is stored for a widget instance into settings it can render with.
 *
 * Stored widget settings are `z.unknown()` in the config tree — validated by the
 * widget's own schema here, at load, rather than centrally. That is what lets an
 * unknown or downgraded widget keep its settings instead of having them stripped.
 *
 * The recovery ladder, in order, because "one bad field blanks the widget" is exactly
 * the failure the widget API promises not to have:
 *
 * 1. Parse as stored. The normal path.
 * 2. Drop only the fields the parser complained about and parse again, so a corrupt
 *    `fontSize` costs the user their font size and nothing else.
 * 3. Fall back to the schema's own defaults.
 */
export function resolveSettings<S>(
  schema: z.ZodType<S>,
  stored: unknown,
): SettingsResolution<S> {
  const direct = schema.safeParse(stored);
  if (direct.success) return { settings: direct.data, repaired: false };

  if (isPlainObject(stored)) {
    const pruned = { ...stored };
    for (const issue of direct.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string') delete pruned[key];
    }
    const retry = schema.safeParse(pruned);
    if (retry.success) return { settings: retry.data, repaired: true };
  }

  const bare = schema.safeParse({});
  if (bare.success) return { settings: bare.data, repaired: true };

  return { settings: null, repaired: true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
