import { describe, expect, it } from 'vitest';
import { layoutSchema, type WidgetInstance } from '@/core/config/schema';
import { alignmentGuides } from './guides';

const layout = layoutSchema.parse({ columns: 24, rows: 12 });
const widget = (id: string, x: number, y: number, w: number, h: number) =>
  ({ instanceId: id, rect: { x, y, w, h } }) as WidgetInstance;

describe('alignmentGuides', () => {
  it('finds nothing when nothing lines up', () => {
    expect(
      alignmentGuides({ x: 1, y: 1, w: 3, h: 3 }, [widget('b', 7, 7, 3, 3)], layout),
    ).toEqual([]);
  });

  it('marks the canvas centre when the dragged widget is centred', () => {
    // 24 columns, 8 wide, starting at 8 → centre 12, which is the canvas centre.
    const guides = alignmentGuides({ x: 8, y: 1, w: 8, h: 2 }, [], layout);
    expect(guides).toContainEqual({ axis: 'x', at: 12, kind: 'canvas' });
  });

  it('marks a shared edge with another widget', () => {
    const guides = alignmentGuides(
      { x: 4, y: 6, w: 3, h: 2 },
      [widget('b', 4, 1, 5, 2)],
      layout,
    );
    expect(guides).toContainEqual({ axis: 'x', at: 4, kind: 'widget' });
  });

  it('matches centres, including on a half cell', () => {
    // Both are centred on column 5.5.
    const guides = alignmentGuides(
      { x: 4, y: 6, w: 3, h: 2 },
      [widget('b', 3, 1, 5, 2)],
      layout,
    );
    expect(guides).toContainEqual({ axis: 'x', at: 5.5, kind: 'widget' });
  });

  it('never lines a widget up against itself', () => {
    const self = widget('a', 4, 4, 3, 3);
    expect(alignmentGuides(self.rect, [self], layout, 'a')).toEqual([]);
  });

  it('prefers the canvas line when both would land in the same place', () => {
    // A widget edge also sitting on the canvas centre must not downgrade the line.
    const guides = alignmentGuides(
      { x: 12, y: 1, w: 4, h: 2 },
      [widget('b', 12, 8, 4, 2)],
      layout,
    );
    expect(guides.filter((g) => g.axis === 'x' && g.at === 12)).toEqual([
      { axis: 'x', at: 12, kind: 'canvas' },
    ]);
  });
});
