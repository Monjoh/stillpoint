import { useMemo } from 'react';
import type { WidgetInstance } from '@/core/config/schema';
import { widgetRegistry } from '@/core/registry';
import { resolveSettings } from '@/core/registry/settings';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';
import styles from './EditPanel.module.css';

/**
 * One widget's settings, generated from its schema and nothing else.
 *
 * The claim this file exists to keep honest: a widget never hand-writes a form. If
 * something cannot be expressed here, that is a finding about the schema vocabulary,
 * not a licence to write JSX in a widget.
 */

export interface WidgetSettingsProps {
  instance: WidgetInstance;
  onChangeSettings: (instanceId: string, settings: unknown) => void;
  onCommit: () => void;
}

export function WidgetSettings({
  instance,
  onChangeSettings,
  onCommit,
}: WidgetSettingsProps) {
  const definition = widgetRegistry.get(instance.type);
  const schema = definition?.settingsSchema;

  const fields = useMemo(() => (schema ? describeSchema(schema) : []), [schema]);
  const resolved = schema ? resolveSettings(schema, instance.settings) : null;
  const values = (resolved?.settings ?? {}) as Record<string, unknown>;

  return (
    <>
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
            className={styles.quiet}
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
    </>
  );
}
