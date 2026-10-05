/**
 * The font stacks a `control: 'font'` field can choose from.
 *
 * Bundled stacks only — nothing is fetched. Every entry resolves to a face that is
 * already on a typical macOS, Windows or Linux machine, with a generic family last so
 * the worst case is the platform default rather than an invisible widget.
 *
 * Grown by hand, not by scanning the system: `queryLocalFonts` needs a permission
 * prompt and a secure context, and a list the user has to approve before they can
 * change a font is worse than eight good choices.
 */
export interface FontStack {
  /** Its name is `fontName(id)`, in settings/names.ts. */
  id: string;
  stack: string;
}

export const FONT_STACKS: FontStack[] = [
  {
    id: 'system',
    stack:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  { id: 'grotesk', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'humanist', stack: 'Avenir, "Avenir Next", Corbel, "Gill Sans", sans-serif' },
  { id: 'geometric', stack: 'Futura, "Century Gothic", "URW Gothic", sans-serif' },
  { id: 'serif', stack: 'Georgia, "Iowan Old Style", "Times New Roman", serif' },
  {
    id: 'oldStyle',
    stack: '"Hoefler Text", "Baskerville Old Face", Garamond, serif',
  },
  { id: 'slab', stack: 'Rockwell, "Roboto Slab", "Courier New", serif' },
  { id: 'monospace', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
];
