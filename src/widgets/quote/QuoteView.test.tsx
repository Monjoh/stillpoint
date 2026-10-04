import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { quoteSettingsSchema, type QuoteSettings } from './definition';
import QuoteView from './QuoteView';

const size = { width: 600, height: 200 };
const settings = (overrides: Partial<QuoteSettings> = {}) =>
  quoteSettingsSchema.parse(overrides);

describe('QuoteView', () => {
  it('shows a built-in quote with its author', () => {
    const { container } = render(
      <QuoteView settings={settings()} size={size} isEditing={false} />,
    );
    expect(container.querySelector('blockquote')?.textContent).not.toBe('');
    expect(container.querySelector('figcaption')?.textContent).not.toBe('');
  });

  it('shows only the user’s quotes when the built-in ones are off', () => {
    render(
      <QuoteView
        settings={settings({
          builtIn: false,
          mine: [
            { text: '  Mine, and only mine.  ', author: 'Me' },
            { text: '   ', author: 'Blank, so skipped' },
          ],
        })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByText('Mine, and only mine.')).toBeTruthy();
    expect(screen.getByText('Me')).toBeTruthy();
  });

  it('leaves out the author line for a quote without one', () => {
    const { container } = render(
      <QuoteView
        settings={settings({
          builtIn: false,
          mine: [{ text: 'Anonymous.', author: '' }],
        })}
        size={size}
        isEditing={false}
      />,
    );
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('hides the author when asked', () => {
    const { container } = render(
      <QuoteView
        settings={settings({ showAuthor: false })}
        size={size}
        isEditing={false}
      />,
    );
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('says how to fix an empty pool instead of showing a blank box', () => {
    render(
      <QuoteView
        settings={settings({ builtIn: false })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByText(/No quotes to show/)).toBeTruthy();
  });
});
