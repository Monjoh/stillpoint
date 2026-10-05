import { i18n } from '#i18n';
import { useEffect, useId, useRef, useState } from 'react';
import type { WidgetProps } from '@/core/registry/types';
import type { SearchSettings } from './definition';
import { ENGINES, isSearchTemplate, searchUrl } from './engines';
import { openUrl } from './navigate';
import styles from './SearchView.module.css';

export default function SearchView({
  settings,
  isEditing,
}: WidgetProps<SearchSettings>) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const id = useId();

  const { engine } = settings;
  const custom = engine === 'custom';
  const template =
    engine === 'custom' ? settings.customUrl.trim() : ENGINES[engine].url;
  const name = engine === 'custom' ? hostOf(template) : ENGINES[engine].name;

  // Only on the way into view mode, and only when nothing else has the cursor: a
  // widget must never pull focus from something the user is typing into.
  useEffect(() => {
    if (isEditing || !settings.autofocus) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    input.current?.focus({ preventScroll: true });
  }, [isEditing, settings.autofocus]);

  // "/" jumps here, as on most sites with a search box. Not while typing elsewhere,
  // and not in edit mode, where the keyboard moves widgets.
  useEffect(() => {
    if (isEditing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(document.activeElement)) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEditing]);

  if (custom && !isSearchTemplate(template)) {
    return <p className={styles.notice}>{i18n.t('widget.search.view.setAddress')}</p>;
  }

  return (
    <form
      className={styles.search}
      role="search"
      style={{ fontSize: `min(${settings.fontSize}px, 45cqh)` }}
      onSubmit={(event) => {
        event.preventDefault();
        const url = searchUrl(template, query);
        if (url) openUrl(url, settings.newTab);
      }}
    >
      <label htmlFor={id} className={styles.icon}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z M15.5 15.5 20 20" />
        </svg>
        <span className={styles.hidden}>
          {i18n.t('widget.search.view.label', { name })}
        </span>
      </label>
      <input
        ref={input}
        id={id}
        className={styles.input}
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={i18n.t('widget.search.view.label', { name })}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        // In edit mode the box is something to move, not to type into.
        readOnly={isEditing}
        tabIndex={isEditing ? -1 : undefined}
      />
    </form>
  );
}

function hostOf(template: string): string {
  try {
    return new URL(template.replace(/%s/g, 'x')).hostname.replace(/^www\./, '');
  } catch {
    return 'the web';
  }
}

function isTyping(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return (
    element.isContentEditable ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}
