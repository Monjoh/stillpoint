import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { linksSettingsSchema, type LinksSettings } from './definition';
import LinksView from './LinksView';

const size = { width: 800, height: 200 };
const settings = (overrides: Partial<LinksSettings> = {}) =>
  linksSettingsSchema.parse(overrides);
const two = [
  { url: 'github.com', label: 'GitHub' },
  { url: 'https://www.wikipedia.org', label: '' },
];

afterEach(() => localStorage.clear());

describe('LinksView', () => {
  it('links to each site under its name', () => {
    render(
      <LinksView settings={settings({ links: two })} size={size} isEditing={false} />,
    );
    expect(screen.getByRole('link', { name: /GitHub/ }).getAttribute('href')).toBe(
      'https://github.com/',
    );
    expect(screen.getByRole('link', { name: /wikipedia\.org/ })).toBeTruthy();
  });

  it('loads the icon from the site itself, touch icon first', () => {
    const { container } = render(
      <LinksView settings={settings({ links: two })} size={size} isEditing={false} />,
    );
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://github.com/apple-touch-icon.png');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('falls back to favicon.ico, then to the letter, and remembers', () => {
    const { container, unmount } = render(
      <LinksView
        settings={settings({ links: [two[0]!] })}
        size={size}
        isEditing={false}
      />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')!.getAttribute('src')).toBe(
      'https://github.com/favicon.ico',
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('G')).toBeTruthy();
    unmount();

    // The next tab does not ask again.
    const again = render(
      <LinksView
        settings={settings({ links: [two[0]!] })}
        size={size}
        isEditing={false}
      />,
    );
    expect(again.container.querySelector('img')).toBeNull();
  });

  it('never fetches an icon from a local address, which would make Firefox ask', () => {
    const { container } = render(
      <LinksView
        settings={settings({ links: [{ url: '192.168.1.1', label: 'Router' }] })}
        size={size}
        isEditing={false}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('R')).toBeTruthy();
  });

  it('names icon-only links for screen readers', () => {
    render(
      <LinksView
        settings={settings({ links: two, layout: 'icons' })}
        size={size}
        isEditing={false}
      />,
    );
    const link = screen.getByRole('link', { name: 'GitHub' });
    expect(link.getAttribute('title')).toBe('GitHub');
  });

  it('opens in a new tab when asked, without telling the site where from', () => {
    render(
      <LinksView
        settings={settings({ links: two, newTab: true })}
        size={size}
        isEditing={false}
      />,
    );
    const link = screen.getByRole('link', { name: /GitHub/ });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('skips addresses it cannot open', () => {
    render(
      <LinksView
        settings={settings({
          links: [...two, { url: 'javascript:alert(1)', label: 'Bad' }],
        })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('says what to do when there are no links', () => {
    render(<LinksView settings={settings()} size={size} isEditing={false} />);
    expect(screen.getByText(/Add your sites/)).toBeTruthy();
  });

  it('says so when no address can be opened', () => {
    render(
      <LinksView
        settings={settings({ links: [{ url: 'mailto:x@y.z', label: '' }] })}
        size={size}
        isEditing={false}
      />,
    );
    expect(screen.getByText(/can be opened/)).toBeTruthy();
  });

  it('takes the links out of the tab order in edit mode', () => {
    render(<LinksView settings={settings({ links: two })} size={size} isEditing />);
    for (const link of screen.getAllByRole('link')) expect(link.tabIndex).toBe(-1);
  });
});
