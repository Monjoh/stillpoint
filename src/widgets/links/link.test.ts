import { describe, expect, it } from 'vitest';
import { isLocalHost, parseLink } from './link';

describe('parseLink', () => {
  it('assumes https for an address typed without a scheme', () => {
    expect(parseLink('github.com')).toEqual({
      href: 'https://github.com/',
      origin: 'https://github.com',
      host: 'github.com',
      label: 'github.com',
      local: false,
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

describe('isLocalHost', () => {
  it('recognises this machine and the local network', () => {
    for (const host of [
      'localhost',
      'app.localhost',
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.10.1',
      '100.100.1.1',
      '0.0.0.0',
      '[::1]',
      '[fd12::1]',
      '[fe80::1]',
      'printer.local',
      'router.lan',
      'nas.home.arpa',
      'intranet',
    ]) {
      expect(isLocalHost(host), host).toBe(true);
    }
  });

  it('leaves public sites alone', () => {
    for (const host of [
      'github.com',
      '8.8.8.8',
      '172.32.0.1',
      '192.169.0.1',
      '[2606:4700::1111]',
    ]) {
      expect(isLocalHost(host), host).toBe(false);
    }
  });
});
