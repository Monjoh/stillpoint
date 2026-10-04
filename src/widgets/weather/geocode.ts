/**
 * City search, for the Location control. Open-Meteo's geocoder: no key, CORS-open.
 * Runs only while the user types in the widget's settings, so only on their action.
 * Loaded with the control, never on the new tab.
 */

export interface Place {
  /** What is stored and shown: "Paris, France". */
  name: string;
  /** The region, to tell two Parises apart in the results. */
  detail: string;
  latitude: number;
  longitude: number;
}

type Fetch = typeof fetch;

/** Two decimals is about a kilometre: plenty for weather, and no more precise than that. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  fetcher: Fetch = fetch,
  language: string = navigator.language,
): Promise<Place[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query.trim());
  url.searchParams.set('count', '6');
  url.searchParams.set('language', language.slice(0, 2) || 'en');
  url.searchParams.set('format', 'json');

  let response: Response;
  try {
    response = await fetcher(url.href, { signal, credentials: 'omit' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('The place search could not be reached.', { cause: error });
  }
  if (!response.ok) throw new Error('The place search is not answering right now.');

  const body: unknown = await response.json().catch(() => null);
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];

  return results.flatMap((raw): Place[] => {
    const r = raw as Record<string, unknown>;
    const { name, latitude, longitude, country, admin1 } = r;
    if (
      typeof name !== 'string' ||
      !isCoordinate(latitude, 90) ||
      !isCoordinate(longitude, 180)
    )
      return [];
    const where = [admin1, country].filter(
      (part): part is string => typeof part === 'string',
    );
    return [
      {
        name: typeof country === 'string' ? `${name}, ${country}` : name,
        detail: where.join(', '),
        latitude: roundCoordinate(latitude),
        longitude: roundCoordinate(longitude),
      },
    ];
  });
}

function isCoordinate(value: unknown, limit: number): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
  );
}
