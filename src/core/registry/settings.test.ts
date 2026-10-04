import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { resolveSettings } from './settings';

const schema = z.object({
  format: z.enum(['24h', '12h']).default('24h'),
  fontSize: z.number().min(12).max(220).default(72),
  label: z.string().default(''),
});

describe('resolveSettings', () => {
  it('passes valid settings straight through', () => {
    const result = resolveSettings(schema, { format: '12h', fontSize: 40 });
    expect(result.repaired).toBe(false);
    expect(result.settings).toEqual({ format: '12h', fontSize: 40, label: '' });
  });

  it('keeps the good fields when one is corrupt', () => {
    // The promise the widget API makes: one bad field costs the user that field, not
    // the widget.
    const result = resolveSettings(schema, {
      format: '12h',
      fontSize: 'enormous',
      label: 'Home',
    });
    expect(result.repaired).toBe(true);
    expect(result.settings).toEqual({ format: '12h', fontSize: 72, label: 'Home' });
  });

  it('repairs a value that is the right type but out of range', () => {
    const result = resolveSettings(schema, { fontSize: 9000 });
    expect(result.settings).toEqual({ format: '24h', fontSize: 72, label: '' });
  });

  it('falls back to defaults for settings that are not an object at all', () => {
    const result = resolveSettings(schema, 'nonsense');
    expect(result.repaired).toBe(true);
    expect(result.settings).toEqual({ format: '24h', fontSize: 72, label: '' });
  });

  it('reports failure when the schema cannot produce a value', () => {
    const required = z.object({ apiKey: z.string() });
    expect(resolveSettings(required, {}).settings).toBeNull();
  });
});
