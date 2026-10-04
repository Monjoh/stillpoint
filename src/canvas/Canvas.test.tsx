import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profileSchema, type Profile } from '@/core/config/schema';

/**
 * The canvas and the frame are tested against a registry of throwaway widgets rather
 * than the real one. The behaviour under test is isolation — a widget that throws, a
 * widget that is missing, a widget whose settings are unusable — and provoking those
 * with the real clock would mean breaking the clock on purpose.
 */
const probe = vi.hoisted(() => ({ throwOnRender: true }));

vi.mock('@/core/registry', async () => {
  const { createRegistry } = await import('@/core/registry/registry');
  const { z } = await import('zod');
  const { createElement } = await import('react');

  const base = {
    description: '',
    category: 'info' as const,
    icon: 'M0 0',
    defaultSize: { w: 4, h: 2 },
  };

  return {
    widgetRegistry: createRegistry([
      {
        ...base,
        id: 'test.good',
        name: 'Good',
        settingsSchema: z.object({ label: z.string().default('hello') }),
        component: () =>
          Promise.resolve({
            default: ({ settings }: { settings: { label: string } }) =>
              createElement('span', null, settings.label),
          }),
      },
      {
        ...base,
        id: 'test.broken',
        name: 'Broken',
        settingsSchema: z.object({}),
        component: () =>
          Promise.resolve({
            default: () => {
              if (probe.throwOnRender) throw new Error('kaboom');
              return createElement('span', null, 'recovered');
            },
          }),
      },
      {
        ...base,
        id: 'test.needs-key',
        name: 'Needs key',
        // No default, so there is nothing to fall back to — the frame has to say so
        // rather than render the widget with undefined settings.
        settingsSchema: z.object({ apiKey: z.string() }),
        component: () => Promise.resolve({ default: () => createElement('span') }),
      },
    ]),
  };
});

const { Canvas } = await import('./Canvas');

function profile(widgets: unknown[]): Profile {
  return profileSchema.parse({
    id: 'p1',
    name: 'Test',
    background: { kind: 'solid', color: '#000' },
    widgets,
  });
}

const instance = (type: string, x = 0, settings: unknown = {}) => ({
  instanceId: `${type}-${x}`,
  type,
  rect: { x, y: 0, w: 4, h: 2 },
  settings,
});

beforeEach(() => {
  probe.throwOnRender = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Canvas', () => {
  it('renders each widget once the canvas has been measured', async () => {
    render(<Canvas profile={profile([instance('test.good')])} isEditing={false} />);
    expect(await screen.findByText('hello')).toBeTruthy();
  });

  it('positions widgets from grid cells, not pixels in the config', async () => {
    const { container } = render(
      <Canvas profile={profile([instance('test.good', 12)])} isEditing={false} />,
    );
    await screen.findByText('hello');

    // 1200px wide, 24 columns, 12px gap → cell 38.5, pitch 50.5, column 12 → 606px.
    const frame = container.querySelector<HTMLElement>('[data-widget-type]');
    expect(frame?.style.left).toBe('606px');
  });

  it('contains a thrown render and leaves its neighbour working', async () => {
    render(
      <Canvas
        profile={profile([instance('test.good'), instance('test.broken', 8)])}
        isEditing={false}
      />,
    );

    expect(await screen.findByText('hello')).toBeTruthy();
    expect(await screen.findByText('Broken failed')).toBeTruthy();
    expect(screen.getByText('kaboom')).toBeTruthy();
  });

  it('logs a failed widget once, naming it', async () => {
    render(<Canvas profile={profile([instance('test.broken')])} isEditing={false} />);
    await screen.findByText('Broken failed');

    const logged = vi
      .mocked(console.error)
      .mock.calls.filter((call) => String(call[0]).includes('[stillpoint]'));
    expect(logged).toHaveLength(1);
    expect(String(logged[0]?.[0])).toContain('"Broken"');
  });

  it('recovers when Retry is pressed and the widget works the second time', async () => {
    const user = userEvent.setup();
    render(<Canvas profile={profile([instance('test.broken')])} isEditing={false} />);
    await screen.findByText('Broken failed');

    probe.throwOnRender = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('recovered')).toBeTruthy();
  });

  it('holds the place of a widget type this build does not have', async () => {
    render(
      <Canvas profile={profile([instance('removed.widget')])} isEditing={false} />,
    );
    expect(await screen.findByText('Widget not available')).toBeTruthy();
  });

  it('says so when settings cannot be read at all', async () => {
    render(
      <Canvas profile={profile([instance('test.needs-key')])} isEditing={false} />,
    );
    expect(await screen.findByText('Settings could not be read')).toBeTruthy();
  });

  it('offers Remove only in edit mode', async () => {
    const onRemoveWidget = vi.fn();
    const { rerender } = render(
      <Canvas
        profile={profile([instance('test.broken')])}
        isEditing={false}
        onRemoveWidget={onRemoveWidget}
      />,
    );
    await screen.findByText('Broken failed');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();

    rerender(
      <Canvas
        profile={profile([instance('test.broken')])}
        isEditing
        onRemoveWidget={onRemoveWidget}
      />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemoveWidget).toHaveBeenCalledWith('test.broken-0');
  });
});
