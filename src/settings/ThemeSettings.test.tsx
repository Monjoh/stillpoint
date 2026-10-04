import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  profileSchema,
  type BackgroundConfig,
  type Profile,
} from '@/core/config/schema';
import { getPreset } from '@/core/theme/presets';
import { ThemeSettings } from './ThemeSettings';

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
  render(
    <ThemeSettings
      profile={p}
      onChangeTheme={onChangeTheme}
      onChangeBackground={onChangeBackground}
    />,
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
          fontScale: 1.4,
          overrides: { '--sp-accent': '#f00' },
        },
        background: { kind: 'solid', color: '#000' },
      }),
    );

    await userEvent.click(within(themes()).getByRole('radio', { name: 'Glass' }));
    expect(onChangeTheme).toHaveBeenCalledWith({
      preset: 'glass',
      fontScale: 1.4,
      overrides: { '--sp-accent': '#f00' },
    });
  });

  /**
   * Paper is dark text. Landing on the default near-black gradient it produces a page
   * nobody can read — including the panel's own way back out — so the preset brings
   * the background that prevents it.
   */
  it('brings the suggested background when the current one is a stock gradient', async () => {
    const { onChangeBackground } = setup();

    await userEvent.click(within(themes()).getByRole('radio', { name: 'Paper' }));
    expect(onChangeBackground).toHaveBeenCalledWith(
      getPreset('paper').suggestedBackground,
    );
  });

  // The other half of the same rule. Overwriting a deliberate choice to prevent a
  // hypothetical problem is the worse trade, so it is offered instead.
  it('leaves a background the user chose themselves alone', async () => {
    const chosen: BackgroundConfig = { kind: 'solid', color: '#402030' };
    const { onChangeBackground, onChangeTheme } = setup(
      profile({ background: chosen }),
    );

    await userEvent.click(within(themes()).getByRole('radio', { name: 'Paper' }));
    expect(onChangeTheme).toHaveBeenCalled();
    expect(onChangeBackground).not.toHaveBeenCalled();
  });

  it('offers the suggestion it declined to apply', async () => {
    const { onChangeBackground } = setup(
      profile({ preset: 'paper', background: { kind: 'solid', color: '#402030' } }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: /background Paper was designed for/i }),
    );
    expect(onChangeBackground).toHaveBeenCalledWith(
      getPreset('paper').suggestedBackground,
    );
  });

  it('says nothing about a suggestion once the page is already on it', () => {
    setup(
      profile({ preset: 'paper', background: getPreset('paper').suggestedBackground }),
    );
    expect(screen.queryByRole('button', { name: /designed for/i })).toBeNull();
  });

  it('generates the text size slider from the schema', () => {
    setup();
    expect(screen.getByLabelText('Text size')).toHaveProperty('type', 'range');
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
