import { i18n } from '#i18n';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/core/permissions';
import type { ControlProps } from '@/core/registry/types';
import type { WeatherLocation } from './definition';
import { roundCoordinate, searchPlaces, type Place } from './geocode';
import styles from './LocationControl.module.css';

/** Typing settles for this long before a search goes out: one request, not nine. */
const SETTLE_MS = 400;

/**
 * Pick a place by name, or "Use my location" once. The coordinates are stored, never
 * tracked: the browser's location is read when the button is pressed and not again.
 *
 * Tool chrome, so `--sp-ui-*` throughout.
 */
export default function LocationControl({
  id,
  value,
  onChange,
}: ControlProps<WeatherLocation | null>) {
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ query: string; places: Place[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Typing a city sends it to Open-Meteo, and so does every forecast after. Firefox
  // asks consent for that, and only from a click, so the picker starts with one.
  const consent = usePermissions({ dataCollection: LOCATION });

  const wanted = query.trim();
  const searchable = wanted.length >= 2 && consent.state === 'granted';

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(wanted, controller.signal)
        .then((places) => {
          setFound({ query: wanted, places });
          setProblem(null);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setProblem(
            error instanceof Error
              ? error.message
              : i18n.t('widget.weather.picker.searchFailed'),
          );
        });
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [wanted, searchable]);

  const choose = (place: WeatherLocation) => {
    onChange({
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setChanging(false);
    setQuery('');
    setFound(null);
    setProblem(null);
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setProblem(i18n.t('widget.weather.picker.noGeolocation'));
      return;
    }
    setLocating(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        choose({
          // Saved with the setting, so it stays in the language it was set in.
          name: i18n.t('widget.weather.picker.myLocation'),
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        });
      },
      (error) => {
        setLocating(false);
        setProblem(
          error.code === error.PERMISSION_DENIED
            ? i18n.t('widget.weather.picker.declined')
            : i18n.t('widget.weather.picker.notFound'),
        );
      },
      { timeout: 10_000, maximumAge: 10 * 60 * 1000 },
    );
  };

  if (value && !changing) {
    return (
      <div className={styles.current}>
        <span className={styles.name}>{value.name}</span>
        <button
          id={id}
          type="button"
          className={styles.button}
          onClick={() => setChanging(true)}
        >
          {i18n.t('widget.weather.picker.change')}
        </button>
      </div>
    );
  }

  if (consent.state === 'checking') return null;
  if (consent.state === 'missing') {
    return (
      <div className={styles.picker}>
        <p className={styles.status}>{i18n.t('widget.weather.picker.consent')}</p>
        <div className={styles.actions}>
          <button
            id={id}
            type="button"
            className={styles.button}
            onClick={consent.request}
          >
            {i18n.t('frame.permission.allow')}
          </button>
          {value && (
            <button
              type="button"
              className={styles.link}
              onClick={() => setChanging(false)}
            >
              {i18n.t('widget.weather.picker.keep', { name: value.name })}
            </button>
          )}
        </div>
      </div>
    );
  }

  const places = found && found.query === wanted ? found.places : null;
  const status = problem
    ? problem
    : locating
      ? i18n.t('widget.weather.picker.locating')
      : searchable && !places
        ? i18n.t('widget.weather.picker.searching')
        : places?.length === 0
          ? i18n.t('widget.weather.picker.noMatch')
          : null;

  return (
    <div className={styles.picker}>
      <input
        id={id}
        className={styles.input}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={i18n.t('widget.weather.picker.placeholder')}
        autoComplete="off"
        spellCheck={false}
      />

      {places && places.length > 0 && (
        <ul
          className={styles.results}
          aria-label={i18n.t('widget.weather.picker.results')}
        >
          {places.map((place) => (
            <li key={`${place.latitude},${place.longitude}`}>
              <button
                type="button"
                className={styles.result}
                onClick={() => choose(place)}
              >
                <span>{place.name.split(',')[0]}</span>
                <span className={styles.detail}>{place.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.status} role="status">
        {status}
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={locate}
          disabled={locating}
        >
          {i18n.t('widget.weather.picker.useMyLocation')}
        </button>
        {value && (
          <button
            type="button"
            className={styles.link}
            onClick={() => setChanging(false)}
          >
            {i18n.t('widget.weather.picker.keep', { name: value.name })}
          </button>
        )}
      </div>
    </div>
  );
}

const LOCATION = ['locationInfo'] as const;
