import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

/**
 * About four pages. The textarea refuses more, so a stored note never exceeds it: an
 * over-long one (a hand-edited import) would fail the schema and be repaired to empty.
 */
export const NOTE_MAX_LENGTH = 10_000;

export const notesSettingsSchema = z.object({
  // Typed on the canvas, saved through `updateSettings`; not a panel field. In the
  // settings rather than its own storage key so it travels with the profile and the
  // export, like everything else the user made.
  text: z.string().max(NOTE_MAX_LENGTH).default('').meta({ hidden: true }),

  fontSize: z
    .number()
    .min(12)
    .max(40)
    .default(16)
    .meta(
      field({
        label: i18n.t('widget.notes.fontSize.label'),
        control: 'slider',
        step: 1,
        unit: 'px',
        help: i18n.t('widget.notes.fontSize.help'),
      }),
    ),
});

export type NotesSettings = z.infer<typeof notesSettingsSchema>;

export const notesDefinition: WidgetDefinition<NotesSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.notes',
  name: i18n.t('widget.notes.name'),
  description: i18n.t('widget.notes.description'),
  category: 'productivity',
  icon: 'M6 4h9l3 3v13H6z M15 4v3h3 M9 11h6 M9 15h6',
  settingsSchema: notesSettingsSchema,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 3, h: 2 },
  component: () => import('./NotesView'),
};
