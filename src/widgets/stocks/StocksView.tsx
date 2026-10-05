import { i18n } from '#i18n';
import { formatAge, formatClockTime } from '@/lib/age';
import type { WidgetProps } from '@/core/registry/types';
import { useNow } from '@/lib/use-now';
import type { StocksSettings } from './definition';
import { direction, formatChange, formatPrice } from './format';
import { layoutStocks } from './layout';
import { normalizeSymbol, TWELVE_DATA_MAX_SYMBOLS, type StocksData } from './quotes';
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
          ? i18n.t('widget.stocks.view.addKey')
          : i18n.t('widget.stocks.view.addSymbols')}
      </p>
    );
  }

  const stocks = data.status === 'empty' ? undefined : data.data;
  if (!stocks) {
    return (
      <p className={styles.notice}>
        {i18n.t('widget.stocks.view.unavailable')}{' '}
        {data.status === 'error' ? data.error : ''}
      </p>
    );
  }

  const unique = settings.symbols.filter((entry, i, all) => {
    const symbol = normalizeSymbol(entry.symbol);
    return symbol && all.findIndex((e) => normalizeSymbol(e.symbol) === symbol) === i;
  });
  // Twelve Data is asked for the first few only; the rest would read as missing.
  const truncated =
    settings.source === 'twelvedata' && unique.length > TWELVE_DATA_MAX_SYMBOLS;
  const rows = unique
    .slice(0, truncated ? TWELVE_DATA_MAX_SYMBOLS : undefined)
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

  // One note under the prices, the most important first: old prices after a failed
  // refresh, then a watchlist Twelve Data cannot take whole, then, if asked for, when
  // the prices were fetched.
  const failedAt = data.status === 'error' ? data.fetchedAt : undefined;
  const note =
    failedAt !== undefined
      ? i18n.t('widget.stocks.view.stale', { age: formatAge(now - failedAt) })
      : truncated
        ? i18n.t('widget.stocks.view.firstOnly', { count: TWELVE_DATA_MAX_SYMBOLS })
        : settings.showUpdated && data.status === 'ready'
          ? i18n.t('widget.common.updated', {
              time: formatClockTime(data.fetchedAt, now),
            })
          : null;
  const longest = (pick: (row: (typeof rows)[number]) => string) =>
    Math.max(1, ...rows.map((row) => pick(row).length));
  const layout = layoutStocks({
    count: rows.length + (note === null ? 0 : 1),
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
  const showNote = note !== null && layout.rows > 1;
  const shown = rows.slice(0, showNote ? layout.rows - 1 : layout.rows);

  return (
    <div className={styles.stocks} style={{ fontSize: `${layout.fontPx}px` }}>
      <table className={styles.table}>
        <caption className={styles.hidden}>
          {i18n.t('widget.stocks.symbols.label')}
        </caption>
        <tbody>
          {shown.map((row) => {
            const way = row.quote ? direction(row.quote.changePercent) : 'flat';
            return (
              <tr
                key={row.symbol}
                title={row.quote?.name ?? i18n.t('widget.stocks.view.notAvailable')}
              >
                <th scope="row" className={styles.label}>
                  {row.label}
                </th>
                <td className={styles.price}>
                  {row.price}
                  {!row.quote && (
                    <span className={styles.hidden}>
                      {' '}
                      {i18n.t('widget.stocks.view.notAvailable')}
                    </span>
                  )}
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
      {showNote && <p className={styles.stale}>{note}</p>}
    </div>
  );
}
