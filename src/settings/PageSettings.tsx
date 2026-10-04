import { useMemo } from 'react';
import {
  appSettingsSchema,
  layoutSchema,
  type LayoutConfig,
  type Profile,
  type StillpointConfig,
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
 * Destructive profile operations are deliberately not here. Deleting the profile you
 * are standing inside, from the sidebar of the canvas you are editing, is more damage
 * than a side panel should be able to do; that, reordering and import/export stay on
 * the options page, which is one click away at the bottom.
 */

export interface PageSettingsProps {
  config: StillpointConfig;
  profile: Profile;
  onChangeLayout: (layout: LayoutConfig) => void;
  onChangeConfig: (recipe: (config: StillpointConfig) => StillpointConfig) => void;
  onOpenOptions?: () => void;
}

export function PageSettings({
  config,
  profile,
  onChangeLayout,
  onChangeConfig,
  onOpenOptions,
}: PageSettingsProps) {
  const layoutFields = useMemo(() => describeSchema(layoutSchema), []);
  const appFields = useMemo(() => describeSchema(appSettingsSchema), []);

  return (
    <>
      <div className={styles.body}>
        <section className={fields.section}>
          <h3 className={fields.sectionHeading}>Profile</h3>

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
        </section>

        <section className={fields.section}>
          <h3 className={fields.sectionHeading}>Layout</h3>
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
        </section>

        <section className={fields.section}>
          <h3 className={fields.sectionHeading}>General</h3>
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
        </section>
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
