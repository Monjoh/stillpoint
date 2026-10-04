import type { WeatherIcon as Kind } from './codes';

/** Drawn here on a 24×24 grid, stroked in `currentColor`: no icon library, no request. */
const CLOUD = 'M7 18h10.5a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 7.3 10 4 4 0 0 0 7 18Z';
const HIGH_CLOUD =
  'M7 14h10.5a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 7.3 6 4 4 0 0 0 7 14Z';
const SUN =
  'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4';
const MOON = 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z';

const PATHS: Record<Kind, { day: string; night?: string }> = {
  clear: { day: SUN, night: MOON },
  partly: {
    day: 'M8 2.5V4 M2.5 8H4 M4.1 4.1l1 1 M11.9 4.1l-1 1 M5.2 10.2A3 3 0 0 1 10.6 7.3 M9 20h8.5a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 9.3 12 4 4 0 0 0 9 20Z',
    night:
      'M10.5 8.2A3.6 3.6 0 0 1 5.6 3.3a3.6 3.6 0 1 0 4.9 4.9Z M9 20h8.5a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 9.3 12 4 4 0 0 0 9 20Z',
  },
  cloudy: { day: CLOUD },
  fog: { day: 'M5 8h14 M3 12h18 M5 16h14 M8 20h8' },
  drizzle: { day: `${HIGH_CLOUD} M8 18v.5 M12 19.5v.5 M16 18v.5` },
  rain: { day: `${HIGH_CLOUD} M8.5 17l-1 3 M12.5 17l-1 3 M16.5 17l-1 3` },
  snow: {
    day: `${HIGH_CLOUD} M8 18h.01 M12 19h.01 M16 18h.01 M10 21.5h.01 M14 21.5h.01`,
  },
  storm: { day: `${HIGH_CLOUD} M12.5 14.5l-2 3.5h3l-2 3.5` },
};

export function WeatherIcon({ kind, isDay = true }: { kind: Kind; isDay?: boolean }) {
  const { day, night } = PATHS[kind];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={isDay ? day : (night ?? day)} />
    </svg>
  );
}
