import { clockDefinition } from '@/widgets/clock/definition';
import { dateDefinition } from '@/widgets/date/definition';
import { linksDefinition } from '@/widgets/links/definition';
import { quoteDefinition } from '@/widgets/quote/definition';
import { searchDefinition } from '@/widgets/search/definition';
import { stocksDefinition } from '@/widgets/stocks/definition';
import { weatherDefinition } from '@/widgets/weather/definition';
import { createRegistry } from './registry';
import type { AnyWidgetDefinition } from './types';

/**
 * Every widget in the build. Adding one costs exactly this: an import and an array
 * entry, on top of its own folder. If it ever costs more, that is a finding about the
 * widget API — record it and fix the API, not the widget.
 */
export const widgetDefinitions = [
  clockDefinition,
  dateDefinition,
  quoteDefinition,
  searchDefinition,
  linksDefinition,
  weatherDefinition,
  stocksDefinition,
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
