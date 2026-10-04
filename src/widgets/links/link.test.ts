import { describe, expect, it } from 'vitest';
import { parseLink } from './link';

describe('parseLink', () => {
  it('assumes https for an address typed without a scheme', () => {
    expect(parseLink('github.com')).toEqual({
      href: 'https://github.com/',
      origin: 'https://github.com',
      host: 'github.com',
      label: 'github.com',
    });
  });

  it('keeps a scheme, a path and a port the user typed', () => {
    expect(parseLink('http://intranet/wiki')?.href).toBe('http://intranet/wiki');
    expect(parseLink('localhost:3000')?.href).toBe('https://localhost:3000/');
    expect(parseLink('https://example.com/a?b=1#c')?.href).toBe(
      'https://example.com/a?b=1#c',
    );
  });

  it('uses the name given, or the host without www', () => {
    expect(parseLink('https://www.bbc.co.uk', '  News ')?.label).toBe('News');
    expect(parseLink('https://www.bbc.co.uk')?.label).toBe('bbc.co.uk');
  });

  it('refuses anything that is not a web address', () => {
    expect(parseLink('')).toBeNull();
    expect(parseLink('   ')).toBeNull();
    expect(parseLink('javascript:alert(1)')).toBeNull();
    expect(parseLink('data:text/html,hi')).toBeNull();
    expect(parseLink('mailto:me@example.com')).toBeNull();
    expect(parseLink('https://')).toBeNull();
  });
});
