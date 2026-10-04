import { useCallback, useEffect, useState } from 'react';

/**
 * Edit mode as a per-tab UI state, deliberately not part of the config.
 *
 * Whether this tab is being edited is not something the user would want synced to
 * their other tabs or restored on a cold start — a new tab that opens in edit mode
 * because you were editing an hour ago is a bug, not a feature. `app.editModeEnabled`
 * in the config is a different question: whether editing is offered at all.
 *
 * This hook is **not** part of the lazily loaded edit chunk, and only handles the two
 * bindings that have to work before edit mode exists: `e` to enter and `Escape` to
 * leave. Everything else — arrows, delete, duplicate — belongs to edit mode and loads
 * with it.
 */

export interface EditSession {
  isEditing: boolean;
  selectedId: string | null;
  enter: () => void;
  exit: () => void;
  select: (instanceId: string | null) => void;
}

export interface EditSessionOptions {
  /** False while the config has not loaded, or if editing is switched off. */
  enabled: boolean;
  /** Called on leaving edit mode. Where the debounced config write gets flushed. */
  onExit?: () => void;
}

export function useEditSession({ enabled, onExit }: EditSessionOptions): EditSession {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const enter = useCallback(() => setIsEditing(true), []);

  const exit = useCallback(() => {
    setIsEditing(false);
    setSelectedId(null);
    onExit?.();
  }, [onExit]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;

      if (event.key === 'Escape' && isEditing) {
        exit();
        return;
      }
      // Bare `e` only. A modifier means the user is reaching for something else.
      if (
        event.key === 'e' &&
        !isEditing &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        enter();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, isEditing, enter, exit]);

  return { isEditing, selectedId, enter, exit, select: setSelectedId };
}

/**
 * A single-letter shortcut must not fire while the user is typing. There is no text
 * input on the canvas yet; the search widget in M5 is exactly why this is here now.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
