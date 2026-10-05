import { i18n } from '#i18n';
import { z } from 'zod';
import { field, type WidgetDefinition } from '@/core/registry/types';

/**
 * Limits the view enforces, so a stored list never exceeds them. One item that did
 * (a hand-edited import) would fail the schema, and the repair drops the whole field.
 */
export const TODO_MAX_ITEMS = 100;
export const TODO_MAX_TEXT = 300;

const itemSchema = z.object({
  /** Stable across edits, so React keeps focus in the row being typed in. */
  id: z.string().min(1).max(40),
  text: z.string().max(TODO_MAX_TEXT),
  done: z.boolean(),
});

export type TodoItem = z.infer<typeof itemSchema>;

export const todoSettingsSchema = z.object({
  // Edited on the canvas, saved through `updateSettings`; not a panel field.
  items: z.array(itemSchema).max(TODO_MAX_ITEMS).default([]).meta({ hidden: true }),

  hideDone: z
    .boolean()
    .default(false)
    .meta(
      field({
        label: i18n.t('widget.todo.hideDone.label'),
        help: i18n.t('widget.todo.hideDone.help'),
      }),
    ),

  fontSize: z
    .number()
    .min(12)
    .max(32)
    .default(16)
    .meta(
      field({
        label: i18n.t('widget.todo.fontSize.label'),
        control: 'slider',
        step: 1,
        unit: 'px',
        help: i18n.t('widget.todo.fontSize.help'),
      }),
    ),
});

export type TodoSettings = z.infer<typeof todoSettingsSchema>;

export const todoDefinition: WidgetDefinition<TodoSettings> = {
  // Permanent: written into every user's stored config.
  id: 'stillpoint.todo',
  name: i18n.t('widget.todo.name'),
  description: i18n.t('widget.todo.description'),
  category: 'productivity',
  icon: 'M4 6.5l1.5 1.5L8 5.5 M4 12.5l1.5 1.5L8 11.5 M4 18.5l1.5 1.5L8 17.5 M11 7h9 M11 13h9 M11 19h9',
  settingsSchema: todoSettingsSchema,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 3, h: 2 },
  component: () => import('./TodoView'),
};
