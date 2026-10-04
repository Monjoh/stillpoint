import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { widgetInstanceSchema, type WidgetInstance } from '@/core/config/schema';
import { SettingsPanel } from './SettingsPanel';

/**
 * The panel against the real clock definition and the real registry, because the
 * claim being tested is M3's: the clock's entire settings UI comes out of its schema
 * with no hand-written form anywhere.
 */

function instance(settings: unknown = {}, type = 'stillpoint.clock'): WidgetInstance {
  return widgetInstanceSchema.parse({
    instanceId: 'w1',
    type,
    rect: { x: 0, y: 0, w: 8, h: 3 },
    settings,
  });
}

function setup(options: { instance?: WidgetInstance } = {}) {
  const onChangeSettings = vi.fn();
  const onCommit = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <SettingsPanel
      instance={options.instance ?? instance()}
      onChangeSettings={onChangeSettings}
      onCommit={onCommit}
      onClose={onClose}
    />,
  );
  return { onChangeSettings, onCommit, onClose, view };
}

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
    const { view } = setup();
    expect(screen.queryByLabelText('Show AM/PM')).toBeNull();

    view.rerender(
      <SettingsPanel
        instance={instance({ format: '12h' })}
        onChangeSettings={vi.fn()}
        onCommit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
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

  it('closes without writing anything', async () => {
    const { onClose, onChangeSettings } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(onClose).toHaveBeenCalled();
    expect(onChangeSettings).not.toHaveBeenCalled();
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
