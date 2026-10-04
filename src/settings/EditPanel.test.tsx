import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIG_VERSION,
  configSchema,
  profileSchema,
  widgetInstanceSchema,
  type Profile,
  type StillpointConfig,
  type WidgetInstance,
} from '@/core/config/schema';
import { EditPanel } from './EditPanel';

/**
 * The panel against the real clock definition and the real registry, because the
 * claim being tested is M3's: the clock's entire settings UI comes out of its schema
 * with no hand-written form anywhere.
 *
 * The shell's own claim is newer and tested here too — one sidebar, two states, and
 * it does not come and go with the selection.
 */

function instance(settings: unknown = {}, type = 'stillpoint.clock'): WidgetInstance {
  return widgetInstanceSchema.parse({
    instanceId: 'w1',
    type,
    rect: { x: 0, y: 0, w: 8, h: 3 },
    settings,
  });
}

function profile(): Profile {
  return profileSchema.parse({
    id: 'p1',
    name: 'Focus',
    background: { kind: 'solid', color: '#000' },
  });
}

function config(profiles: Profile[] = [profile()]): StillpointConfig {
  return configSchema.parse({
    version: CONFIG_VERSION,
    activeProfileId: profiles[0]!.id,
    profiles,
    app: {},
  });
}

/** `instance: null` is the no-selection state; omitting it gives a clock. */
function setup(options: { instance?: WidgetInstance | null } = {}) {
  const handlers = {
    onChangeSettings: vi.fn(),
    onChangeLayout: vi.fn(),
    onChangeTheme: vi.fn(),
    onChangeBackground: vi.fn(),
    onChangeConfig: vi.fn(),
    onBack: vi.fn(),
    onHide: vi.fn(),
    onCommit: vi.fn(),
  };
  const selected =
    options.instance === null ? undefined : (options.instance ?? instance());

  const tree = (shown: WidgetInstance | undefined) => (
    <EditPanel config={config()} profile={profile()} instance={shown} {...handlers} />
  );

  const view = render(tree(selected));
  return { ...handlers, view, tree };
}

describe('the shell', () => {
  it('shows the page settings when nothing is selected, and offers no way back', () => {
    setup({ instance: null });

    expect(screen.getByRole('complementary', { name: 'Page settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to page settings' })).toBeNull();
  });

  it('names the selected widget and offers the way back', async () => {
    const { onBack } = setup();

    expect(screen.getByRole('complementary', { name: 'Clock settings' })).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to page settings' }),
    );
    expect(onBack).toHaveBeenCalled();
  });

  // Hiding is about the width, not about the selection: the two used to be the same
  // thing and the canvas moved under the cursor every time a widget was clicked.
  it('hides without touching the selection or writing anything', async () => {
    const { onHide, onBack, onChangeSettings } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Hide settings' }));
    expect(onHide).toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    expect(onChangeSettings).not.toHaveBeenCalled();
  });
});

describe('the clock’s generated panel', () => {
  it('renders every field the schema declares, and nothing hand-written', () => {
    setup();
    const panel = screen.getByRole('complementary', { name: 'Clock settings' });

    expect(screen.getByRole('group', { name: 'Time format' })).toBeTruthy();
    expect(screen.getByLabelText('Show seconds')).toBeTruthy();
    expect(screen.getByLabelText('Size')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Weight' })).toBeTruthy();
    expect(screen.getByLabelText('Time zone')).toBeTruthy();

    // No form element and no submit: every change is written through, and an Apply
    // button on a live preview is a lie about when the change took effect.
    expect(panel.querySelector('form')).toBeNull();
    expect(screen.queryByRole('button', { name: /apply|save|ok/i })).toBeNull();
  });

  it('shows the stored value, not the schema default', () => {
    setup({ instance: instance({ fontSize: 120, showSeconds: true }) });
    expect(screen.getByLabelText('Size')).toHaveProperty('value', '120');
    expect(screen.getByLabelText('Show seconds')).toHaveProperty('checked', true);
  });

  it('writes the whole settings object back, with the one field changed', async () => {
    const { onChangeSettings } = setup();
    await userEvent.click(screen.getByLabelText('Show seconds'));

    expect(onChangeSettings).toHaveBeenCalledWith(
      'w1',
      expect.objectContaining({ showSeconds: true, format: '24h', fontSize: 72 }),
    );
  });

  // The roadmap's own criterion for M3.
  it('hides Show AM/PM in 24-hour time and reveals it in 12-hour', () => {
    const { view, tree } = setup();
    expect(screen.queryByLabelText('Show AM/PM')).toBeNull();

    view.rerender(tree(instance({ format: '12h' })));
    expect(screen.getByLabelText('Show AM/PM')).toBeTruthy();
  });

  it('resets by storing nothing, so the schema defines the defaults', async () => {
    const { onChangeSettings, onCommit } = setup({
      instance: instance({ fontSize: 200 }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(onChangeSettings).toHaveBeenCalledWith('w1', {});
    expect(onCommit).toHaveBeenCalled();
  });

  it('flushes the debounced write when focus leaves the panel', async () => {
    const { onCommit } = setup();
    render(<button type="button">elsewhere</button>);

    await userEvent.click(screen.getByLabelText('Show seconds'));
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(onCommit).toHaveBeenCalled();
  });
});

describe('a widget type that is not installed', () => {
  // The instance survives a downgrade; so must its settings.
  it('says so and offers no controls rather than editing a guess', () => {
    const { onChangeSettings } = setup({
      instance: instance({ keep: 'this' }, 'someone.else'),
    });
    expect(screen.getByText(/is not installed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset to defaults' })).toBeNull();
    expect(onChangeSettings).not.toHaveBeenCalled();
  });
});
