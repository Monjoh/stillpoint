/** Its own module so tests can replace it: jsdom cannot navigate. */
export function openUrl(url: string, newTab: boolean): void {
  if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
  else window.location.assign(url);
}
