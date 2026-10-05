import { describe, expect, it } from 'vitest';
import { clockSettingsSchema } from './definition';

describe('clockSettingsSchema', () => {
  it('parses an empty object, which is what a newly added widget stores', () => {
    expect(clockSettingsSchema.parse({})).toEqual({
      format: '24h',
      showSeconds: false,
      showMeridiem: true,
      fontSize: 72,
      weight: 'light',
      timezone: null,
    });
  });

  it('rejects a font size outside the slider range', () => {
    expect(clockSettingsSchema.safeParse({ fontSize: 500 }).success).toBe(false);
  });
});
