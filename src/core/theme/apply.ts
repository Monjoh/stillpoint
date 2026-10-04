import type { ImageSource } from '@/core/assets/image';
import type { BackgroundConfig, LayoutConfig, Profile } from '@/core/config/schema';
import { backgroundBlur, backgroundToCss } from './background';
import { presetTokens } from './presets';
import { isThemeableToken, type TokenSet } from './tokens';

/**
 * Everything needed to paint an empty but correctly-styled canvas.
 *
 * Shared by two callers that could not be more different: `boot.ts`, which runs before
 * React exists and reads this out of the synchronous paint cache, and the React tree,
 * which gets it from the real config once storage resolves. Both end up calling
 * `applyCanvasTokens`, so the two paints cannot disagree about what the page looks like.
 *
 * Deliberately zod-free — this is on the critical path.
 */
export interface CanvasPaint {
  background: BackgroundConfig;
  layout: LayoutConfig;
  preset: string;
  overrides: Record<string, string>;
  /**
   * An image background's pixels, as far as they are resolved: the cached preview on
   * the paint-cache write, the photograph's object URL as well once the page has it.
   * Not part of the profile, because neither lives in the config.
   */
  image?: ImageSource;
}

export function profileToPaint(profile: Profile, image?: ImageSource): CanvasPaint {
  return {
    background: profile.background,
    layout: profile.layout,
    preset: profile.theme.preset,
    overrides: profile.theme.overrides,
    image,
  };
}

export { isThemeableToken };

/**
 * Canvas tokens the sweep below must never remove.
 *
 * `--sp-background` is not written when the background kind needs an asset that is
 * not resolved yet, and "not written" there means *keep what is on screen* — the
 * exact opposite of "clear it". Removing it would turn every image background into a
 * flash of the default gradient on the way to the real one.
 */
const PRESERVED_TOKENS = new Set(['--sp-background']);

/**
 * The complete set of custom properties a paint describes.
 *
 * Built as one object before anything is written, which is what makes the stale-token
 * sweep below safe: the writer knows the full set it owns, so anything else inline on
 * `:root` is from a previous paint and has no business surviving this one.
 */
export function paintToTokens(paint: CanvasPaint): TokenSet {
  const tokens = themeTokens(paint.preset, paint.overrides);

  const background = backgroundToCss(paint.background, paint.image);
  if (background !== null) tokens['--sp-background'] = background;
  tokens['--sp-background-blur'] = `${backgroundBlur(paint.background)}px`;

  tokens['--sp-grid-cols'] = String(paint.layout.columns);
  tokens['--sp-grid-rows'] = String(paint.layout.rows);
  tokens['--sp-grid-gap'] = `${paint.layout.gap}px`;
  tokens['--sp-canvas-max-width'] =
    paint.layout.maxWidth === null ? 'none' : `${paint.layout.maxWidth}px`;

  return tokens;
}

/**
 * A theme as it actually paints: the preset, then the user's overrides over it.
 *
 * Shared with the panel, so the contrast warning and the override editor measure
 * the same colours the page is showing rather than the preset's.
 */
export function themeTokens(
  preset: string,
  overrides: Record<string, string>,
): TokenSet {
  const tokens: TokenSet = { ...presetTokens(preset) };

  // Overrides last: a preset is a starting point and the user's own value wins.
  for (const [token, value] of Object.entries(overrides)) {
    if (isThemeableToken(token)) tokens[token] = value;
  }
  return tokens;
}

/**
 * Write a resolved token set to an element, and clear what it supersedes.
 *
 * The primitive `boot.ts` calls. It is handed tokens rather than a paint on purpose:
 * resolving a paint needs the preset table, and the preset table has no business in
 * the blocking boot script. The cache stores the answer, so boot only writes it.
 */
export function applyTokens(
  tokens: TokenSet,
  root: HTMLElement = document.documentElement,
): void {
  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(token, value);
  }

  // Remove canvas properties this paint does not set. An inline property is not
  // cleared by a later theme simply failing to mention it, so without this a token
  // set once would outlive every theme chosen afterwards — switch to Terminal, get
  // square corners, switch back, keep them. Removing an inline property falls back
  // to the stylesheet's value, which is the cold-start default in index.html.
  //
  // `--sp-ui-*` is skipped: tool chrome is not ours to clear.
  for (const token of inlineCanvasTokens(root)) {
    if (!(token in tokens) && !PRESERVED_TOKENS.has(token)) {
      root.style.removeProperty(token);
    }
  }
}

/** Resolve a paint and apply it. What the React tree calls, once the config is in. */
export function applyCanvasTokens(
  paint: CanvasPaint,
  root: HTMLElement = document.documentElement,
): void {
  applyTokens(paintToTokens(paint), root);
}

/** Snapshot first — removing a property while iterating the live list skips entries. */
function inlineCanvasTokens(root: HTMLElement): string[] {
  const found: string[] = [];
  for (let i = 0; i < root.style.length; i++) {
    const token = root.style[i];
    if (token !== undefined && isThemeableToken(token)) found.push(token);
  }
  return found;
}
