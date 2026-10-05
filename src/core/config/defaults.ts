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
        // Firefox shows "an extension changed your new tab page" with a keep/restore
        // choice, so the first kept tab has to look like something was chosen. An
        // empty canvas with no visible way into edit mode is the worst first run we
        // could ship. Clock, date and search: useful at once, and none of them needs
        // the network, a key or a location. Weather and Unsplash would ask for one of
        // those before the user has decided to keep the page.
        //
        // The types are literals rather than imports: widget ids are permanent by
        // rule, and importing the registry here would put every widget definition on
        // the config module's import graph. `registry.test.ts` asserts they resolve.
        widgets: [
          {
            instanceId: newId(),
            type: 'stillpoint.clock',
            rect: { x: 8, y: 3, w: 8, h: 3 },
          },
          {
            instanceId: newId(),
            type: 'stillpoint.date',
            rect: { x: 8, y: 6, w: 8, h: 1 },
          },
          {
            instanceId: newId(),
            type: 'stillpoint.search',
            rect: { x: 7, y: 8, w: 10, h: 1 },
            // A focused search box swallows the E shortcut the first-run hint
            // advertises. Firefox keeps the cursor in the address bar anyway.
            settings: { autofocus: false },
          },
        ],
      },
    ],
  });
}
