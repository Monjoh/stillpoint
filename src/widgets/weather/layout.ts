import { lineWidthEm } from '@/lib/fit-text';

/**
 * Which lines fit, and how big the temperature can be. Solved from the frame's content
 * box (the `size` prop), as the quote and links are.
 *
 * The temperature is what the widget is for, so it is the last thing to give way. As
 * the cell shrinks the next days go first, then the details, then the summary line;
 * only then does the temperature get smaller than asked (docs/07-widget-design.md:
 * degrade by dropping, not by squeezing).
 */

export interface WeatherLayout {
  tempPx: number;
  /** Secondary text, in px: the summary, details and the next days. */
  smallPx: number;
  showSummary: boolean;
  showDetails: boolean;
  showForecast: boolean;
}

const LINE = 1.4;
/** A day of the forecast: its name, an icon and two temperatures, stacked. */
const FORECAST_LINES = 3.6;
/** The width one forecast day needs, in multiples of the small text size. */
const FORECAST_DAY_EM = 5;
/** The icon beside the temperature, plus the gap, in em of the temperature. */
const ICON_EM = 1.15;

export function layoutWeather(input: {
  width: number;
  height: number;
  maxPx: number;
  /** The temperature as it will be shown, e.g. "-12°". */
  temperature: string;
  details: boolean;
  forecastDays: number;
}): WeatherLayout {
  const { width, height } = input;
  const smallPx = Math.round(clamp(Math.min(width * 0.045, height * 0.09), 11, 16));
  const gap = smallPx * 0.6;
  const widthBound = width / (lineWidthEm(input.temperature) + ICON_EM);
  // Lines are kept only while the temperature stays at least half the size asked for:
  // a forecast under a cramped temperature is the wrong way round.
  const minTemp = Math.max(24, smallPx * 2.5, input.maxPx * 0.5);

  const forecastFits = input.forecastDays * FORECAST_DAY_EM * smallPx <= width;
  const candidates: [summary: boolean, details: boolean, forecast: boolean][] = [
    [true, input.details, input.forecastDays > 0 && forecastFits],
    [true, input.details, false],
    [true, false, false],
    [false, false, false],
  ];

  for (const [summary, details, forecast] of candidates) {
    const lines =
      (summary ? LINE : 0) + (details ? LINE : 0) + (forecast ? FORECAST_LINES : 0);
    const gaps = [summary, details, forecast].filter(Boolean).length * gap;
    const room = height - lines * smallPx - gaps;
    const tempPx = Math.floor(Math.min(input.maxPx, room / 1.05, widthBound));
    if (tempPx >= minTemp || (!summary && !details && !forecast)) {
      return {
        tempPx: Math.max(12, tempPx),
        smallPx,
        showSummary: summary,
        showDetails: details,
        showForecast: forecast,
      };
    }
  }
  /* c8 ignore next */
  throw new Error('unreachable');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
