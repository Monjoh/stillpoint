/**
 * The canvas token vocabulary: every custom property a theme is allowed to set.
 *
 * This is the contract between three things that must not drift — the inline CSS in
 * `newtab/index.html` that paints a cold profile, the presets in `presets.ts`, and
 * the override editor. A token that is not listed here is not themeable, and a preset
 * that does not define all of them is rejected by `presets.test.ts`.
 *
 * **Every preset must be total over this list**, which is the non-obvious rule.
 * `applyCanvasTokens` writes to `:root`'s inline style, and an inline property is not
 * removed by the next theme merely failing to mention it. A `terminal` preset with
 * `--sp-radius: 0` and a `midnight` preset that left the radius unset would mean
 * switching back from terminal keeps square corners forever. Totality is cheaper to
 * enforce than that bug is to find.
 *
 * Deliberately zod-free and data-only: `apply.ts` imports this and `apply.ts` is on
 * the critical path of every new tab.
 */

export interface TokenSpec {
  /** The custom property name, including the leading `--`. */
  token: string;
  label: string;
  /** How the override editor should offer it. */
  kind: 'color' | 'font' | 'length' | 'shadow';
  help?: string;
}

/**
 * Ordered for presentation: colour first because it is what anyone opening a theme
 * editor came to change, type and rhythm after.
 */
export const THEME_TOKENS: readonly TokenSpec[] = [
  { token: '--sp-text', label: 'Text', kind: 'color' },
  {
    token: '--sp-text-muted',
    label: 'Muted text',
    kind: 'color',
    help: 'Secondary lines — a date under a clock, a label under a value.',
  },
  { token: '--sp-accent', label: 'Accent', kind: 'color' },
  {
    token: '--sp-surface',
    label: 'Widget surface',
    kind: 'color',
    help: 'Only visible on widgets whose frame background is switched on.',
  },
  { token: '--sp-surface-border', label: 'Widget border', kind: 'color' },
  { token: '--sp-shadow', label: 'Widget shadow', kind: 'shadow' },
  {
    token: '--sp-surface-blur',
    label: 'Surface blur',
    kind: 'length',
    help: 'Frosts whatever is behind a widget’s surface. Costs nothing at 0.',
  },
  { token: '--sp-font-display', label: 'Display font', kind: 'font' },
  { token: '--sp-font-body', label: 'Body font', kind: 'font' },
  { token: '--sp-font-mono', label: 'Monospace font', kind: 'font' },
  { token: '--sp-radius', label: 'Corner radius', kind: 'length' },
];

export const THEME_TOKEN_NAMES: readonly string[] = THEME_TOKENS.map((t) => t.token);

/** A complete set of canvas tokens. Presets are exactly this; overrides are sparse. */
export type TokenSet = Record<string, string>;

/**
 * An override may only touch canvas tokens, and `--sp-ui-*` is explicitly not one.
 *
 * Tool chrome does not follow the user's theme on purpose: a settings panel that
 * inherits a low-contrast custom palette becomes unusable exactly when the user is
 * trying to fix that palette.
 *
 * Deliberately broader than `THEME_TOKEN_NAMES` — it answers "is this safe to write",
 * not "do we offer it". A profile exported by a later version may carry a token this
 * build has not heard of, and dropping it on import would quietly corrupt the theme
 * on a round trip.
 */
export function isThemeableToken(token: string): boolean {
  return token.startsWith('--sp-') && !token.startsWith('--sp-ui-');
}
