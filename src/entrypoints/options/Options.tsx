import { useEffect, useMemo, useState } from 'react';
import { appSettingsSchema, type StillpointConfig } from '@/core/config/schema';
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  moveProfile,
  renameProfile,
  setActiveProfile,
  setAppSettings,
} from '@/core/config/profiles';
import { configStore, useConfig } from '@/core/config/store';
import {
  CURRENT_CONFIG_VERSION,
  exportConfig,
  importConfig,
} from '@/core/config/transfer';
import { describeSchema } from '@/settings/describe';
import { GeneratedFields } from '@/settings/generate';
import { NameField } from '@/settings/NameField';
import styles from './Options.module.css';

/**
 * Profiles, global settings and the way data gets in and out.
 *
 * The same store as the new tab, in a different document. A write here lands in
 * `storage.local`, and the open new tabs pick it up through the watch the store
 * already sets up — there is no messaging layer and there does not need to be.
 *
 * The General section is drawn by the same generator that draws a widget's settings
 * panel. It only needs an object with a zod schema, and `appSettingsSchema` is one.
 */
export function Options() {
  const config = useConfig((state) => state.config);
  const status = useConfig((state) => state.status);
  const storeError = useConfig((state) => state.error);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    void configStore.getState().load();
  }, []);

  /** Every write goes through here, so nothing can forget to flush. */
  const write = (recipe: (config: StillpointConfig) => StillpointConfig) => {
    configStore.getState().update(recipe);
    void configStore.getState().flush();
  };

  if (status !== 'ready' || !config) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Stillpoint</h1>
        <p className={styles.body}>
          {status === 'error'
            ? 'Settings could not be loaded.'
            : 'Loading your settings…'}
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Stillpoint</h1>
      <p className={styles.body}>
        Everything here is stored on this device only. Nothing is sent anywhere, and
        there is no account.
      </p>

      {storeError && (
        <p className={styles.status} data-tone="error" role="status">
          {storeError}
        </p>
      )}

      <Profiles config={config} write={write} />
      <General config={config} write={write} />
      <Data config={config} notice={notice} setNotice={setNotice} />

      <p className={styles.footnote}>Config format version {CURRENT_CONFIG_VERSION}.</p>
    </main>
  );
}

type Write = (recipe: (config: StillpointConfig) => StillpointConfig) => void;

interface Notice {
  tone: 'error' | 'success';
  text: string;
}

/* Profiles ------------------------------------------------------------------- */

function Profiles({ config, write }: { config: StillpointConfig; write: Write }) {
  const only = config.profiles.length === 1;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Profiles</h2>
      <p className={styles.sectionNote}>
        Each profile is a whole new tab page: its own layout, widgets, background and
        theme. One is active at a time.
      </p>

      <ul className={styles.profiles}>
        {config.profiles.map((profile, index) => (
          <li
            key={profile.id}
            className={styles.profile}
            data-active={profile.id === config.activeProfileId || undefined}
          >
            <input
              type="radio"
              name="active-profile"
              className={styles.radio}
              checked={profile.id === config.activeProfileId}
              aria-label={`Use ${profile.name}`}
              onChange={() => write((c) => setActiveProfile(c, profile.id))}
            />

            <NameField
              id={`profile-name-${profile.id}`}
              className={styles.name}
              label={`Name of profile ${profile.name}`}
              value={profile.name}
              onCommit={(name) => write((c) => renameProfile(c, profile.id, name))}
            />

            <span className={styles.count}>
              {profile.widgets.length === 1
                ? '1 widget'
                : `${profile.widgets.length} widgets`}
            </span>

            <div className={styles.rowActions}>
              <IconButton
                label={`Move ${profile.name} up`}
                disabled={index === 0}
                onClick={() => write((c) => moveProfile(c, profile.id, -1))}
                path="M6 14l6-6 6 6"
              />
              <IconButton
                label={`Move ${profile.name} down`}
                disabled={index === config.profiles.length - 1}
                onClick={() => write((c) => moveProfile(c, profile.id, 1))}
                path="M6 10l6 6 6-6"
              />
              <IconButton
                label={`Duplicate ${profile.name}`}
                onClick={() => write((c) => duplicateProfile(c, profile.id))}
                path="M9 9h10v10H9zM5 15V5h10"
              />
              <IconButton
                label={`Delete ${profile.name}`}
                // The schema requires at least one profile. Deleting the last would
                // produce a config that fails to parse and is replaced by defaults on
                // the next load — the user's whole setup gone to an ordinary button.
                disabled={only}
                onClick={() => write((c) => deleteProfile(c, profile.id))}
                path="M6 6l12 12M18 6L6 18"
              />
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={styles.button}
        onClick={() => write((c) => createProfile(c))}
      >
        New profile
      </button>
    </section>
  );
}

/* General -------------------------------------------------------------------- */

function General({ config, write }: { config: StillpointConfig; write: Write }) {
  const fields = useMemo(() => describeSchema(appSettingsSchema), []);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>General</h2>
      <p className={styles.sectionNote}>
        Applies to every profile. Generated from the same schema the new tab validates
        against, by the same code that draws a widget’s settings.
      </p>

      <GeneratedFields
        fields={fields}
        values={config.app}
        idPrefix="app"
        // Parsed before it is stored, so a control that emits something the schema
        // rejects costs that one change rather than corrupting the block. Nothing
        // visible can do that today; the generator is meant to outlive that fact.
        onChange={(key, value) =>
          write((c) => {
            const next = appSettingsSchema.safeParse({ ...c.app, [key]: value });
            return next.success ? setAppSettings(c, next.data) : c;
          })
        }
      />
    </section>
  );
}

/* Data ----------------------------------------------------------------------- */

function Data({
  config,
  notice,
  setNotice,
}: {
  config: StillpointConfig;
  notice: Notice | null;
  setNotice: (notice: Notice | null) => void;
}) {
  const [confirmingReset, setConfirmingReset] = useState(false);

  const download = () => {
    const file = exportConfig(config);
    const url = URL.createObjectURL(
      new Blob([file.json], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.click();
    // Revoked on the next turn of the loop: Firefox needs the URL to still resolve
    // when it starts the download, which happens after click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice({ tone: 'success', text: `Saved ${file.filename}.` });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const result = importConfig(await file.text());

    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error });
      return;
    }

    // Replaced wholesale rather than merged. A half-merged config is a state neither
    // the old nor the new file describes, and the user asked for the file.
    configStore.getState().set(result.config);
    void configStore.getState().flush();
    setNotice({
      tone: 'success',
      text: result.migratedFrom
        ? `Imported, and upgraded from config version ${result.migratedFrom}.`
        : 'Imported.',
    });
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Your data</h2>
      <p className={styles.sectionNote}>
        An export is a plain JSON file holding every profile and setting. Importing one
        replaces everything — export first if you want a way back.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={download}>
          Export to a file
        </button>

        <label className={styles.button}>
          Import a file
          <input
            type="file"
            accept="application/json,.json"
            className={styles.hiddenInput}
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              // Cleared so picking the same file twice fires change twice.
              event.target.value = '';
            }}
          />
        </label>

        {confirmingReset ? (
          <>
            <button
              type="button"
              className={styles.button}
              data-danger
              onClick={() => {
                void configStore.getState().reset();
                setConfirmingReset(false);
                setNotice({ tone: 'success', text: 'Reset to a fresh install.' });
              }}
            >
              Delete everything, really
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => setConfirmingReset(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.button}
            data-danger
            onClick={() => setConfirmingReset(true)}
          >
            Reset everything
          </button>
        )}
      </div>

      {notice && (
        <p className={styles.status} data-tone={notice.tone} role="status">
          {notice.text}
        </p>
      )}
    </section>
  );
}

function IconButton({
  label,
  path,
  disabled,
  onClick,
}: {
  label: string;
  path: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );
}
