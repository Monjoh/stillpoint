import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';

/**
 * Smoke test for the extension-API test harness, not for our own code — the storage
 * adapter it is standing in for arrives in M1. It exists so that a broken harness
 * fails here, with an obvious cause, instead of inside the first real storage test.
 */
describe('test harness: browser.storage.local', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('aliases wxt/browser onto the in-memory fake', () => {
    expect(browser.storage.local).toBe(fakeBrowser.storage.local);
  });

  it('round-trips a value', async () => {
    await browser.storage.local.set({ smoke: { ok: true } });
    await expect(browser.storage.local.get('smoke')).resolves.toEqual({
      smoke: { ok: true },
    });
  });

  it('clears state on reset, so tests cannot leak into each other', async () => {
    await browser.storage.local.set({ smoke: 1 });
    fakeBrowser.reset();
    await expect(browser.storage.local.get('smoke')).resolves.toEqual({});
  });
});
