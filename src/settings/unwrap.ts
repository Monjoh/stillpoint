import type { z } from 'zod';
import type { FieldMeta } from '@/core/registry/types';

/**
 * zod introspection, isolated.
 *
 * This is the one place in the project that reads zod's internals, and the one place
 * a zod upgrade can break. Everything above it works on the plain data returned here,
 * so a breaking change in `.def` is a change to this file and its test, not a change
 * to eleven controls.
 *
 * Verified against zod 4.6.5. The shapes relied on:
 *
 *   wrapper.def = { type: 'default'|'prefault'|'optional'|'nullable'|…, innerType, defaultValue? }
 *   enum.def    = { type: 'enum', entries: Record<string, string> }
 *   number.def  = { type: 'number', checks: [{ _zod: { def: { check: 'greater_than', value, inclusive } } }] }
 *   array.def   = { type: 'array', element }
 *   object.def  = { type: 'object', shape }
 */

/** Wrapper types that sit between a field and the type the user actually edits. */
const WRAPPERS = new Set([
  'default',
  'prefault',
  'optional',
  'nullable',
  'nonoptional',
  'readonly',
  'catch',
]);

/** Depth guard. A legitimate field is `.nullable().default()`, never twenty deep. */
const MAX_DEPTH = 20;

interface ZodInternals {
  def: {
    type: string;
    innerType?: unknown;
    defaultValue?: unknown;
    entries?: Record<string, string>;
    element?: unknown;
    shape?: Record<string, unknown>;
    checks?: { _zod?: { def?: Record<string, unknown> } }[];
  };
  meta?: () => Record<string, unknown> | undefined;
}

function internals(schema: unknown): ZodInternals | null {
  const candidate = schema as ZodInternals | null | undefined;
  return candidate && typeof candidate.def?.type === 'string' ? candidate : null;
}

export interface Unwrapped {
  /** The innermost non-wrapper schema — what the control actually edits. */
  inner: z.ZodType;
  /** `inner.def.type`: 'string' | 'number' | 'boolean' | 'enum' | 'array' | … */
  type: string;
  /**
   * The first `.meta()` found walking outside in.
   *
   * It has to be a search rather than a read of the outermost schema: zod does not
   * carry metadata across a wrapper, so `z.string().meta(…).optional()` and
   * `z.string().optional().meta(…)` both occur in the wild and both have to work.
   */
  meta: FieldMeta | null;
  optional: boolean;
  nullable: boolean;
  hasDefault: boolean;
  /** Only meaningful when `hasDefault`. */
  defaultValue: unknown;
}

export function unwrap(schema: z.ZodType): Unwrapped {
  let current: unknown = schema;
  let meta: FieldMeta | null = null;
  let optional = false;
  let nullable = false;
  let hasDefault = false;
  let defaultValue: unknown;

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const node = internals(current);
    if (!node) break;

    if (!meta) {
      const own = node.meta?.();
      // A label marks our metadata; so does `hidden` alone, which needs no label
      // because nothing is drawn. Requiring a label here once let `{ hidden: true }`
      // fall through, and a photo background's panel showed its asset id (S23).
      if (own && (typeof own.label === 'string' || own.hidden === true)) {
        meta = own as FieldMeta;
      }
    }

    if (!WRAPPERS.has(node.def.type)) break;

    if (node.def.type === 'optional') optional = true;
    if (node.def.type === 'nullable') nullable = true;
    if (node.def.type === 'default' || node.def.type === 'prefault') {
      // Only the outermost default is the one that applies.
      if (!hasDefault) {
        hasDefault = true;
        const raw = node.def.defaultValue;
        defaultValue = typeof raw === 'function' ? (raw as () => unknown)() : raw;
      }
    }

    if (node.def.innerType === undefined) break;
    current = node.def.innerType;
  }

  const node = internals(current);
  return {
    inner: current as z.ZodType,
    type: node?.def.type ?? 'unknown',
    meta,
    optional,
    nullable,
    hasDefault,
    defaultValue,
  };
}

export interface NumericRange {
  min?: number;
  max?: number;
  /** From `.multipleOf()`. `FieldMeta.step` overrides it. */
  step?: number;
}

/**
 * Slider bounds from a number schema's checks.
 *
 * Exclusive bounds are pulled in by one step rather than passed through: a slider
 * whose track reaches a value the schema rejects hands the user a setting that fails
 * to parse and is silently repaired away the next time the widget loads.
 */
export function numericRange(inner: z.ZodType): NumericRange {
  const node = internals(inner);
  const range: NumericRange = {};
  const bounds: { key: 'min' | 'max'; value: number; inclusive: boolean }[] = [];

  for (const check of node?.def.checks ?? []) {
    const def = check._zod?.def;
    if (!def || typeof def.value !== 'number') continue;
    if (def.check === 'greater_than') {
      bounds.push({ key: 'min', value: def.value, inclusive: def.inclusive === true });
    } else if (def.check === 'less_than') {
      bounds.push({ key: 'max', value: def.value, inclusive: def.inclusive === true });
    } else if (def.check === 'multiple_of') {
      range.step = def.value;
    }
  }

  for (const bound of bounds) {
    const nudge = bound.inclusive ? 0 : (range.step ?? 1);
    range[bound.key] = bound.key === 'min' ? bound.value + nudge : bound.value - nudge;
  }

  return range;
}

/**
 * `{ maxLength }` from a string's or an array's checks: characters for the text
 * controls, rows for the list control. zod writes `.max()` as the same check on both.
 */
export function maxLength(inner: z.ZodType): { maxLength?: number } {
  const node = internals(inner);
  for (const check of node?.def.checks ?? []) {
    const def = check._zod?.def;
    if (def?.check === 'max_length' && typeof def.maximum === 'number') {
      return { maxLength: def.maximum };
    }
  }
  return {};
}

/** The values of a `z.enum()`, or `null` for anything else. */
export function enumValues(inner: z.ZodType): string[] | null {
  const node = internals(inner);
  if (node?.def.type !== 'enum' || !node.def.entries) return null;
  return Object.values(node.def.entries);
}

/** The shape of a `z.object()`, or `null` for anything else. */
export function objectShape(inner: z.ZodType): Record<string, z.ZodType> | null {
  const node = internals(inner);
  if (node?.def.type !== 'object' || !node.def.shape) return null;
  return node.def.shape as Record<string, z.ZodType>;
}

/** The element schema of a `z.array()`, or `null` for anything else. */
export function arrayElement(inner: z.ZodType): z.ZodType | null {
  const node = internals(inner);
  if (node?.def.type !== 'array' || node.def.element === undefined) return null;
  return node.def.element as z.ZodType;
}
