import { i18n } from '#i18n';
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
          .meta(
            field({
              label: i18n.t('widget.links.links.row.url.label'),
              help: i18n.t('widget.links.links.row.url.help'),
            }),
          ),
        label: z
          .string()
          .max(60)
          .default('')
          .meta(
            field({
              label: i18n.t('widget.links.links.row.label.label'),
              help: i18n.t('widget.links.links.row.label.help'),
            }),
          ),
      }),
    )
    .max(48)
    .default([])
    .meta(
      field({
        label: i18n.t('widget.links.links.label'),
        itemLabel: i18n.t('widget.links.links.itemLabel'),
      }),
    ),

  layout: z
    .enum(['tiles', 'icons', 'list'])
    .default('tiles')
    .meta(
      field({
        label: i18n.t('widget.links.layout.label'),
        control: 'segmented',
        options: {
          tiles: i18n.t('widget.links.layout.option.tiles'),
          icons: i18n.t('widget.links.layout.option.icons'),
          list: i18n.t('widget.links.layout.option.list'),
        },
      }),
    ),

  newTab: z
    .boolean()
    .default(false)
    .meta(field({ label: i18n.t('widget.links.newTab.label') })),

  iconSize: z
    .number()
    .min(16)
    .max(96)
    .default(48)
    .meta(
      field({
        label: i18n.t('widget.links.iconSize.label'),
        control: 'slider',
        step: 2,
        unit: 'px',
        help: i18n.t('widget.links.iconSize.help'),
      }),
    ),
});

export type LinksSettings = z.infer<typeof linksSettingsSchema>;

export const linksDefinition: WidgetDefinition<LinksSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.links',
  name: i18n.t('widget.links.name'),
  description: i18n.t('widget.links.description'),
  category: 'navigation',
  icon: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  settingsSchema: linksSettingsSchema,
  defaultSize: { w: 8, h: 2 },
  minSize: { w: 2, h: 1 },
  component: () => import('./LinksView'),
};
