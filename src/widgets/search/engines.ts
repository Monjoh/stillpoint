/**
 * Where a search goes. A plain URL per engine, with `%s` for the words: the widget
 * submits by navigating, so it needs no permission and sends nothing until the user
 * presses Enter. No suggestions, for the same reason: they would send every keystroke.
 *
 * Firefox's own `browser.search` would use the browser's default engine, but it is
 * Firefox-only and needs a permission. See docs/decisions (ADR-0003).
 */
export const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=%s' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s' },
  kagi: { name: 'Kagi', url: 'https://kagi.com/search?q=%s' },
} as const;

export type EngineId = keyof typeof ENGINES;

/** A custom address must be http(s) and say where the words go. */
export function isSearchTemplate(template: string): boolean {
  if (!template.includes('%s')) return false;
  try {
    const url = new URL(template.replace(/%s/g, 'x'));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** The address for a search, or null when there is nothing to search or nowhere to go. */
export function searchUrl(template: string, query: string): string | null {
  const words = query.trim();
  if (!words || !isSearchTemplate(template)) return null;
  return template.replace(/%s/g, encodeURIComponent(words));
}
