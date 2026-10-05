import { i18n } from '#i18n';
import type { CSSProperties } from 'react';
import type { WidgetProps } from '@/core/registry/types';
import { formatClock } from '@/lib/clock-format';
import { useNow } from '@/lib/use-now';
import type { WorldClocksSettings } from './definition';
import { worldClocksLayout } from './layout';
import { cityName, difference, differenceText, isKnownZone } from './zones';
import styles from './WorldClocksView.module.css';

/** Once a minute, on the minute. There are no seconds to show. */
const TICK_MS = 60_000;

export default function WorldClocksView({
  settings,
  size,
}: WidgetProps<WorldClocksSettings>) {
  const now = useNow(TICK_MS);

  if (settings.clocks.length === 0) {
    return <p className={styles.empty}>{i18n.t('widget.worldclocks.empty')}</p>;
  }

  const rows = settings.clocks.map((clock, index) => {
    // An unknown zone shows the device's time, named as such, not a wrong city.
    const zone = clock.timezone && isKnownZone(clock.timezone) ? clock.timezone : null;
    return {
      key: index,
      label:
        clock.label.trim() ||
        (zone ? cityName(zone) : i18n.t('widget.worldclocks.local')),
      time: formatClock(now, {
        format: settings.format,
        showSeconds: false,
        showMeridiem: true,
        timezone: zone,
      }),
      difference: differenceText(difference(now, zone)),
    };
  });

  const longest = (texts: string[]) =>
    texts.reduce((a, b) => (b.length > a.length ? b : a), '');
  const layout = worldClocksLayout({
    size,
    count: rows.length,
    time: longest(rows.map((row) => row.time)),
    label: longest(rows.map((row) => row.label)),
    maxPx: settings.fontSize,
    wantDifference: settings.showDifference,
  });

  return (
    <ul
      className={styles.clocks}
      data-direction={layout.direction}
      style={{ '--time': layout.timeSize } as CSSProperties}
    >
      {rows.map((row) => (
        <li key={row.key} className={styles.clock}>
          <span className={styles.place}>
            <span className={styles.label}>{row.label}</span>
            {layout.showDifference && (
              // An empty line still holds its height, so every row lines up.
              <span className={styles.difference}>{row.difference || ' '}</span>
            )}
          </span>
          <time className={styles.time} dateTime={now.toISOString()}>
            {row.time}
          </time>
        </li>
      ))}
    </ul>
  );
}
