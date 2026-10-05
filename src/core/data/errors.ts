/**
 * A service said "too many requests" (HTTP 429, or its own way of saying so). Throw it
 * from a data source's `fetch` instead of a plain `Error`, and the data layer waits
 * much longer before asking again: retrying a rate limit quickly is what keeps it in
 * force.
 */
export class RateLimitError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RateLimitError';
  }
}
