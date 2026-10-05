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
          setProblem(error instanceof Error ? error.message : 'The search failed.');
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
      setProblem('This browser cannot share a location. Search for a city instead.');
      return;
    }
    setLocating(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        choose({
          name: 'My location',
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        });
      },
      (error) => {
        setLocating(false);
        setProblem(
          error.code === error.PERMISSION_DENIED
            ? 'Location access was declined. Search for a city instead.'
            : 'Your location could not be found. Search for a city instead.',
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
          Change
        </button>
      </div>
    );
  }

  if (consent.state === 'checking') return null;
  if (consent.state === 'missing') {
    return (
      <div className={styles.picker}>
        <p className={styles.status}>
          Weather sends the place you choose to Open-Meteo, the forecast service.
          Firefox asks you to allow that once.
        </p>
        <div className={styles.actions}>
          <button
            id={id}
            type="button"
            className={styles.button}
            onClick={consent.request}
          >
            Allow
          </button>
          {value && (
            <button
              type="button"
              className={styles.link}
              onClick={() => setChanging(false)}
            >
              Keep {value.name}
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
      ? 'Finding your location…'
      : searchable && !places
        ? 'Searching…'
        : places?.length === 0
          ? 'No place by that name.'
          : null;

  return (
    <div className={styles.picker}>
      <input
        id={id}
        className={styles.input}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search for a city"
        autoComplete="off"
        spellCheck={false}
      />

      {places && places.length > 0 && (
        <ul className={styles.results} aria-label="Places found">
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
          Use my location
        </button>
        {value && (
          <button
            type="button"
            className={styles.link}
            onClick={() => setChanging(false)}
          >
            Keep {value.name}
          </button>
        )}
      </div>
    </div>
  );
}

const LOCATION = ['locationInfo'] as const;
