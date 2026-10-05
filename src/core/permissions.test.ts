import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { originHost, useOrigins } from './permissions';

const ORIGIN = 'https://query1.finance.yahoo.com/*';

describe('useOrigins', () => {
  beforeEach(() => {
    // The fake browser declares these events but implements none of them.
    for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
      vi.spyOn(event, 'addListener').mockImplementation(() => {});
      vi.spyOn(event, 'removeListener').mockImplementation(() => {});
    }
  });

  it('needs nothing when no origin is asked for', () => {
    const contains = vi.spyOn(browser.permissions, 'contains');
    const { result } = renderHook(() => useOrigins([]));
    expect(result.current.state).toBe('granted');
    expect(contains).not.toHaveBeenCalled();
  });

  it('reports a granted origin', async () => {
    vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => true);
    const { result } = renderHook(() => useOrigins([ORIGIN]));
    expect(result.current.state).toBe('checking');
    await waitFor(() => expect(result.current.state).toBe('granted'));
  });

  it('asks for a missing origin from the click, and takes the answer', async () => {
    vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
    const request = vi
      .spyOn(browser.permissions, 'request')
      .mockImplementation(async () => true);
    const { result } = renderHook(() => useOrigins([ORIGIN]));
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
    const { result } = renderHook(() => useOrigins([ORIGIN]));
    await waitFor(() => expect(result.current.state).toBe('missing'));
    act(() => result.current.request());
    await waitFor(() => expect(result.current.state).toBe('missing'));
  });
});

describe('originHost', () => {
  it('names the host of a match pattern', () => {
    expect(originHost(ORIGIN)).toBe('query1.finance.yahoo.com');
  });
});
