import { useMemo } from 'react';
import {
  themeSchema,
  type BackgroundConfig,
  type Profile,
  type ThemeConfig,
} from '@/core/config/schema';
import { backgroundToCss } from '@/core/theme/background';
import {
  GRADIENT_PRESETS,
  gradientToBackground,
  matchGradient,
} from '@/core/theme/gradients';
import { getPreset, THEME_PRESETS, type ThemePreset } from '@/core/theme/presets';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';
import fields from './Fields.module.css';
import styles from './ThemeSettings.module.css';

/**
 * Theme and background, the two things the user came to change.
 *
 * Placed by hand rather than generated, and this is the case `control: 'custom'`
 * exists for: a theme is a look, and a `<select>` listing four names shows none of
 * it. Every swatch here is painted with the real tokens it would apply, so choosing
 * is looking rather than guessing-then-undoing. `fontScale` is an ordinary bounded
 * number and *is* generated, because a slider is already the right answer for it.
 */

export interface ThemeSettingsProps {
  profile: Profile;
  onChangeTheme: (theme: ThemeConfig) => void;
  onChangeBackground: (background: BackgroundConfig) => void;
}

export function ThemeSettings({
  profile,
  onChangeTheme,
  onChangeBackground,
}: ThemeSettingsProps) {
  const themeFields = useMemo(
    () => describeSchema(themeSchema).filter((f) => f.key === 'fontScale'),
    [],
  );
  const active = getPreset(profile.theme.preset);
  const activeGradient = matchGradient(profile.background);
  const suggested = backgroundToCss(active.suggestedBackground);
  const onSuggested = backgroundToCss(profile.background) === suggested;

  /**
   * Picking a theme also takes its background — but only when the background on the
   * page is one of ours.
   *
   * Paper is dark text. Applied over the default near-black gradient it produces a
   * page nobody can read, including the panel's own way back out, so a preset that
   * can do that has to bring the thing that prevents it. The guard is what keeps that
   * from being destructive: a background the user chose themselves is left alone and
   * offered as a suggestion instead, because overwriting a deliberate choice to
   * prevent a hypothetical one is the worse trade.
   */
  const choosePreset = (preset: ThemePreset) => {
    onChangeTheme({ ...profile.theme, preset: preset.id });
    if (activeGradient !== undefined) onChangeBackground(preset.suggestedBackground);
  };

  return (
    <>
      <section className={fields.section}>
        <h3 className={fields.sectionHeading}>Theme</h3>

        <div className={styles.grid} role="radiogroup" aria-label="Theme">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={preset.id === active.id}
              className={styles.swatch}
              title={preset.description}
              onClick={() => choosePreset(preset)}
            >
              {/* Painted with the preset's own tokens rather than described in
                  words. The tile is a miniature of the page it would produce. */}
              <span
                className={styles.preview}
                style={{
                  background: backgroundToCss(preset.suggestedBackground) ?? undefined,
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

        {/* Only when the guard above declined to change it. Shows the user the thing
            that was not done to them, instead of silently not doing it. */}
        {!onSuggested && suggested !== null && (
          <button
            type="button"
            className={styles.suggestion}
            onClick={() => onChangeBackground(active.suggestedBackground)}
          >
            Use the background {active.name} was designed for
          </button>
        )}

        <GeneratedFields
          fields={themeFields}
          values={profile.theme}
          idPrefix="sp-theme"
          onChange={(key, value) => {
            const next = themeSchema.safeParse({ ...profile.theme, [key]: value });
            if (next.success) onChangeTheme(next.data);
          }}
        />
      </section>

      <section className={fields.section}>
        <h3 className={fields.sectionHeading}>Background</h3>

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

        {/* A background that is not one of ours is a legitimate state — an import, a
            hand-edited export, later an image. Saying so beats showing ten swatches
            with none selected and leaving the user to wonder which one is on. */}
        {activeGradient === undefined && (
          <p className={fields.help}>
            This profile uses a background that is not one of these. Picking one
            replaces it.
          </p>
        )}
      </section>
    </>
  );
}
