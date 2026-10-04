import { useState } from 'react';
import {
  type BackgroundConfig,
  type Profile,
  type ThemeConfig,
} from '@/core/config/schema';
import { backgroundToCss } from '@/core/theme/background';
import { backgroundContrast, MIN_CONTRAST } from '@/core/theme/contrast';
import {
  GRADIENT_PRESETS,
  gradientToBackground,
  matchGradient,
} from '@/core/theme/gradients';
import { themeTokens } from '@/core/theme/apply';
import { getPreset, THEME_PRESETS } from '@/core/theme/presets';
import { TokenOverrides } from './TokenOverrides';
import fields from './Fields.module.css';
import styles from './ThemeSettings.module.css';

/**
 * Theme and background: two sections, two separate choices.
 *
 * A theme is type, colour and shape. A background is what is behind them. They were
 * briefly one thing here — picking a theme also set a background it shipped with —
 * and that was wrong twice over: it made two independent controls feel like one, and
 * it meant choosing a typeface could silently throw away a background the user had
 * picked. Backgrounds are the user's, and will soon include their own photographs.
 *
 * Nothing now prevents an unreadable pairing, so nothing has to pretend to. The
 * contrast of the actual result is measured and reported, which is both more honest
 * and more useful than a theme guessing at what should be behind it.
 *
 * Placed by hand rather than generated, and this is what `control: 'custom'` exists
 * for: a theme is a look, and a `<select>` listing four names shows none of it. Every
 * swatch is painted with the tokens it would apply, over the background actually in
 * use, so choosing is looking.
 */

export interface ThemeFieldsProps {
  profile: Profile;
  onChangeTheme: (theme: ThemeConfig) => void;
}

export interface BackgroundFieldsProps {
  profile: Profile;
  onChangeBackground: (background: BackgroundConfig) => void;
}

export function ThemeFields({ profile, onChangeTheme }: ThemeFieldsProps) {
  const active = getPreset(profile.theme.preset);
  const changes = Object.keys(profile.theme.overrides).length;
  // Closed by default: the swatches are what most visits are for, and eleven rows
  // under them would push the rest of the panel out of reach. Local state, so it
  // resets when the section closes — opening Theme again shows the swatches first.
  const [customising, setCustomising] = useState(false);

  // The real background, so every tile previews this page rather than a showroom.
  const canvas = backgroundToCss(profile.background) ?? undefined;

  return (
    <>
      <div className={styles.grid} role="radiogroup" aria-label="Theme">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={preset.id === active.id}
            className={styles.swatch}
            title={preset.description}
            onClick={() => onChangeTheme({ ...profile.theme, preset: preset.id })}
          >
            {/* Painted over the background that is actually on the page: this is a
                  preview of the result, not of the theme in the abstract. A tile that
                  is hard to read is telling the truth about the pairing. */}
            <span
              className={styles.preview}
              style={{
                background: canvas,
                borderRadius: preset.tokens['--sp-radius'],
              }}
              aria-hidden="true"
            >
              <span
                className={styles.previewText}
                style={{
                  color: preset.tokens['--sp-text'],
                  fontFamily: preset.tokens['--sp-font-display'],
                }}
              >
                09:41
              </span>
              <span
                className={styles.previewAccent}
                style={{ background: preset.tokens['--sp-accent'] }}
              />
            </span>
            <span className={styles.swatchName}>{preset.name}</span>
          </button>
        ))}
      </div>

      <p className={fields.help}>{active.description}</p>

      <div className={styles.customiseRow}>
        <button
          type="button"
          className={styles.customise}
          aria-expanded={customising}
          aria-controls="sp-theme-tokens"
          onClick={() => setCustomising((open) => !open)}
        >
          <svg viewBox="0 0 24 24" className={styles.chevron} aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          Customise
          {changes > 0 && (
            <span className={styles.count}>
              {changes} {changes === 1 ? 'change' : 'changes'}
            </span>
          )}
        </button>
        {/* Out here rather than inside the editor, so a customised theme can be put
            back without opening eleven rows to find what was changed. */}
        {changes > 0 && (
          <button
            type="button"
            className={styles.resetAll}
            onClick={() => onChangeTheme({ ...profile.theme, overrides: {} })}
          >
            Reset all
          </button>
        )}
      </div>

      {customising && (
        <div id="sp-theme-tokens">
          {/* Overrides apply over whichever preset is chosen, and survive a switch:
              an accent the user picked is theirs, not Midnight's. */}
          <TokenOverrides theme={profile.theme} onChangeTheme={onChangeTheme} />
        </div>
      )}
    </>
  );
}

export function BackgroundFields({
  profile,
  onChangeBackground,
}: BackgroundFieldsProps) {
  const active = getPreset(profile.theme.preset);
  const activeGradient = matchGradient(profile.background);

  // The theme as painted, overrides included: a text colour the user changed is the
  // one that has to be readable, not the preset's.
  const tokens = themeTokens(profile.theme.preset, profile.theme.overrides);
  const contrast = backgroundContrast(tokens, profile.background);
  const ownText = '--sp-text' in profile.theme.overrides;
  const unreadable = contrast !== null && contrast < MIN_CONTRAST;

  return (
    <>
      <div className={styles.grid} role="radiogroup" aria-label="Background">
        {GRADIENT_PRESETS.map((gradient) => (
          <button
            key={gradient.id}
            type="button"
            role="radio"
            aria-checked={gradient.id === activeGradient?.id}
            aria-label={gradient.name}
            className={styles.swatch}
            title={gradient.name}
            onClick={() => onChangeBackground(gradientToBackground(gradient))}
          >
            <span
              className={styles.preview}
              style={{
                background:
                  backgroundToCss(gradientToBackground(gradient)) ?? undefined,
              }}
              aria-hidden="true"
            />
            <span className={styles.swatchName}>{gradient.name}</span>
          </button>
        ))}
      </div>

      {/* A measured number, not a hunch about what looks dark. It fires on the
            pairings that are genuinely illegible and stays quiet on the merely
            unusual — and it says which two things are fighting, because the fix
            might be either of them. */}
      {unreadable && (
        <p className={styles.warning} role="status">
          {ownText ? 'Your text colour' : `${active.name} text`} is hard to read on this
          background
          {contrast !== null && ` (contrast ${contrast.toFixed(1)}:1)`}. Pick a lighter
          or darker background, or a theme that suits this one.
        </p>
      )}

      {/* A background that is none of ours is a legitimate state — an import, a
            hand-edited export, later a photograph. Saying so beats showing ten
            swatches with none selected and leaving the user to wonder. */}
      {activeGradient === undefined && (
        <p className={fields.help}>
          This profile uses a background that is not one of these. Picking one replaces
          it.
        </p>
      )}
    </>
  );
}
