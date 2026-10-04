import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { readPaintCache } from '@/core/storage/paint-cache';
import { applyTokens } from '@/core/theme/apply';

/**
 * The first-paint path, built as its own tiny bundle at `/boot.js`.
 *
 * It lives here rather than inside `entrypoints/newtab/` for a concrete reason: a
 * second `<script type="module">` in newtab/index.html gets merged into the page's main
 * chunk, which would put the whole React + zod bundle in front of the first pixel. As
 * an unlisted script it stays separate, so newtab.html can load it with a classic
 * blocking `<script>` that runs before the body is parsed.
 *
 * Keep it tiny and keep it synchronous. It must not import zod, the store, or anything
 * that reaches `browser.storage` — everything here is on the critical path of every new
 * tab the user opens. It does not resolve a theme either: the cache holds tokens that
 * are already resolved, so the preset table never reaches this bundle.
 *
 * A cache miss is not an error. The inline CSS in index.html already describes a
 * perfectly good default page, so doing nothing is the correct fallback.
 */
export default defineUnlistedScript(() => {
  const cache = readPaintCache();
  if (cache) applyTokens(cache.tokens);
});
