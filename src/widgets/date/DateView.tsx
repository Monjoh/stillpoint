import type { WidgetProps } from '@/core/registry/types';
import { fitTextCss } from '@/lib/fit-text';
import { useNow } from '@/lib/use-now';
import type { DateSettings } from './definition';
import { formatDate, isoDate } from './format';
import styles from './DateView.module.css';

const WEIGHT = { light: 200, regular: 400, medium: 500 } as const;

// Once a minute, on the minute: the date changes at a minute boundary in every time
// zone, so this turns over at midnight without a timer of its own.
const TICK_MS = 60_000;

export default function DateView({ settings }: WidgetProps<DateSettings>) {
  const now = useNow(TICK_MS);
  const text = formatDate(now, settings);

  return (
    <time
      className={styles.date}
      dateTime={isoDate(now, settings.timezone)}
      style={{
        fontSize: fitTextCss({ maxPx: settings.fontSize, text }),
        fontWeight: WEIGHT[settings.weight],
      }}
    >
      {text}
    </time>
  );
}
