import { useMemo } from 'react';
import {
  appSettingsSchema,
  layoutSchema,
  type BackgroundConfig,
  type LayoutConfig,
  type Profile,
  type StillpointConfig,
  type ThemeConfig,
} from '@/core/config/schema';
import {
  createProfile,
  duplicateProfile,
  renameProfile,
  setActiveProfile,
  setAppSettings,
} from '@/core/config/profiles';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';
import { NameField } from './NameField';
import { Section } from './Section';
import { BackgroundFields, ThemeFields } from './ThemeSettings';
import { getPreset } from '@/core/theme/presets';
import { matchGradient } from '@/core/theme/gradients';
// The section frame and the input chrome come from the two stylesheets the generator
// already uses, so a hand-placed field beside a generated one is visually the same
// field. Duplicating either here is how two settings surfaces start to drift apart.
import fields from './Fields.module.css';
import controls from './controls/Controls.module.css';
import styles from './EditPanel.module.css';

/**
 * What the panel shows when no widget is selected: the page you are editing, rather
 * than a thing on it.
 *
 * Profile, grid and global settings — all drawn by the same generator a widget's
 * settings use, from `layoutSchema` and `appSettingsSchema`. Neither was editable
 * anywhere before; the grid in particular is the most canvas-contextual setting there
 * is, and it was reachable only by hand-editing an export.
 *
 * Every category is collapsed to a single row carrying its current value — Midnight,
 * 24 × 12 — and only one opens at a time. Five expanded categories were taller than
 * the window, and a sidebar you scroll to find what you came for is a worse sidebar.
 * The collapsed rows still answer most questions without being opened.
 *
 * Destructive profile operations are deliberately not here. Deleting the profile you
 * are standing inside, from the sidebar of the canvas you are editing, is more damage
 * than a side panel should be able to do; that, reordering and import/export stay on
 * the options page, which is one click away at the bottom.
 */

export interface PageSettingsProps {
  config: StillpointConfig;
  profile: Profile;
  onChangeLayout: (layout: LayoutConfig) => void;
  onChangeTheme: (theme: ThemeConfig) => void;
  onChangeBackground: (background: BackgroundConfig) => void;
  onChangeConfig: (recipe: (config: StillpointConfig) => StillpointConfig) => void;
  onOpenOptions?: () => void;
  /** The one open category, or null. Held above this component — see `EditPanel`. */
  openSection: string | null;
  onToggleSection: (id: string) => void;
}

export function PageSettings({
  config,
  profile,
  onChangeLayout,
  onChangeTheme,
  onChangeBackground,
  onChangeConfig,
  onOpenOptions,
  openSection,
  onToggleSection,
}: PageSettingsProps) {
  const layoutFields = useMemo(() => describeSchema(layoutSchema), []);
  const appFields = useMemo(() => describeSchema(appSettingsSchema), []);

  const preset = getPreset(profile.theme.preset);
  const gradient = matchGradient(profile.background);

  /** Every category takes the same three props; only the body differs. */
  const section = (id: string, title: string, value: string) => ({
    id,
    title,
    value,
    open: openSection === id,
    onToggle: onToggleSection,
  });

  return (
    <>
      <div className={styles.body}>
        <Section
          {...section(
            'profile',
            'Profile',
            config.profiles.length > 1
              ? `${profile.name} of ${config.profiles.length}`
              : profile.name,
          )}
        >
          {/* Only offered when there is a choice to make. A select with one option is
              a control that cannot do anything. */}
          {config.profiles.length > 1 && (
            <div className={fields.field}>
              <label className={fields.label} htmlFor="sp-profile-switch">
                Editing
              </label>
              <select
                id="sp-profile-switch"
                className={controls.select}
                value={profile.id}
                // Switching mid-edit is intentional: the canvas becomes the other
                // profile and the selection falls away with the widgets that are no
                // longer there, which puts the panel back on this view by itself.
                //
                // The id is read now, not inside the recipe: the recipe is a closure
                // the caller may run later, and by then this controlled select has
                // been re-rendered back to whatever the config still says.
                onChange={(event) => {
                  const id = event.target.value;
                  onChangeConfig((c) => setActiveProfile(c, id));
                }}
              >
                {config.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={fields.field}>
            <label className={fields.label} htmlFor="sp-profile-name">
              Name
            </label>
            <NameField
              id="sp-profile-name"
              className={controls.input}
              label="Profile name"
              value={profile.name}
              onCommit={(name) =>
                onChangeConfig((c) => renameProfile(c, profile.id, name))
              }
            />
          </div>

          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.button}
              onClick={() => onChangeConfig((c) => createProfile(c))}
            >
              New profile
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => onChangeConfig((c) => duplicateProfile(c, profile.id))}
            >
              Duplicate
            </button>
          </div>
        </Section>

        <Section
          {...section(
            'theme',
            'Theme',
            Object.keys(profile.theme.overrides).length > 0
              ? `${preset.name}, customised`
              : preset.name,
          )}
        >
          <ThemeFields profile={profile} onChangeTheme={onChangeTheme} />
        </Section>

        <Section
          {...section(
            'background',
            'Background',
            profile.background.kind === 'image'
              ? 'Photo'
              : (gradient?.name ?? 'Custom'),
          )}
        >
          <BackgroundFields profile={profile} onChangeBackground={onChangeBackground} />
        </Section>

        <Section
          {...section(
            'layout',
            'Layout',
            `${profile.layout.columns} \u00d7 ${profile.layout.rows}`,
          )}
        >
          <GeneratedFields
            fields={layoutFields}
            values={profile.layout}
            idPrefix="sp-layout"
            // Parsed before it is applied, so a half-typed number never reaches the
            // geometry. `setLayout` then rescales the widgets to match the new grid.
            onChange={(key, value) => {
              const next = layoutSchema.safeParse({ ...profile.layout, [key]: value });
              if (next.success) onChangeLayout(next.data);
            }}
          />
        </Section>

        <Section
          {...section(
            'general',
            'General',
            config.app.editModeEnabled ? 'Editing allowed' : 'Canvas locked',
          )}
        >
          <GeneratedFields
            fields={appFields}
            values={config.app}
            idPrefix="sp-app"
            onChange={(key, value) =>
              onChangeConfig((c) => {
                const next = appSettingsSchema.safeParse({ ...c.app, [key]: value });
                return next.success ? setAppSettings(c, next.data) : c;
              })
            }
          />
        </Section>
      </div>

      {onOpenOptions && (
        <footer className={styles.footer}>
          <button type="button" className={styles.quiet} onClick={onOpenOptions}>
            All settings and backups…
          </button>
        </footer>
      )}
    </>
  );
}
