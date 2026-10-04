import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchSettingsSchema, type SearchSettings } from './definition';
import { openUrl } from './navigate';
import SearchView from './SearchView';

vi.mock('./navigate', () => ({ openUrl: vi.fn() }));

const size = { width: 400, height: 60 };
const settings = (overrides: Partial<SearchSettings> = {}) =>
  searchSettingsSchema.parse(overrides);

afterEach(() => vi.mocked(openUrl).mockClear());

describe('SearchView', () => {
  it('searches the chosen engine on Enter', async () => {
    render(<SearchView settings={settings()} size={size} isEditing={false} />);
    await userEvent.type(screen.getByRole('searchbox'), 'quiet places{Enter}');
    expect(openUrl).toHaveBeenCalledWith(
      'https://duckduckgo.com/?q=quiet%20places',
      false,
    );
  });

  it('opens a new tab when asked', async () => {
    render(
      <SearchView
        settings={settings({ engine: 'kagi', newTab: true })}
        size={size}
        isEditing={false}
      />,
    );
    await userEvent.type(screen.getByRole('searchbox'), 'x{Enter}');
    expect(openUrl).toHaveBeenCalledWith('https://kagi.com/search?q=x', true);
  });

  it('does nothing for an empty search', async () => {
    render(<SearchView settings={settings()} size={size} isEditing={false} />);
    await userEvent.type(screen.getByRole('searchbox'), '   {Enter}');
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('is labelled with the engine', () => {
    render(
      <SearchView
        settings={settings({ engine: 'ecosia' })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByLabelText('Search Ecosia')).toBeTruthy();
  });

  it('names a custom engine by its host', () => {
    render(
      <SearchView
        settings={settings({
          engine: 'custom',
          customUrl: 'https://www.example.org/?q=%s',
        })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByLabelText('Search example.org')).toBeTruthy();
  });

  it('asks for a usable address instead of a box that goes nowhere', () => {
    render(
      <SearchView
        settings={settings({ engine: 'custom' })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByText(/Set a search address/)).toBeTruthy();
  });

  it('takes focus on open', () => {
    render(<SearchView settings={settings()} size={size} isEditing={false} />);
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });

  it('does not take focus when turned off, or in edit mode', () => {
    const { unmount } = render(
      <SearchView
        settings={settings({ autofocus: false })}
        size={size}
        isEditing={false}
      />,
    );
    expect(document.activeElement).toBe(document.body);
    unmount();
    render(<SearchView settings={settings()} size={size} isEditing />);
    expect(document.activeElement).toBe(document.body);
  });

  it('does not take focus from something already focused', () => {
    const other = document.createElement('input');
    document.body.append(other);
    other.focus();
    render(<SearchView settings={settings()} size={size} isEditing={false} />);
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it('jumps to the box on /, but not while typing elsewhere', () => {
    render(
      <SearchView
        settings={settings({ autofocus: false })}
        size={size}
        isEditing={false}
      />,
    );
    const box = screen.getByRole('searchbox');

    const other = document.createElement('textarea');
    document.body.append(other);
    other.focus();
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(other);

    other.blur();
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(box);
    other.remove();
  });

  it('cannot be typed into in edit mode', () => {
    render(<SearchView settings={settings()} size={size} isEditing />);
    const box = screen.getByRole('searchbox');
    expect(box).toHaveProperty('readOnly', true);
    expect(box.tabIndex).toBe(-1);
  });
});
