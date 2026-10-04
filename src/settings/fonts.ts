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
  name: string;
  stack: string;
}

export const FONT_STACKS: FontStack[] = [
  {
    name: 'System',
    stack:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  { name: 'Grotesk', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { name: 'Humanist', stack: 'Avenir, "Avenir Next", Corbel, "Gill Sans", sans-serif' },
  { name: 'Geometric', stack: 'Futura, "Century Gothic", "URW Gothic", sans-serif' },
  { name: 'Serif', stack: 'Georgia, "Iowan Old Style", "Times New Roman", serif' },
  {
    name: 'Old style',
    stack: '"Hoefler Text", "Baskerville Old Face", Garamond, serif',
  },
  { name: 'Slab', stack: 'Rockwell, "Roboto Slab", "Courier New", serif' },
  { name: 'Monospace', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
];
