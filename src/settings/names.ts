import { i18n } from '#i18n';
import { browser } from 'wxt/browser';

/**
 * Display names for things the core identifies by id: theme presets, gradients,
 * design tokens and font stacks.
 *
 * They live here, in the settings layer, and not beside the data in `core/theme`:
 * `apply.ts` reads presets and tokens inside `boot.ts`, the script in front of the
 * first pixel, and a name looked up there would pull the i18n runtime into it. The
 * settings UI is lazy, so the lookup costs nothing on a new tab.
 *
 * The ids are plain strings in the data, so the keys are built at runtime and
 * checked by `names.test.ts` rather than by the compiler.
 */

const lookup = i18n.t as (key: string) => string;

const camel = (name: string) =>
  name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export const presetName = (id: string) => lookup(`theme.preset.${id}.name`);
export const presetDescription = (id: string) =>
  lookup(`theme.preset.${id}.description`);
export const gradientName = (id: string) => lookup(`gradient.${id}`);
export const fontName = (id: string) => lookup(`font.${id}`);

/** `--sp-text-muted` → `theme.token.textMuted`. */
const tokenKey = (token: string) => `theme.token.${camel(token.replace(/^--sp-/, ''))}`;
export const tokenLabel = (token: string) => lookup(`${tokenKey(token)}.label`);

/** Most tokens have no help text; an empty string means none. */
export function tokenHelp(token: string): string | undefined {
  const key = `${tokenKey(token)}.help`;
  // Asked of the browser directly: `i18n.t` warns in the console about a missing key,
  // and a missing help text is the normal case here.
  const message = (browser.i18n.getMessage as (name: string) => string)(
    key.replaceAll('.', '_'),
  );
  return message || undefined;
}
