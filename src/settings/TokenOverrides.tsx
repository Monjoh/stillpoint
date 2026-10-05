import { i18n } from '#i18n';
import type { ReactNode } from 'react';
import type { ControlField } from '@/core/registry/types';
import type { ThemeConfig } from '@/core/config/schema';
import { presetTokens } from '@/core/theme/presets';
import { tokenHelp, tokenLabel } from './names';
import { THEME_TOKENS, type TokenSpec } from '@/core/theme/tokens';
import { ColorControl } from './controls/Color';
import { FontControl } from './controls/Font';
import { SliderControl } from './controls/Number';
import controls from './controls/Controls.module.css';
import fields from './Fields.module.css';
import styles from './TokenOverrides.module.css';

/**
 * The theme's tokens, one control each, over whichever preset is chosen.
 *
 * Driven by `THEME_TOKENS` rather than a zod schema. The vocabulary is the schema
 * here: `overrides` is a sparse record in the config, and what makes a key
 * meaningful is the token list, which already carries a label, a kind and help text
 * for exactly this editor. Widgets still never hand-write a form; this is page
 * settings, like the swatches above it.
 *
 * Overrides stay sparse. A value set back to what the preset says is removed rather
 * than stored, so "changed" always means *different from the theme*, the reset
 * buttons tell the truth, and switching preset carries over only what the user
 * actually changed.
 */

export interface TokenOverridesProps {
  theme: ThemeConfig;
  onChangeTheme: (theme: ThemeConfig) => void;
}

/**
 * Shadows are offered as a short list, not a text box. Nobody opening a theme panel
 * wants to write `box-shadow` syntax, and these four cover what the presets use.
 */
const SHADOWS = [
  { value: 'none', id: 'none' },
  { value: '0 1px 8px rgb(0 0 0 / 0.15)', id: 'subtle' },
  { value: '0 2px 20px rgb(0 0 0 / 0.25)', id: 'soft' },
  { value: '0 8px 32px rgb(0 0 0 / 0.4)', id: 'strong' },
] as const;

const GROUPS = [
  { id: 'colour', kinds: ['color'] },
  { id: 'type', kinds: ['font'] },
  { id: 'surface', kinds: ['length', 'shadow'] },
] as const satisfies readonly { id: string; kinds: readonly TokenSpec['kind'][] }[];

export function TokenOverrides({ theme, onChangeTheme }: TokenOverridesProps) {
  const base = presetTokens(theme.preset);
  const overrides = theme.overrides;

  const set = (token: string, value: string | null) => {
    const next = { ...overrides };
    if (value === null || value === base[token]) delete next[token];
    else next[token] = value;
    onChangeTheme({ ...theme, overrides: next });
  };

  return (
    <div className={styles.editor}>
      {GROUPS.map((group) => (
        <fieldset key={group.id} className={fields.group}>
          <legend className={fields.legend}>{i18n.t(`theme.group.${group.id}`)}</legend>
          {THEME_TOKENS.filter((spec) =>
            (group.kinds as readonly TokenSpec['kind'][]).includes(spec.kind),
          ).map((spec) => (
            <TokenRow
              key={spec.token}
              spec={spec}
              changed={spec.token in overrides}
              onReset={() => set(spec.token, null)}
            >
              {control(spec, overrides[spec.token], base[spec.token] ?? '', (value) =>
                set(spec.token, value),
              )}
            </TokenRow>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function TokenRow({
  spec,
  changed,
  onReset,
  children,
}: {
  spec: TokenSpec;
  changed: boolean;
  onReset: () => void;
  children: ReactNode;
}) {
  const id = tokenId(spec.token);
  const label = tokenLabel(spec.token);
  const help = tokenHelp(spec.token);
  return (
    <div className={fields.field}>
      <div className={styles.labelRow}>
        <label className={fields.label} id={`${id}-label`} htmlFor={id}>
          {label}
        </label>
        {changed && (
          <button
            type="button"
            className={styles.reset}
            aria-label={i18n.t('theme.resetToken', { name: label })}
            onClick={onReset}
          >
            {i18n.t('theme.reset')}
          </button>
        )}
      </div>
      {children}
      {help && <p className={fields.help}>{help}</p>}
    </div>
  );
}

function control(
  spec: TokenSpec,
  override: string | undefined,
  base: string,
  onChange: (value: string | null) => void,
): ReactNode {
  const id = tokenId(spec.token);
  const field: ControlField = { label: tokenLabel(spec.token), nullable: false };

  switch (spec.kind) {
    case 'color':
      return (
        <ColorControl
          id={id}
          value={override ?? base}
          onChange={onChange}
          field={field}
        />
      );

    case 'font':
      // Nullable, so "Theme default" is the first option and choosing it clears the
      // override. The preset's own stack is rarely one of the bundled eight, so it
      // could not be shown as a selected entry anyway.
      return (
        <FontControl
          id={id}
          value={override ?? null}
          onChange={onChange}
          field={{ ...field, nullable: true }}
        />
      );

    case 'length': {
      const range = spec.range ?? { min: 0, max: 32 };
      const px = parseFloat(override ?? base);
      return (
        <SliderControl
          id={id}
          value={Number.isFinite(px) ? px : range.min}
          onChange={(value) => onChange(`${value}px`)}
          field={{ ...field, ...range, step: 1, unit: 'px' }}
        />
      );
    }

    case 'shadow':
      // "Theme default" first, as with fonts: a preset's shadow need not be one of
      // the four, and picking the one that equals it clears the override anyway.
      return (
        <select
          id={id}
          className={controls.select}
          value={override ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">{i18n.t('theme.default')}</option>
          {SHADOWS.map((shadow) => (
            <option key={shadow.id} value={shadow.value}>
              {i18n.t(`theme.shadow.${shadow.id}`)}
            </option>
          ))}
        </select>
      );
  }
}

function tokenId(token: string): string {
  return `sp-token${token.slice('--sp'.length)}`;
}
