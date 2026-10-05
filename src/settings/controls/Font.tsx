import { i18n } from '#i18n';
import { FONT_STACKS } from '../fonts';
import { fontName } from '../names';
import type { ControlProps } from '@/core/registry/types';
import styles from './Controls.module.css';

/**
 * A font picker over bundled stacks only.
 *
 * No webfont list and no Google Fonts: a new tab that fetches a font before it can
 * paint is exactly the thing this project refuses to be, and every stack here
 * resolves to something already on the machine. Each option is drawn in its own face,
 * which is the only way to choose a font.
 */
export function FontControl({
  id,
  value,
  onChange,
  field,
}: ControlProps<string | null>) {
  return (
    <select
      id={id}
      className={styles.select}
      value={value ?? ''}
      style={{ fontFamily: value || undefined }}
      onChange={(event) =>
        onChange(
          field.nullable && event.target.value === '' ? null : event.target.value,
        )
      }
    >
      {field.nullable && <option value="">{i18n.t('theme.default')}</option>}
      {FONT_STACKS.map((font) => (
        <option key={font.id} value={font.stack} style={{ fontFamily: font.stack }}>
          {fontName(font.id)}
        </option>
      ))}
    </select>
  );
}
