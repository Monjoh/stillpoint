import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { actAsFirefox } from '@/core/__fixtures__/permissions';
import type { BackgroundConfig, UnsplashBackground } from '@/core/config/schema';
import type { PhotoSource } from '@/core/unsplash/api';
import { StorageKeys } from '@/core/storage/adapter';
import { localAdapter } from '@/core/storage/local';
import { emptyState } from '@/core/unsplash/state';
import { UnsplashFields } from './UnsplashFields';

const unsplash: UnsplashBackground = {
  kind: 'unsplash',
  source: 'unsplash',
  query: 'mountains',
  refresh: 'daily',
  blur: 0,
  dim: 0,
};

function setup(
  background: BackgroundConfig,
  accessKey: string | null = 'k',
  source: PhotoSource = background.kind === 'unsplash' ? background.source : 'unsplash',
) {
  const onChangeBackground = vi.fn();
  const onChangeAccessKey = vi.fn();
  render(
    <UnsplashFields
      source={source}
      background={background}
      onChangeBackground={onChangeBackground}
      accessKey={accessKey}
      onChangeAccessKey={onChangeAccessKey}
    />,
  );
  return { onChangeBackground, onChangeAccessKey };
}

describe('UnsplashFields', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('runs Lorem Picsum with no setup, and leaves out the search it cannot do', () => {
    setup({ ...unsplash, source: 'picsum' }, null);
    expect(screen.getByRole('button', { name: 'Show another photo' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'New photo' })).toBeTruthy();
    expect(screen.queryByLabelText('Search')).toBeNull();
    expect(screen.queryByLabelText('Unsplash access key')).toBeNull();
    expect(screen.getByText(/via Lorem Picsum/)).toBeTruthy();
  });

  it('asks Unsplash for its key first, and shows nothing else until then', async () => {
    const { onChangeAccessKey } = setup({ kind: 'solid', color: '#000' }, null);
    expect(screen.getByText(/needs an access key/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show another photo' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Unsplash access key'), {
      target: { value: 'abc' },
    });
    expect(onChangeAccessKey).toHaveBeenLastCalledWith('abc');
  });

  it('offers search, timing, blur and dim, generated from the schema', () => {
    const { onChangeBackground } = setup(unsplash);
    expect(screen.getByRole('button', { name: 'Show another photo' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'New photo' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ocean' } });
    expect(onChangeBackground).toHaveBeenCalledWith({ ...unsplash, query: 'ocean' });
  });

  it('shows Picsum’s own trouble even with an Unsplash key saved', async () => {
    await localAdapter.set(StorageKeys.unsplash, {
      ...emptyState('mountains', 'picsum'),
      error: { kind: 'network', at: Date.now(), key: null },
    });
    setup({ ...unsplash, source: 'picsum' }, 'k');
    expect((await screen.findByRole('status')).textContent).toMatch(
      /could not be reached/,
    );
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

describe('UnsplashFields, where Firefox asks consent for sending search words', () => {
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => {
    // Unmount first: the consent hook removes its listeners on the way out.
    cleanup();
    vi.restoreAllMocks();
  });

  it('holds search back until the user allows it', async () => {
    const { request } = actAsFirefox({ granted: false });
    setup(unsplash);

    await userEvent.click(await screen.findByRole('button', { name: 'Allow search' }));
    expect(request).toHaveBeenCalledWith({ data_collection: ['searchTerms'] });
    expect(await screen.findByLabelText('Search')).toBeTruthy();
  });

  it('fetches no new photo by search before then', async () => {
    actAsFirefox({ granted: false });
    setup(unsplash);
    await screen.findByRole('button', { name: 'Allow search' });
    expect(screen.queryByLabelText('Search')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Show another photo' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('needs no consent without a key: Picsum sends no search words', () => {
    const { request } = actAsFirefox({ granted: false });
    setup(unsplash, null);
    expect(screen.queryByRole('button', { name: 'Allow search' })).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
