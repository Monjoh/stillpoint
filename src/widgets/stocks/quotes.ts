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
  /** ISO 4217, except the minor units some feeds use: `GBp` is pence, `ZAc` cents. */
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

/**
 * Twelve Data's free plan allows 8 credits a minute, and one request costs a credit
 * per symbol: a request for 9 fails, at any interval. So it is asked for the first 8.
 */
export const TWELVE_DATA_MAX_SYMBOLS = 8;

/** The symbols Twelve Data will actually be asked for, in watchlist order. */
export function fetchedSymbols(entries: readonly { symbol: string }[]): string[] {
  return watchlist(entries).slice(0, TWELVE_DATA_MAX_SYMBOLS);
}

/**
 * The shortest refresh interval, in minutes, a watchlist this long can afford on a
 * tab left open all day. Twelve Data: 800 credits a day at one per symbol per
 * refresh, so 1,440 / 800 = 1.8 minutes per symbol.
 */
export function minRefreshMinutes(symbols: number): number {
  return Math.ceil((symbols * 24 * 60) / 800);
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
