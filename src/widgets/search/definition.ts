import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';
import { ENGINES, type EngineId } from './engines';

const engineIds = [...(Object.keys(ENGINES) as EngineId[]), 'custom'] as const;

export const searchSettingsSchema = z.object({
  engine: z
    .enum(engineIds)
    .default('duckduckgo')
    .meta(
      field({
        label: 'Engine',
        control: 'select',
        options: {
          ...Object.fromEntries(
            Object.entries(ENGINES).map(([id, engine]) => [id, engine.name]),
          ),
          custom: 'Other…',
        },
      }),
    ),

  customUrl: z
    .string()
    .max(500)
    .default('')
    .meta(
      field({
        label: 'Search address',
        help: 'The address of a results page, with %s where the words go. For example https://example.com/search?q=%s',
        showIf: { field: 'engine', equals: 'custom' },
      }),
    ),

  newTab: z
    .boolean()
    .default(false)
    .meta(field({ label: 'Open results in a new tab' })),

  autofocus: z
    .boolean()
    .default(true)
    .meta(
      field({
        label: 'Focus on open',
        help: 'Browsers usually keep the cursor in the address bar on a new tab. Press / to jump to the search box at any time.',
      }),
    ),

  fontSize: z
    .number()
    .min(12)
    .max(48)
    .default(18)
    .meta(
      field({
        label: 'Size',
        control: 'slider',
        step: 1,
        unit: 'px',
        help: 'An upper limit. The box shrinks to fit when its cell is too small.',
      }),
    ),
});

export type SearchSettings = z.infer<typeof searchSettingsSchema>;

export const searchDefinition: WidgetDefinition<SearchSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.search',
  name: 'Search',
  description: 'A search box for the engine of your choice.',
  category: 'navigation',
  icon: 'M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z M15.5 15.5 20 20',
  settingsSchema: searchSettingsSchema,
  defaultSize: { w: 8, h: 1 },
  minSize: { w: 3, h: 1 },
  component: () => import('./SearchView'),
};
