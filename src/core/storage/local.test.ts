import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { StorageKeys } from './adapter';
import { localAdapter } from './local';

describe('localAdapter', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns null for a key that was never written', async () => {
    await expect(localAdapter.get('config')).resolves.toBeNull();
  });

  it('round-trips a nested value', async () => {
    const value = { a: [1, 2, { b: true }] };
    await localAdapter.set('config', value);
    await expect(localAdapter.get('config')).resolves.toEqual(value);
  });

  it('removes', async () => {
    await localAdapter.set('config', 1);
    await localAdapter.remove('config');
    await expect(localAdapter.get('config')).resolves.toBeNull();
  });

  it('notifies watchers of changes to the watched key only', async () => {
    const seen: unknown[] = [];
    const stop = localAdapter.watch('config', (value) => seen.push(value));

    await browser.storage.local.set({ config: { version: 1 } });
    await browser.storage.local.set({ 'assets/a1': 'ignored' });

    expect(seen).toEqual([{ version: 1 }]);
    stop();
  });

  it('reports a removal as null', async () => {
    await localAdapter.set('config', { version: 1 });

    const seen: unknown[] = [];
    const stop = localAdapter.watch('config', (value) => seen.push(value));
    await browser.storage.local.remove('config');

    expect(seen).toEqual([null]);
    stop();
  });

  it('stops notifying after unsubscribe', async () => {
    const cb = vi.fn();
    const stop = localAdapter.watch('config', cb);
    stop();

    await browser.storage.local.set({ config: 1 });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('StorageKeys', () => {
  it('namespaces keys with /', () => {
    expect(StorageKeys.asset('a1')).toBe('assets/a1');
    expect(StorageKeys.widgetCache('stillpoint.weather', '48.85,2.35')).toBe(
      'cache/stillpoint.weather/48.85,2.35',
    );
    expect(StorageKeys.configBackup(1)).toBe('config.backup.v1');
  });
});
