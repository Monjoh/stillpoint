import { useMemo, useState } from 'react';
import type { WidgetProps } from '@/core/registry/types';
import type { LinksSettings } from './definition';
import { ICON_PATHS, knownMisses, rememberMiss } from './favicon';
import { layoutLinks } from './layout';
import { parseLink, type ParsedLink } from './link';
import styles from './LinksView.module.css';

export default function LinksView({
  settings,
  size,
  isEditing,
}: WidgetProps<LinksSettings>) {
  const links = useMemo(
    () =>
      settings.links
        .map((link) => parseLink(link.url, link.label))
        .filter((link): link is ParsedLink => link !== null),
    [settings.links],
  );

  if (links.length === 0) {
    return (
      <p className={styles.notice}>
        {settings.links.some((link) => link.url.trim())
          ? 'None of these addresses can be opened. Check them in this widget’s settings.'
          : 'Add your sites in this widget’s settings.'}
      </p>
    );
  }

  const layout = layoutLinks({
    count: links.length,
    width: size.width,
    height: size.height,
    mode: settings.layout,
    maxPx: settings.iconSize,
  });

  return (
    <ul
      className={styles.links}
      data-mode={layout.mode}
      style={{
        gridTemplateColumns: `repeat(${layout.columns}, auto)`,
        ['--icon' as string]: `${layout.icon}px`,
      }}
    >
      {links.slice(0, layout.visible).map((link, index) => (
        <li key={`${index}:${link.href}`}>
          <a
            className={styles.link}
            href={link.href}
            target={settings.newTab ? '_blank' : undefined}
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            // Icons alone need their name said, and shown on hover.
            aria-label={layout.mode === 'icons' ? link.label : undefined}
            title={layout.mode === 'icons' ? link.label : undefined}
            // In edit mode a link is something to move, not to follow.
            tabIndex={isEditing ? -1 : undefined}
          >
            <Favicon link={link} />
            {layout.mode !== 'icons' && (
              <span className={styles.label}>{link.label}</span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The site's icon over a letter tile. The letter is always there underneath, so a slow
 * or missing icon shows a tile, never a hole.
 */
function Favicon({ link }: { link: ParsedLink }) {
  const [skip, setSkip] = useState(() =>
    link.local ? ICON_PATHS.length : knownMisses(link.origin),
  );
  const [loaded, setLoaded] = useState(false);
  const path = ICON_PATHS[skip];

  return (
    <span className={styles.icon} aria-hidden="true">
      <span className={styles.letter}>{link.label.charAt(0).toUpperCase()}</span>
      {path && (
        <img
          key={path}
          className={styles.image}
          data-loaded={loaded || undefined}
          src={`${link.origin}${path}`}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={(event) => {
            // Some sites answer a missing icon with a 1×1 pixel or a tiny placeholder.
            if (event.currentTarget.naturalWidth < 8) {
              rememberMiss(link.origin, skip + 1);
              setSkip(skip + 1);
            } else setLoaded(true);
          }}
          onError={() => {
            rememberMiss(link.origin, skip + 1);
            setSkip(skip + 1);
          }}
        />
      )}
    </span>
  );
}
