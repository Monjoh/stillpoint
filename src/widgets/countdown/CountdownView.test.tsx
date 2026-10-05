import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countdownSettingsSchema } from './definition';
import CountdownView from './CountdownView';

const size = { width: 400, height: 200 };
const show = (overrides: Record<string, unknown>) =>
  render(
    <CountdownView
      settings={countdownSettingsSchema.parse(overrides)}
      size={size}
      isEditing={false}
    />,
  );

describe('CountdownView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 9, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('asks for a date until it has one', () => {
    show({});
    expect(screen.getByText('Pick a date in this widget’s settings.')).toBeTruthy();
  });

  it('counts the days until a named date', () => {
    show({ title: 'Holidays', date: '2026-12-25' });
    expect(screen.getByText('42 days')).toBeTruthy();
    expect(screen.getByText('until Holidays')).toBeTruthy();
  });

  it('names the date itself when there is no title', () => {
    show({ date: '2026-12-25' });
    expect(screen.getByText(/^until .*25.*2026/)).toBeTruthy();
  });

  it('says Today on the day, then counts the days since', () => {
    const { unmount } = show({ title: 'Launch', date: '2026-11-13' });
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Launch')).toBeTruthy();
    unmount();

    show({ title: 'Launch', date: '2026-11-10' });
    expect(screen.getByText('3 days')).toBeTruthy();
    expect(screen.getByText('since Launch')).toBeTruthy();
  });

  it('shows days, hours and minutes, to a time', () => {
    show({ title: 'Flight', date: '2026-11-15', time: '18:30', display: 'full' });
    expect(screen.getByText('2d 9h 30m')).toBeTruthy();
    expect(screen.getByText('until Flight')).toBeTruthy();
  });

  it('treats a value no date input would send as no date', () => {
    expect(countdownSettingsSchema.safeParse({ date: '25/12/2026' }).success).toBe(
      false,
    );
    expect(countdownSettingsSchema.safeParse({ time: '6pm' }).success).toBe(false);
  });
});
