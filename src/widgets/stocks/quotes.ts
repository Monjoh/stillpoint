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

/**
 * Twelve Data's free plan allows 8 credits a minute, and one request costs a credit
 * per symbol: a request for 9 fails, at any interval. So it is asked for the first 8.
 */
export const TWELVE_DATA_MAX_SYMBOLS = 8;

/** The symbols a source will actually be asked for, in watchlist order. */
export function fetchedSymbols(
  source: 'yahoo' | 'twelvedata',
  entries: readonly { symbol: string }[],
): string[] {
  const all = watchlist(entries);
  return source === 'twelvedata' ? all.slice(0, TWELVE_DATA_MAX_SYMBOLS) : all;
}

/**
 * The shortest refresh interval, in minutes, a watchlist this long can afford on a
 * tab left open all day. Twelve Data: 800 credits a day at one per symbol per
 * refresh, so 1,440 / 800 = 1.8 minutes per symbol. Yahoo publishes no limit and
 * answers 429 readily; 30 seconds per symbol keeps it near 120 requests an hour.
 */
export function minRefreshMinutes(
  source: 'yahoo' | 'twelvedata',
  symbols: number,
): number {
  const perSymbol = source === 'twelvedata' ? (24 * 60) / 800 : 0.5;
  return Math.ceil(symbols * perSymbol);
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
