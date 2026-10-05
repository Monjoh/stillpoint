/**
 * Response bodies in the shapes Twelve Data's quote endpoint returns, trimmed to the fields read. Twelve Data's values are strings, as
 * on the wire.
 */

export function twelveQuote(symbol: string, close: string, previous: string) {
  const change = (Number(close) - Number(previous)).toFixed(5);
  return {
    symbol,
    name: `${symbol} Inc`,
    exchange: 'NASDAQ',
    currency: 'USD',
    datetime: '2026-10-02',
    timestamp: 1790947800,
    last_quote_at: 1790971140,
    close,
    previous_close: previous,
    change,
    percent_change: ((Number(change) / Number(previous)) * 100).toFixed(5),
    is_market_open: false,
  };
}

export const twelveNotFound = {
  code: 404,
  message: '**symbol** not found: NOPE. Please specify it correctly.',
  status: 'error',
};

export const twelveBadKey = {
  code: 401,
  message: '**apikey** parameter is incorrect or not specified.',
  status: 'error',
};

export const twelveOutOfCredits = {
  code: 429,
  message: 'You have run out of API credits for the current minute.',
  status: 'error',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
