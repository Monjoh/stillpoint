import { clockDefinition } from '@/widgets/clock/definition';
import { createRegistry } from './registry';
import type { AnyWidgetDefinition } from './types';

/**
 * Every widget in the build. Adding one costs exactly this: an import and an array
 * entry, on top of its own folder. If it ever costs more, that is a finding about the
 * widget API — record it and fix the API, not the widget.
 */
export const widgetDefinitions = [
  clockDefinition,
] as const satisfies readonly AnyWidgetDefinition[];

/**
 * Built at module load on purpose: the duplicate-id assertion inside `createRegistry`
 * then fires at startup in development rather than the first time someone opens the
 * picker.
 */
export const widgetRegistry = createRegistry(widgetDefinitions);

export { createRegistry, DuplicateWidgetIdError } from './registry';
export type { WidgetRegistry } from './registry';
export * from './types';
