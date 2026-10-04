/**
 * What a user typed into a link row, made into something safe to put in an `href`.
 *
 * "github.com" means https://github.com: nobody types the scheme. Anything that is not
 * http(s) is refused, which is what keeps `javascript:` and `data:` out of the page.
 */

export interface ParsedLink {
  href: string;
  origin: string;
  host: string;
  label: string;
}

const SCHEME = /^[a-z][a-z\d+.-]*:/i;

export function parseLink(rawUrl: string, rawLabel = ''): ParsedLink | null {
  const typed = rawUrl.trim();
  if (!typed) return null;
  let url: URL;
  try {
    url = new URL(
      SCHEME.test(typed) && !/^[^:]+:\d/.test(typed) ? typed : `https://${typed}`,
    );
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname)
    return null;

  const host = url.hostname.replace(/^www\./, '');
  return { href: url.href, origin: url.origin, host, label: rawLabel.trim() || host };
}
