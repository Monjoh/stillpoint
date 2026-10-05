/**
 * Yahoo Finance sends no CORS headers, so the extension may read it only with a host
 * permission, asked for when the user first sees the widget. Imported by
 * `wxt.config.ts` too, which lists it under `optional_host_permissions`. This file
 * must stay free of imports for that reason.
 */
export const YAHOO_ORIGIN = 'https://query1.finance.yahoo.com/*';
