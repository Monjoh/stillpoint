import { i18n } from '#i18n';
import { useState } from 'react';
import type { PhotoSource } from '@/core/unsplash/api';
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
import { imageAssetId } from '@/core/assets/image';
import { readImagePreview } from '@/core/storage/paint-cache';
import { UNSPLASH_PREVIEW_ID } from '@/core/unsplash/state';
import { gradientName, presetDescription, presetName } from './names';
import { PhotoFields } from './PhotoFields';
import { UnsplashFields } from './UnsplashFields';
import { TokenOverrides } from './TokenOverrides';
import controls from './controls/Controls.module.css';
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
  /** The global Unsplash key, needed only when Unsplash is the chosen source. */
  unsplashAccessKey?: string | null;
  /** Saves the key app-wide. Without it, the Unsplash view cannot take one. */
  onChangeAccessKey?: (key: string | null) => void;
}

export type BackgroundMode = 'colour' | 'photo' | PhotoSource;

const MODES: readonly BackgroundMode[] = ['colour', 'photo', 'picsum', 'unsplash'];

/** "Colour", "My photo", "Lorem Picsum", "Unsplash", in the browser's language. */
export const backgroundModeName = (mode: BackgroundMode): string =>
  i18n.t(`background.type.${mode}`);

export function backgroundMode(background: BackgroundConfig): BackgroundMode {
  if (background.kind === 'image') return 'photo';
  if (background.kind === 'unsplash') return background.source;
  return 'colour';
}

export function ThemeFields({ profile, onChangeTheme }: ThemeFieldsProps) {
  const active = getPreset(profile.theme.preset);
  const changes = Object.keys(profile.theme.overrides).length;
  // Closed by default: the swatches are what most visits are for, and eleven rows
  // under them would push the rest of the panel out of reach. Local state, so it
  // resets when the section closes — opening Theme again shows the swatches first.
  const [customising, setCustomising] = useState(false);

  // The real background, so every tile previews this page rather than a showroom. A
  // photograph previews as its thumbnail, which at 46px is all a tile could show.
  const assetId =
    profile.background.kind === 'unsplash'
      ? UNSPLASH_PREVIEW_ID
      : imageAssetId(profile.background);
  const canvas =
    backgroundToCss(
      profile.background,
      (assetId !== null && readImagePreview(assetId)) || undefined,
    ) ?? undefined;

  return (
    <>
      <div
        className={styles.grid}
        role="radiogroup"
        aria-label={i18n.t('page.theme.title')}
      >
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={preset.id === active.id}
            className={styles.swatch}
            title={presetDescription(preset.id)}
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
            <span className={styles.swatchName}>{presetName(preset.id)}</span>
          </button>
        ))}
      </div>

      <p className={fields.help}>{presetDescription(active.id)}</p>

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
          {i18n.t('theme.customise')}
          {changes > 0 && (
            <span className={styles.count}>{i18n.t('theme.changes', changes)}</span>
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
            {i18n.t('theme.resetAll')}
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
  unsplashAccessKey = null,
  onChangeAccessKey = () => {},
}: BackgroundFieldsProps) {
  const active = getPreset(profile.theme.preset);
  const activeGradient = matchGradient(profile.background);
  const current = backgroundMode(profile.background);

  // What the dropdown shows. Usually the background in use, but a choice that needs
  // setup first — a photo not yet uploaded, Unsplash without a key — shows its setup
  // while the page keeps its old background. A change from elsewhere (a profile
  // switch, an import) wins over a pending choice.
  const [chosen, setChosen] = useState({ mode: current, over: current });
  const mode = chosen.over === current ? chosen.mode : current;

  // The theme as painted, overrides included: a text colour the user changed is the
  // one that has to be readable, not the preset's.
  const tokens = themeTokens(profile.theme.preset, profile.theme.overrides);
  const contrast = backgroundContrast(tokens, profile.background);
  const ownText = '--sp-text' in profile.theme.overrides;
  const unreadable = contrast !== null && contrast < MIN_CONTRAST;

  /** A web-photo background for `source`, keeping what was tuned for this page. */
  const webPhoto = (source: PhotoSource): BackgroundConfig => {
    const bg = profile.background;
    const web = bg.kind === 'unsplash' ? bg : null;
    const kept = bg.kind === 'image' || bg.kind === 'unsplash' ? bg : null;
    return {
      kind: 'unsplash',
      source,
      query: web?.query ?? 'landscape',
      refresh: web?.refresh ?? 'daily',
      blur: kept?.blur ?? 0,
      dim: kept?.dim ?? 0,
    };
  };

  const choose = (next: BackgroundMode) => {
    setChosen({ mode: next, over: current });
    if (next === current) return;
    if (next === 'colour') {
      onChangeBackground(gradientToBackground(GRADIENT_PRESETS[0]!));
    } else if (next === 'picsum' || (next === 'unsplash' && unsplashAccessKey)) {
      onChangeBackground(webPhoto(next));
    }
    // 'photo', and Unsplash without a key: setup first, applied when it is done.
  };

  const changeKey = (key: string | null) => {
    onChangeAccessKey(key);
    // The key was the one thing missing: Unsplash can start now.
    if (key && mode === 'unsplash' && current !== 'unsplash') {
      onChangeBackground(webPhoto('unsplash'));
    }
  };

  return (
    <>
      <div className={fields.field}>
        <label className={fields.label} htmlFor="sp-background-mode">
          {i18n.t('background.typeLabel')}
        </label>
        <select
          id="sp-background-mode"
          className={controls.select}
          value={mode}
          onChange={(event) => choose(event.target.value as BackgroundMode)}
        >
          {MODES.map((id) => (
            <option key={id} value={id}>
              {backgroundModeName(id)}
            </option>
          ))}
        </select>
      </div>

      {mode === 'photo' && (
        <PhotoFields
          background={profile.background}
          onChangeBackground={onChangeBackground}
        />
      )}

      {(mode === 'picsum' || mode === 'unsplash') && (
        <UnsplashFields
          source={mode}
          background={profile.background}
          onChangeBackground={onChangeBackground}
          accessKey={unsplashAccessKey}
          onChangeAccessKey={changeKey}
        />
      )}

      {mode === 'colour' && (
        <div
          className={styles.grid}
          role="radiogroup"
          aria-label={i18n.t('page.background.title')}
        >
          {GRADIENT_PRESETS.map((gradient) => (
            <button
              key={gradient.id}
              type="button"
              role="radio"
              aria-checked={gradient.id === activeGradient?.id}
              aria-label={gradientName(gradient.id)}
              className={styles.swatch}
              title={gradientName(gradient.id)}
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
              <span className={styles.swatchName}>{gradientName(gradient.id)}</span>
            </button>
          ))}
        </div>
      )}

      {/* A measured number, not a hunch about what looks dark. It fires on the
            pairings that are genuinely illegible and stays quiet on the merely
            unusual — and it says which two things are fighting, because the fix
            might be either of them. */}
      {unreadable && (
        <p className={styles.warning} role="status">
          {ownText
            ? i18n.t('background.contrast.yourText', { ratio: formatRatio(contrast) })
            : i18n.t('background.contrast.themeText', {
                theme: presetName(active.id),
                ratio: formatRatio(contrast),
              })}
        </p>
      )}

      {/* A background that is none of ours is a legitimate state — an import, a
            hand-edited export, later a photograph. Saying so beats showing ten
            swatches with none selected and leaving the user to wonder. */}
      {mode === 'colour' && current === 'colour' && activeGradient === undefined && (
        <p className={fields.help}>{i18n.t('background.notAPreset')}</p>
      )}
    </>
  );
}

/** A contrast ratio as "3.2", with the browser's decimal separator. */
const formatRatio = (ratio: number | null) =>
  (ratio ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
