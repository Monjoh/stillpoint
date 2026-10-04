import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchPlaces } from './geocode';
import LocationControl from './LocationControl';

vi.mock('./geocode', async (original) => ({
  ...(await original<typeof import('./geocode')>()),
  searchPlaces: vi.fn(),
}));

const field = { label: 'Place', nullable: true };
const paris = {
  name: 'Paris, France',
  detail: 'Île-de-France, France',
  latitude: 48.85,
  longitude: 2.35,
};

afterEach(() => vi.mocked(searchPlaces).mockReset());

const type = (text: string) =>
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } });

describe('LocationControl', () => {
  it('searches once typing settles, and stores the place picked', async () => {
    vi.mocked(searchPlaces).mockResolvedValue([paris]);
    const onChange = vi.fn();
    render(
      <LocationControl id="place" value={null} onChange={onChange} field={field} />,
    );

    type('Pa');
    type('Par');
    type('Paris');
    fireEvent.click(await screen.findByRole('button', { name: /Paris/ }));

    // One request for the settled word, not one per keystroke.
    expect(searchPlaces).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchPlaces).mock.calls[0]![0]).toBe('Paris');
    expect(onChange).toHaveBeenCalledWith({
      name: 'Paris, France',
      latitude: 48.85,
      longitude: 2.35,
    });
  });

  it('does not search for one letter', async () => {
    render(
      <LocationControl id="place" value={null} onChange={vi.fn()} field={field} />,
    );
    type('P');
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it('says when nothing matches', async () => {
    vi.mocked(searchPlaces).mockResolvedValue([]);
    render(
      <LocationControl id="place" value={null} onChange={vi.fn()} field={field} />,
    );
    type('zzzz');
    expect(await screen.findByText('No place by that name.')).toBeTruthy();
  });

  it('says when the search fails', async () => {
    vi.mocked(searchPlaces).mockRejectedValue(
      new Error('The place search could not be reached.'),
    );
    render(
      <LocationControl id="place" value={null} onChange={vi.fn()} field={field} />,
    );
    type('Paris');
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'The place search could not be reached.',
      ),
    );
  });

  it('shows the chosen place, and its id lands on the Change button', () => {
    render(
      <LocationControl id="place" value={paris} onChange={vi.fn()} field={field} />,
    );
    expect(screen.getByText('Paris, France')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change' }).id).toBe('place');
  });

  it('stores a rounded position from “Use my location”', () => {
    const onChange = vi.fn();
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({
        coords: { latitude: 51.507351, longitude: -0.127758 },
      } as GeolocationPosition),
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    render(
      <LocationControl id="place" value={null} onChange={onChange} field={field} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(onChange).toHaveBeenCalledWith({
      name: 'My location',
      latitude: 51.51,
      longitude: -0.13,
    });
  });
});
