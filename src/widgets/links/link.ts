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
  /**
   * On this machine or the local network. Its icon is not fetched: Firefox asks the
   * user before a page reaches a local address, and a router link must not cause a
   * permission prompt on every new tab. It gets the letter tile.
   */
  local: boolean;
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
  return {
    href: url.href,
    origin: url.origin,
    host,
    label: rawLabel.trim() || host,
    local: isLocalHost(url.hostname),
  };
}

/** Loopback, private and link-local addresses, and names only a local network knows. */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.lan') || host.endsWith('.home.arpa'))
    return true;

  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (host.includes(':')) {
    return host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  }
  // A single-label name ("nas", "intranet") only resolves on a local network.
  return !host.includes('.');
}
