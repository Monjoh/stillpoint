import { i18n } from '#i18n';
import { richText } from '@/lib/rich-text';
import { useMemo, useState } from 'react';
import { frameSchema, type WidgetInstance } from '@/core/config/schema';
import { widgetRegistry } from '@/core/registry';
import { resolveSettings } from '@/core/registry/settings';
import { describeSchema } from './describe';
import { GeneratedFields } from './generate';
import fieldStyles from './Fields.module.css';
import styles from './EditPanel.module.css';

/**
 * One widget's settings, generated from its schema and nothing else.
 *
 * The claim this file exists to keep honest: a widget never hand-writes a form. If
 * something cannot be expressed here, that is a finding about the schema vocabulary,
 * not a licence to write JSX in a widget.
 *
 * Below the widget's own fields sits its Frame — card, alignment, opacity —
 * generated from `frameSchema` and identical for every widget type. It is drawn here
 * rather than declared by each widget so that no widget can forget it and no two can
 * offer it differently.
 *
 * The footer holds what acts on the widget itself: Duplicate and Remove (also on
 * ⌘D and Delete, which nobody finds unaided), and Reset. Remove asks once, because
 * there is no undo.
 */

export interface WidgetSettingsProps {
  instance: WidgetInstance;
  onChangeSettings: (instanceId: string, settings: unknown) => void;
  onChangeFrame: (instanceId: string, frame: WidgetInstance['frame']) => void;
  onDuplicate: (instanceId: string) => void;
  onRemove: (instanceId: string) => void;
  onCommit: () => void;
}

export function WidgetSettings({
  instance,
  onChangeSettings,
  onChangeFrame,
  onDuplicate,
  onRemove,
  onCommit,
}: WidgetSettingsProps) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const definition = widgetRegistry.get(instance.type);
  const schema = definition?.settingsSchema;

  const fields = useMemo(() => (schema ? describeSchema(schema) : []), [schema]);
  const resolved = schema ? resolveSettings(schema, instance.settings) : null;
  const values = (resolved?.settings ?? {}) as Record<string, unknown>;
  const frameFields = useMemo(() => describeSchema(frameSchema), []);

  return (
    <>
      <div className={styles.body}>
        {!definition && (
          <p className={styles.note}>
            {richText(i18n.t('widgetSettings.notInstalled'), {
              type: <code>{instance.type}</code>,
            })}
          </p>
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

        {/* Shown for an uninstalled type too: the frame is drawn by the canvas, not by
            the widget, so it still does something there. */}
        <section className={fieldStyles.section} aria-labelledby="sp-frame-heading">
          <h3 className={fieldStyles.sectionHeading} id="sp-frame-heading">
            {i18n.t('widgetSettings.frame')}
          </h3>
          <GeneratedFields
            fields={frameFields}
            values={instance.frame}
            idPrefix={`sp-${instance.instanceId}-frame`}
            onChange={(key, value) => {
              const next = frameSchema.safeParse({ ...instance.frame, [key]: value });
              if (next.success) onChangeFrame(instance.instanceId, next.data);
            }}
          />
        </section>
      </div>

      <footer className={styles.footer}>
        {confirmingRemove ? (
          <>
            <button
              key="confirm"
              type="button"
              className={styles.quiet}
              data-danger
              onClick={() => onRemove(instance.instanceId)}
            >
              {i18n.t('widgetSettings.confirmRemove')}
            </button>
            <button
              key="cancel"
              type="button"
              className={styles.quiet}
              // Focus goes to Cancel, not to the destructive choice: a held Enter or
              // a double click on Remove must not remove. Keyed, so this is a fresh
              // element rather than the Remove button reused in place.
              autoFocus
              onClick={() => setConfirmingRemove(false)}
            >
              {i18n.t('widgetSettings.cancel')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.quiet}
              onClick={() => onDuplicate(instance.instanceId)}
            >
              {i18n.t('widgetSettings.duplicate')}
            </button>
            <button
              type="button"
              className={styles.quiet}
              data-danger
              onClick={() => setConfirmingRemove(true)}
            >
              {i18n.t('widgetSettings.remove')}
            </button>
            {definition && fields.length > 0 && (
              <button
                type="button"
                className={styles.quiet}
                data-push
                // `{}` rather than a built object: the schema's own defaults are the
                // definition of "default", and rebuilding them here would drift.
                onClick={() => {
                  onChangeSettings(instance.instanceId, {});
                  onCommit();
                }}
              >
                {i18n.t('widgetSettings.reset')}
              </button>
            )}
          </>
        )}
      </footer>
    </>
  );
}
