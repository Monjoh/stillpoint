import { fitTextCss } from '@/lib/fit-text';
import type { WidgetProps } from '@/core/registry/types';
import type { ClockSettings } from './definition';
import { formatClock, tickIntervalMs } from '@/lib/clock-format';
import { useNow } from '@/lib/use-now';
import styles from './Clock.module.css';

const WEIGHT = { light: 200, regular: 400, medium: 500 } as const;

export default function Clock({ settings }: WidgetProps<ClockSettings>) {
  const now = useNow(tickIntervalMs(settings));
  const time = formatClock(now, settings);

  return (
    <time
      className={styles.clock}
      dateTime={now.toISOString()}
      style={{
        // `fontSize` is the size the user asked for, not a promise. The grid is
        // relative, so this cell is a different number of pixels on every window size;
        // `fitTextCss` keeps the requested size until the cell can no longer hold it
        // and shrinks the line from there.
        fontSize: fitTextCss({ maxPx: settings.fontSize, text: time }),
        fontWeight: WEIGHT[settings.weight],
      }}
    >
      {time}
    </time>
  );
}
