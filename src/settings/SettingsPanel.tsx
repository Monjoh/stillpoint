import { useMemo } from 'react';
import type { WidgetInstance } from '@/core/config/schema';
import { widgetRegistry } from '@/core/registry';
import { resolveSettings } from '@/core/registry/settings';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';
import styles from './SettingsPanel.module.css';

/**
 * The selected widget's settings, generated from its schema.
 *
 * There is no Apply button and no OK: every change is written straight through to the
 * config, so the widget behind the panel is the preview. That is only safe because
 * `resolveSettings` repairs anything the schema rejects — a half-finished value can
 * reach storage without breaking the canvas.
 *
 * Docked to the right, and the canvas gives up that width rather than being covered
 * by it, so the thing being edited stays fully visible while it is edited. It used to
 * dock to whichever side the selected widget was not on; that only worked while no
 * widget was wide, and moved the obstruction around when one was.
 */

export interface SettingsPanelProps {
  instance: WidgetInstance;
  onChangeSettings: (instanceId: string, settings: unknown) => void;
  onCommit: () => void;
  onClose: () => void;
}

export function SettingsPanel({
  instance,
  onChangeSettings,
  onCommit,
  onClose,
}: SettingsPanelProps) {
  const definition = widgetRegistry.get(instance.type);
  const schema = definition?.settingsSchema;

  const fields = useMemo(() => (schema ? describeSchema(schema) : []), [schema]);
  const resolved = schema ? resolveSettings(schema, instance.settings) : null;
  const values = (resolved?.settings ?? {}) as Record<string, unknown>;

  const title = definition?.name ?? instance.type;

  return (
    <aside
      className={styles.panel}
      // `complementary`, not `dialog`: the canvas behind it stays live and the user is
      // meant to keep working there. A dialog would imply a focus trap and a modal
      // backdrop, both of which would get in the way of the live preview.
      aria-label={`${title} settings`}
      // Writes are debounced by the store; focus leaving the panel is the moment to
      // stop waiting. Nothing is lost without it — the debounce fires on its own, and
      // leaving edit mode flushes — but a setting that reaches disk when the user
      // stops typing is a setting that survives the browser being killed.
      onBlur={onCommit}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button
          type="button"
          className={styles.close}
          aria-label="Close settings"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className={styles.body}>
        {!definition && (
          <p className={styles.note}>
            This widget’s type (<code>{instance.type}</code>) is not installed, so its
            settings cannot be shown. They are kept untouched.
          </p>
        )}

        {definition && fields.length === 0 && (
          <p className={styles.note}>This widget has nothing to configure.</p>
        )}

        {definition && fields.length > 0 && (
          <GeneratedFields
            fields={fields}
            values={values}
            idPrefix={`sp-${instance.instanceId}`}
            onChange={(key, value) =>
              onChangeSettings(instance.instanceId, { ...values, [key]: value })
            }
          />
        )}
      </div>

      {definition && fields.length > 0 && (
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.reset}
            // `{}` rather than a built object: the schema's own defaults are the
            // definition of "default", and rebuilding them here would drift.
            onClick={() => {
              onChangeSettings(instance.instanceId, {});
              onCommit();
            }}
          >
            Reset to defaults
          </button>
        </footer>
      )}
    </aside>
  );
}
