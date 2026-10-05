import { i18n } from '#i18n';
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
        label: i18n.t('widget.search.engine.label'),
        control: 'select',
        options: {
          ...Object.fromEntries(
            Object.entries(ENGINES).map(([id, engine]) => [id, engine.name]),
          ),
          custom: i18n.t('widget.search.engine.option.custom'),
        },
      }),
    ),

  customUrl: z
    .string()
    .max(500)
    .default('')
    .meta(
      field({
        label: i18n.t('widget.search.customUrl.label'),
        help: i18n.t('widget.search.customUrl.help'),
        showIf: { field: 'engine', equals: 'custom' },
      }),
    ),

  newTab: z
    .boolean()
    .default(false)
    .meta(field({ label: i18n.t('widget.search.newTab.label') })),

  autofocus: z
    .boolean()
    .default(true)
    .meta(
      field({
        label: i18n.t('widget.search.autofocus.label'),
        help: i18n.t('widget.search.autofocus.help'),
      }),
    ),

  fontSize: z
    .number()
    .min(12)
    .max(48)
    .default(18)
    .meta(
      field({
        label: i18n.t('widget.search.fontSize.label'),
        control: 'slider',
        step: 1,
        unit: 'px',
        help: i18n.t('widget.search.fontSize.help'),
      }),
    ),
});

export type SearchSettings = z.infer<typeof searchSettingsSchema>;

export const searchDefinition: WidgetDefinition<SearchSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.search',
  name: i18n.t('widget.search.name'),
  description: i18n.t('widget.search.description'),
  category: 'navigation',
  icon: 'M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z M15.5 15.5 20 20',
  settingsSchema: searchSettingsSchema,
  defaultSize: { w: 8, h: 1 },
  minSize: { w: 3, h: 1 },
  component: () => import('./SearchView'),
};
