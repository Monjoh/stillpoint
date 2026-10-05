import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarSettingsSchema } from './definition';
import CalendarView from './CalendarView';

const size = { width: 400, height: 360 };
const show = (overrides: Record<string, unknown> = {}, isEditing = false) =>
  render(
    <CalendarView
      settings={calendarSettingsSchema.parse(overrides)}
      size={size}
      isEditing={isEditing}
    />,
  );

describe('CalendarView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('shows this month, with today marked', () => {
    show({ weekStart: 'monday' });
    const grid = screen.getByRole('table', { name: 'October 2026' });
    const today = grid.querySelector('[aria-current="date"]');
    expect(today?.textContent).toBe('6');
    expect(today?.getAttribute('datetime')).toBe('2026-10-06');
    const headers = within(grid).getAllByRole('columnheader');
    expect(headers.map((th) => th.textContent)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(headers[0]!.getAttribute('abbr')).toBe('Monday');
  });

  it('starts the week on Sunday when asked', () => {
    show({ weekStart: 'sunday' });
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]!.textContent).toBe('Sun');
  });

  it('greys or hides the days of other months', () => {
    const { container, unmount } = show({ weekStart: 'monday' });
    // 28, 29 and 30 September lead into October.
    expect(container.querySelector('time[datetime="2026-09-28"]')).toBeTruthy();
    unmount();

    const hidden = show({ weekStart: 'monday', showOtherMonths: false });
    expect(hidden.container.querySelector('time[datetime="2026-09-28"]')).toBeNull();
    expect(hidden.container.querySelectorAll('time')).toHaveLength(31);
  });

  it('numbers the weeks when asked', () => {
    show({ weekStart: 'monday', showWeekNumbers: true });
    const rows = screen.getAllByRole('rowheader');
    expect(rows.map((th) => th.getAttribute('aria-label'))).toEqual([
      'Week 40',
      'Week 41',
      'Week 42',
      'Week 43',
      'Week 44',
      'Week 45',
    ]);
  });

  it('pages through the months and comes back to this one', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('table', { name: 'December 2026' })).toBeTruthy();
    expect(document.querySelector('[aria-current="date"]')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'December 2026' }));
    expect(screen.getByRole('table', { name: 'October 2026' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('table', { name: 'September 2026' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'September 2026' }).title).toBe(
      'Back to October 2026',
    );
  });

  it('keeps its buttons out of the tab order in edit mode', () => {
    show({}, true);
    for (const button of screen.getAllByRole('button')) {
      expect(button.tabIndex).toBe(-1);
    }
  });
});
