import type { Quote } from './quotes';

/**
 * Prices in the quote's own currency and the reader's own number format: "$333.69",
 * "¥2,850", "1.234,50 €". Each currency keeps its usual decimals, and prices of
 * 10,000 or more drop them.
 */
export function formatPrice(price: number, currency: string, locale?: string): string {
  const digits = Math.abs(price) >= 10_000 ? { maximumFractionDigits: 0 } : {};
  // Yahoo quotes London in pence (GBp) and Johannesburg in cents (ZAc). Intl would
  // read either as the major unit, a hundredfold out.
  const minor = MINOR_UNITS[currency];
  if (minor) {
    return `${plain(price, locale, { maximumFractionDigits: 2, ...digits })}${minor}`;
  }
  if (/^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        ...digits,
      }).format(price);
    } catch {
      // An unknown code: fall through to the number with the code after it.
    }
  }
  const number = plain(price, locale, { maximumFractionDigits: 2, ...digits });
  return currency ? `${number} ${currency}` : number;
}

const MINOR_UNITS: Record<string, string> = {
  GBp: 'p',
  GBX: 'p',
  ZAc: 'c',
  ILA: ' ag',
};

/** "+1.02%", "−0.40%", or "+3.37" in the quote's units. Never colour alone. */
export function formatChange(
  quote: Pick<Quote, 'change' | 'changePercent'>,
  mode: 'percent' | 'amount',
  locale?: string,
): string {
  if (mode === 'percent') {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero',
    }).format(quote.changePercent / 100);
  }
  const big = Math.abs(quote.change) >= 100;
  return plain(quote.change, locale, {
    minimumFractionDigits: big ? 0 : 2,
    maximumFractionDigits: big ? 0 : 2,
    signDisplay: 'exceptZero',
  });
}

/** Up, down or flat, for the arrow and the colour. Rounds as the text does. */
export function direction(changePercent: number): 'up' | 'down' | 'flat' {
  const rounded = Math.round(changePercent * 100);
  return rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
}

function plain(
  value: number,
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, options).format(value);
}
