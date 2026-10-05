import { isNumber, normalizeSymbol, type Quote, type StocksData } from './quotes';

/**
 * Prices from Twelve Data: an official API, CORS-open, with the user's own key. The
 * free plan covers US markets, forex and crypto, and allows 8 symbols a minute and
 * 800 a day; each symbol in a request counts as one. Loaded lazily by the data source.
 * Sends the symbols and the key.
 */

type Fetch = typeof fetch;

export async function fetchTwelveData(
  symbols: readonly string[],
  apiKey: string,
  signal?: AbortSignal,
  fetcher: Fetch = fetch,
): Promise<StocksData> {
  const url = new URL('https://api.twelvedata.com/quote');
  url.searchParams.set('symbol', symbols.join(','));
  url.searchParams.set('apikey', apiKey);

  let response: Response;
  try {
    response = await fetcher(url.href, { signal, credentials: 'omit' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Twelve Data could not be reached.', { cause: error });
  }
  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) throw new Error('Twelve Data is not answering right now.');

  // Errors arrive with HTTP 200 as often as not; the body's `code` is what counts.
  // Asked for one symbol, the body is that symbol's answer, so a "not found" there
  // belongs to the symbol rather than to the request.
  const single = symbols.length === 1;
  if (isError(body) && !(single && isMissing(body))) throw requestError(body);
  if (!response.ok && !single)
    throw new Error('Twelve Data is not answering right now.');

  const answers: Record<string, unknown> = single ? { [symbols[0]!]: body } : body;
  const data: StocksData = { quotes: {}, missing: [] };
  for (const symbol of symbols) {
    const answer = answers[symbol] ?? findIgnoringCase(answers, symbol);
    const quote = parse(answer);
    if (quote) data.quotes[normalizeSymbol(symbol)] = quote;
    else if (isError(answer) && !isMissing(answer)) throw requestError(answer);
    else data.missing.push(symbol);
  }
  return data;
}

function parse(answer: unknown): Quote | null {
  if (typeof answer !== 'object' || answer === null || isError(answer)) return null;
  const a = answer as Record<string, unknown>;
  const price = number(a.close);
  const change = number(a.change);
  const changePercent = number(a.percent_change);
  if (price === null || change === null || changePercent === null) return null;
  if (typeof a.symbol !== 'string') return null;
  const time = number(a.last_quote_at) ?? number(a.timestamp);
  return {
    symbol: a.symbol,
    name: typeof a.name === 'string' && a.name ? a.name : a.symbol,
    price,
    change,
    changePercent,
    currency: typeof a.currency === 'string' ? a.currency : '',
    time: time === null ? Date.now() : time * 1000,
  };
}

/** Twelve Data writes numbers as strings. */
function number(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return isNumber(n) ? n : null;
}

interface ApiError {
  status: 'error';
  code?: number;
  message?: string;
}

function isError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).status === 'error'
  );
}

/**
 * Unknown, or outside the key's plan, which on the free plan means any market
 * outside the US. Either way the symbol shows as unavailable; the rest still load.
 */
function isMissing(error: ApiError): boolean {
  return error.code === 400 || error.code === 403 || error.code === 404;
}

function requestError(error: ApiError): Error {
  if (error.code === 401) return new Error('Twelve Data did not accept this key.');
  if (error.code === 429) {
    return new Error(
      'This Twelve Data key has used its allowance. The free plan allows 8 symbols a minute and 800 a day.',
    );
  }
  return new Error('Twelve Data is not answering right now.');
}

function findIgnoringCase(answers: Record<string, unknown>, symbol: string): unknown {
  const wanted = normalizeSymbol(symbol);
  const key = Object.keys(answers).find((k) => normalizeSymbol(k) === wanted);
  return key === undefined ? undefined : answers[key];
}
