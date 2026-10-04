/**
 * Ids for profiles and widget instances. They end up in stored config, so they must be
 * stable and unique, but they are never shown to the user and never used as a key into
 * anything external — any collision-free generator will do.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without randomUUID (older jsdom, odd runtimes).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
