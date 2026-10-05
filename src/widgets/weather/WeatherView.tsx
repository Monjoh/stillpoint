import { i18n } from '#i18n';
import { formatAge, formatClockTime, unit } from '@/lib/age';
import type { WidgetProps } from '@/core/registry/types';
import { useNow } from '@/lib/use-now';
import type { WeatherData } from './api';
import { describeWeather } from './codes';
import type { WeatherSettings } from './definition';
import { WeatherIcon } from './icons';
import { layoutWeather } from './layout';
import styles from './WeatherView.module.css';

export default function WeatherView({
  settings,
  size,
  data,
}: WidgetProps<WeatherSettings, WeatherData>) {
  // Once a minute, for the "updated 3 h ago" note on old data.
  const now = useNow(60_000).getTime();

  if (!settings.location || !data) {
    return <p className={styles.notice}>{i18n.t('widget.weather.view.choosePlace')}</p>;
  }

  const weather = data.status === 'empty' ? undefined : data.data;
  if (!weather) {
    // An error with nothing cached. `ready` always has data; `empty` is the frame's.
    return (
      <p className={styles.notice}>
        {i18n.t('widget.weather.view.unavailable')}{' '}
        {data.status === 'error' ? data.error : ''}
      </p>
    );
  }

  const { current } = weather;
  const condition = describeWeather(current.code);
  const temperature = `${Math.round(current.temperature)}°`;
  const wind = unit(
    Math.round(current.windSpeed),
    weather.units === 'imperial' ? 'mile-per-hour' : 'kilometer-per-hour',
  );
  const place = settings.location.name.split(',')[0] ?? settings.location.name;
  const days = settings.forecast ? weather.days.slice(0, 3) : [];

  const layout = layoutWeather({
    width: size.width,
    height: size.height,
    maxPx: settings.fontSize,
    temperature,
    details: settings.details,
    forecastDays: days.length,
    // A failed refresh already says how old the data is, in the summary line.
    updated: settings.showUpdated && data.status === 'ready',
  });

  // Old data stays up when a refresh fails, with a note saying how old. The words
  // carry it, not a dimmer colour alone.
  const failedAt = data.status === 'error' ? data.fetchedAt : undefined;

  return (
    <div className={styles.weather} style={{ fontSize: `${layout.smallPx}px` }}>
      <div className={styles.now} style={{ fontSize: `${layout.tempPx}px` }}>
        <span className={styles.icon}>
          <WeatherIcon kind={condition.icon} isDay={current.isDay} />
        </span>
        <span className={styles.temperature}>
          {temperature}
          <span className={styles.hidden}>
            {' '}
            {i18n.t('widget.weather.view.conditionIn', {
              condition: condition.label,
              place,
            })}
          </span>
        </span>
      </div>

      {layout.showSummary && (
        <p className={styles.line}>
          {failedAt !== undefined
            ? i18n.t('widget.weather.view.stale', { age: formatAge(now - failedAt) })
            : `${condition.label} · ${place}`}
        </p>
      )}

      {layout.showDetails && (
        <p className={styles.line}>
          {i18n.t('widget.weather.view.details', {
            feels: `${Math.round(current.feelsLike)}°`,
            wind,
            humidity: percent(current.humidity),
          })}
        </p>
      )}

      {layout.showForecast && (
        <ol className={styles.forecast}>
          {days.map((day) => {
            const { label, icon } = describeWeather(day.code);
            return (
              <li key={day.date} className={styles.day}>
                <span className={styles.dayName}>{weekday(day.date)}</span>
                <span className={styles.dayIcon} title={label}>
                  <WeatherIcon kind={icon} />
                </span>
                <span>
                  {Math.round(day.max)}°{' '}
                  <span className={styles.low}>{Math.round(day.min)}°</span>
                </span>
                <span className={styles.hidden}>{label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {layout.showUpdated && data.status === 'ready' && (
        <p className={styles.line}>
          {i18n.t('widget.common.updated', {
            time: formatClockTime(data.fetchedAt, now),
          })}
        </p>
      )}
    </div>
  );
}

/** "Mon" for a calendar date. UTC on both sides, so no time zone moves it a day. */
function weekday(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** "64 %" or "64%", as the browser's language writes it. */
function percent(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'percent' }).format(
    Math.round(value) / 100,
  );
}
