import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIG_VERSION,
  configSchema,
  profileSchema,
  type Profile,
  type StillpointConfig,
} from '@/core/config/schema';
import { computeGeometry } from '../geometry';
import EditMode from './EditMode';

/**
 * M2's definition of done, asserted: a widget can be added, dragged, resized,
 * duplicated and removed, by pointer and by keyboard.
 *
 * Drags are driven as raw pointer events rather than through `user-event`, because the
 * thing under test is the pixels-to-cells arithmetic and that needs real coordinates.
 * jsdom has no layout, so the geometry is supplied directly — which is exactly why
 * `computeGeometry` is a pure function the canvas passes down rather than something
 * each component measures for itself.
 */

const geometry = computeGeometry(
  profileSchema.parse({
    id: 'p',
    name: 'p',
    background: { kind: 'solid', color: '#000' },
  }).layout,
  { width: 1200, height: 600 },
);

const pitchX = geometry.cellWidth + geometry.gap;
const pitchY = geometry.cellHeight + geometry.gap;

function profile(widgets: unknown[] = []): Profile {
  return profileSchema.parse({
    id: 'p1',
    name: 'Focus',
    background: { kind: 'solid', color: '#000' },
    widgets,
  });
}

const clock = (id: string, x: number, y: number, w = 8, h = 3) => ({
  instanceId: id,
  type: 'stillpoint.clock',
  rect: { x, y, w, h },
});

/**
 * Renders EditMode against a live profile, the way NewTab drives it.
 *
 * `panelOpen` starts true because that is the real default: the panel belongs to edit
 * mode, not to the selection. Tests that want the canvas to themselves pass false.
 */
function setup(initial: Profile, options: { panelOpen?: boolean } = {}) {
  const state = { profile: initial, config: configFor(initial) };
  const onChange = vi.fn((next: Profile) => {
    state.profile = next;
    state.config = configFor(next);
    rerender();
  });
  const onChangeConfig = vi.fn((recipe: (c: StillpointConfig) => StillpointConfig) => {
    state.config = recipe(state.config);
    state.profile =
      state.config.profiles.find((p) => p.id === state.config.activeProfileId) ??
      state.profile;
    rerender();
  });
  const onCommit = vi.fn();
  const onExit = vi.fn();
  let panelOpen = options.panelOpen ?? true;
  const onTogglePanel = vi.fn(() => {
    panelOpen = !panelOpen;
    rerender();
  });
  let selected: string | null = null;
  const onSelect = vi.fn((id: string | null) => {
    selected = id;
    rerender();
  });

  const tree = () => (
    <EditMode
      geometry={geometry}
      config={state.config}
      profile={state.profile}
      selectedId={selected}
      panelOpen={panelOpen}
      onSelect={onSelect}
      onChange={onChange}
      onChangeConfig={onChangeConfig}
      onTogglePanel={onTogglePanel}
      onCommit={onCommit}
      onExit={onExit}
    />
  );

  const view = render(tree());
  const rerender = () => view.rerender(tree());

  return {
    state,
    onChange,
    onChangeConfig,
    onCommit,
    onExit,
    onSelect,
    onTogglePanel,
    view,
  };
}

/** The smallest config that holds this profile, so the panel has something to read. */
function configFor(profile: Profile): StillpointConfig {
  return configSchema.parse({
    version: CONFIG_VERSION,
    activeProfileId: profile.id,
    profiles: [profile],
    app: {},
  });
}

/** The overlay box for the nth widget, in config order. */
function widgetBox(index: number): HTMLElement {
  const all = document.querySelectorAll<HTMLElement>('[role="button"][aria-label]');
  return [...all].filter((el) => el.getAttribute('aria-label')?.includes('Clock'))[
    index
  ]!;
}

function pointer(el: HTMLElement, type: string, x: number, y: number) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
  });
  act(() => {
    el.dispatchEvent(event);
  });
}

describe('adding a widget', () => {
  it('lists the catalogue from the registry and adds what is picked', async () => {
    const user = userEvent.setup();
    const { state, onCommit } = setup(profile());

    await user.click(screen.getByRole('button', { name: 'Add widget' }));
    const menu = screen.getByRole('menu', { name: 'Add a widget' });
    await user.click(within(menu).getByRole('menuitem', { name: /Clock/ }));

    expect(state.profile.widgets).toHaveLength(1);
    expect(state.profile.widgets[0]!.type).toBe('stillpoint.clock');
    expect(onCommit).toHaveBeenCalled();
  });

  it('selects what it just added, so it can be nudged straight away', async () => {
    const user = userEvent.setup();
    const { state, onSelect } = setup(profile());

    await user.click(screen.getByRole('button', { name: 'Add widget' }));
    await user.click(screen.getByRole('menuitem', { name: /Clock/ }));

    expect(onSelect).toHaveBeenLastCalledWith(state.profile.widgets[0]!.instanceId);
  });

  it('closes the picker on Escape without leaving edit mode', async () => {
    const user = userEvent.setup();
    const { onExit } = setup(profile());

    await user.click(screen.getByRole('button', { name: 'Add widget' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe('dragging', () => {
  it('moves by whole cells, following the pointer', () => {
    const { state } = setup(profile([clock('a', 0, 0)]));
    const el = widgetBox(0);

    pointer(el, 'pointerdown', 0, 0);
    pointer(el, 'pointermove', pitchX * 3, pitchY * 2);
    pointer(el, 'pointerup', pitchX * 3, pitchY * 2);

    expect(state.profile.widgets[0]!.rect).toMatchObject({ x: 3, y: 2 });
  });

  it('ignores travel shorter than half a cell', () => {
    const { state, onChange } = setup(profile([clock('a', 4, 4)]));
    const el = widgetBox(0);

    pointer(el, 'pointerdown', 0, 0);
    pointer(el, 'pointermove', pitchX * 0.3, 0);

    expect(onChange).not.toHaveBeenCalled();
    expect(state.profile.widgets[0]!.rect.x).toBe(4);
  });

  it('refuses a drop onto another widget and keeps the last good position', () => {
    // 'a' at column 0 width 8, 'b' at column 10. Dragging 'a' right by 3 cells is
    // fine; by 4 it would overlap 'b' and must simply not be taken.
    const { state } = setup(profile([clock('a', 0, 0), clock('b', 10, 0)]));
    const el = widgetBox(0);

    pointer(el, 'pointerdown', 0, 0);
    pointer(el, 'pointermove', pitchX * 2, 0);
    expect(state.profile.widgets[0]!.rect.x).toBe(2);

    pointer(el, 'pointermove', pitchX * 5, 0);
    expect(state.profile.widgets[0]!.rect.x).toBe(2);
    expect(state.profile.widgets[1]!.rect.x).toBe(10);

    pointer(el, 'pointerup', pitchX * 5, 0);
  });

  it('stops at the grid edge', () => {
    const { state } = setup(profile([clock('a', 0, 0)]));
    const el = widgetBox(0);

    pointer(el, 'pointerdown', 0, 0);
    pointer(el, 'pointermove', pitchX * 100, pitchY * 100);
    pointer(el, 'pointerup', pitchX * 100, pitchY * 100);

    expect(state.profile.widgets[0]!.rect).toEqual({ x: 16, y: 9, w: 8, h: 3 });
  });

  it('flushes the debounced write when the drag ends, not during it', () => {
    const { onCommit } = setup(profile([clock('a', 0, 0)]));
    const el = widgetBox(0);

    pointer(el, 'pointerdown', 0, 0);
    pointer(el, 'pointermove', pitchX * 2, 0);
    expect(onCommit).not.toHaveBeenCalled();

    pointer(el, 'pointerup', pitchX * 2, 0);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

describe('resizing', () => {
  it('resizes from the handle that was grabbed', () => {
    const { state } = setup(profile([clock('a', 4, 4)]));
    const el = widgetBox(0);
    pointer(el, 'pointerdown', 0, 0);
    pointer(el, 'pointerup', 0, 0);

    const handle = document.querySelector<HTMLElement>('[data-handle="se"]')!;
    pointer(handle, 'pointerdown', 0, 0);
    pointer(handle, 'pointermove', pitchX * 2, pitchY * 1);
    pointer(handle, 'pointerup', pitchX * 2, pitchY * 1);

    expect(state.profile.widgets[0]!.rect).toEqual({ x: 4, y: 4, w: 10, h: 4 });
  });

  it('keeps the opposite edge pinned when resizing from the north-west', () => {
    const { state } = setup(profile([clock('a', 4, 4)]));
    const el = widgetBox(0);
    pointer(el, 'pointerdown', 0, 0);
    pointer(el, 'pointerup', 0, 0);

    const handle = document.querySelector<HTMLElement>('[data-handle="nw"]')!;
    pointer(handle, 'pointerdown', 0, 0);
    pointer(handle, 'pointermove', -pitchX * 2, -pitchY * 1);
    pointer(handle, 'pointerup', -pitchX * 2, -pitchY * 1);

    const rect = state.profile.widgets[0]!.rect;
    expect(rect).toEqual({ x: 2, y: 3, w: 10, h: 4 });
    expect(rect.x + rect.w).toBe(12);
  });

  it('shows handles only on the selected widget', () => {
    setup(profile([clock('a', 0, 0), clock('b', 10, 0)]));
    expect(document.querySelectorAll('[data-handle]')).toHaveLength(0);

    pointer(widgetBox(0), 'pointerdown', 0, 0);
    expect(document.querySelectorAll('[data-handle]')).toHaveLength(8);
  });
});

describe('keyboard', () => {
  it('nudges one cell per arrow press', async () => {
    const user = userEvent.setup();
    const { state } = setup(profile([clock('a', 4, 4)]));

    widgetBox(0).focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}');

    expect(state.profile.widgets[0]!.rect).toMatchObject({ x: 6, y: 5 });
  });

  it('resizes with shift held', async () => {
    const user = userEvent.setup();
    const { state } = setup(profile([clock('a', 4, 4)]));

    widgetBox(0).focus();
    await user.keyboard('{Shift>}{ArrowRight}{ArrowDown}{/Shift}');

    expect(state.profile.widgets[0]!.rect).toMatchObject({ w: 9, h: 4 });
  });

  it('will not nudge a widget on top of another', async () => {
    const user = userEvent.setup();
    const { state } = setup(profile([clock('a', 0, 0), clock('b', 8, 0)]));

    widgetBox(0).focus();
    await user.keyboard('{ArrowRight}');

    expect(state.profile.widgets[0]!.rect.x).toBe(0);
  });

  it('duplicates with the platform modifier and D', async () => {
    const user = userEvent.setup();
    const { state } = setup(profile([clock('a', 0, 0)]));

    widgetBox(0).focus();
    await user.keyboard('{Control>}d{/Control}');

    expect(state.profile.widgets).toHaveLength(2);
    expect(state.profile.widgets[1]!.instanceId).not.toBe('a');
    expect(state.profile.widgets[1]!.rect).not.toEqual(state.profile.widgets[0]!.rect);
  });

  it('removes with Delete and clears the selection', async () => {
    const user = userEvent.setup();
    const { state, onSelect } = setup(profile([clock('a', 0, 0)]));

    widgetBox(0).focus();
    await user.keyboard('{Delete}');

    expect(state.profile.widgets).toHaveLength(0);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('reaches every widget with Tab, in reading order', async () => {
    const user = userEvent.setup();
    setup(profile([clock('a', 0, 0), clock('b', 10, 0)]));

    widgetBox(0).focus();
    await user.tab();
    expect(document.activeElement).toBe(widgetBox(1));
  });

  it('describes each widget for a screen reader', () => {
    setup(profile([clock('a', 8, 4)]));
    expect(widgetBox(0).getAttribute('aria-label')).toBe(
      'Clock, column 9, row 5, 8 by 3 cells',
    );
  });
});

describe('leaving', () => {
  it('exits from the toolbar', async () => {
    const user = userEvent.setup();
    const { onExit } = setup(profile([clock('a', 0, 0)]));

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('deselects when the empty canvas is clicked', () => {
    const { onSelect } = setup(profile([clock('a', 0, 0)]));
    pointer(widgetBox(0), 'pointerdown', 0, 0);
    expect(onSelect).toHaveBeenLastCalledWith('a');

    const layer = widgetBox(0).parentElement!;
    pointer(layer, 'pointerdown', 500, 500);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});

describe('the settings panel', () => {
  it('is open from the start, on the page settings, with nothing selected', () => {
    setup(profile([clock('a', 0, 0)]));

    // Categories collapsed, each carrying its value. Five expanded at once were
    // taller than the window.
    const panel = screen.getByRole('complementary', { name: 'Page settings' });
    expect(within(panel).getByRole('button', { name: /^Theme/ })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: /^Layout24 × 12/ })).toBeTruthy();
    expect(within(panel).queryByLabelText('Columns')).toBeNull();
  });

  it('switches to the widget’s settings on selection, and back again', async () => {
    setup(profile([clock('a', 0, 0)]));

    await userEvent.click(widgetBox(0));
    expect(screen.getByRole('complementary', { name: 'Clock settings' })).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to page settings' }),
    );
    expect(screen.getByRole('complementary', { name: 'Page settings' })).toBeTruthy();
  });

  it('writes a setting through to the profile, leaving the layout alone', async () => {
    const { state } = setup(profile([clock('a', 2, 1)]));
    await userEvent.click(widgetBox(0));
    await userEvent.click(screen.getByLabelText('Show seconds'));

    expect(state.profile.widgets[0]?.settings).toMatchObject({ showSeconds: true });
    expect(state.profile.widgets[0]?.rect).toEqual({ x: 2, y: 1, w: 8, h: 3 });
  });

  it('changes the grid and brings the widgets with it', async () => {
    const { state } = setup(profile([clock('a', 12, 0)]));
    await userEvent.click(screen.getByRole('button', { name: /^Layout/ }));

    // One deliberate step, not a typed sequence: 24 → 4 → 48 would rescale twice and
    // round the widget away in between, which is the whole reason this is a number
    // field and not a slider.
    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '48' } });

    expect(state.profile.layout.columns).toBe(48);
    // Half way across a 24-column grid is still half way across a 48-column one.
    expect(state.profile.widgets[0]?.rect).toMatchObject({ x: 24, w: 16 });
  });

  it('hides on request and comes back from the toolbar', async () => {
    setup(profile([clock('a', 0, 0)]));

    await userEvent.click(screen.getByRole('button', { name: 'Hide settings' }));
    expect(screen.queryByRole('complementary')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('complementary', { name: 'Page settings' })).toBeTruthy();
  });

  it('stays out of the way when it is closed', () => {
    setup(profile([clock('a', 0, 0)]), { panelOpen: false });
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('does not deselect when the panel itself is clicked', async () => {
    setup(profile([clock('a', 0, 0)]));
    await userEvent.click(widgetBox(0));
    await userEvent.click(screen.getByLabelText('Size'));
    expect(screen.getByRole('complementary')).toBeTruthy();
  });
});
