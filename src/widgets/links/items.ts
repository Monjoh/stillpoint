import { i18n } from '#i18n';
import type { LinksSettings } from './definition';
import { parseLink, type ParsedLink } from './link';

/** What the widget draws in one place on its grid: a link, or a folder of them. */
export type LinkItem =
  | { kind: 'link'; link: ParsedLink }
  | { kind: 'folder'; name: string; links: ParsedLink[] };

/**
 * The rows as they can be shown. A link that can't be opened is skipped, and so is a
 * folder with nothing in it that can: an empty folder is a tile that opens on
 * nothing.
 */
export function linkItems(rows: LinksSettings['links']): LinkItem[] {
  const items: LinkItem[] = [];
  for (const row of rows) {
    if (row.kind === 'folder') {
      const links = parseAll(row.links);
      if (links.length === 0) continue;
      items.push({
        kind: 'folder',
        name: row.name.trim() || i18n.t('widget.links.view.folder'),
        links,
      });
    } else {
      const link = parseLink(row.url, row.label);
      if (link) items.push({ kind: 'link', link });
    }
  }
  return items;
}

/** Whether any row has an address typed into it, opened or not. */
export function anyTyped(rows: LinksSettings['links']): boolean {
  return rows.some((row) =>
    row.kind === 'folder'
      ? row.links.some((link) => link.url.trim())
      : row.url.trim() !== '',
  );
}

function parseAll(rows: { url: string; label: string }[]): ParsedLink[] {
  return rows
    .map((row) => parseLink(row.url, row.label))
    .filter((link): link is ParsedLink => link !== null);
}
