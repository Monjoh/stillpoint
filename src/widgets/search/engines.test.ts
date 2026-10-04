import { describe, expect, it } from 'vitest';
import { searchSettingsSchema } from './definition';
import { ENGINES, isSearchTemplate, searchUrl } from './engines';

describe('searchUrl', () => {
  it('puts the encoded words where %s is', () => {
    expect(searchUrl(ENGINES.duckduckgo.url, 'café & crème')).toBe(
      'https://duckduckgo.com/?q=caf%C3%A9%20%26%20cr%C3%A8me',
    );
  });

  it('trims the words, and does nothing with none', () => {
    expect(searchUrl(ENGINES.google.url, '  cats  ')).toBe(
      'https://www.google.com/search?q=cats',
    );
    expect(searchUrl(ENGINES.google.url, '   ')).toBeNull();
  });

  it('cannot be turned into another address by the words', () => {
    const url = searchUrl(ENGINES.bing.url, 'x&q=evil#frag');
    expect(new URL(url!).searchParams.get('q')).toBe('x&q=evil#frag');
  });

  it('refuses a template it cannot use', () => {
    expect(searchUrl('https://example.com/search', 'cats')).toBeNull();
    expect(searchUrl('javascript:alert(%s)', 'cats')).toBeNull();
  });
});

describe('isSearchTemplate', () => {
  it('accepts http(s) with %s', () => {
    expect(isSearchTemplate('https://example.com/?q=%s')).toBe(true);
    expect(isSearchTemplate('http://intranet/find/%s')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isSearchTemplate('')).toBe(false);
    expect(isSearchTemplate('example.com/?q=%s')).toBe(false);
    expect(isSearchTemplate('data:text/html,%s')).toBe(false);
  });

  it('accepts every built-in engine', () => {
    for (const engine of Object.values(ENGINES)) {
      expect(isSearchTemplate(engine.url)).toBe(true);
    }
  });
});

describe('searchSettingsSchema', () => {
  it('parses an empty object, which is what a newly added widget stores', () => {
    expect(searchSettingsSchema.parse({})).toEqual({
      engine: 'duckduckgo',
      customUrl: '',
      newTab: false,
      autofocus: true,
      fontSize: 18,
    });
  });
});
