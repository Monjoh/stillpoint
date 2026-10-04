import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from './__fixtures__/open-meteo';
import { roundCoordinate, searchPlaces } from './geocode';

describe('searchPlaces', () => {
  it('names each place with its country, and keeps the region to tell them apart', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        results: [
          {
            name: 'Paris',
            latitude: 48.85341,
            longitude: 2.3488,
            country: 'France',
            admin1: 'Île-de-France',
          },
          {
            name: 'Paris',
            latitude: 33.66094,
            longitude: -95.55551,
            country: 'United States',
            admin1: 'Texas',
          },
        ],
      }),
    );
    const places = await searchPlaces(' Paris ', undefined, fetcher, 'fr-FR');
    expect(places).toEqual([
      {
        name: 'Paris, France',
        detail: 'Île-de-France, France',
        latitude: 48.85,
        longitude: 2.35,
      },
      {
        name: 'Paris, United States',
        detail: 'Texas, United States',
        latitude: 33.66,
        longitude: -95.56,
      },
    ]);
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.searchParams.get('name')).toBe('Paris');
    expect(url.searchParams.get('language')).toBe('fr');
  });

  it('finds nothing when the service has no results', async () => {
    expect(await searchPlaces('zzzz', undefined, async () => jsonResponse({}))).toEqual(
      [],
    );
  });

  it('skips a result without usable coordinates', async () => {
    const places = await searchPlaces('x', undefined, async () =>
      jsonResponse({ results: [{ name: 'Nowhere', latitude: 200, longitude: 0 }] }),
    );
    expect(places).toEqual([]);
  });

  it('says so when the service cannot be reached', async () => {
    await expect(
      searchPlaces('Paris', undefined, async () => {
        throw new TypeError('NetworkError');
      }),
    ).rejects.toThrow('could not be reached');
  });
});

describe('roundCoordinate', () => {
  it('keeps about a kilometre of precision', () => {
    expect(roundCoordinate(48.853412)).toBe(48.85);
    expect(roundCoordinate(-95.55551)).toBe(-95.56);
  });
});
