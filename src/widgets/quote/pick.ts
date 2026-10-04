import type { QuoteSettings } from './definition';
import type { Quote } from './quotes';

export type QuoteRefresh = QuoteSettings['refresh'];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** A stride through the pool. Prime, so consecutive periods visit every quote once. */
const STRIDE = 7919;

/**
 * Which quote to show, without storing anything.
 *
 * Hourly and daily count periods in local time and step through the pool by a prime
 * stride: the same quote all day in every tab, and no repeat until every one has had
 * its turn (for any pool size not a multiple of the stride). Every tab is `seed`, a
 * random number the component draws once when it mounts.
 *
 * Called once per mount, not on every tick: like the Unsplash photo, a quote never
 * changes under someone reading it. The next tab gets the next one.
 */
export function pickQuote<Q extends Quote>(
  pool: readonly Q[],
  refresh: QuoteRefresh,
  now: number,
  seed: number,
  offsetMinutes = new Date(now).getTimezoneOffset(),
): Q | null {
  if (pool.length === 0) return null;
  if (refresh === 'tab') return pool[Math.floor(seed * pool.length)] ?? pool[0]!;

  const local = now - offsetMinutes * 60 * 1000;
  const period = Math.floor(local / (refresh === 'daily' ? DAY : HOUR));
  const index = (((period * STRIDE) % pool.length) + pool.length) % pool.length;
  return pool[index]!;
}
