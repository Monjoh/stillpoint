import { describe, expect, it } from 'vitest';
import { isDue, referralUrl, sameQuery } from './state';

const at = (iso: string) => new Date(iso).getTime();

describe('isDue', () => {
  it('is always due at every tab', () => {
    expect(isDue('tab', Date.now(), Date.now())).toBe(true);
  });

  it('is due hourly after an hour', () => {
    const shown = at('2026-10-05T09:00:00');
    expect(isDue('hourly', shown, at('2026-10-05T09:59:00'))).toBe(false);
    expect(isDue('hourly', shown, at('2026-10-05T10:00:00'))).toBe(true);
  });

  // A calendar day, not 24 hours: a photo picked late should not stay all of tomorrow.
  it('is due daily on a new local day, not after 24 hours', () => {
    const shown = at('2026-10-05T23:00:00');
    expect(isDue('daily', shown, at('2026-10-05T23:59:00'))).toBe(false);
    expect(isDue('daily', shown, at('2026-10-06T00:01:00'))).toBe(true);
  });
});

describe('sameQuery', () => {
  it('ignores case and spacing', () => {
    expect(sameQuery(' Snowy  Mountains', 'snowy mountains ')).toBe(true);
    expect(sameQuery('ocean', 'oceans')).toBe(false);
  });
});

describe('referralUrl', () => {
  it('adds Unsplash’s referral parameters, with or without a query already', () => {
    expect(referralUrl('https://unsplash.com/@a')).toBe(
      'https://unsplash.com/@a?utm_source=stillpoint&utm_medium=referral',
    );
    expect(referralUrl('https://unsplash.com/p?x=1')).toBe(
      'https://unsplash.com/p?x=1&utm_source=stillpoint&utm_medium=referral',
    );
  });
});
