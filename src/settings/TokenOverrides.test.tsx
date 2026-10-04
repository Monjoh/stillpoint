import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeConfig } from '@/core/config/schema';
import { THEME_TOKENS } from '@/core/theme/tokens';
import { TokenOverrides } from './TokenOverrides';

/** Controlled, as the store is: a write comes back as the next `theme` prop. */
function setup(theme: Partial<ThemeConfig> = {}) {
  const onChangeTheme = vi.fn();
  const initial: ThemeConfig = { preset: 'midnight', overrides: {}, ...theme };

  function Harness() {
    const [current, setCurrent] = useState(initial);
    return (
      <TokenOverrides
        theme={current}
        onChangeTheme={(next) => {
          onChangeTheme(next);
          setCurrent(next);
        }}
      />
    );
  }

  render(<Harness />);
  return { onChangeTheme };
}

const lastOverrides = (fn: ReturnType<typeof vi.fn>) =>
  (fn.mock.lastCall?.[0] as ThemeConfig).overrides;

describe('TokenOverrides', () => {
  it('offers a labelled control for every token in the vocabulary', () => {
    setup();
    for (const spec of THEME_TOKENS) {
      expect(
        screen.getAllByLabelText(new RegExp(`^${spec.label}`)).length,
      ).toBeGreaterThan(0);
    }
  });

  it('shows the preset’s value where nothing is overridden', () => {
    setup();
    expect(screen.getByLabelText<HTMLInputElement>('Accent, colour value').value).toBe(
      '#7aa2f7',
    );
  });

  it('writes a typed colour once it parses, and not before', async () => {
    const { onChangeTheme } = setup();
    const input = screen.getByLabelText('Accent, colour value');

    await userEvent.clear(input);
    await userEvent.type(input, '#f');
    // `#f` is a colour on its way somewhere; repainting with it would flash.
    expect(onChangeTheme).not.toHaveBeenCalled();
    await userEvent.type(input, 'f8800');
    expect(lastOverrides(onChangeTheme)).toEqual({ '--sp-accent': '#ff8800' });
  });

  it('keeps a translucent token translucent when picked from the swatch', () => {
    const { onChangeTheme } = setup();
    // Midnight's surface is white at 6%. The picker cannot show alpha, so it must
    // not reset it: an opaque white widget surface is a different theme.
    fireEvent.change(screen.getByLabelText('Widget surface, colour picker'), {
      target: { value: '#ff0000' },
    });
    expect(lastOverrides(onChangeTheme)).toEqual({
      '--sp-surface': 'rgb(255 0 0 / 0.06)',
    });
  });

  it('stays sparse: setting a token back to the preset removes the override', () => {
    const { onChangeTheme } = setup({ overrides: { '--sp-radius': '4px' } });
    fireEvent.change(screen.getByLabelText('Corner radius'), {
      target: { value: '10' },
    });
    expect(lastOverrides(onChangeTheme)).toEqual({});
  });

  it('writes lengths in px', () => {
    const { onChangeTheme } = setup();
    fireEvent.change(screen.getByLabelText('Corner radius'), {
      target: { value: '0' },
    });
    expect(lastOverrides(onChangeTheme)).toEqual({ '--sp-radius': '0px' });
  });

  it('clears a font override by choosing the theme default', async () => {
    const { onChangeTheme } = setup({
      overrides: { '--sp-font-display': 'Georgia, serif', '--sp-accent': '#f00' },
    });
    await userEvent.selectOptions(
      screen.getByLabelText('Display font'),
      'Theme default',
    );
    expect(lastOverrides(onChangeTheme)).toEqual({ '--sp-accent': '#f00' });
  });

  it('offers shadows as named choices', async () => {
    const { onChangeTheme } = setup();
    await userEvent.selectOptions(screen.getByLabelText('Widget shadow'), 'None');
    expect(lastOverrides(onChangeTheme)).toEqual({ '--sp-shadow': 'none' });
  });

  it('marks changed tokens with a reset, and only those', async () => {
    const { onChangeTheme } = setup({ overrides: { '--sp-accent': '#ff8800' } });
    const resets = screen.getAllByRole('button', { name: /^Reset / });
    expect(resets).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /Reset Accent/ }));
    expect(lastOverrides(onChangeTheme)).toEqual({});
  });

  it('keeps the rest of the theme when it writes', async () => {
    const { onChangeTheme } = setup({ preset: 'paper' });
    await userEvent.selectOptions(screen.getByLabelText('Widget shadow'), 'Strong');
    expect(onChangeTheme.mock.lastCall?.[0]).toMatchObject({ preset: 'paper' });
  });
});
