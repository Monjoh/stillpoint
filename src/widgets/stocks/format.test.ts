import { describe, expect, it } from 'vitest';
import { direction, formatChange, formatPrice } from './format';

describe('formatPrice', () => {
  it('uses the currency’s symbol and its usual decimals', () => {
    expect(formatPrice(333.69, 'USD', 'en-US')).toBe('$333.69');
    expect(formatPrice(2850, 'JPY', 'en-US')).toBe('¥2,850');
    // French spaces are narrow and non-breaking.
    expect(formatPrice(1234.5, 'EUR', 'fr-FR').replace(/\s/gu, ' ')).toBe('1 234,50 €');
  });

  it('drops the decimals from prices of 10,000 or more', () => {
    expect(formatPrice(62_345.67, 'USD', 'en-US')).toBe('$62,346');
  });

  it('writes London’s pence as pence, not pounds', () => {
    expect(formatPrice(1234.5, 'GBp', 'en-GB')).toBe('1,234.5p');
  });

  it('falls back to the number and the code for a code Intl does not know', () => {
    expect(formatPrice(12, 'XYZW', 'en-US')).toBe('12 XYZW');
    expect(formatPrice(12, '', 'en-US')).toBe('12');
  });
});

describe('formatChange', () => {
  it('signs the percent, and leaves zero unsigned', () => {
    expect(
      formatChange({ change: 3.37, changePercent: 1.0202 }, 'percent', 'en-US'),
    ).toBe('+1.02%');
    expect(formatChange({ change: -1, changePercent: -0.4 }, 'percent', 'en-US')).toBe(
      '-0.40%',
    );
    expect(formatChange({ change: 0, changePercent: 0 }, 'percent', 'en-US')).toBe(
      '0.00%',
    );
  });

  it('signs the amount, without decimals once it is large', () => {
    expect(formatChange({ change: 3.37, changePercent: 1 }, 'amount', 'en-US')).toBe(
      '+3.37',
    );
    expect(formatChange({ change: -150.4, changePercent: -1 }, 'amount', 'en-US')).toBe(
      '-150',
    );
  });
});

describe('direction', () => {
  it('agrees with the rounded text', () => {
    expect(direction(1.02)).toBe('up');
    expect(direction(-0.4)).toBe('down');
    expect(direction(0.004)).toBe('flat');
  });
});
