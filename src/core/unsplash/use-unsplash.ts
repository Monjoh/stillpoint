import { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageSource } from '@/core/assets/image';
import { dataUrlToBlob } from '@/core/assets/image';
import type { BackgroundConfig } from '@/core/config/schema';
import { usePermissions } from '@/core/permissions';
import { StorageKeys, type StorageAdapter } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import { readImagePreview } from '@/core/storage/paint-cache';
import type { UnsplashPhoto } from './api';
import {
  isUnsplashState,
  sameQuery,
  UNSPLASH_PREVIEW_ID,
  type ShownPhoto,
} from './state';

/** Who to credit, as Unsplash's guidelines require wherever a photo is shown. */
export interface UnsplashCredit {
  name: string;
  /** Null for a Picsum photo: Picsum names the photographer but does not link them. */
  profileUrl: string | null;
  pageUrl: string;
}

export interface UnsplashView {
  source?: ImageSource;
  credit?: UnsplashCredit;
}

/**
 * Typing a search or pasting a key changes the config once per keystroke. Each change
 * waits this long for the next, so "mountains" is one request, not nine.
 */
const SETTLE_MS = 800;

/**
 * The Unsplash background for this tab.
 *
 * First render: the cached preview, synchronously, matching the boot paint. Then the
 * stored `current` photo as an object URL, with its credit. Then, in the background,
 * a refresh (`refresh.ts`, imported only now), which may only change this tab's
 * picture when there was nothing for the query, or when the user asked — see the
 * rule at the top of that file.
 *
 * Also watches the rotation state, so "Show another photo" in the panel, or in
 * another tab, changes the picture here too.
 *
 * Nothing for any other background kind. Without a key it still works, on Lorem
 * Picsum's photos instead of Unsplash search.
 */
export function useUnsplash(
  background: BackgroundConfig | undefined,
  accessKey: string | null,
  onPreviewChanged?: () => void,
  adapter: StorageAdapter = localAdapter,
): UnsplashView {
  const unsplash = background?.kind === 'unsplash' ? background : null;
  // Both sources rotate the same way; `refresh.ts` picks the service by `source`.
  const active = unsplash !== null;
  const key = accessKey || null;
  const query = unsplash?.query ?? '';
  const refresh = unsplash?.refresh ?? 'daily';
  // An Unsplash search sends its words to Unsplash, which Firefox asks consent for.
  // Picsum has no search, so it needs none. Until it is given, the photo already
  // fetched stays up and nothing new is asked for; the panel offers Allow.
  const consent = usePermissions({
    dataCollection:
      unsplash?.source === 'unsplash' && searchSendsTerms(key, query)
        ? SEARCH_TERMS
        : [],
  }).state;

  const [shown, setShown] = useState<{
    query: string;
    photo: UnsplashPhoto;
    source: ImageSource;
  } | null>(null);
  const url = useRef<string | null>(null);
  /** The photo on screen, so re-showing it does not swap in a new object URL. */
  const shownId = useRef<string | null>(null);
  const lastSkip = useRef<number | null>(null);
  const settled = useRef(false);
  // A ref so the effects below do not restart when the caller's callback changes.
  const notify = useRef(onPreviewChanged);
  useEffect(() => {
    notify.current = onPreviewChanged;
  });

  const preview = useMemo(
    () => (active ? readImagePreview(UNSPLASH_PREVIEW_ID) : null),
    [active],
  );

  // Switching away and back starts a fresh refresh. The last photo's object URL is
  // kept until it is replaced or the page goes: one blob, and it means switching back
  // shows the photo at once instead of its thumbnail.
  useEffect(() => {
    if (!active) settled.current = false;
  }, [active]);
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  useEffect(() => {
    if (!active || !unsplash || consent === 'checking') return;
    let cancelled = false;

    const show = async (photo: ShownPhoto, forQuery: string) => {
      if (shownId.current === photo.photo.id) return;
      const { loadPhotoImage } = await import('./refresh');
      const asset = await loadPhotoImage(adapter, photo.photo.id);
      if (cancelled || !asset) return;
      const next = URL.createObjectURL(dataUrlToBlob(asset.dataUrl));
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = next;
      shownId.current = photo.photo.id;
      setShown({
        query: forQuery,
        photo: photo.photo,
        source: { ...photo.preview, url: next },
      });
    };

    let showing: string | null = null;
    const run = async () => {
      const { loadState, refreshUnsplash, wantedWidth } = await import('./refresh');
      if (cancelled) return;

      // What this tab opened on, if the store has it for this search.
      const state = await loadState(adapter);
      lastSkip.current = state?.skip ?? 0;
      if (state?.current && sameQuery(state.query, query) && !settled.current) {
        showing = query;
        await show(state.current, query);
      }
      if (consent !== 'granted') {
        settled.current = true;
        return;
      }

      const result = await refreshUnsplash({
        adapter,
        key,
        background: unsplash,
        width: wantedWidth(),
      });
      if (cancelled) return;
      lastSkip.current = result.state.skip;
      if (result.changed) notify.current?.();
      if (result.showNow) await show(result.showNow, query);
      else if (showing === null && result.state.current && !settled.current)
        await show(result.state.current, query);
      settled.current = true;
    };

    // The first run is immediate — the page has painted by the time an effect runs.
    // Later ones are a search or a key being typed, and wait for the typing to stop.
    const delay = settled.current ? SETTLE_MS : 0;
    if (settled.current) settled.current = false;
    const timer = setTimeout(() => void run().catch(() => {}), delay);

    const unwatch = adapter.watch<unknown>(StorageKeys.unsplash, (incoming) => {
      if (!isUnsplashState(incoming) || lastSkip.current === null) return;
      if (incoming.skip <= lastSkip.current) return;
      lastSkip.current = incoming.skip;
      // The skip already wrote the new preview; the paint cache has to follow it.
      notify.current?.();
      if (incoming.current && sameQuery(incoming.query, query))
        void show(incoming.current, query).catch(() => {});
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unwatch();
    };
    // `unsplash` is read through `query` and `refresh`; its blur and dim change
    // nothing about which photo to show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, query, refresh, adapter, consent]);

  if (!active) return {};
  if (shown) {
    return {
      source: shown.source,
      credit: {
        name: shown.photo.author.name,
        profileUrl: shown.photo.author.profileUrl,
        pageUrl: shown.photo.pageUrl,
      },
    };
  }
  return preview ? { source: preview } : {};
}

const SEARCH_TERMS = ['searchTerms'] as const;

/** Only the Unsplash API searches, and only it needs the user's key. */
export function searchSendsTerms(key: string | null, query: string): boolean {
  return Boolean(key) && query.trim() !== '';
}
