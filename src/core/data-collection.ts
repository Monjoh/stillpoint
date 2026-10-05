/**
 * Firefox's data-collection categories that Stillpoint may ask for, and only when a
 * feature that sends them is used: Weather sends a place to Open-Meteo, an Unsplash
 * search sends its words to Unsplash. Nothing is sent to the developer.
 *
 * Imported by `wxt.config.ts`, which lists these under the manifest's optional
 * `data_collection_permissions`. This file must stay free of imports for that reason.
 * A category asked for at runtime but missing from the manifest is refused without a
 * prompt, which is why `DataCollection` is derived from this list: a widget cannot
 * name a category the manifest does not declare.
 */
export const OPTIONAL_DATA_COLLECTION = ['locationInfo', 'searchTerms'] as const;

export type DataCollection = (typeof OPTIONAL_DATA_COLLECTION)[number];
