import { i18n } from '#i18n';
import { useState, type CSSProperties } from 'react';
import type { WidgetProps } from '@/core/registry/types';
import { useNow } from '@/lib/use-now';
import type { CalendarSettings } from './definition';
import { calendarLayout } from './layout';
import { firstWeekday, isoDate, monthGrid, sameDay } from './month';
import styles from './CalendarView.module.css';

/** Once a minute is often enough to notice midnight. */
const TICK_MS = 60_000;

/** A Sunday, from which each weekday's name is taken. */
const A_SUNDAY = new Date(2026, 0, 4);

export default function CalendarView({
  settings,
  size,
  isEditing,
}: WidgetProps<CalendarSettings>) {
  const now = useNow(TICK_MS);
  // Months away from this one. Not a setting: the next tab opens on today.
  const [offset, setOffset] = useState(0);

  const shown = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const monthTitle = (date: Date) =>
    new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
  const title = monthTitle(shown);

  const weekStart = firstWeekday(settings.weekStart);
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(A_SUNDAY);
    day.setDate(A_SUNDAY.getDate() + ((weekStart + i) % 7));
    return day;
  });
  const weekdayName = (date: Date, style: 'long' | 'short' | 'narrow') =>
    new Intl.DateTimeFormat(undefined, { weekday: style }).format(date);

  const layout = calendarLayout({
    size,
    maxPx: settings.fontSize,
    wantWeekNumbers: settings.showWeekNumbers,
    shortWeekdays: weekdays.map((day) => weekdayName(day, 'short')),
    title,
  });

  const weeks = monthGrid(shown.getFullYear(), shown.getMonth(), weekStart);
  const tab = isEditing ? -1 : undefined;

  return (
    <div
      className={styles.calendar}
      style={
        {
          '--rows': layout.rows,
          '--columns': layout.columns,
          '--day': layout.daySize,
          '--title': layout.titleSize,
        } as CSSProperties
      }
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => setOffset((value) => value - 1)}
          aria-label={i18n.t('widget.calendar.previous')}
          title={i18n.t('widget.calendar.previous')}
          tabIndex={tab}
        >
          <Chevron direction="left" />
        </button>
        {/* Announced, so moving a month is heard and not only seen. */}
        <div className={styles.title} aria-live="polite">
          {offset === 0 ? (
            <span className={styles.titleText}>{title}</span>
          ) : (
            <button
              type="button"
              className={styles.titleText}
              onClick={() => setOffset(0)}
              title={i18n.t('widget.calendar.back', { month: monthTitle(now) })}
              tabIndex={tab}
            >
              {title}
            </button>
          )}
        </div>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => setOffset((value) => value + 1)}
          aria-label={i18n.t('widget.calendar.next')}
          title={i18n.t('widget.calendar.next')}
          tabIndex={tab}
        >
          <Chevron direction="right" />
        </button>
      </div>

      <table className={styles.grid} aria-label={title}>
        {layout.showWeekdays && (
          <thead>
            <tr>
              {layout.showWeekNumbers && (
                <th scope="col" className={styles.weekday}>
                  <span className={styles.hidden}>
                    {i18n.t('widget.calendar.week')}
                  </span>
                </th>
              )}
              {weekdays.map((day) => (
                <th
                  key={day.getDay()}
                  scope="col"
                  abbr={weekdayName(day, 'long')}
                  className={styles.weekday}
                >
                  {weekdayName(day, layout.weekdayStyle)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {weeks.map((week) => (
            <tr key={isoDate(week.days[0]!.date)}>
              {layout.showWeekNumbers && (
                <th
                  scope="row"
                  className={styles.weekNumber}
                  aria-label={i18n.t('widget.calendar.weekNumber', { n: week.number })}
                >
                  {week.number}
                </th>
              )}
              {week.days.map(({ date, inMonth }) => {
                const today = sameDay(date, now);
                return (
                  <td
                    key={date.getDate()}
                    className={styles.day}
                    data-other={inMonth ? undefined : ''}
                  >
                    {(inMonth || settings.showOtherMonths) && (
                      <time
                        dateTime={isoDate(date)}
                        className={styles.number}
                        aria-current={today ? 'date' : undefined}
                      >
                        {date.getDate()}
                      </time>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.chevron}>
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}
