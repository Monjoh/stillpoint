import type { WidgetProps } from '@/core/registry/types';
import { useNow } from '@/lib/use-now';
import type { StocksSettings } from './definition';
import { direction, formatChange, formatPrice } from './format';
import { layoutStocks } from './layout';
import { normalizeSymbol, type StocksData } from './quotes';
import styles from './StocksView.module.css';

const ARROW = { up: '▲', down: '▼', flat: '' } as const;

export default function StocksView({
  settings,
  size,
  data,
}: WidgetProps<StocksSettings, StocksData>) {
  // Once a minute, for the "not updated for 3 h" note on old prices.
  const now = useNow(60_000).getTime();

  if (!data) {
    // No key means nothing was fetched: the data source returned no cache key.
    return (
      <p className={styles.notice}>
        {settings.source === 'twelvedata' && !settings.apiKey.trim()
          ? 'Add your Twelve Data key in this widget’s settings.'
          : 'Add symbols in this widget’s settings.'}
      </p>
    );
  }

  const stocks = data.status === 'empty' ? undefined : data.data;
  if (!stocks) {
    return (
      <p className={styles.notice}>
        Prices unavailable. {data.status === 'error' ? data.error : ''}
      </p>
    );
  }

  const rows = settings.symbols
    .filter((entry, i, all) => {
      const symbol = normalizeSymbol(entry.symbol);
      return symbol && all.findIndex((e) => normalizeSymbol(e.symbol) === symbol) === i;
    })
    .map((entry) => {
      const symbol = normalizeSymbol(entry.symbol);
      const quote = stocks.quotes[symbol];
      return {
        symbol,
        label: entry.label.trim() || symbol,
        quote,
        price: quote ? formatPrice(quote.price, quote.currency) : '—',
        change: quote ? formatChange(quote, settings.change) : '',
      };
    });

  // Old prices stay up when a refresh fails, with a line saying how old.
  const failedAt = data.status === 'error' ? data.fetchedAt : undefined;
  const longest = (pick: (row: (typeof rows)[number]) => string) =>
    Math.max(1, ...rows.map((row) => pick(row).length));
  const layout = layoutStocks({
    count: rows.length + (failedAt === undefined ? 0 : 1),
    width: size.width,
    height: size.height,
    maxPx: settings.fontSize,
    labelChars: Math.min(
      12,
      longest((row) => row.label),
    ),
    priceChars: longest((row) => row.price),
    changeChars: longest((row) => row.change),
  });
  // The note takes a row, but never the only one: a price beats a caveat.
  const showStale = failedAt !== undefined && layout.rows > 1;
  const shown = rows.slice(0, showStale ? layout.rows - 1 : layout.rows);

  return (
    <div className={styles.stocks} style={{ fontSize: `${layout.fontPx}px` }}>
      <table className={styles.table}>
        <caption className={styles.hidden}>Watchlist</caption>
        <tbody>
          {shown.map((row) => {
            const way = row.quote ? direction(row.quote.changePercent) : 'flat';
            return (
              <tr key={row.symbol} title={row.quote?.name ?? 'Not available'}>
                <th scope="row" className={styles.label}>
                  {row.label}
                </th>
                <td className={styles.price}>
                  {row.price}
                  {!row.quote && <span className={styles.hidden}> Not available</span>}
                </td>
                {layout.showChange && (
                  <td className={styles.change} data-direction={way}>
                    {ARROW[way] && (
                      <span className={styles.arrow} aria-hidden="true">
                        {ARROW[way]}
                      </span>
                    )}
                    {row.change}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {showStale && (
        <p className={styles.stale}>Not updated for {age(now - failedAt!)}</p>
      )}
    </div>
  );
}

function age(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}
