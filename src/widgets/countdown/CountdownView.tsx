import { i18n } from '#i18n';
import type { CSSProperties } from 'react';
import type { WidgetProps } from '@/core/registry/types';
import { fitTextCss } from '@/lib/fit-text';
import { useNow } from '@/lib/use-now';
import { calendarDays, daysText, span, spanText, targetDate } from './count';
import type { CountdownSettings } from './definition';
import styles from './CountdownView.module.css';

export default function CountdownView({ settings }: WidgetProps<CountdownSettings>) {
  const seconds = settings.display === 'full' && settings.showSeconds;
  const now = useNow(seconds ? 1_000 : 60_000);
  const target = targetDate(settings.date, settings.time);

  if (!target) {
    return <p className={styles.empty}>{i18n.t('widget.countdown.empty')}</p>;
  }

  const { count, passed } = measure(now, target, settings.display, seconds);

  const when = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    ...(settings.time ? { timeStyle: 'short' } : {}),
  }).format(target);
  const name = settings.title.trim() || when;
  const caption =
    passed === null
      ? name
      : i18n.t(passed ? 'widget.countdown.since' : 'widget.countdown.until', {
          target: name,
        });

  return (
    <div
      className={styles.countdown}
      style={
        {
          // The caption sits under the count, so the count takes 60% of the height.
          '--count': fitTextCss({
            maxPx: settings.fontSize,
            text: count,
            heightRatio: 0.6,
          }),
        } as CSSProperties
      }
    >
      <p className={styles.count}>{count}</p>
      <p className={styles.caption}>
        <time dateTime={target.toISOString()} title={when}>
          {caption}
        </time>
      </p>
    </div>
  );
}

/**
 * The big line, and whether the moment is ahead (`false`), behind (`true`), or now
 * (`null`: the caption then names it with no "until" or "since").
 */
function measure(
  now: Date,
  target: Date,
  display: CountdownSettings['display'],
  seconds: boolean,
): { count: string; passed: boolean | null } {
  if (display === 'days') {
    const days = calendarDays(now, target);
    if (days === 0) return { count: i18n.t('widget.countdown.today'), passed: null };
    return { count: daysText(days), passed: days < 0 };
  }
  const left = span(now, target, seconds);
  if (left.days + left.hours + left.minutes + left.seconds === 0) {
    return { count: i18n.t('widget.countdown.now'), passed: null };
  }
  return { count: spanText(left, seconds), passed: target <= now };
}
