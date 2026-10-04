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
