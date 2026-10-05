import { i18n } from '#i18n';
import { useRef, useState } from 'react';
import type { WidgetProps } from '@/core/registry/types';
import {
  TODO_MAX_ITEMS,
  TODO_MAX_TEXT,
  type TodoItem,
  type TodoSettings,
} from './definition';
import styles from './TodoView.module.css';

/**
 * A checklist edited in place: type and press Enter to add, tick to finish, edit a
 * task's text where it is, clear it to remove it. Saved as it changes, like Notes.
 *
 * The list scrolls inside itself when it is longer than the cell; the field for a new
 * task stays put underneath. Tasks are the user's, so none can be dropped to fit.
 */
export default function TodoView({
  settings,
  isEditing,
  updateSettings,
}: WidgetProps<TodoSettings>) {
  const [draft, setDraft] = useState('');
  const addField = useRef<HTMLInputElement>(null);

  const editable = !isEditing && updateSettings !== undefined;
  const { items } = settings;
  const shown = settings.hideDone ? items.filter((item) => !item.done) : items;
  const full = items.length >= TODO_MAX_ITEMS;

  // Every change is a recipe over the list as stored now, not as last rendered.
  const write = (change: (items: TodoItem[]) => TodoItem[]) =>
    updateSettings?.((current) => ({ ...current, items: change(current.items) }));

  const add = () => {
    const text = draft.trim();
    if (!text || full) return;
    write((list) =>
      list.length >= TODO_MAX_ITEMS
        ? list
        : [...list, { id: newId(), text, done: false }],
    );
    setDraft('');
  };
  const edit = (id: string, patch: Partial<TodoItem>) =>
    write((list) =>
      list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const remove = (id: string) => write((list) => list.filter((item) => item.id !== id));

  const tab = isEditing ? -1 : undefined;

  return (
    <div
      className={styles.todo}
      style={{ fontSize: `min(${settings.fontSize}px, 8cqw)` }}
    >
      {shown.length > 0 ? (
        <ul className={styles.list} aria-label={i18n.t('widget.todo.label')}>
          {shown.map((item) => (
            <li
              key={item.id}
              className={styles.item}
              data-done={item.done || undefined}
            >
              <input
                type="checkbox"
                className={styles.check}
                checked={item.done}
                onChange={(event) => edit(item.id, { done: event.target.checked })}
                aria-label={item.text || i18n.t('widget.todo.untitled')}
                disabled={!editable}
                tabIndex={tab}
              />
              <input
                className={styles.text}
                value={item.text}
                onChange={(event) => edit(item.id, { text: event.target.value })}
                // Cleared and left: the task is gone. Removing on every empty
                // keystroke would lose the row mid-retype.
                onBlur={(event) => {
                  if (!event.target.value.trim()) remove(item.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    addField.current?.focus();
                  }
                }}
                aria-label={i18n.t('widget.todo.task')}
                maxLength={TODO_MAX_TEXT}
                readOnly={!editable}
                tabIndex={tab}
                spellCheck={false}
              />
              {editable && (
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => remove(item.id)}
                  aria-label={i18n.t('widget.todo.remove', {
                    task: item.text || i18n.t('widget.todo.untitled'),
                  })}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10M17 7L7 17" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        items.length > 0 && (
          <p className={styles.note}>{i18n.t('widget.todo.allDone')}</p>
        )
      )}

      <input
        ref={addField}
        className={styles.add}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            add();
          }
        }}
        aria-label={i18n.t('widget.todo.add')}
        placeholder={full ? i18n.t('widget.todo.full') : i18n.t('widget.todo.add')}
        maxLength={TODO_MAX_TEXT}
        disabled={full}
        readOnly={!editable}
        tabIndex={tab}
        enterKeyHint="done"
        autoComplete="off"
      />
    </div>
  );
}

function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}
