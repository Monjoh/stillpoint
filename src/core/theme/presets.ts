import type { TokenSet } from './tokens';

/**
 * The four built-in themes.
 *
 * Four, and each a genuinely different mood rather than four shades of grey — a
 * preset list that all looks the same is a preset list nobody opens twice.
 *
 * Every preset defines every token in `THEME_TOKENS`. That is enforced by
 * `presets.test.ts` and the reason is in `tokens.ts`: inline properties on `:root`
 * are not cleared by a theme that neglects to mention them, so a partial preset
 * leaks into whatever is chosen next.
 *
 * A preset is type, colour and shape — and deliberately **not** a background. The two
 * are chosen independently: a theme says how text and surfaces look, a background
 * says what is behind them, and a theme that silently rewrote the background made the
 * two feel like one muddled control. What stops the pair being unreadable is
 * `contrast.ts`, which measures the result rather than preventing the combination.
 *
 * No preset names a font it has to download. Nothing on the newtab critical path may
 * hit the network, and a webfont is a network request in front of the first pixel —
 * so every stack here resolves against fonts the machine already has.
 *
 * Deliberately zod-free: `apply.ts` reads this and runs inside `boot.ts`.
 */

/**
 * Names and descriptions are not here: `boot.ts` reaches this file, and the i18n
 * runtime must stay out of it. See `settings/names.ts`.
 */
export interface ThemePreset {
  id: string;
  tokens: TokenSet;
}

const SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
// macOS, Windows, then anything. No download, so no request before first paint.
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'midnight',
    tokens: {
      '--sp-text': '#f2f2f2',
      '--sp-text-muted': 'rgb(242 242 242 / 0.62)',
      '--sp-accent': '#7aa2f7',
      '--sp-surface': 'rgb(255 255 255 / 0.06)',
      '--sp-surface-border': 'rgb(255 255 255 / 0.10)',
      '--sp-shadow': '0 2px 20px rgb(0 0 0 / 0.25)',
      '--sp-surface-blur': '0px',
      '--sp-font-display': SANS,
      '--sp-font-body': SANS,
      '--sp-font-mono': MONO,
      '--sp-radius': '10px',
    },
  },
  {
    id: 'paper',
    tokens: {
      '--sp-text': '#23201c',
      '--sp-text-muted': 'rgb(35 32 28 / 0.58)',
      '--sp-accent': '#a6572b',
      '--sp-surface': 'rgb(35 32 28 / 0.05)',
      '--sp-surface-border': 'rgb(35 32 28 / 0.12)',
      '--sp-shadow': '0 1px 12px rgb(60 50 40 / 0.12)',
      '--sp-surface-blur': '0px',
      '--sp-font-display': SERIF,
      '--sp-font-body': SERIF,
      '--sp-font-mono': MONO,
      '--sp-radius': '8px',
    },
  },
  {
    id: 'terminal',
    tokens: {
      '--sp-text': '#cfe8cf',
      '--sp-text-muted': 'rgb(207 232 207 / 0.55)',
      '--sp-accent': '#5bd97f',
      '--sp-surface': 'rgb(91 217 127 / 0.07)',
      '--sp-surface-border': 'rgb(91 217 127 / 0.28)',
      // Flat means flat. `none` rather than a faint shadow, so the preset reads as a
      // deliberate choice instead of a weaker Midnight.
      '--sp-shadow': 'none',
      '--sp-surface-blur': '0px',
      '--sp-font-display': MONO,
      '--sp-font-body': MONO,
      '--sp-font-mono': MONO,
      '--sp-radius': '0px',
    },
  },
  {
    id: 'glass',
    tokens: {
      // Pure white and a heavier shadow: this theme expects to sit on a photograph,
      // where anything less than full contrast disappears into a bright patch.
      '--sp-text': '#ffffff',
      '--sp-text-muted': 'rgb(255 255 255 / 0.72)',
      '--sp-accent': '#9ec1ff',
      '--sp-surface': 'rgb(255 255 255 / 0.14)',
      '--sp-surface-border': 'rgb(255 255 255 / 0.22)',
      '--sp-shadow': '0 8px 32px rgb(0 0 0 / 0.28)',
      '--sp-surface-blur': '18px',
      '--sp-font-display': SANS,
      '--sp-font-body': SANS,
      '--sp-font-mono': MONO,
      '--sp-radius': '16px',
    },
  },
];

export const DEFAULT_PRESET_ID = 'midnight';

/**
 * The preset with this id, or the default.
 *
 * `themeSchema.preset` is a bare `z.string()`, so an id this build has never heard of
 * is an ordinary thing to be handed — by a profile exported from a later version, or
 * by a theme that was removed. Falling back paints a page; throwing paints nothing.
 */
export function getPreset(id: string): ThemePreset {
  return (
    THEME_PRESETS.find((p) => p.id === id) ??
    THEME_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!
  );
}

/** The tokens a preset contributes, before the profile's own overrides are merged. */
export function presetTokens(id: string): TokenSet {
  return getPreset(id).tokens;
}
