import { i18n } from '#i18n';
import { RateLimitError } from '@/core/data/errors';
import {
  changeSince,
  isNumber,
  normalizeSymbol,
  type Quote,
  type StocksData,
} from './quotes';

/**
 * Prices from Yahoo Finance's chart endpoint: no key, every market, but unofficial.
 * Yahoo publishes no API, and this is the address its own site calls, so it can change
 * without notice. Its quote endpoint already needs a session cookie; the chart one,
 * for now, does not.
 *
 * Needs the `YAHOO_ORIGIN` host permission: Yahoo sends no CORS headers. Loaded lazily
 * by the data source. Sends the symbols and nothing else: no cookies.
 */

type Fetch = typeof fetch;

type Outcome =
  | { kind: 'quote'; quote: Quote }
  | { kind: 'missing' }
  | { kind: 'failed'; error: Error };

export async function fetchYahoo(
  symbols: readonly string[],
  signal?: AbortSignal,
  fetcher: Fetch = fetch,
): Promise<StocksData> {
  // One request per symbol: the endpoint that takes a list is the one needing a cookie.
  const outcomes = await Promise.all(symbols.map((s) => one(s, signal, fetcher)));

  const data: StocksData = { quotes: {}, missing: [] };
  let failure: Error | undefined;
  outcomes.forEach((outcome, i) => {
    if (outcome.kind === 'quote')
      data.quotes[normalizeSymbol(symbols[i]!)] = outcome.quote;
    else if (outcome.kind === 'missing') data.missing.push(symbols[i]!);
    // A rate limit outranks any other failure: it decides how long to wait.
    else if (!(failure instanceof RateLimitError)) failure = outcome.error;
  });
  // A partial answer would be cached as if complete, so a symbol that merely failed
  // would read as unknown for the next ten minutes. Fail the lot; the last complete
  // answer stays up.
  if (failure) throw failure;
  return data;
}

async function one(symbol: string, signal: AbortSignal | undefined, fetcher: Fetch) {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set('range', '1d');
  url.searchParams.set('interval', '1d');

  let response: Response;
  try {
    response = await fetcher(url.href, { signal, credentials: 'omit' });
  } catch (error) {
    if (signal?.aborted) throw error;
    return failed(i18n.t('widget.stocks.error.yahooUnreachable'), error);
  }
  if (response.status === 404) return { kind: 'missing' } as Outcome;
  if (response.status === 429) {
    return {
      kind: 'failed',
      error: new RateLimitError(i18n.t('widget.stocks.error.yahooRefusing')),
    } as Outcome;
  }
  if (!response.ok) return failed(i18n.t('widget.stocks.error.yahooDown'));

  const body = (await response.json().catch(() => null)) as {
    chart?: { result?: { meta?: Record<string, unknown> }[] | null };
  } | null;
  const result = body?.chart?.result;
  // An empty result is how Yahoo answers some symbols it does not know.
  if (Array.isArray(result) && result.length === 0)
    return { kind: 'missing' } as Outcome;
  const quote = parse(result?.[0]?.meta);
  if (!quote) return failed(i18n.t('widget.stocks.error.yahooUnreadable'));
  return { kind: 'quote', quote } as Outcome;
}

function parse(meta: Record<string, unknown> | undefined): Quote | null {
  if (!meta) return null;
  const price = meta.regularMarketPrice;
  const previous = meta.chartPreviousClose ?? meta.previousClose;
  if (!isNumber(price) || !isNumber(previous) || typeof meta.symbol !== 'string') {
    return null;
  }
  const name = [meta.shortName, meta.longName, meta.symbol].find(
    (n): n is string => typeof n === 'string' && n !== '',
  )!;
  return {
    symbol: meta.symbol,
    name,
    price,
    ...changeSince(price, previous),
    currency: typeof meta.currency === 'string' ? meta.currency : '',
    time: isNumber(meta.regularMarketTime) ? meta.regularMarketTime * 1000 : Date.now(),
  };
}

function failed(message: string, cause?: unknown): Outcome {
  return { kind: 'failed', error: new Error(message, { cause }) };
}
