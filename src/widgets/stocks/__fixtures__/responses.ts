/**
 * Response bodies in the shapes Yahoo's chart endpoint and Twelve Data's quote
 * endpoint return, trimmed to the fields read. Twelve Data's values are strings, as
 * on the wire.
 */

export function yahooChart(meta: Record<string, unknown>) {
  return { chart: { result: [{ meta, timestamp: [], indicators: {} }], error: null } };
}

export const yahooApple = yahooChart({
  currency: 'USD',
  symbol: 'AAPL',
  exchangeName: 'NMS',
  regularMarketTime: 1790971200,
  regularMarketPrice: 333.69,
  chartPreviousClose: 330.32,
  shortName: 'Apple Inc.',
  longName: 'Apple Inc.',
});

export const yahooToyota = yahooChart({
  currency: 'JPY',
  symbol: '7203.T',
  exchangeName: 'JPX',
  regularMarketTime: 1790924400,
  regularMarketPrice: 2850,
  chartPreviousClose: 2900,
  shortName: 'TOYOTA MOTOR CORP',
});

export const yahooNotFound = {
  chart: {
    result: null,
    error: { code: 'Not Found', description: 'No data found, symbol may be delisted' },
  },
};

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
