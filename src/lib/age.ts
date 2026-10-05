/**
 * How long ago, briefly, in the browser's language: "5 min", "3 hr", "2 days".
 * `Intl.NumberFormat`'s unit style knows every locale's abbreviations, so there is
 * nothing to translate here.
 */
export function formatAge(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return unit(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  return hours < 48 ? unit(hours, 'hour') : unit(Math.round(hours / 24), 'day');
}

/** A measurement with its unit, as the browser's language writes it: "12 km/h". */
export function unit(value: number, name: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: name,
    unitDisplay: 'short',
  }).format(value);
}
