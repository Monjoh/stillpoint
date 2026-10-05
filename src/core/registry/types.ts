import type { ComponentType } from 'react';
import type { z } from 'zod';

/**
 * The widget contract. See docs/03-widget-api.md — changes here are ADR-worthy.
 *
 * Note what a widget does NOT receive: no `onSettingsChange`, no store access, no
 * `instanceId`, no theme object. A widget is a pure function of its props. Settings are
 * written by the settings panel, theming arrives as CSS custom properties, and position
 * is the canvas's business.
 */

export type WidgetCategory =
  'time' | 'info' | 'navigation' | 'productivity' | 'decoration';

export type ResourceState<D> =
  /** Nothing cached yet; a fetch is in flight. */
  | { status: 'empty' }
  | { status: 'ready'; data: D; fetchedAt: number; stale: boolean }
  /** May still carry stale data — showing yesterday's weather beats a spinner. */
  | { status: 'error'; error: string; data?: D; fetchedAt?: number };

export interface DataSourceSpec<S, D> {
  /**
   * Cache identity. Every setting that changes the result must appear here. `null`
   * means there is nothing to fetch yet, because the widget is not configured. The
   * widget then renders with `data` undefined and says what it needs.
   */
  key: (settings: S) => string | null;
  /**
   * Throw an `Error` whose message the user can read. It is shown as is, under any
   * data still cached. Keep the network code behind a dynamic `import()` in here: the
   * definition is on the new tab's critical path, and the fetch must not be.
   */
  fetch: (settings: S, signal: AbortSignal) => Promise<D>;
  /** Serve cached data for this long before revalidating. */
  ttlMs: number;
  /** Beyond this, cached data is too old to show at all. */
  maxAgeMs?: number;
}

export interface WidgetProps<S, D = unknown> {
  settings: S;
  /** The frame's content box in px, for widgets that scale their own type. */
  size: { width: number; height: number };
  /** True while the canvas is in edit mode: suppress autofocus, hide interactions. */
  isEditing: boolean;
  /**
   * Resolved `dataSource` state: `ready` or `error`, never `empty`, which the frame
   * draws as a skeleton itself. `undefined` when the widget declares no data source,
   * or its `key` is null.
   */
  data?: ResourceState<D>;
}

export interface WidgetDefinition<S = unknown, D = unknown> {
  /** Stable, namespaced, never changes once released — it is part of stored config. */
  id: string;
  name: string;
  description: string;
  category: WidgetCategory;
  /** Inline SVG path data for the picker, drawn on a 24×24 viewBox. No icon library. */
  icon: string;

  /** Single source of truth for this widget's settings, and for its settings UI. */
  settingsSchema: z.ZodType<S>;

  /** Grid units. */
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };

  /** Lazy — only configured widget types are ever fetched. */
  component: () => Promise<{ default: ComponentType<WidgetProps<S, D>> }>;

  /**
   * Declarative async data. Omit for widgets that need no network. Fetched, cached and
   * revalidated by `core/data/resource.ts`, never by the widget.
   */
  dataSource?: DataSourceSpec<S, D>;

  /**
   * Host origins the data source needs, given these settings, for a service that
   * sends no CORS headers. Each must also be under `optional_host_permissions` in
   * `wxt.config.ts`. Until they are granted, the frame fetches nothing and shows an
   * Allow button in their place (see `core/permissions.ts`).
   */
  origins?: (settings: S) => readonly string[];
}

/**
 * A definition with its settings type erased, which is what a heterogeneous registry
 * has to store. `unknown` cannot stand in here: `component` is contravariant in `S`, so
 * `WidgetDefinition<ClockSettings>` is not assignable to `WidgetDefinition<unknown>`.
 *
 * This is one of the project's few deliberate `any`s. It is contained to this alias —
 * everything that reads a definition back out goes through `WidgetFrame`, which
 * re-validates settings against the schema before they reach the component.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWidgetDefinition = WidgetDefinition<any, any>;

/**
 * What the generator has worked out about a field, handed to whichever control renders
 * it. A control reads this rather than the schema: it is the generator's job to know
 * what zod means, and a control's job to be a good input.
 */
export interface ControlField {
  label: string;
  help?: string;
  /** Suffix shown next to the value, e.g. `px`. Presentational only. */
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  /** Already resolved to display labels; `FieldMeta.options` is the raw form. */
  options?: { value: string; label: string }[];
  /** When true the control may emit `null` — "unset" is a value the schema allows. */
  nullable: boolean;
}

/**
 * The contract for a settings control, including a widget's own `control: 'custom'`
 * one. It lives here rather than in `src/settings` for a boundary reason: a widget may
 * import from `src/core` and `src/lib` only, so a custom control could not name its
 * own props type if it were declared next to the generator.
 *
 * The control renders the input and nothing else. The label, the help text and the
 * `id` wiring are the generator's, so that every field gets them whether or not the
 * control's author remembered — see docs/04-design-system.md.
 */
export interface ControlProps<T> {
  /** Must land on the control's focusable element; the generated `<label>` points at it. */
  id: string;
  value: T;
  onChange: (next: T) => void;
  field: ControlField;
}

/**
 * Presentation hints attached to a settings field with zod's `.meta()`, read back by
 * the generator in M3. Declared here so widget authors get completion and type
 * checking on `.meta()` today, before the generator exists.
 *
 * A type alias rather than an interface, and not by preference: zod's `.meta()` takes
 * a record with an index signature, and TypeScript gives an implicit index signature
 * to object type aliases but never to interfaces. As an interface this does not
 * compile.
 */
export type FieldMeta = {
  label: string;
  help?: string;
  control?:
    | 'slider'
    /** Opt out of the slider a min/max pair would otherwise infer. */
    | 'number'
    | 'select'
    | 'segmented'
    | 'color'
    | 'font'
    | 'timezone'
    | 'textarea'
    | 'custom';
  /** Human labels for enum values, keyed by value. */
  options?: Record<string, string>;
  step?: number;
  unit?: string;
  /** Show this field only when another field has a given value. */
  showIf?: { field: string; equals: unknown };
  /** `control: 'custom'` — the widget supplies its own control component. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component?: ComponentType<ControlProps<any>>;
  /** Group fields under a collapsible heading. */
  group?: string;
  order?: number;
  /**
   * Skip this field in generated forms. For state the schema has to carry but the
   * user has no business editing — a first-run flag, a cache stamp — and for fields
   * belonging to a feature that is not built yet. A control for something that does
   * nothing teaches the user less than no control at all.
   */
  hidden?: boolean;
};

/**
 * Identity function that type-checks a `.meta()` payload as a `FieldMeta`.
 * zod's `.meta()` accepts an open record, so without this a typo in `lable` is silent.
 */
export function field(meta: FieldMeta): FieldMeta {
  return meta;
}
