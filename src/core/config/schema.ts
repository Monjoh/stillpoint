import { i18n } from '#i18n';
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
export const CONFIG_VERSION = 5;

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

/**
 * How a widget sits in its cell — per instance, and the same for every widget type.
 *
 * The frame decides *whether* a widget has a card and where its content sits; the
 * theme decides what a card *looks like*. That split is what keeps a page coherent:
 * a widget can never pick its own corner radius or shadow, so every card on the page
 * matches and a theme switch restyles them all. See docs/07-widget-design.md.
 *
 * Rendered by the panel below every widget's own settings, so no widget author has
 * to remember it. `.meta()` only — no shape change.
 */
export const frameSchema = z
  .object({
    showBackground: z
      .boolean()
      .default(false)
      .meta({
        label: i18n.t('config.frame.card.label'),
        help: i18n.t('config.frame.card.help'),
      }),
    align: z
      .enum(['start', 'center', 'end'])
      .default('center')
      .meta({
        label: i18n.t('config.frame.align.label'),
        control: 'segmented',
        options: {
          start: i18n.t('config.frame.align.start'),
          center: i18n.t('config.frame.align.center'),
          end: i18n.t('config.frame.align.end'),
        },
      }),
    // Percent, with a floor: at 0 a widget was invisible and nearly impossible to
    // find again. Config v3; v2 stored a 0–1 fraction.
    opacity: z
      .number()
      .int()
      .min(20)
      .max(100)
      .default(100)
      .meta({ label: i18n.t('config.frame.opacity.label'), step: 5, unit: '%' }),
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
    columns: z
      .number()
      .int()
      .min(4)
      .max(48)
      .default(24)
      .meta({
        control: 'number',
        label: i18n.t('config.layout.columns.label'),
        help: i18n.t('config.layout.columns.help'),
      }),
    rows: z
      .number()
      .int()
      .min(4)
      .max(32)
      .default(12)
      .meta({ control: 'number', label: i18n.t('config.layout.rows.label') }),
    gap: z
      .number()
      .int()
      .min(0)
      .max(64)
      .default(12)
      .meta({ label: i18n.t('config.layout.gap.label'), unit: 'px' }),
    /** Caps canvas width so an ultrawide composes instead of smearing. */
    maxWidth: z
      .number()
      .int()
      .min(480)
      .nullable()
      .default(1600)
      .meta({
        label: i18n.t('config.layout.maxWidth.label'),
        unit: 'px',
        help: i18n.t('config.layout.maxWidth.help'),
      }),
  })
  .prefault({});

/**
 * `preset` and `overrides` deliberately carry no `.meta()`: a preset is chosen from
 * swatches that show what each theme looks like, and a `<select>` of four names shows
 * nothing at all. That is what `control: 'custom'` is for, and the panel places it by
 * hand.
 *
 * There is no page-wide text size. v1 had `fontScale`, a multiplier over every widget's
 * type, and it duplicated the size each widget already sets for itself — two controls
 * for one thing, with the global one silently overruling the local one. Removed in v2.
 */
export const themeSchema = z
  .object({
    preset: z.string().default('midnight'),
    /** Sparse token overrides, e.g. { '--sp-accent': '#ff8800' }. */
    overrides: z.record(z.string(), z.string()).default({}),
  })
  .prefault({});

/**
 * A photograph. Its own export so the panel can generate fit, blur and dim from it —
 * `kind` and `assetId` are hidden, since the upload sets both. `.meta()` only: no
 * shape change.
 */
export const imageBackgroundSchema = z.object({
  kind: z.literal('image').meta({ hidden: true }),
  /** Key into the asset store. Never a data: URI — see docs/02-data-model.md. */
  assetId: z.string().min(1).meta({ hidden: true }),
  fit: z
    .enum(['cover', 'contain'])
    .default('cover')
    .meta({
      label: i18n.t('config.image.fit.label'),
      control: 'segmented',
      options: {
        cover: i18n.t('config.image.fit.cover'),
        contain: i18n.t('config.image.fit.contain'),
      },
    }),
  blur: z
    .number()
    .min(0)
    .max(40)
    .default(0)
    .meta({ label: i18n.t('config.photo.blur'), unit: 'px' }),
  dim: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .meta({
      label: i18n.t('config.photo.dim'),
      step: 0.05,
      help: i18n.t('config.photo.dimHelp'),
    }),
});

/**
 * A photograph from the web, picked at random and rotated: from Lorem Picsum (a
 * curated set of Unsplash photos, no key, no search) or from the Unsplash API (the
 * user's key, with search). The same export-and-hide arrangement as
 * `imageBackgroundSchema`.
 *
 * `kind` stays `'unsplash'` for both, since it is permanent in stored configs and the
 * rotation, paint cache and credit are shared. `source` was added in v4: before it,
 * which service answered depended on whether a key happened to be saved, and the user
 * could not tell which one they were looking at.
 */
export const unsplashBackgroundSchema = z.object({
  kind: z.literal('unsplash').meta({ hidden: true }),
  source: z.enum(['picsum', 'unsplash']).default('picsum').meta({ hidden: true }),
  query: z
    .string()
    .default('landscape')
    .meta({
      label: i18n.t('config.web.query.label'),
      help: i18n.t('config.web.query.help'),
    }),
  refresh: z
    .enum(['tab', 'hourly', 'daily'])
    .default('daily')
    .meta({
      label: i18n.t('config.web.refresh.label'),
      control: 'segmented',
      options: {
        tab: i18n.t('config.web.refresh.tab'),
        hourly: i18n.t('config.web.refresh.hourly'),
        daily: i18n.t('config.web.refresh.daily'),
      },
      help: i18n.t('config.web.refresh.help'),
    }),
  blur: z
    .number()
    .min(0)
    .max(40)
    .default(0)
    .meta({ label: i18n.t('config.photo.blur'), unit: 'px' }),
  dim: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .meta({
      label: i18n.t('config.photo.dim'),
      step: 0.05,
      help: i18n.t('config.photo.dimHelp'),
    }),
});

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
  imageBackgroundSchema,
  unsplashBackgroundSchema,
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
      .meta({ label: i18n.t('config.app.locale.label'), hidden: true }),
    /** User-supplied. Without it, Unsplash backgrounds use Lorem Picsum. */
    unsplashAccessKey: z
      .string()
      .nullable()
      .default(null)
      .meta({
        label: i18n.t('config.app.unsplashKey.label'),
        help: i18n.t('config.app.unsplashKey.help'),
      }),
    hasCompletedFirstRun: z
      .boolean()
      .default(false)
      .meta({ label: i18n.t('config.app.firstRun.label'), hidden: true }),
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
export type ImageBackground = z.infer<typeof imageBackgroundSchema>;
export type UnsplashBackground = z.infer<typeof unsplashBackgroundSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type StillpointConfig = z.infer<typeof configSchema>;
