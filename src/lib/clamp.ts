/**
 * Clamp `value` into the inclusive range [`min`, `max`].
 *
 * Numbers reaching a control can come from a hand-edited config or an imported JSON
 * file, so "trust the schema" is not enough on its own — `NaN` resolves to `min`
 * rather than propagating.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
