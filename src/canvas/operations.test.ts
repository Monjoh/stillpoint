import { describe, expect, it } from 'vitest';
import { profileSchema, type Profile } from '@/core/config/schema';
import type { AnyWidgetDefinition } from '@/core/registry/types';
import {
  addWidget,
  centredRect,
  duplicateWidget,
  findFreeRect,
  placeWidget,
  removeWidget,
  setLayout,
  updateWidgetFrame,
  updateWidgetSettings,
  withProfile,
} from './operations';

function profile(widgets: unknown[] = [], layout?: Record<string, number>): Profile {
  return profileSchema.parse({
    id: 'p1',
    name: 'Test',
    background: { kind: 'solid', color: '#000' },
    ...(layout ? { layout } : {}),
    widgets,
  });
}

/** Stands in for a real widget: `operations` only ever reads `id` and `defaultSize`,
 *  and the canvas is not allowed to import a widget directly anyway. */
const testWidget = {
  id: 'stillpoint.clock',
  defaultSize: { w: 8, h: 3 },
} as AnyWidgetDefinition;

const at = (x: number, y: number, w: number, h: number, id = `w${x}${y}`) => ({
  instanceId: id,
  type: 'stillpoint.clock',
  rect: { x, y, w, h },
});

describe('findFreeRect', () => {
  it('returns the top-left slot on an empty grid', () => {
    expect(findFreeRect(profile(), { w: 4, h: 2 })).toEqual({ x: 0, y: 0, w: 4, h: 2 });
  });

  it('skips past an occupied slot in reading order', () => {
    const p = profile([at(0, 0, 4, 2)]);
    expect(findFreeRect(p, { w: 4, h: 2 })).toEqual({ x: 4, y: 0, w: 4, h: 2 });
  });

  it('returns null when nothing fits', () => {
    const p = profile([at(0, 0, 24, 12)]);
    expect(findFreeRect(p, { w: 1, h: 1 })).toBeNull();
  });
});

describe('addWidget', () => {
  it('places the widget and fills in the frame defaults from the schema', () => {
    const next = addWidget(profile(), testWidget);
    const added = next.widgets[0]!;

    expect(next.widgets).toHaveLength(1);
    expect(added.type).toBe('stillpoint.clock');
    expect(added.rect).toEqual({ x: 0, y: 0, ...testWidget.defaultSize });
    expect(added.frame.align).toBe('center');
    expect(added.settings).toEqual({});
  });

  it('centres the widget when the grid is full rather than refusing to add it', () => {
    const p = profile([at(0, 0, 24, 12)]);
    const next = addWidget(p, testWidget);
    expect(next.widgets[1]!.rect).toEqual(centredRect(p, testWidget.defaultSize));
  });

  it('does not mutate the profile it was given', () => {
    const p = profile();
    addWidget(p, testWidget);
    expect(p.widgets).toHaveLength(0);
  });

  it('clamps an oversized explicit rect into the grid', () => {
    const next = addWidget(profile(), testWidget, {
      rect: { x: 30, y: 30, w: 40, h: 40 },
    });
    expect(next.widgets[0]!.rect).toEqual({ x: 0, y: 0, w: 24, h: 12 });
  });
});

describe('duplicateWidget', () => {
  it('copies settings but never the instance id', () => {
    const p = profile([{ ...at(0, 0, 4, 2, 'a'), settings: { format: '12h' } }]);
    const next = duplicateWidget(p, 'a');
    const copy = next.widgets[1]!;

    expect(next.widgets).toHaveLength(2);
    expect(copy.instanceId).not.toBe('a');
    expect(copy.settings).toEqual({ format: '12h' });
    // The first free slot, not an offset copy sitting on top of the original.
    expect(copy.rect).toEqual({ x: 4, y: 0, w: 4, h: 2 });
  });

  it('offsets from the original when the grid has no room left', () => {
    const p = profile([at(0, 0, 24, 12, 'a')]);
    const copy = duplicateWidget(p, 'a').widgets[1]!;
    expect(copy.rect).toEqual({ x: 0, y: 0, w: 24, h: 12 });
    expect(copy.instanceId).not.toBe('a');
  });

  it('is a no-op for an unknown instance', () => {
    const p = profile([at(0, 0, 4, 2, 'a')]);
    expect(duplicateWidget(p, 'nope')).toBe(p);
  });
});

describe('removeWidget / placeWidget / updateWidgetSettings', () => {
  it('removes by instance id', () => {
    const p = profile([at(0, 0, 4, 2, 'a'), at(5, 0, 4, 2, 'b')]);
    expect(removeWidget(p, 'a').widgets.map((w) => w.instanceId)).toEqual(['b']);
  });

  it('clamps on place, so a drag past the edge cannot leave the canvas', () => {
    const p = profile([at(0, 0, 4, 2, 'a')]);
    expect(placeWidget(p, 'a', { x: 99, y: 99, w: 4, h: 2 }).widgets[0]!.rect).toEqual({
      x: 20,
      y: 10,
      w: 4,
      h: 2,
    });
  });

  it('replaces settings wholesale', () => {
    const p = profile([at(0, 0, 4, 2, 'a')]);
    const next = updateWidgetSettings(p, 'a', { format: '12h' });
    expect(next.widgets[0]!.settings).toEqual({ format: '12h' });
  });
});

describe('withProfile', () => {
  it('swaps one profile and leaves the rest of the tree identical', () => {
    const a = profile();
    const b = { ...profile(), id: 'p2' };
    const config = { profiles: [a, b], activeProfileId: 'p1' };
    const edited = addWidget(a, testWidget);

    const next = withProfile(config, edited);
    expect(next.profiles[0]!.widgets).toHaveLength(1);
    expect(next.profiles[1]).toBe(b);
    expect(next.activeProfileId).toBe('p1');
  });
});

describe('setLayout', () => {
  const grid = (columns: number, rows: number, gap = 12) => ({
    columns,
    rows,
    gap,
    maxWidth: 1600,
  });

  it('keeps each widget on the same fraction of the page when the grid grows', () => {
    const p = profile([at(12, 6, 8, 3, 'a')]);
    const next = setLayout(p, grid(48, 24));

    expect(next.layout.columns).toBe(48);
    expect(next.widgets[0]!.rect).toEqual({ x: 24, y: 12, w: 16, h: 6 });
  });

  // The destructive alternative, written down so it is not quietly reintroduced:
  // clamping into the smaller grid would pile every widget into the top-left corner
  // and lose the positions, so going back up could not restore them.
  it('shrinks proportionally rather than clamping into the corner', () => {
    const p = profile([at(0, 0, 8, 4, 'a'), at(16, 8, 8, 4, 'b')]);
    const next = setLayout(p, grid(12, 6));

    expect(next.widgets[0]!.rect).toEqual({ x: 0, y: 0, w: 4, h: 2 });
    expect(next.widgets[1]!.rect).toEqual({ x: 8, y: 4, w: 4, h: 2 });
  });

  it('leaves every rect byte-identical when only the gap moves', () => {
    const p = profile([at(3, 1, 8, 3, 'a')]);
    const next = setLayout(p, grid(24, 12, 32));

    expect(next.layout.gap).toBe(32);
    expect(next.widgets[0]).toBe(p.widgets[0]);
  });

  it('never rounds a widget away to nothing', () => {
    const p = profile([at(0, 0, 2, 1, 'a')]);
    const next = setLayout(p, grid(4, 4));

    expect(next.widgets[0]!.rect.w).toBeGreaterThanOrEqual(1);
    expect(next.widgets[0]!.rect.h).toBeGreaterThanOrEqual(1);
  });

  it('keeps a widget at the far edge inside the new grid', () => {
    const p = profile([at(20, 9, 4, 3, 'a')]);
    const next = setLayout(p, grid(10, 5));
    const r = next.widgets[0]!.rect;

    expect(r.x + r.w).toBeLessThanOrEqual(10);
    expect(r.y + r.h).toBeLessThanOrEqual(5);
  });

  // Rounding is lossy on purpose — hence a number box rather than a slider — but it
  // must stay lossy in a bounded way rather than drifting the layout off the page.
  it('survives a round trip with everything still on the canvas', () => {
    const p = profile([at(0, 0, 8, 3, 'a'), at(12, 6, 6, 4, 'b')]);
    const back = setLayout(setLayout(p, grid(48, 24)), grid(24, 12));

    expect(back.widgets.map((w) => w.rect)).toEqual(p.widgets.map((w) => w.rect));
  });
});

describe('updateWidgetFrame', () => {
  it('replaces one widget’s frame and leaves the rest alone', () => {
    const before = profile([at(0, 0, 4, 2, 'a'), at(4, 0, 4, 2, 'b')]);
    const frame = {
      showBackground: true,
      opacity: 80,
      align: 'start' as const,
    };
    const after = updateWidgetFrame(before, 'a', frame);

    expect(after.widgets[0]!.frame).toEqual(frame);
    expect(after.widgets[0]!.rect).toEqual(before.widgets[0]!.rect);
    expect(after.widgets[1]).toBe(before.widgets[1]);
  });
});
