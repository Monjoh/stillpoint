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
    return <p className={styles.notice}>Choose a place in this widget’s settings.</p>;
  }

  const weather = data.status === 'empty' ? undefined : data.data;
  if (!weather) {
    // An error with nothing cached. `ready` always has data; `empty` is the frame's.
    return (
      <p className={styles.notice}>
        Weather unavailable. {data.status === 'error' ? data.error : ''}
      </p>
    );
  }

  const { current } = weather;
  const condition = describeWeather(current.code);
  const temperature = `${Math.round(current.temperature)}°`;
  const wind = weather.units === 'imperial' ? 'mph' : 'km/h';
  const place = settings.location.name.split(',')[0];
  const days = settings.forecast ? weather.days.slice(0, 3) : [];

  const layout = layoutWeather({
    width: size.width,
    height: size.height,
    maxPx: settings.fontSize,
    temperature,
    details: settings.details,
    forecastDays: days.length,
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
            {condition.label} in {place}
          </span>
        </span>
      </div>

      {layout.showSummary && (
        <p className={styles.line}>
          {failedAt !== undefined
            ? `Not updated for ${age(now - failedAt)}`
            : `${condition.label} · ${place}`}
        </p>
      )}

      {layout.showDetails && (
        <p className={styles.line}>
          Feels {Math.round(current.feelsLike)}° · Wind {Math.round(current.windSpeed)}{' '}
          {wind}
          {' · '}Humidity {Math.round(current.humidity)}%
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

function age(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}
