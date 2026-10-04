import { newId } from '@/lib/id';
import { CONFIG_VERSION, configSchema, type StillpointConfig } from './schema';

/**
 * A fresh install's config.
 *
 * Built by parsing a minimal literal rather than by writing the tree out by hand: the
 * schema's own defaults fill everything else in, so defaults and validation cannot
 * drift apart. If this function throws, the schema and the defaults disagree — which is
 * exactly the failure we want loud and at startup rather than silent.
 */
export function createDefaultConfig(): StillpointConfig {
  const profileId = newId();

  return configSchema.parse({
    version: CONFIG_VERSION,
    activeProfileId: profileId,
    profiles: [
      {
        id: profileId,
        name: 'Default',
        // A gradient, not a flat colour: a fresh install should already look
        // deliberate, and this needs no network and no user choice.
        background: { kind: 'gradient', from: '#11131c', to: '#1d2033', angle: 160 },
      },
    ],
  });
}
