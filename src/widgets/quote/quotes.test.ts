import { describe, expect, it } from 'vitest';
import { quoteSettingsSchema } from './definition';
import { QUOTES } from './quotes';

describe('the built-in quotes', () => {
  it('are all distinct', () => {
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(QUOTES.length);
  });

  it('each have text and an author, trimmed', () => {
    for (const { text, author } of QUOTES) {
      expect(text).toBe(text.trim());
      expect(author).toBe(author.trim());
      expect(text.length).toBeGreaterThan(0);
      expect(author.length).toBeGreaterThan(0);
    }
  });

  it('would each be accepted as one of the user’s own', () => {
    const parsed = quoteSettingsSchema.safeParse({ mine: QUOTES });
    expect(parsed.success).toBe(true);
  });
});

describe('quoteSettingsSchema', () => {
  it('parses an empty object, which is what a newly added widget stores', () => {
    expect(quoteSettingsSchema.parse({})).toEqual({
      refresh: 'daily',
      builtIn: true,
      mine: [],
      showAuthor: true,
      fontSize: 24,
      style: 'normal',
    });
  });
});
