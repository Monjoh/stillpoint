/**
 * What both price sources produce. The view does not know which one answered.
 */

export interface Quote {
  /** As the source writes it, which may differ in case from what the user typed. */
  symbol: string;
  name: string;
  price: number;
  /** Since the previous close. */
  change: number;
  changePercent: number;
  /** ISO 4217, except Yahoo's minor units: `GBp` is pence, `ZAc` cents. */
  currency: string;
  /** When the price was set, in ms. Old on a weekend: the market is shut. */
  time: number;
}

export interface StocksData {
  /** Keyed by `normalizeSymbol`, so a lookup ignores case. */
  quotes: Record<string, Quote>;
  /** Symbols the source does not know. Shown as such, not hidden. */
  missing: string[];
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** The user's list, trimmed, without blanks or repeats, in order. */
export function watchlist(entries: readonly { symbol: string }[]): string[] {
  const seen = new Set<string>();
  for (const { symbol } of entries) {
    const s = normalizeSymbol(symbol);
    if (s) seen.add(s);
  }
  return [...seen];
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Change and percent from a price and the close before it. */
export function changeSince(price: number, previousClose: number) {
  const change = price - previousClose;
  return {
    change,
    changePercent: previousClose === 0 ? 0 : (change / previousClose) * 100,
  };
}
