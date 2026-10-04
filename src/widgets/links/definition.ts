import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

export const linksSettingsSchema = z.object({
  links: z
    .array(
      z.object({
        url: z
          .string()
          .max(2000)
          .default('')
          .meta(field({ label: 'Address', help: 'For example github.com' })),
        label: z
          .string()
          .max(60)
          .default('')
          .meta(field({ label: 'Name', help: 'Leave empty to show the address.' })),
      }),
    )
    .max(48)
    .default([])
    .meta(field({ label: 'Links' })),

  layout: z
    .enum(['tiles', 'icons', 'list'])
    .default('tiles')
    .meta(
      field({
        label: 'Layout',
        control: 'segmented',
        options: { tiles: 'Tiles', icons: 'Icons', list: 'List' },
      }),
    ),

  newTab: z
    .boolean()
    .default(false)
    .meta(field({ label: 'Open in a new tab' })),

  iconSize: z
    .number()
    .min(16)
    .max(96)
    .default(48)
    .meta(
      field({
        label: 'Size',
        control: 'slider',
        step: 2,
        unit: 'px',
        help: 'An upper limit. Icons shrink to fit their cell, and names are dropped first.',
      }),
    ),
});

export type LinksSettings = z.infer<typeof linksSettingsSchema>;

export const linksDefinition: WidgetDefinition<LinksSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.links',
  name: 'Links',
  description: 'Your sites, one click away, with their icons.',
  category: 'navigation',
  icon: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  settingsSchema: linksSettingsSchema,
  defaultSize: { w: 8, h: 2 },
  minSize: { w: 2, h: 1 },
  component: () => import('./LinksView'),
};
