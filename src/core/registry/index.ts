import { calendarDefinition } from '@/widgets/calendar/definition';
import { clockDefinition } from '@/widgets/clock/definition';
import { countdownDefinition } from '@/widgets/countdown/definition';
import { dateDefinition } from '@/widgets/date/definition';
import { linksDefinition } from '@/widgets/links/definition';
import { notesDefinition } from '@/widgets/notes/definition';
import { quoteDefinition } from '@/widgets/quote/definition';
import { searchDefinition } from '@/widgets/search/definition';
import { stocksDefinition } from '@/widgets/stocks/definition';
import { todoDefinition } from '@/widgets/todo/definition';
import { weatherDefinition } from '@/widgets/weather/definition';
import { worldClocksDefinition } from '@/widgets/worldclocks/definition';
import { createRegistry } from './registry';
import type { AnyWidgetDefinition } from './types';

/**
 * Every widget in the build. Adding one costs exactly this: an import and an array
 * entry, on top of its own folder. If it ever costs more, that is a finding about the
 * widget API — record it and fix the API, not the widget.
 */
export const widgetDefinitions = [
  clockDefinition,
  worldClocksDefinition,
  dateDefinition,
  calendarDefinition,
  countdownDefinition,
  quoteDefinition,
  searchDefinition,
  linksDefinition,
  weatherDefinition,
  stocksDefinition,
  notesDefinition,
  todoDefinition,
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
