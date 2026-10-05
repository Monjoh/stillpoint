import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { originHost, supportsDataCollection, usePermissions } from './permissions';

const ORIGIN = 'https://api.example.com/*';

describe('usePermissions: origins', () => {
  beforeEach(() => {
    // The fake browser declares these events but implements none of them.
    for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
      vi.spyOn(event, 'addListener').mockImplementation(() => {});
      vi.spyOn(event, 'removeListener').mockImplementation(() => {});
    }
  });

  it('needs nothing when no origin is asked for', () => {
    const contains = vi.spyOn(browser.permissions, 'contains');
    const { result } = renderHook(() => usePermissions({ origins: [] }));
    expect(result.current.state).toBe('granted');
    expect(contains).not.toHaveBeenCalled();
  });

  it('reports a granted origin', async () => {
    vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => true);
    const { result } = renderHook(() => usePermissions({ origins: [ORIGIN] }));
    expect(result.current.state).toBe('checking');
    await waitFor(() => expect(result.current.state).toBe('granted'));
  });

  it('asks for a missing origin from the click, and takes the answer', async () => {
    vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
    const request = vi
      .spyOn(browser.permissions, 'request')
      .mockImplementation(async () => true);
    const { result } = renderHook(() => usePermissions({ origins: [ORIGIN] }));
    await waitFor(() => expect(result.current.state).toBe('missing'));

    act(() => result.current.request());
    // Synchronously, inside the click: Firefox refuses a request made after an await.
    expect(request).toHaveBeenCalledWith({ origins: [ORIGIN] });
    await waitFor(() => expect(result.current.state).toBe('granted'));
  });

  it('stays missing when the user declines, or the browser throws', async () => {
    vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => {
      throw new Error('no');
    });
    vi.spyOn(browser.permissions, 'request').mockImplementation(async () => false);
    const { result } = renderHook(() => usePermissions({ origins: [ORIGIN] }));
    await waitFor(() => expect(result.current.state).toBe('missing'));
    act(() => result.current.request());
    await waitFor(() => expect(result.current.state).toBe('missing'));
  });
});

describe('usePermissions: data collection', () => {
  const firefoxManifest = {
    manifest_version: 3 as const,
    name: 'Stillpoint',
    version: '1.0.0',
    browser_specific_settings: {
      gecko: { data_collection_permissions: { required: ['none'] } },
    },
  };

  beforeEach(() => {
    for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
      vi.spyOn(event, 'addListener').mockImplementation(() => {});
      vi.spyOn(event, 'removeListener').mockImplementation(() => {});
    }
  });

  it('asks Firefox for the category, from the click', async () => {
    vi.spyOn(browser.runtime, 'getManifest').mockReturnValue(firefoxManifest);
    const contains = vi
      .spyOn(browser.permissions, 'contains')
      .mockImplementation(async () => false);
    const request = vi
      .spyOn(browser.permissions, 'request')
      .mockImplementation(async () => true);
    const { result } = renderHook(() =>
      usePermissions({ dataCollection: ['locationInfo'] }),
    );
    await waitFor(() => expect(result.current.state).toBe('missing'));
    expect(contains).toHaveBeenCalledWith({ data_collection: ['locationInfo'] });

    act(() => result.current.request());
    expect(request).toHaveBeenCalledWith({ data_collection: ['locationInfo'] });
    await waitFor(() => expect(result.current.state).toBe('granted'));
  });

  it('asks for origins and categories in one request', async () => {
    vi.spyOn(browser.runtime, 'getManifest').mockReturnValue(firefoxManifest);
    vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
    const request = vi
      .spyOn(browser.permissions, 'request')
      .mockImplementation(async () => true);
    const { result } = renderHook(() =>
      usePermissions({ origins: [ORIGIN], dataCollection: ['searchTerms'] }),
    );
    await waitFor(() => expect(result.current.state).toBe('missing'));
    act(() => result.current.request());
    expect(request).toHaveBeenCalledWith({
      origins: [ORIGIN],
      data_collection: ['searchTerms'],
    });
  });

  it('counts as granted where the manifest declares no data collection (Chrome)', () => {
    vi.spyOn(browser.runtime, 'getManifest').mockReturnValue({
      manifest_version: 3 as const,
      name: 'Stillpoint',
      version: '1.0.0',
    });
    const contains = vi.spyOn(browser.permissions, 'contains');
    expect(supportsDataCollection()).toBe(false);
    const { result } = renderHook(() =>
      usePermissions({ dataCollection: ['locationInfo'] }),
    );
    expect(result.current.state).toBe('granted');
    expect(contains).not.toHaveBeenCalled();
  });
});

describe('originHost', () => {
  it('names the host of a match pattern', () => {
    expect(originHost(ORIGIN)).toBe('api.example.com');
  });
});
