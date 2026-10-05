import { i18n } from '#i18n';
import { describe, expect, it } from 'vitest';

/**
 * The test shim in vitest.setup.ts must answer the way the browser would, from the
 * real src/locales/en.yml.
 */
describe('i18n in tests', () => {
  it('reads src/locales/en.yml', () => {
    expect(i18n.t('manifest.name')).toBe('Stillpoint');
  });

  it('fills named values', () => {
    expect(i18n.t('frame.failed', { name: 'Clock' })).toBe('Clock failed');
  });

  it('pluralises, with the count in the sentence', () => {
    expect(i18n.t('options.profiles.widgets', 1)).toBe('1 widget');
    expect(i18n.t('options.profiles.widgets', 3)).toBe('3 widgets');
  });

  it('leaves element markers for richText to place', () => {
    expect(i18n.t('newtab.emptyHint')).toBe('Press [[key]] to add a widget.');
  });
});
