import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  profileSchema,
  type BackgroundConfig,
  type Profile,
} from '@/core/config/schema';
import { BackgroundFields, ThemeFields } from './ThemeSettings';

/**
 * The picker, and the one rule in it with teeth: choosing Paper must not leave the
 * user on a page they cannot read, and must not overwrite a background they chose.
 */

function profile(
  options: { preset?: string; background?: BackgroundConfig } = {},
): Profile {
  return profileSchema.parse({
    id: 'p1',
    name: 'Focus',
    theme: { preset: options.preset ?? 'midnight' },
    background: options.background ?? {
      kind: 'gradient',
      from: '#11131c',
      to: '#1d2033',
      angle: 160,
    },
  });
}

function setup(p: Profile = profile()) {
  const onChangeTheme = vi.fn();
  const onChangeBackground = vi.fn();
  // Both bodies together: they are two sections in the panel, but the contrast
  // warning is about the pairing, so the tests need them side by side.
  render(
    <>
      <ThemeFields profile={p} onChangeTheme={onChangeTheme} />
      <BackgroundFields profile={p} onChangeBackground={onChangeBackground} />
    </>,
  );
  return { onChangeTheme, onChangeBackground };
}

const themes = () => screen.getByRole('radiogroup', { name: 'Theme' });
const backgrounds = () => screen.getByRole('radiogroup', { name: 'Background' });

describe('the theme picker', () => {
  it('offers every preset and marks the active one', () => {
    setup(profile({ preset: 'terminal' }));
    const group = themes();

    for (const name of ['Midnight', 'Paper', 'Terminal', 'Glass']) {
      expect(within(group).getByRole('radio', { name })).toBeTruthy();
    }
    expect(
      within(group)
        .getByRole('radio', { name: 'Terminal' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      within(group)
        .getByRole('radio', { name: 'Midnight' })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('switches the preset without disturbing the rest of the theme', async () => {
    const { onChangeTheme } = setup(
      profileSchema.parse({
        id: 'p1',
        name: 'Focus',
        theme: {
          preset: 'midnight',
          overrides: { '--sp-accent': '#f00' },
        },
        background: { kind: 'solid', color: '#000' },
      }),
    );

    await userEvent.click(within(themes()).getByRole('radio', { name: 'Glass' }));
    expect(onChangeTheme).toHaveBeenCalledWith({
      preset: 'glass',
      overrides: { '--sp-accent': '#f00' },
    });
  });

  /**
   * The rule that replaced an auto-applied background. A theme and a background are
   * independent choices, so changing one must not quietly discard the other — and
   * what stops an unreadable page is measuring the result, not preventing the
   * combination.
   */
  it('never touches the background', async () => {
    const { onChangeBackground } = setup();

    await userEvent.click(within(themes()).getByRole('radio', { name: 'Paper' }));
    expect(onChangeBackground).not.toHaveBeenCalled();
  });
});

describe('the contrast warning', () => {
  // Paper is dark text; the default gradient is near-black. Legitimate to choose,
  // but the user should be told rather than left wondering why the page went blank.
  it('fires on a pairing that is genuinely unreadable', () => {
    setup(profile({ preset: 'paper' }));
    expect(screen.getByRole('status').textContent).toMatch(
      /Paper text is hard to read/,
    );
  });

  it('quotes the measured ratio rather than just asserting it is bad', () => {
    setup(profile({ preset: 'paper' }));
    expect(screen.getByRole('status').textContent).toMatch(/contrast \d+\.\d:1/);
  });

  it('stays quiet on a pairing that works', () => {
    setup(profile({ preset: 'midnight' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('follows the background as well as the theme', () => {
    setup(
      profile({
        preset: 'paper',
        background: { kind: 'gradient', from: '#f7f2e8', to: '#e8e0d1', angle: 160 },
      }),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('the background picker', () => {
  it('offers the curated gradients and marks the one in use', () => {
    setup();
    const group = backgrounds();

    expect(within(group).getAllByRole('radio')).toHaveLength(10);
    expect(
      within(group)
        .getByRole('radio', { name: 'Midnight' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('applies a gradient as stops and an angle, not as a swatch id', async () => {
    const { onChangeBackground } = setup();

    await userEvent.click(within(backgrounds()).getByRole('radio', { name: 'Paper' }));
    expect(onChangeBackground).toHaveBeenCalledWith({
      kind: 'gradient',
      from: '#f7f2e8',
      to: '#e8e0d1',
      angle: 160,
    });
  });

  // An import or a hand-edited export can carry anything. Ten swatches with none
  // selected and no explanation is worse than saying so.
  it('explains a background that is none of the ten', () => {
    setup(profile({ background: { kind: 'solid', color: '#402030' } }));
    expect(screen.getByText(/not one of these/i)).toBeTruthy();
    for (const radio of within(backgrounds()).getAllByRole('radio')) {
      expect(radio.getAttribute('aria-checked')).toBe('false');
    }
  });
});
