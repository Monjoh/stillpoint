import type { BackgroundConfig, LayoutConfig, Profile } from '@/core/config/schema';
import { backgroundToCss } from './background';

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
  fontScale: number;
  overrides: Record<string, string>;
}

export function profileToPaint(profile: Profile): CanvasPaint {
  return {
    background: profile.background,
    layout: profile.layout,
    fontScale: profile.theme.fontScale,
    overrides: profile.theme.overrides,
  };
}

/**
 * An override may only touch canvas tokens. `--sp-ui-*` is tool chrome and is not
 * user-themeable on purpose: a settings panel that inherits a broken custom palette
 * becomes unusable exactly when the user is trying to fix that palette.
 */
export function isThemeableToken(token: string): boolean {
  return token.startsWith('--sp-') && !token.startsWith('--sp-ui-');
}

export function applyCanvasTokens(
  paint: CanvasPaint,
  root: HTMLElement = document.documentElement,
): void {
  const background = backgroundToCss(paint.background);
  if (background !== null) root.style.setProperty('--sp-background', background);

  root.style.setProperty('--sp-grid-cols', String(paint.layout.columns));
  root.style.setProperty('--sp-grid-rows', String(paint.layout.rows));
  root.style.setProperty('--sp-grid-gap', `${paint.layout.gap}px`);
  root.style.setProperty(
    '--sp-canvas-max-width',
    paint.layout.maxWidth === null ? 'none' : `${paint.layout.maxWidth}px`,
  );
  root.style.setProperty('--sp-scale', String(paint.fontScale));

  for (const [token, value] of Object.entries(paint.overrides)) {
    if (isThemeableToken(token)) root.style.setProperty(token, value);
  }
}
