import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  arrayElement,
  enumValues,
  numericRange,
  objectShape,
  maxLength,
  unwrap,
} from './unwrap';

describe('unwrap', () => {
  it('reaches the inner type through default and nullable', () => {
    const result = unwrap(z.string().nullable().default(null));
    expect(result.type).toBe('string');
    expect(result.nullable).toBe(true);
    expect(result.hasDefault).toBe(true);
    expect(result.defaultValue).toBeNull();
  });

  it('reports an optional field', () => {
    const result = unwrap(z.number().optional());
    expect(result.type).toBe('number');
    expect(result.optional).toBe(true);
    expect(result.hasDefault).toBe(false);
  });

  it('treats prefault as a default', () => {
    const result = unwrap(z.object({ n: z.number() }).prefault({ n: 1 }));
    expect(result.type).toBe('object');
    expect(result.hasDefault).toBe(true);
    expect(result.defaultValue).toEqual({ n: 1 });
  });

  it('leaves a bare schema alone', () => {
    const result = unwrap(z.boolean());
    expect(result.type).toBe('boolean');
    expect(result.optional).toBe(false);
    expect(result.nullable).toBe(false);
    expect(result.hasDefault).toBe(false);
    expect(result.meta).toBeNull();
  });

  // The thing the plan doc got wrong. zod does not carry metadata across a wrapper,
  // so reading only the outermost schema finds nothing on the commonest declaration
  // in the codebase — `.meta()` written before `.default()`.
  it('finds metadata wherever in the wrapper chain it was attached', () => {
    const outside = z.string().optional().meta({ label: 'Outside' });
    const inside = z.string().meta({ label: 'Inside' }).optional();
    const underDefault = z.number().meta({ label: 'Under' }).default(3);

    expect(unwrap(outside).meta?.label).toBe('Outside');
    expect(unwrap(inside).meta?.label).toBe('Inside');
    expect(unwrap(underDefault).meta?.label).toBe('Under');
  });

  it('prefers the outermost metadata when both levels carry it', () => {
    const schema = z
      .string()
      .meta({ label: 'Inner' })
      .optional()
      .meta({ label: 'Outer' });
    expect(unwrap(schema).meta?.label).toBe('Outer');
  });

  it('keeps the outermost default when two are stacked', () => {
    const schema = z.number().default(1).nullable().default(2);
    expect(unwrap(schema).defaultValue).toBe(2);
  });
});

describe('numericRange', () => {
  it('reads inclusive bounds', () => {
    expect(numericRange(z.number().min(12).max(220))).toEqual({ min: 12, max: 220 });
  });

  it('reads a step from multipleOf', () => {
    expect(numericRange(z.number().min(0).max(10).multipleOf(2))).toEqual({
      min: 0,
      max: 10,
      step: 2,
    });
  });

  // A slider whose track reaches a value the schema rejects hands the user a setting
  // that fails to parse and is quietly repaired away on the next load.
  it('pulls exclusive bounds inside the range', () => {
    expect(numericRange(z.number().gt(0).lt(10))).toEqual({ min: 1, max: 9 });
  });

  it('pulls exclusive bounds by one step when there is one', () => {
    expect(numericRange(z.number().gt(0).lt(10).multipleOf(0.5))).toEqual({
      min: 0.5,
      max: 9.5,
      step: 0.5,
    });
  });

  it('returns nothing for an unconstrained number', () => {
    expect(numericRange(z.number())).toEqual({});
  });
});

describe('shape readers', () => {
  it('reads enum values', () => {
    expect(enumValues(z.enum(['a', 'b']))).toEqual(['a', 'b']);
    expect(enumValues(z.string())).toBeNull();
  });

  it('reads a max length', () => {
    expect(maxLength(z.string().max(40))).toEqual({ maxLength: 40 });
    expect(maxLength(z.string())).toEqual({});
    expect(maxLength(z.array(z.string()).max(48))).toEqual({ maxLength: 48 });
  });

  it('reads an object shape', () => {
    expect(Object.keys(objectShape(z.object({ a: z.string() })) ?? {})).toEqual(['a']);
    expect(objectShape(z.string())).toBeNull();
  });

  it('reads an array element', () => {
    expect(unwrap(arrayElement(z.array(z.number()))!).type).toBe('number');
    expect(arrayElement(z.string())).toBeNull();
  });

  it('survives a schema shape it does not understand', () => {
    const result = unwrap(z.union([z.string(), z.number()]));
    expect(result.type).toBe('union');
    expect(numericRange(result.inner)).toEqual({});
    expect(objectShape(result.inner)).toBeNull();
  });
});
