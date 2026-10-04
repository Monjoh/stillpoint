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
  const clockId = newId();

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
        // Firefox shows "an extension changed your new tab page" with a keep/restore
        // choice, so the first kept tab has to look like something was chosen. An
        // empty canvas with no visible way into edit mode is the worst first run we
        // could ship.
        //
        // The type is a literal rather than an import: widget ids are permanent by
        // rule, and importing the registry here would put every widget definition on
        // the config module's import graph. `defaults.test.ts` asserts it resolves.
        widgets: [
          {
            instanceId: clockId,
            type: 'stillpoint.clock',
            rect: { x: 8, y: 4, w: 8, h: 3 },
          },
        ],
      },
    ],
  });
}
