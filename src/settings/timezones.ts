/**
 * IANA zone names for the timezone control's suggestions.
 *
 * `Intl.supportedValuesOf` is the browser's own list, which is both more current than
 * anything we could bundle and free — Firefox 93+ and Chrome 99+, so every target has
 * it. The fallback is not a shipped database but a short list of common zones: the
 * field is free text, so suggestions missing costs convenience, not capability.
 */
let cached: string[] | null = null;

export function timezoneNames(): string[] {
  if (cached) return cached;
  try {
    cached = Intl.supportedValuesOf('timeZone');
  } catch {
    cached = FALLBACK;
  }
  return cached;
}

const FALLBACK = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Africa/Cairo',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];
