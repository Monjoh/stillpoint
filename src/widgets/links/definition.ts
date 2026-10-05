import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

/** A folder holds links, never folders: one level deep. */
export const FOLDER_MAX_LINKS = 24;

const url = z
  .string()
  .max(2000)
  .default('')
  .meta(
    field({
      label: i18n.t('widget.links.links.row.url.label'),
      help: i18n.t('widget.links.links.row.url.help'),
    }),
  );

const label = z
  .string()
  .max(60)
  .default('')
  .meta(
    field({
      label: i18n.t('widget.links.links.row.label.label'),
      help: i18n.t('widget.links.links.row.label.help'),
    }),
  );

const onlyFor = (kind: 'link' | 'folder') => ({ field: 'kind', equals: kind });

export const linksSettingsSchema = z.object({
  // A row is a link or a folder. Both shapes share one object, rather than a union
  // the generator can't draw, and `showIf` shows each kind its own fields. A folder
  // keeps its `url`, and a link its `links`, so switching back loses nothing.
  links: z
    .array(
      z.object({
        kind: z
          .enum(['link', 'folder'])
          .default('link')
          .meta(
            field({
              label: i18n.t('widget.links.links.row.kind.label'),
              control: 'segmented',
              options: {
                link: i18n.t('widget.links.links.row.kind.option.link'),
                folder: i18n.t('widget.links.links.row.kind.option.folder'),
              },
            }),
          ),
        url: url.meta({ ...url.meta(), showIf: onlyFor('link') }),
        label: label.meta({ ...label.meta(), showIf: onlyFor('link') }),
        name: z
          .string()
          .max(60)
          .default('')
          .meta(
            field({
              label: i18n.t('widget.links.links.row.name.label'),
              help: i18n.t('widget.links.links.row.name.help'),
              showIf: onlyFor('folder'),
            }),
          ),
        links: z
          .array(z.object({ url, label }))
          .max(FOLDER_MAX_LINKS)
          .default([])
          .meta(
            field({
              label: i18n.t('widget.links.links.row.links.label'),
              itemLabel: i18n.t('widget.links.links.itemLabel'),
              showIf: onlyFor('folder'),
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
