import { useCallback, useEffect, useState } from 'react';

/**
 * Edit mode as a per-tab UI state, deliberately not part of the config.
 *
 * Whether this tab is being edited is not something the user would want synced to
 * their other tabs or restored on a cold start — a new tab that opens in edit mode
 * because you were editing an hour ago is a bug, not a feature. (There was also a
 * config switch to lock editing altogether; it hid the only way back in, and went in
 * config v5.)
 *
 * This hook is **not** part of the lazily loaded edit chunk, and only handles the two
 * bindings that have to work before edit mode exists: `e` to enter and `Escape` to
 * leave. Everything else — arrows, delete, duplicate — belongs to edit mode and loads
 * with it.
 *
 * Escape is two-stage: it clears the selection first — which returns the settings
 * panel to the page-level settings — and leaves edit mode second.
 *
 * Whether the panel is showing also lives here rather than inside the lazily loaded
 * edit chunk, because the stage has to reserve the panel's width, and the stage is
 * rendered by the page.
 */

/**
 * Below this the stage cannot afford to give up the panel's width, so the panel
 * overlays instead of displacing. Matches the breakpoint in EditPanel.module.css and
 * Canvas.module.css; the three must not drift.
 */
const PANEL_MIN_VIEWPORT = 760;

export interface EditSession {
  isEditing: boolean;
  selectedId: string | null;
  /** The settings panel is showing. Open throughout edit mode, not per selection. */
  panelOpen: boolean;
  enter: () => void;
  exit: () => void;
  select: (instanceId: string | null) => void;
  togglePanel: () => void;
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

  /**
   * Open by default, and the user's choice from then on — never reopened behind their
   * back. The panel used to appear and disappear with the selection, which resized
   * the stage mid-click: every widget shifted, including the one being aimed at.
   *
   * On a window too narrow to displace the canvas it starts closed instead, because
   * there it would cover the thing it is meant to be editing.
   */
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= PANEL_MIN_VIEWPORT,
  );

  const enter = useCallback(() => setIsEditing(true), []);
  const togglePanel = useCallback(() => setPanelOpen((open) => !open), []);

  const exit = useCallback(() => {
    setIsEditing(false);
    setSelectedId(null);
    onExit?.();
  }, [onExit]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === 'Escape' && isEditing) {
        // Two stages: the first Escape closes the settings panel, the second leaves
        // edit mode. Checked before `isTypingTarget` on purpose — a text field the
        // user cannot back out of with Escape is a trap, and the settings panel is
        // full of text fields.
        if (selectedId !== null) setSelectedId(null);
        else exit();
        return;
      }

      if (isTypingTarget(event.target)) return;

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
  }, [enabled, isEditing, selectedId, enter, exit]);

  return {
    isEditing,
    selectedId,
    panelOpen,
    enter,
    exit,
    select: setSelectedId,
    togglePanel,
  };
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
