import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { worldClocksSettingsSchema } from './definition';
import WorldClocksView from './WorldClocksView';

const size = { width: 400, height: 300 };
const settings = (overrides: Record<string, unknown> = {}) =>
  worldClocksSettingsSchema.parse(overrides);

describe('WorldClocksView', () => {
  // The difference is from this device; pin the device to London in winter (UTC).
  const deviceZone = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = 'UTC';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-15T23:04:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    if (deviceZone === undefined) delete process.env.TZ;
    else process.env.TZ = deviceZone;
  });

  it('shows three cities untouched, each with its own time', () => {
    render(<WorldClocksView settings={settings()} size={size} isEditing={false} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => within(item).getByText(/^\D+$/).textContent)).toEqual([
      'London',
      'New York',
      'Tokyo',
    ]);
    expect(within(items[0]!).getByText('23:04')).toBeTruthy();
    expect(within(items[1]!).getByText('18:04')).toBeTruthy();
    expect(within(items[2]!).getByText('08:04')).toBeTruthy();
  });

  it('uses the name the user gave, and calls the device zone "Here"', () => {
    render(
      <WorldClocksView
        settings={settings({
          clocks: [
            { timezone: 'Asia/Tokyo', label: 'Office' },
            { timezone: null, label: '' },
          ],
        })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByText('Office')).toBeTruthy();
    expect(screen.getByText('Here')).toBeTruthy();
  });

  it('shows a zone the browser does not know as the device time, not a wrong city', () => {
    render(
      <WorldClocksView
        settings={settings({ clocks: [{ timezone: 'Mars/Olympus', label: '' }] })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByText('Here')).toBeTruthy();
    expect(screen.queryByText('Olympus')).toBeNull();
  });

  it('says how to add a city when the list is empty', () => {
    render(
      <WorldClocksView
        settings={settings({ clocks: [] })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByText(/No cities yet/)).toBeTruthy();
  });

  it('drops the difference line when asked', () => {
    const { rerender } = render(
      <WorldClocksView settings={settings()} size={size} isEditing={false} />,
    );
    expect(screen.getByText(/tomorrow/)).toBeTruthy();
    rerender(
      <WorldClocksView
        settings={settings({ showDifference: false })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.queryByText(/tomorrow/)).toBeNull();
  });
});
