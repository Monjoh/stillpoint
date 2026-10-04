import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { BackgroundConfig, UnsplashBackground } from '@/core/config/schema';
import { StorageKeys } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import { emptyState } from '@/core/unsplash/state';
import { UnsplashFields } from './UnsplashFields';

const unsplash: UnsplashBackground = {
  kind: 'unsplash',
  query: 'mountains',
  refresh: 'daily',
  blur: 0,
  dim: 0,
};

function setup(background: BackgroundConfig, accessKey: string | null = 'k') {
  const onChangeBackground = vi.fn();
  render(
    <UnsplashFields
      background={background}
      onChangeBackground={onChangeBackground}
      accessKey={accessKey}
    />,
  );
  return { onChangeBackground };
}

describe('UnsplashFields', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('switches to Unsplash, keeping the blur and dim chosen for a photo', async () => {
    const { onChangeBackground } = setup(
      { kind: 'image', assetId: 'a', fit: 'cover', blur: 8, dim: 0.3 },
      null,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Photos from Unsplash' }));
    expect(onChangeBackground).toHaveBeenCalledWith({
      kind: 'unsplash',
      query: 'landscape',
      refresh: 'daily',
      blur: 8,
      dim: 0.3,
    });
  });

  // Works with nothing set up. Only search needs a key, so only Search is missing.
  it('works without a key, and leaves out the search it cannot do', () => {
    setup(unsplash, null);
    expect(screen.getByRole('button', { name: 'Show another photo' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'New photo' })).toBeTruthy();
    expect(screen.queryByLabelText('Search')).toBeNull();
    expect(screen.getByText(/via Lorem Picsum/)).toBeTruthy();
  });

  it('offers search, timing, blur and dim, generated from the schema', () => {
    const { onChangeBackground } = setup(unsplash);
    expect(screen.getByRole('button', { name: 'Show another photo' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'New photo' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ocean' } });
    expect(onChangeBackground).toHaveBeenCalledWith({ ...unsplash, query: 'ocean' });
  });

  it('says what went wrong with Unsplash, in words', async () => {
    await localAdapter.set(StorageKeys.unsplash, {
      ...emptyState('mountains'),
      error: { kind: 'key', at: Date.now(), key: 'k' },
    });
    setup(unsplash);
    expect((await screen.findByRole('status')).textContent).toMatch(
      /did not accept this key/,
    );
  });

  it('does not blame a new key for the old one’s refusal', async () => {
    await localAdapter.set(StorageKeys.unsplash, {
      ...emptyState('mountains'),
      error: { kind: 'key', at: Date.now(), key: 'old' },
    });
    setup(unsplash, 'new');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
