import { i18n } from '#i18n';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { WidgetProps } from '@/core/registry/types';
import type { LinksSettings } from './definition';
import { ICON_PATHS, knownMisses, rememberMiss } from './favicon';
import { folderBox, placeFolder } from './folder-layout';
import { anyTyped, linkItems } from './items';
import { layoutLinks, type LinksMode } from './layout';
import type { ParsedLink } from './link';
import styles from './LinksView.module.css';

export default function LinksView({
  settings,
  size,
  isEditing,
}: WidgetProps<LinksSettings>) {
  const items = useMemo(() => linkItems(settings.links), [settings.links]);

  if (items.length === 0) {
    return (
      <p className={styles.notice}>
        {anyTyped(settings.links)
          ? i18n.t('widget.links.view.noneOpen')
          : i18n.t('widget.links.view.empty')}
      </p>
    );
  }

  const layout = layoutLinks({
    count: items.length,
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
      {items.slice(0, layout.visible).map((item, index) => (
        <li key={`${index}:${item.kind === 'link' ? item.link.href : item.name}`}>
          {item.kind === 'link' ? (
            <LinkAnchor
              link={item.link}
              newTab={settings.newTab}
              iconsOnly={layout.mode === 'icons'}
              isEditing={isEditing}
            />
          ) : (
            <Folder
              name={item.name}
              links={item.links}
              iconsOnly={layout.mode === 'icons'}
              // The open folder isn't bound by the cell, so it takes the layout the
              // user chose, not the one a small cell fell back to.
              mode={settings.layout}
              maxPx={settings.iconSize}
              newTab={settings.newTab}
              isEditing={isEditing}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function LinkAnchor({
  link,
  newTab,
  iconsOnly,
  isEditing,
  onFollow,
}: {
  link: ParsedLink;
  newTab: boolean;
  iconsOnly: boolean;
  isEditing: boolean;
  onFollow?: () => void;
}) {
  return (
    <a
      className={styles.link}
      href={link.href}
      target={newTab ? '_blank' : undefined}
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      // Icons alone need their name said, and shown on hover.
      aria-label={iconsOnly ? link.label : undefined}
      title={iconsOnly ? link.label : undefined}
      // In edit mode a link is something to move, not to follow.
      tabIndex={isEditing ? -1 : undefined}
      onClick={onFollow}
    >
      <Favicon link={link} />
      {!iconsOnly && <span className={styles.label}>{link.label}</span>}
    </a>
  );
}

/**
 * A folder: a tile showing its first four icons, which opens its links in a popover
 * beside it. The popover is the browser's own (`popover="auto"`): it is drawn in the
 * top layer, so the frame's clipping and opacity don't reach it, and a click outside
 * or Escape closes it and hands focus back to the tile.
 */
function Folder({
  name,
  links,
  iconsOnly,
  mode,
  maxPx,
  newTab,
  isEditing,
}: {
  name: string;
  links: ParsedLink[];
  iconsOnly: boolean;
  mode: LinksMode;
  maxPx: number;
  newTab: boolean;
  isEditing: boolean;
}) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const box = folderBox({ count: links.length, mode, maxPx, viewport });

  // In edit mode a folder is something to move, not to open.
  useEffect(() => {
    if (isEditing) close(popover.current);
  }, [isEditing]);

  // Into the folder, on its first link, once its links are rendered. Closing hands
  // focus back to the tile on its own.
  useEffect(() => {
    if (open) popover.current?.querySelector('a')?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.link}
        popoverTarget={isEditing ? undefined : id}
        aria-expanded={open}
        aria-label={iconsOnly ? name : undefined}
        title={iconsOnly ? name : undefined}
        tabIndex={isEditing ? -1 : undefined}
        // Runs before the browser opens the popover, so it opens already in place.
        onClick={(event) => {
          const element = popover.current;
          if (!element) return;
          const place = placeFolder(
            event.currentTarget.getBoundingClientRect(),
            box,
            viewport,
          );
          element.style.left = `${place.left}px`;
          element.style.top = `${place.top}px`;
        }}
      >
        <span className={`${styles.icon} ${styles.folderIcon}`} aria-hidden="true">
          {links.slice(0, 4).map((link, index) => (
            <span key={index} className={styles.mini}>
              <Favicon link={link} />
            </span>
          ))}
        </span>
        {!iconsOnly && <span className={styles.label}>{name}</span>}
      </button>

      <div
        ref={popover}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={name}
        className={styles.folder}
        style={{ width: box.width, height: box.height } as CSSProperties}
        onToggle={(event) => setOpen(event.newState === 'open')}
      >
        {/* Its links render only while open: the favicons beyond the first four
            aren't fetched until someone looks. */}
        {open && (
          <ul
            className={styles.links}
            data-mode={box.mode}
            style={{
              gridTemplateColumns: `repeat(${box.columns}, auto)`,
              ['--icon' as string]: `${box.icon}px`,
            }}
          >
            {links.map((link, index) => (
              <li key={`${index}:${link.href}`}>
                <LinkAnchor
                  link={link}
                  newTab={newTab}
                  iconsOnly={box.mode === 'icons'}
                  isEditing={false}
                  // A new tab leaves this one showing: close the folder behind it.
                  onFollow={newTab ? () => close(popover.current) : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function close(element: HTMLElement | null) {
  // Only an open one: jsdom has no popover API, and never reports one open.
  if (element?.matches(':popover-open')) element.hidePopover();
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
