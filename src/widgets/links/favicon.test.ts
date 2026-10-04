import { afterEach, describe, expect, it } from 'vitest';
import { ICON_PATHS, knownMisses, rememberMiss } from './favicon';

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => localStorage.clear());

describe('favicon misses', () => {
  it('knows nothing about a new site', () => {
    expect(knownMisses('https://example.com')).toBe(0);
  });

  it('remembers which icons a site does not have', () => {
    rememberMiss('https://example.com', 1, 1000);
    expect(knownMisses('https://example.com', 2000)).toBe(1);
    expect(knownMisses('https://other.com', 2000)).toBe(0);
  });

  it('tries again after a week, in case the site added one', () => {
    rememberMiss('https://example.com', 2, 0);
    expect(knownMisses('https://example.com', 6 * DAY)).toBe(2);
    expect(knownMisses('https://example.com', 8 * DAY)).toBe(0);
  });

  it('survives a corrupt or hostile entry', () => {
    localStorage.setItem('stillpoint.favicons', 'not json');
    expect(knownMisses('https://example.com')).toBe(0);
    localStorage.setItem(
      'stillpoint.favicons',
      JSON.stringify({ 'https://example.com': { skip: 99, at: Date.now() } }),
    );
    expect(knownMisses('https://example.com')).toBe(ICON_PATHS.length);
  });
});
