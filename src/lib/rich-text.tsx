import { Fragment, type ReactNode } from 'react';

/**
 * A translated sentence with elements inside it: "Press [[key]] to add a widget." The
 * browser's message format substitutes only strings, so the sentence keeps a named
 * marker where an element goes, and a translation moves the marker wherever its
 * language wants it.
 *
 * `[[…]]` rather than `{…}`: @wxt-dev/i18n reserves braces for its own string
 * substitutions and would demand a value for each.
 */
export function richText(message: string, parts: Record<string, ReactNode>): ReactNode {
  return message.split(/\[\[(\w+)\]\]/).map((piece, i) =>
    // Odd indices are the captured marker names.
    i % 2 === 1 ? <Fragment key={i}>{parts[piece] ?? `[[${piece}]]`}</Fragment> : piece,
  );
}
