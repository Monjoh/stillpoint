import { z } from 'zod';

/**
 * Extension pages run under the default MV3 CSP, which forbids `eval` and the
 * `Function` constructor. zod feature-detects that by calling `Function('')` inside a
 * try/catch and falling back to a slower interpreter — correct, but it means every new
 * tab triggers a blocked-eval CSP violation in the console. Telling zod up front costs
 * nothing: the config tree is a few KB and is parsed once per page.
 *
 * Set here because this module is imported before any schema is built.
 */
z.config({ jitless: true });

/**
 * Bump for ANY shape change, including additive ones, and write a migration.
 * Two releases sharing a version number with different shapes is unrecoverable.
 */
export const CONFIG_VERSION = 1;

/**
 * A position on the canvas in grid cells, not pixels. Both axes are relative:
 * cell size is derived from the viewport at paint time. See docs/02-data-model.md.
 */
export const rectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});

export const frameSchema = z
  .object({
    showBackground: z.boolean().default(false),
    opacity: z.number().min(0).max(1).default(1),
    padding: z.number().min(0).max(64).default(0),
    align: z.enum(['start', 'center', 'end']).default('center'),
  })
  .prefault({});

export const widgetInstanceSchema = z.object({
  instanceId: z.string().min(1),
  /** A registered WidgetDefinition.id. Unknown types are preserved, not dropped. */
  type: z.string().min(1),
  rect: rectSchema,
  /** Validated by the widget's own schema when it loads, not here. */
  settings: z.unknown().default({}),
  frame: frameSchema,
});

/**
 * The grid, and the only part of a profile the user arranges widgets *against*.
 *
 * Carries `.meta()` so the edit panel can draw it with the same generator that draws
 * a widget's settings. Metadata changes nothing about what the schema parses, so this
 * is not a config shape change and needs no migration.
 */
export const layoutSchema = z
  .object({
    // Number fields, not the sliders a min/max pair would otherwise infer. Changing
    // the column count rescales every widget, and rounding to whole cells is lossy,
    // so a slider drag would compound a hundred roundings into a mangled layout.
    // See `setLayout` in canvas/operations.ts.
    columns: z.number().int().min(4).max(48).default(24).meta({
      control: 'number',
      label: 'Columns',
      help: 'How finely a widget can be placed across the page. More columns means finer placement, not smaller widgets.',
    }),
    rows: z
      .number()
      .int()
      .min(4)
      .max(32)
      .default(12)
      .meta({ control: 'number', label: 'Rows' }),
    gap: z.number().int().min(0).max(64).default(12).meta({ label: 'Gap', unit: 'px' }),
    /** Caps canvas width so an ultrawide composes instead of smearing. */
    maxWidth: z.number().int().min(480).nullable().default(1600).meta({
      label: 'Maximum width',
      unit: 'px',
      help: 'Keeps the canvas from smearing across an ultrawide screen. Clear it to use the whole window.',
    }),
  })
  .prefault({});

/**
 * `fontScale` carries `.meta()` so the panel can generate it. `preset` and
 * `overrides` deliberately do not: a preset is chosen from swatches that show what
 * each theme looks like, and a `<select>` of four names shows nothing at all. That
 * is what `control: 'custom'` is for, and the panel places it by hand.
 */
export const themeSchema = z
  .object({
    preset: z.string().default('midnight'),
    /** Sparse token overrides, e.g. { '--sp-accent': '#ff8800' }. */
    overrides: z.record(z.string(), z.string()).default({}),
    fontScale: z.number().min(0.6).max(2).default(1).meta({
      label: 'Text size',
      step: 0.05,
      help: 'Scales every widget’s type together. The one control that makes the whole page bigger.',
    }),
  })
  .prefault({});

export const backgroundSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('solid'),
    color: z.string().min(1),
  }),
  z.object({
    kind: z.literal('gradient'),
    from: z.string().min(1),
    to: z.string().min(1),
    angle: z.number().min(0).max(360).default(160),
  }),
  z.object({
    kind: z.literal('image'),
    /** Key into the asset store. Never a data: URI — see docs/02-data-model.md. */
    assetId: z.string().min(1),
    fit: z.enum(['cover', 'contain']).default('cover'),
    blur: z.number().min(0).max(40).default(0),
    dim: z.number().min(0).max(1).default(0),
  }),
  z.object({
    kind: z.literal('unsplash'),
    query: z.string().default('landscape'),
    refresh: z.enum(['tab', 'hourly', 'daily']).default('daily'),
    blur: z.number().min(0).max(40).default(0),
    dim: z.number().min(0).max(1).default(0),
  }),
]);

export const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  layout: layoutSchema,
  theme: themeSchema,
  background: backgroundSchema,
  widgets: z.array(widgetInstanceSchema).default([]),
  /** Reserved for post-v1 automatic switching. Always null in v1. */
  activation: z.null().default(null),
});

/**
 * Global settings, edited on the options page by the same generator that draws a
 * widget's panel — it only needs an object with a zod schema, and this is one.
 *
 * Fields marked `hidden` are carried but not offered: either internal state, or an
 * option for a feature that does not exist yet. A control that does nothing teaches
 * the user less than no control at all.
 */
export const appSettingsSchema = z
  .object({
    locale: z
      .string()
      .default('en')
      // Nothing reads this yet — the clock formats with the browser's own locale.
      // Offered to the user when something does. See M5.
      .meta({ label: 'Language', hidden: true }),
    /** User-supplied; Unsplash backgrounds are off until it is set. */
    unsplashAccessKey: z
      .string()
      .nullable()
      .default(null)
      // Unsplash backgrounds are M4. Shown when there is something for a key to do.
      .meta({ label: 'Unsplash access key', hidden: true }),
    hasCompletedFirstRun: z
      .boolean()
      .default(false)
      .meta({ label: 'Has completed first run', hidden: true }),
    editModeEnabled: z.boolean().default(true).meta({
      label: 'Allow editing the layout',
      help: 'Turn this off to lock the canvas. The “Edit layout” button and the E shortcut stop responding.',
    }),
  })
  .prefault({});

export const configSchema = z
  .object({
    version: z.literal(CONFIG_VERSION),
    activeProfileId: z.string().min(1),
    profiles: z.array(profileSchema).min(1),
    app: appSettingsSchema,
  })
  .refine((c) => c.profiles.some((p) => p.id === c.activeProfileId), {
    error: 'activeProfileId does not match any profile',
    path: ['activeProfileId'],
  })
  .refine((c) => new Set(c.profiles.map((p) => p.id)).size === c.profiles.length, {
    error: 'profile ids must be unique',
    path: ['profiles'],
  });

export type Rect = z.infer<typeof rectSchema>;
export type FrameStyle = z.infer<typeof frameSchema>;
export type WidgetInstance = z.infer<typeof widgetInstanceSchema>;
export type LayoutConfig = z.infer<typeof layoutSchema>;
export type ThemeConfig = z.infer<typeof themeSchema>;
export type BackgroundConfig = z.infer<typeof backgroundSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type StillpointConfig = z.infer<typeof configSchema>;
