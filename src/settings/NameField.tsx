import { useState } from 'react';

/**
 * A text field whose value is a draft until it is left.
 *
 * Every other control writes through on each keystroke, because the canvas behind
 * them is the preview and a value the schema dislikes is repaired by
 * `resolveSettings`. A profile name has neither property: `renameProfile` refuses an
 * empty one, so a per-keystroke write would have the store fight the user over the
 * deletion of their own last character.
 *
 * Shared by the edit panel and the options page so there is one implementation of
 * that rule rather than two that drift.
 */

export interface NameFieldProps {
  id: string;
  /** The committed name. A draft is kept only while it still belongs to this one. */
  value: string;
  label: string;
  className?: string;
  maxLength?: number;
  onCommit: (name: string) => void;
}

export function NameField({
  id,
  value,
  label,
  className,
  maxLength = 60,
  onCommit,
}: NameFieldProps) {
  // Keyed by the committed value rather than held across it: if the name changes
  // underneath — another tab, a profile switch — the draft is stale and is dropped.
  const [draft, setDraft] = useState<{ text: string; of: string } | null>(null);
  const text = draft && draft.of === value ? draft.text : value;

  const commit = () => {
    setDraft(null);
    if (text.trim() !== '' && text !== value) onCommit(text);
  };

  return (
    <input
      id={id}
      type="text"
      className={className}
      value={text}
      maxLength={maxLength}
      aria-label={label}
      onChange={(event) => setDraft({ text: event.target.value, of: value })}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        // Escape abandons the draft, and is swallowed only when there was one. On
        // the canvas the same key leaves edit mode, so always swallowing it would
        // make this field the one place Escape does nothing — a trap. With a draft
        // the first press undoes the typing and the second one still gets out.
        if (event.key === 'Escape' && draft) {
          event.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}
